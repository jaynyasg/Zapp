import { z } from "zod";
import { now } from "./db.js";

// Descriptive records only: no generated targets, diagnoses or growing advice.
export function installCollection({
  app,
  repo,
  base,
  get,
  save,
  parse,
  error,
}) {
  const short = z.string().trim().min(1).max(200);
  app.get(`${base}/specimens`, (req, res) => {
    const observations = repo.list(req.wid, "observation");
    res.json(
      repo.list(req.wid, "specimen").map((p) => {
        const entries = observations
          .filter((o) => o.specimenId === p.id)
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        return {
          ...p,
          entryCount: entries.length,
          openIssues: entries.filter((o) => o.status === "open").length,
          coverId: entries.find((o) => o.mediaId)?.mediaId || null,
        };
      }),
    );
  });
  app.post(`${base}/specimens`, (req, res) => {
    const body = parse(
      z.object({
        name: short,
        kind: z.enum(["plant", "seed", "material"]),
        notes: z.string().max(4000).default(""),
        measurementLabel: z.string().trim().max(80).default(""),
        unit: z.string().trim().max(30).default(""),
      }),
      req.body,
    );
    if (Boolean(body.measurementLabel) !== Boolean(body.unit))
      throw error(
        400,
        "Provide both a measurement label and unit, or leave both blank.",
      );
    res
      .status(201)
      .json(
        save(
          req,
          "specimen",
          { ...body, authorId: req.user.id, author: req.user.name },
          "collection.created",
        ),
      );
  });
  app.get(`${base}/specimens/:rid`, (req, res) => {
    const p = get(req, "specimen");
    res.json({
      ...p,
      observations: repo
        .list(req.wid, "observation")
        .filter((o) => o.specimenId === p.id)
        .sort(
          (a, b) =>
            a.observedAt.localeCompare(b.observedAt) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    });
  });
  app.post(`${base}/specimens/:rid/observations`, (req, res) => {
    const p = get(req, "specimen");
    const body = parse(
      z.object({
        observedAt: z.iso.datetime(),
        notes: z.string().trim().min(1).max(8000),
        kind: z.enum(["observation", "issue"]).default("observation"),
        mediaId: z.string().uuid().nullable().default(null),
        measurement: z.number().min(-1e9).max(1e9).nullable().default(null),
      }),
      req.body,
    );
    if (Date.parse(body.observedAt) > Date.now() + 300000)
      throw error(400, "Observations must be dated in the past or present.");
    if (body.measurement !== null && !p.measurementLabel)
      throw error(400, "This profile has no measurement label or unit.");
    if (body.mediaId) {
      const media = repo.get(req.wid, "media", body.mediaId);
      if (!media || !media.mime.startsWith("image/"))
        throw error(400, "Choose an image from this workspace.");
    }
    res.status(201).json(
      save(
        req,
        "observation",
        {
          ...body,
          observedAt: new Date(body.observedAt).toISOString(),
          specimenId: p.id,
          authorId: req.user.id,
          author: req.user.name,
          status: body.kind === "issue" ? "open" : null,
          resolutionNote: "",
          resolvedAt: null,
          version: 1,
        },
        "observation.created",
      ),
    );
  });
  app.patch(`${base}/observations/:rid`, (req, res) => {
    const record = get(req, "observation");
    if (req.role === "member" && record.authorId !== req.user.id)
      throw error(403, "Only the author or a reviewer can update this issue.");
    if (record.kind !== "issue")
      throw error(409, "Only issue records have an open or resolved status.");
    const body = parse(
      z.object({
        status: z.enum(["open", "resolved"]),
        version: z.number().int().min(1),
        resolutionNote: z.string().trim().max(4000).default(""),
      }),
      req.body,
    );
    if (body.version !== record.version)
      throw error(409, "This issue changed. Reload before updating it.");
    res.json(
      save(
        req,
        "observation",
        {
          ...record,
          status: body.status,
          resolutionNote: body.resolutionNote,
          resolvedAt:
            body.status === "resolved" ? record.resolvedAt || now() : null,
          version: record.version + 1,
        },
        "issue.updated",
      ),
    );
  });
}
