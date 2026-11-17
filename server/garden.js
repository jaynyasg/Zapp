import { z } from "zod";
import { now } from "./db.js";

// Workspace management only. All deadlines, quantities and targets are user supplied.
export function installGarden({ app, repo, base, get, save, parse, error }) {
  const name = z.string().trim().min(1).max(200);
  const notes = z.string().trim().max(4000).default("");
  const version = z.number().int().min(1);
  const link = z.string().uuid().nullable().default(null);
  const quantity = z.number().min(0).max(1e9);
  const checkVersion = (record, expected) => {
    if (record.version !== expected)
      throw error(409, "This record changed. Reload before updating it.");
  };
  const checkLink = (req, type, id) => {
    if (!id) return null;
    const record = repo.get(req.wid, type, id);
    if (!record) throw error(400, "Choose a record from this workspace.");
    return record;
  };
  app.get(`${base}/garden`, (req, res) => {
    const tasks = repo
      .list(req.wid, "gardenTask")
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const supplies = repo.list(req.wid, "supply");
    res.json({
      areas: repo.list(req.wid, "area"),
      placements: repo.list(req.wid, "placement"),
      tasks,
      supplies,
      adjustments: repo.list(req.wid, "stockAdjustment"),
      dueTasks: tasks.filter(
        (t) => t.status === "pending" && Date.parse(t.dueAt) <= Date.now(),
      ),
      restock: supplies
        .filter((s) => s.quantity <= s.reorderAt)
        .map((s) => ({
          ...s,
          suggestedQuantity:
            Math.round((s.targetQuantity - s.quantity) * 1e6) / 1e6,
        })),
    });
  });
  app.post(`${base}/areas`, (req, res) => {
    const body = parse(
      z.object({
        name,
        rows: z.number().int().min(1).max(12),
        columns: z.number().int().min(1).max(12),
        notes,
      }),
      req.body,
    );
    res
      .status(201)
      .json(save(req, "area", { ...body, version: 1 }, "area.created"));
  });
  app.patch(`${base}/areas/:rid`, (req, res) => {
    const record = get(req, "area");
    const body = parse(z.object({ name, notes, version }), req.body);
    checkVersion(record, body.version);
    res.json(
      save(
        req,
        "area",
        { ...record, ...body, version: record.version + 1 },
        "area.updated",
      ),
    );
  });
  app.put(`${base}/specimens/:rid/placement`, (req, res) => {
    const specimen = get(req, "specimen");
    if (!["plant", "seed"].includes(specimen.kind))
      throw error(400, "Choose a plant or seed profile for the layout.");
    const body = parse(
      z.object({
        areaId: link,
        row: z.number().int().min(0).optional(),
        column: z.number().int().min(0).optional(),
        version: z.number().int().min(0),
      }),
      req.body,
    );
    // Check and write under one lock, including occupancy across all placements.
    const result = repo.transaction(() => {
      const placements = repo.list(req.wid, "placement");
      const existing = placements.find((p) => p.specimenId === specimen.id);
      if ((existing?.version || 0) !== body.version)
        throw error(409, "This placement changed. Reload before moving it.");
      if (body.areaId) {
        const area = checkLink(req, "area", body.areaId);
        if (
          body.row === undefined ||
          body.column === undefined ||
          body.row >= area.rows ||
          body.column >= area.columns
        )
          throw error(400, "Choose a cell inside this area.");
        if (
          placements.some(
            (p) =>
              p.specimenId !== specimen.id &&
              p.areaId === area.id &&
              p.row === body.row &&
              p.column === body.column,
          )
        )
          throw error(409, "That cell is occupied. Choose an empty cell.");
      }
      const p = repo.put(req.wid, "placement", {
        ...existing,
        specimenId: specimen.id,
        areaId: body.areaId,
        row: body.areaId ? body.row : null,
        column: body.areaId ? body.column : null,
        version: body.version + 1,
      });
      repo.audit(req.wid, req.user.id, "placement.updated", specimen.name);
      return p;
    });
    res.json(result);
  });
  const taskFields = {
    title: name,
    notes,
    specimenId: link,
    areaId: link,
    dueAt: z.iso.datetime(),
  };
  app.post(`${base}/garden-tasks`, (req, res) => {
    const body = parse(z.object(taskFields), req.body);
    checkLink(req, "specimen", body.specimenId);
    checkLink(req, "area", body.areaId);
    res
      .status(201)
      .json(
        save(
          req,
          "gardenTask",
          {
            ...body,
            dueAt: new Date(body.dueAt).toISOString(),
            status: "pending",
            completedAt: null,
            version: 1,
            authorId: req.user.id,
          },
          "gardenTask.created",
        ),
      );
  });
  app.patch(`${base}/garden-tasks/:rid`, (req, res) => {
    const record = get(req, "gardenTask");
    const body = parse(
      z.object({
        title: name.optional(),
        notes: z.string().trim().max(4000).optional(),
        specimenId: z.string().uuid().nullable().optional(),
        areaId: z.string().uuid().nullable().optional(),
        dueAt: z.iso.datetime().optional(),
        status: z.enum(["pending", "completed", "cancelled"]).optional(),
        version,
      }),
      req.body,
    );
    checkVersion(record, body.version);
    checkLink(req, "specimen", body.specimenId);
    checkLink(req, "area", body.areaId);
    const updated = { ...record, ...body, version: record.version + 1 };
    updated.dueAt = new Date(updated.dueAt).toISOString();
    updated.completedAt =
      updated.status === "completed" ? record.completedAt || now() : null;
    res.json(save(req, "gardenTask", updated, "gardenTask.updated"));
  });
  const escapeIcs = (text) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r/g, "");
  const stamp = (date) =>
    new Date(date)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const fold = (line) => {
    const lines = [];
    let current = "";
    for (const c of line) {
      if (Buffer.byteLength(current + c) > 73) {
        lines.push(current);
        current = " ";
      }
      current += c;
    }
    return [...lines, current].join("\r\n");
  };
  app.get(`${base}/garden-tasks/:rid/calendar`, (req, res) => {
    const task = get(req, "gardenTask");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MasterGrow//Collection//EN",
      "BEGIN:VEVENT",
      `UID:${task.id}@mastergrow`,
      `DTSTAMP:${stamp(now())}`,
      `DTSTART:${stamp(task.dueAt)}`,
      `SEQUENCE:${task.version}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.notes)}`,
      `STATUS:${task.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    ];
    if (task.status === "pending")
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:PT0M",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs(task.title)}`,
        "END:VALARM",
      );
    lines.push("END:VEVENT", "END:VCALENDAR");
    res
      .type("text/calendar")
      .attachment("mastergrow-task.ics")
      .send(lines.map(fold).join("\r\n") + "\r\n");
  });
  const supplyFields = {
    name,
    unit: z.string().trim().min(1).max(30),
    reorderAt: quantity,
    targetQuantity: quantity,
    notes,
    specimenId: link,
  };
  const validateSupply = (req, body) => {
    if (body.targetQuantity < body.reorderAt)
      throw error(
        400,
        "Target quantity must be at least the restock threshold.",
      );
    const profile = checkLink(req, "specimen", body.specimenId);
    if (profile && profile.kind !== "material")
      throw error(400, "Link inventory to a material profile.");
    if (
      body.specimenId &&
      repo
        .list(req.wid, "supply")
        .some(
          (s) => s.specimenId === body.specimenId && s.id !== req.params.rid,
        )
    )
      throw error(409, "This material already has an inventory record.");
  };
  app.post(`${base}/supplies`, (req, res) => {
    const body = parse(z.object({ ...supplyFields, quantity }), req.body);
    validateSupply(req, body);
    res
      .status(201)
      .json(save(req, "supply", { ...body, version: 1 }, "supply.created"));
  });
  app.patch(`${base}/supplies/:rid`, (req, res) => {
    const record = get(req, "supply");
    const body = parse(z.object({ ...supplyFields, version }), req.body);
    checkVersion(record, body.version);
    validateSupply(req, body);
    if (body.unit !== record.unit)
      throw error(
        400,
        "Keep the original stock unit to preserve adjustment history.",
      );
    res.json(
      save(
        req,
        "supply",
        { ...record, ...body, version: record.version + 1 },
        "supply.updated",
      ),
    );
  });
  app.post(`${base}/supplies/:rid/adjustments`, (req, res) => {
    const body = parse(
      z.object({
        version,
        delta: z
          .number()
          .min(-1e9)
          .max(1e9)
          .refine((n) => n !== 0),
        note: z.string().trim().min(1).max(1000),
      }),
      req.body,
    );
    res.json(
      repo.transaction(() => {
        const record = get(req, "supply");
        checkVersion(record, body.version);
        const next = Math.round((record.quantity + body.delta) * 1e6) / 1e6;
        if (next < 0 || next > 1e9)
          throw error(400, "Stock must stay between zero and one billion.");
        const updated = repo.put(req.wid, "supply", {
          ...record,
          quantity: next,
          version: record.version + 1,
        });
        repo.put(req.wid, "stockAdjustment", {
          supplyId: record.id,
          delta: next - record.quantity,
          note: body.note,
          quantity: next,
          author: req.user.name,
        });
        repo.audit(req.wid, req.user.id, "supply.adjusted", record.name);
        return updated;
      }),
    );
  });
}
