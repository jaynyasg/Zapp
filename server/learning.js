import { z } from "zod";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { now } from "./db.js";
import { structuredResponse, scope } from "./ai.js";

export function lessonFromProcedure(repo, wid, p, status = "draft") {
  return repo.put(wid, "lesson", {
    title: p.title,
    summary: p.summary,
    steps: p.steps,
    questions: p.questions,
    gaps: p.gaps,
    sourceId: p.sourceId,
    procedureId: p.id,
    procedureVersion: p.version,
    status,
    version: 1,
  });
}
const feedbackSchema = z.object({
  allowed: z.boolean(),
  reply: z.string().max(12000),
  observations: z.array(z.string().max(2000)).max(12),
  uncertainties: z.array(z.string().max(2000)).max(12),
});
const jsonSchema = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    reply: { type: "string" },
    observations: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["allowed", "reply", "observations", "uncertainties"],
  additionalProperties: false,
};

export function installLearning({
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
  respond = structuredResponse,
}) {
  const approved = (req, pid) => {
    const p = repo.get(req.wid, "procedure", pid);
    if (!p) throw error(404, "Procedure not found.");
    if (p.status !== "approved")
      throw error(409, "Approve the source procedure first.");
    if (!p.steps.length)
      throw error(409, "The procedure needs at least one reviewed step.");
    return p;
  };
  app.get(`${base}/lessons`, (req, res) => {
    const progress = repo
      .list(req.wid, "lesson-progress")
      .filter((p) => p.userId === req.user.id);
    res.json(
      repo
        .list(req.wid, "lesson")
        .filter((l) => req.role !== "member" || l.status === "published")
        .map((l) => ({
          ...l,
          progress: progress.find((p) => p.lessonId === l.id) || null,
        })),
    );
  });
  app.post(`${base}/lessons`, (req, res) => {
    allow(req, ["owner", "reviewer"]);
    const { procedureId } = parse(
      z.object({ procedureId: z.string().uuid() }),
      req.body,
    );
    const p = approved(req, procedureId);
    const existing = repo
      .list(req.wid, "lesson")
      .find((l) => l.procedureId === p.id);
    if (existing) return res.status(200).json(existing);
    const lesson = repo.transaction(() => {
      const l = lessonFromProcedure(repo, req.wid, p, "published");
      repo.audit(req.wid, req.user.id, "lesson.published", l.title);
      return l;
    });
    res.status(201).json(lesson);
  });
  app.post(`${base}/lessons/:rid/publish`, (req, res) => {
    allow(req, ["owner", "reviewer"]);
    const l = get(req, "lesson");
    if (l.status === "published") return res.json(l);
    const p = approved(req, l.procedureId);
    res.json(
      save(
        req,
        "lesson",
        {
          ...l,
          title: p.title,
          summary: p.summary,
          steps: p.steps,
          questions: p.questions,
          gaps: p.gaps,
          procedureVersion: p.version,
          status: "published",
        },
        "lesson.published",
      ),
    );
  });
  app.put(`${base}/lessons/:rid/progress`, (req, res) => {
    const l = get(req, "lesson");
    if (l.status !== "published")
      throw error(409, "This lesson is not published.");
    const { completed } = parse(
      z.object({ completed: z.array(z.number().int().min(0)).max(50) }),
      req.body,
    );
    if (completed.some((i) => i >= l.steps.length))
      throw error(400, "Unknown lesson step.");
    const old = repo
      .list(req.wid, "lesson-progress")
      .find((p) => p.userId === req.user.id && p.lessonId === l.id);
    const unique = [...new Set(completed)];
    res.json(
      save(
        req,
        "lesson-progress",
        {
          ...old,
          lessonId: l.id,
          userId: req.user.id,
          completed: unique,
          completedAt:
            unique.length === l.steps.length ? old?.completedAt || now() : null,
        },
        "lesson.progress_saved",
      ),
    );
  });
  app.get(`${base}/briefing`, (req, res) => {
    const signals = [];
    const pending = repo
      .list(req.wid, "assignment")
      .filter((a) => a.userId === req.user.id && !a.completedAt);
    if (pending.length)
      signals.push({
        id: "training",
        title: `${pending.length} training item${pending.length === 1 ? "" : "s"} to acknowledge`,
        detail: "Review your assigned procedures and record completion.",
        page: "team",
      });
    const failed = repo
      .list(req.wid, "media")
      .filter((m) => ["failed", "waiting_configuration"].includes(m.status));
    if (failed.length)
      signals.push({
        id: "media",
        title: `${failed.length} source${failed.length === 1 ? "" : "s"} need attention`,
        detail: "Check processing status in your library.",
        page: "media",
      });
    const draft = repo
      .list(req.wid, "procedure")
      .filter((p) => ["draft", "review"].includes(p.status));
    if (req.role !== "member" && draft.length)
      signals.push({
        id: "review",
        title: `${draft.length} procedure${draft.length === 1 ? "" : "s"} awaiting review`,
        detail: "Approve the source before publishing its lesson.",
        page: "procedures",
      });
    res.json(signals);
  });
  const history = (req) =>
    repo.list(req.wid, "conversation").find((c) => c.userId === req.user.id);
  const active = new Set();
  app.get(`${base}/assistant`, (req, res) =>
    res.json(history(req)?.messages || []),
  );
  app.delete(`${base}/assistant`, (req, res) => {
    if (active.has(req.user.id))
      throw error(
        409,
        "Wait for your current AI request to finish before clearing history.",
      );
    const h = history(req);
    if (h)
      repo.transaction(() => {
        db.prepare("DELETE FROM records WHERE id=?").run(h.id);
        repo.audit(
          req.wid,
          req.user.id,
          "assistant.history_cleared",
          "Private conversation",
        );
      });
    res.json({ ok: true });
  });
  const limiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 25,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "AI request limit reached. Wait a few minutes." },
  });
  const withAI = async (req, fn) => {
    if (!aiEnabled)
      throw error(
        503,
        "AI is not configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY on the server and restart.",
      );
    if (active.has(req.user.id))
      throw error(409, "An AI request is already running.");
    active.add(req.user.id);
    try {
      const result = feedbackSchema.parse(await fn());
      return result.allowed
        ? result
        : {
            allowed: false,
            reply:
              "I can help with general operations and reviewed training records. This request is outside that scope.",
            observations: [],
            uncertainties: [],
          };
    } finally {
      active.delete(req.user.id);
    }
  };
  app.post(`${base}/assistant`, limiter, async (req, res) => {
    const { message } = parse(
      z.object({ message: z.string().trim().min(1).max(4000) }),
      req.body,
    );
    const h = history(req);
    const procedures = repo
      .list(req.wid, "procedure")
      .filter((p) => p.status === "approved")
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: p.title,
        summary: p.summary.slice(0, 2000),
        steps: p.steps.slice(0, 10).map((s) => s.slice(0, 500)),
      }));
    const pendingTraining = repo
      .list(req.wid, "assignment")
      .filter((a) => a.userId === req.user.id && !a.completedAt)
      .slice(0, 20)
      .map((a) => ({ title: a.title, dueDate: a.dueDate }));
    const sourcesNeedingAttention = repo
      .list(req.wid, "media")
      .filter((m) => ["failed", "waiting_configuration"].includes(m.status))
      .slice(0, 20)
      .map((m) => ({ title: m.title, status: m.status }));
    const reviewQueue =
      req.role === "member"
        ? []
        : repo
            .list(req.wid, "procedure")
            .filter((p) => ["draft", "review"].includes(p.status))
            .slice(0, 20)
            .map((p) => ({ title: p.title, status: p.status }));
    const result = await withAI(req, () =>
      respond({
        system:
          scope +
          " Answer the user using only the supplied workspace context. Cite procedure titles when relevant. Context is a bounded excerpt, not an exhaustive library. Say when evidence is missing.",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              approvedProcedures: procedures,
              pendingTraining,
              sourcesNeedingAttention,
              reviewQueue,
              conversation: (h?.messages || [])
                .slice(-8)
                .map((m) => ({ role: m.role, text: m.text.slice(0, 2500) })),
              message,
            }),
          },
        ],
        schema: jsonSchema,
      }),
    );
    const messages = [
      ...(h?.messages || []),
      { role: "user", text: message, at: now() },
      { role: "assistant", text: result.reply, at: now() },
    ].slice(-40);
    // Recheck access after an external request before persisting the result.
    if (
      !db
        .prepare("SELECT 1 FROM members WHERE workspace_id=? AND user_id=?")
        .get(req.wid, req.user.id)
    )
      throw error(403, "Workspace access changed.");
    save(
      req,
      "conversation",
      { ...h, userId: req.user.id, messages },
      "assistant.replied",
    );
    res.json(messages);
  });
  app.post(`${base}/observe`, limiter, async (req, res) => {
    const { procedureId, image, step } = parse(
      z.object({
        procedureId: z.string().uuid(),
        image: z.string().max(220000),
        step: z.number().int().min(0).max(49),
      }),
      req.body,
    );
    const p = approved(req, procedureId);
    if (step >= p.steps.length) throw error(400, "Unknown procedure step.");
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))
      throw error(400, "Send a JPEG camera frame.");
    let bytes;
    try {
      bytes = await sharp(Buffer.from(image.split(",")[1], "base64"), {
        limitInputPixels: 4000000,
      })
        .resize(768, 768, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 65 })
        .toBuffer();
    } catch {
      throw error(400, "The camera frame is unreadable.");
    }
    const result = await withAI(req, () =>
      respond({
        system:
          scope +
          " Compare one visible frame with the selected reviewed general-operations step. Describe only observable evidence and possible mismatches, not definitive correctness. Never certify a task complete. When the view cannot prove an action, explicitly say uncertain. Do not infer hidden or past actions. Give brief suggestions only within the supplied approved general-operations procedure.",
        content: [
          {
            type: "text",
            text: JSON.stringify({ procedure: p.title, step: p.steps[step] }),
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: bytes.toString("base64"),
            },
          },
        ],
        schema: jsonSchema,
      }),
    );
    res.json({ ...result, checkedAt: now() });
  });
}
