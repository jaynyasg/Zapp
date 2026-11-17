import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { openDatabase, repository, id, now } from "./db.js";
import { providerConfig } from "./ai.js";
import { installLearning } from "./learning.js";
import { installCollection } from "./collection.js";
import { installGarden } from "./garden.js";
import { installProjects } from "./projects.js";

const scrypt = promisify(scryptCallback);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const error = (status, message) =>
  Object.assign(new Error(message), { status });
const text = z.string().trim().min(1).max(200);
const procedureSchema = z.object({
  title: text,
  summary: z.string().max(12000).default(""),
  steps: z.array(z.string().min(1).max(2000)).max(50).default([]),
  questions: z.array(z.string().max(1000)).max(20).default([]),
  gaps: z.array(z.string().max(1000)).max(30).default([]),
});
const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw error(400, r.error.issues[0].message);
  return r.data;
};

export function createApp({
  dataDir = resolve("data"),
  aiEnabled = providerConfig().aiEnabled,
  respond,
  allowLocalAccounts = process.env.NODE_ENV !== "production" &&
    ["127.0.0.1", "localhost", "::1"].includes(process.env.HOST || "127.0.0.1"),
} = {}) {
  const db = openDatabase(dataDir),
    repo = repository(db),
    app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests:
            process.env.COOKIE_SECURE === "true" ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      const allowed =
        process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;
      if (
        req.headers.origin !== allowed &&
        !(
          process.env.NODE_ENV !== "production" &&
          req.headers.origin === "http://127.0.0.1:5173"
        )
      )
        return next(error(403, "Request origin is not allowed."));
    }
    next();
  });
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many sign-in attempts. Try again later." },
    }),
  );
  const cookie = (res, token, maxAge = 7 * 86400000) =>
    res.cookie("mg_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge,
      path: "/",
    });
  function session(req, res, user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      hash(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    cookie(res, token);
  }
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
  const localAccountAllowed = (req, user) =>
    user.email.includes("@") ||
    (allowLocalAccounts &&
      ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      ));
  app.post("/api/auth/register", async (req, res) => {
    const b = parse(
      z.object({
        name: text,
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(12).max(128),
      }),
      req.body,
    );
    const salt = randomBytes(16).toString("hex"),
      key = (await scrypt(b.password, salt, 64)).toString("hex");
    const user = { id: id(), ...b };
    try {
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
        user.id,
        b.name,
        b.email,
        `${salt}:${key}`,
        now(),
      );
    } catch (e) {
      if (e.message.includes("UNIQUE"))
        throw error(409, "An account with that email already exists.");
      throw e;
    }
    session(req, res, user);
    res.status(201).json(publicUser(user));
  });
  app.post("/api/auth/login", async (req, res) => {
    const b = parse(
      z.object({
        email: z
          .string()
          .trim()
          .min(1)
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(128),
      }),
      req.body,
    );
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(b.email);
    const [salt, expected] = (
      user?.password || `${"0".repeat(32)}:${"0".repeat(128)}`
    ).split(":");
    const actual = await scrypt(b.password, salt, 64);
    if (
      !user ||
      !localAccountAllowed(req, user) ||
      !timingSafeEqual(actual, Buffer.from(expected, "hex"))
    )
      throw error(401, "Email or password is incorrect.");
    session(req, res, user);
    res.json(publicUser(user));
  });
  app.use("/api", (req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("mg_session="))
      ?.slice(11);
    const row =
      token &&
      db
        .prepare(
          "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(hash(token), Date.now());
    if (!row || !localAccountAllowed(req, row))
      return next(error(401, "Please sign in to continue."));
    req.user = publicUser(row);
    req.sessionHash = hash(token);
    next();
  });
  app.get("/api/auth/me", (req, res) => res.json(req.user));
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.sessionHash);
    cookie(res, "", 0);
    res.json({ ok: true });
  });
  app.get("/api/config", (req, res) =>
    res.json({
      aiEnabled,
      provider: providerConfig().provider === "openai" ? "OpenAI" : "Anthropic",
      maxUploadMB: 100,
      videoAnalysis: "Visual frames only; audio is not transcribed.",
    }),
  );
  app.get("/api/workspaces", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT w.*,m.role FROM workspaces w JOIN members m ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY w.created",
        )
        .all(req.user.id),
    ),
  );
  app.post("/api/workspaces", (req, res) => {
    const b = parse(
      z.object({ name: text, kind: z.enum(["home", "facility"]) }),
      req.body,
    );
    const wid = id();
    repo.transaction(() => {
      db.prepare("INSERT INTO workspaces VALUES(?,?,?,?)").run(
        wid,
        b.name,
        b.kind,
        now(),
      );
      db.prepare("INSERT INTO members VALUES(?,?,?)").run(
        wid,
        req.user.id,
        "owner",
      );
      repo.audit(wid, req.user.id, "workspace.created", b.name);
    });
    res.status(201).json({ id: wid, ...b, role: "owner" });
  });
  app.use("/api/workspaces/:wid", (req, res, next) => {
    const m = db
      .prepare("SELECT role FROM members WHERE workspace_id=? AND user_id=?")
      .get(req.params.wid, req.user.id);
    if (!m)
      return next(error(403, "You do not have access to this workspace."));
    req.wid = req.params.wid;
    req.role = m.role;
    next();
  });
  const base = "/api/workspaces/:wid";
  const allow = (req, roles) => {
    if (!roles.includes(req.role))
      throw error(403, "Your role does not permit this action.");
  };
  const get = (req, type) => {
    const r = repo.get(req.wid, type, req.params.rid);
    if (!r) throw error(404, "Record not found.");
    return r;
  };
  const save = (req, type, data, action) =>
    repo.transaction(() => {
      const r = repo.put(req.wid, type, data);
      repo.audit(req.wid, req.user.id, action, r.title || r.id);
      return r;
    });
  app.get(`${base}/members`, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY u.name",
        )
        .all(req.wid),
    ),
  );
  app.post(`${base}/members`, (req, res) => {
    allow(req, ["owner"]);
    const b = parse(
      z.object({
        email: z.email().transform((v) => v.toLowerCase()),
        role: z.enum(["member", "reviewer"]),
      }),
      req.body,
    );
    const user = db.prepare("SELECT id FROM users WHERE email=?").get(b.email);
    if (!user)
      throw error(
        404,
        "That person must create an account before you can add them.",
      );
    if (
      db
        .prepare("SELECT 1 FROM members WHERE workspace_id=? AND user_id=?")
        .get(req.wid, user.id)
    )
      throw error(409, "This person is already a member.");
    repo.transaction(() => {
      db.prepare("INSERT INTO members VALUES(?,?,?)").run(
        req.wid,
        user.id,
        b.role,
      );
      repo.audit(req.wid, req.user.id, "member.added", b.email);
    });
    res.status(201).json({ ok: true });
  });
  app.get(`${base}/audit`, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT a.*,COALESCE(u.name,'Media processor') AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor WHERE workspace_id=? ORDER BY a.created DESC LIMIT 500",
        )
        .all(req.wid),
    ),
  );
  app.get(`${base}/journals`, (req, res) =>
    res.json(repo.list(req.wid, "journal")),
  );
  app.post(`${base}/journals`, (req, res) => {
    const b = parse(
      z.object({ title: text, body: z.string().trim().min(1).max(20000) }),
      req.body,
    );
    res
      .status(201)
      .json(
        save(
          req,
          "journal",
          { ...b, author: req.user.name },
          "journal.created",
        ),
      );
  });
  app.get(`${base}/procedures`, (req, res) =>
    res.json(repo.list(req.wid, "procedure")),
  );
  app.post(`${base}/procedures`, (req, res) => {
    allow(req, ["owner", "reviewer"]);
    res.status(201).json(
      save(
        req,
        "procedure",
        {
          ...parse(procedureSchema, req.body),
          version: 1,
          status: "draft",
          author: req.user.name,
        },
        "procedure.created",
      ),
    );
  });
  app.patch(`${base}/procedures/:rid`, (req, res) => {
    allow(req, ["owner", "reviewer"]);
    const p = get(req, "procedure");
    if (p.status !== "draft")
      throw error(
        409,
        "Create a revision to edit an approved procedure, or return a review to draft.",
      );
    if (req.body.version !== p.version)
      throw error(409, "This draft has changed. Reload before saving.");
    res.json(
      save(
        req,
        "procedure",
        { ...p, ...parse(procedureSchema, req.body), version: p.version + 1 },
        "procedure.updated",
      ),
    );
  });
  for (const action of ["submit", "approve", "return", "revise"])
    app.post(`${base}/procedures/:rid/${action}`, (req, res) => {
      allow(req, action === "approve" ? ["owner"] : ["owner", "reviewer"]);
      const p = get(req, "procedure");
      if (req.body.version !== p.version)
        throw error(
          409,
          "This version has changed. Reload and review it again.",
        );
      const expected = {
        submit: "draft",
        approve: "review",
        return: "review",
        revise: "approved",
      }[action];
      if (p.status !== expected)
        throw error(409, `This action requires a ${expected} procedure.`);
      if (["submit", "approve"].includes(action) && !p.steps.length)
        throw error(400, "Add at least one evidenced step before submitting.");
      const revised =
        action === "revise"
          ? {
              ...p,
              id: id(),
              status: "draft",
              version: 1,
              revisionOf: p.id,
              createdAt: now(),
              approvedAt: null,
              approvedBy: null,
            }
          : {
              ...p,
              status: {
                submit: "review",
                approve: "approved",
                return: "draft",
              }[action],
            };
      if (action === "approve") {
        revised.approvedAt = now();
        revised.approvedBy = req.user.name;
      }
      res
        .status(action === "revise" ? 201 : 200)
        .json(save(req, "procedure", revised, `procedure.${action}`));
    });
  app.get(`${base}/procedures/:rid/export`, (req, res) => {
    const p = get(req, "procedure");
    res
      .type("text/markdown")
      .attachment("procedure.md")
      .send(
        `# ${p.title}\n\nStatus: ${p.status} · Version ${p.version}\n\n${p.summary}\n\n## Checklist\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n## Knowledge check\n${p.questions.map((q) => `- ${q}`).join("\n")}\n\n## Evidence gaps\n${p.gaps.map((g) => `- ${g}`).join("\n")}\n\nSource: ${p.sourceId || "Manually authored"}\n`,
      );
  });
  app.get(`${base}/assignments`, (req, res) => {
    const rows = repo.list(req.wid, "assignment");
    res.json(
      req.role === "member"
        ? rows.filter((r) => r.userId === req.user.id)
        : rows,
    );
  });
  app.post(`${base}/assignments`, (req, res) => {
    allow(req, ["owner", "reviewer"]);
    const b = parse(
      z.object({
        procedureId: z.uuid(),
        userId: z.uuid(),
        dueDate: z.iso.date(),
      }),
      req.body,
    );
    const p = repo.get(req.wid, "procedure", b.procedureId);
    if (!p || p.status !== "approved")
      throw error(400, "Choose an approved procedure.");
    const user = db
      .prepare(
        "SELECT u.* FROM users u JOIN members m ON m.user_id=u.id WHERE m.workspace_id=? AND u.id=?",
      )
      .get(req.wid, b.userId);
    if (!user) throw error(400, "Choose a member of this workspace.");
    if (
      repo
        .list(req.wid, "assignment")
        .some(
          (a) =>
            a.userId === b.userId && a.procedureId === p.id && !a.completedAt,
        )
    )
      throw error(
        409,
        "This member already has an open assignment for this procedure.",
      );
    res.status(201).json(
      save(
        req,
        "assignment",
        {
          ...b,
          snapshot: p,
          title: p.title,
          assignee: user.name,
          completedAt: null,
        },
        "training.assigned",
      ),
    );
  });
  app.post(`${base}/assignments/:rid/complete`, (req, res) => {
    const a = get(req, "assignment");
    if (a.userId !== req.user.id)
      throw error(
        403,
        "Only the assigned person can acknowledge this training.",
      );
    if (a.completedAt) return res.json(a);
    res.json(
      save(
        req,
        "assignment",
        { ...a, completedAt: now() },
        "training.acknowledged",
      ),
    );
  });
  const upload = multer({
    dest: join(dataDir, "uploads"),
    limits: {
      fileSize: 100 * 1024 * 1024,
      files: 1,
      fields: 4,
      fieldSize: 2000,
    },
  });
  app.get(`${base}/media`, (req, res) =>
    res.json(repo.list(req.wid, "media").map(({ storedName, ...m }) => m)),
  );
  app.post(`${base}/media`, upload.single("file"), async (req, res) => {
    if (!req.file) throw error(400, "Choose a picture, video or document.");
    try {
      const b = parse(
        z.object({
          title: text,
          analyze: z.enum(["true", "false"]).default("false"),
        }),
        req.body,
      );
      const bytes = await readFile(req.file.path);
      let mime = null;
      if (bytes.toString("ascii", 0, 5) === "%PDF-") {
        if (bytes.length > 10 * 1024 * 1024)
          throw error(413, "PDF documents must be under 10 MB.");
        mime = "application/pdf";
      }
      if (
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        mime = "image/png";
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        mime = "image/jpeg";
      else if (
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      )
        mime = "image/webp";
      else if (bytes.toString("ascii", 4, 8) === "ftyp") mime = "video/mp4";
      else if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
        mime = "video/webm";
      else if (
        /\.(txt|md)$/i.test(req.file.originalname) &&
        bytes.length <= 1024 * 1024 &&
        !bytes.includes(0)
      )
        mime = "text/plain";
      if (!mime)
        throw error(
          415,
          "Unsupported content. Use JPG, PNG, WebP, MP4, WebM, PDF, TXT or MD.",
        );
      if (!bytes.length) throw error(400, "The file is empty.");
      const status =
        b.analyze === "true"
          ? aiEnabled
            ? "queued"
            : "waiting_configuration"
          : "stored";
      const r = save(
        req,
        "media",
        {
          title: b.title,
          filename: req.file.originalname,
          mime,
          size: bytes.length,
          storedName: req.file.filename,
          status,
          uploadedBy: req.user.name,
          processingError: null,
        },
        "media.uploaded",
      );
      const { storedName, ...safe } = r;
      res.status(201).json(safe);
    } catch (e) {
      await unlink(req.file.path).catch(() => {});
      throw e;
    }
  });
  app.get(`${base}/media/:rid/file`, (req, res) => {
    const m = get(req, "media");
    res.set("Content-Type", m.mime);
    res.set(
      "Content-Disposition",
      `${m.mime === "text/plain" || m.mime === "application/pdf" ? "attachment" : "inline"}; filename="media.${m.mime.split("/")[1]}"`,
    );
    res.sendFile(resolve(dataDir, "uploads", m.storedName));
  });
  app.post(`${base}/media/:rid/retry`, (req, res) => {
    if (!aiEnabled)
      throw error(
        503,
        "AI processing is not configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY on the server and restart.",
      );
    const m = get(req, "media");
    if (["queued", "processing", "draft"].includes(m.status))
      throw error(409, "This media is processing or already has a draft.");
    res.json(
      save(
        req,
        "media",
        { ...m, status: "queued", processingError: null },
        "media.processing_requested",
      ),
    );
  });
  app.delete(`${base}/media/:rid`, async (req, res) => {
    allow(req, ["owner"]);
    const m = get(req, "media");
    if (["queued", "processing"].includes(m.status))
      throw error(409, "Wait for processing to finish before deleting.");
    if (
      repo.list(req.wid, "procedure").some((p) => p.sourceId === m.id) ||
      repo.list(req.wid, "observation").some((o) => o.mediaId === m.id)
    )
      throw error(
        409,
        "This file is evidence for a procedure or collection record and must be retained.",
      );
    repo.transaction(() => {
      db.prepare("DELETE FROM records WHERE id=?").run(m.id);
      repo.audit(req.wid, req.user.id, "media.deleted", m.title);
    });
    await unlink(join(dataDir, "uploads", m.storedName)).catch(() => {});
    res.json({ ok: true });
  });
  installCollection({ app, repo, base, get, save, parse, error });
  installGarden({ app, repo, base, get, save, parse, error });
  installProjects({ app, repo, base, get, save, parse, error });
  installLearning({
    app,
    repo,
    db,
    base,
    allow,
    get,
    save,
    parse,
    error,
    aiEnabled,
    respond,
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (req, res, next) =>
    res.sendFile(resolve("dist/index.html"), (e) => e && next(e)),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err.code === "LIMIT_FILE_SIZE"
        ? 413
        : err instanceof multer.MulterError
          ? 400
          : err.status || 500;
    if (status >= 500 && status !== 503)
      console.error("Request failed:", err.name);
    res.status(status).json({
      error:
        status >= 500 && status !== 503
          ? "Something went wrong. Please retry."
          : err.code === "LIMIT_FILE_SIZE"
            ? "File exceeds the 100 MB limit."
            : err.message,
    });
  });
  return { app, db, repo };
}
