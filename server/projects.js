import { z } from "zod";
import { now } from "./db.js";

export const organizationFields = {
  siteId: z.string().uuid().nullable().default(null),
  projectId: z.string().uuid().nullable().default(null),
};
const types = ["specimen", "area", "gardenTask", "supply"];
export function validateOrganization(repo, wid, record, error) {
  if (record.siteId && !repo.get(wid, "site", record.siteId))
    throw error(400, "Choose a site from this workspace.");
  if (record.projectId) {
    const project = repo.get(wid, "project", record.projectId);
    if (!project) throw error(400, "Choose a project from this workspace.");
    if (record.siteId && !project.siteIds.includes(record.siteId))
      throw error(400, "This site is not part of the selected project.");
  }
}
export function compatibleOrganization(a, b, error) {
  if (!a || !b) return;
  if (a.siteId && b.siteId && a.siteId !== b.siteId)
    throw error(
      409,
      "Linked records belong to different sites. Update their assignments or remove the link first.",
    );
  if (a.projectId && b.projectId && a.projectId !== b.projectId)
    throw error(
      409,
      "Linked records belong to different projects. Update their assignments or remove the link first.",
    );
}
// Evaluate incoming links too, so moving an area cannot silently relocate its plants.
function validateLinks(repo, wid, type, candidate, error) {
  const records = Object.fromEntries(
    types.map((t) => [
      t,
      repo
        .list(wid, t)
        .map((r) => (t === type && r.id === candidate.id ? candidate : r)),
    ]),
  );
  const find = (t, id) => records[t].find((r) => r.id === id);
  for (const p of repo.list(wid, "placement"))
    if (p.areaId)
      compatibleOrganization(
        find("specimen", p.specimenId),
        find("area", p.areaId),
        error,
      );
  for (const task of records.gardenTask) {
    const plant = find("specimen", task.specimenId),
      area = find("area", task.areaId);
    compatibleOrganization(task, plant, error);
    compatibleOrganization(task, area, error);
    compatibleOrganization(plant, area, error);
  }
  for (const supply of records.supply)
    compatibleOrganization(supply, find("specimen", supply.specimenId), error);
}
export function installProjects({ app, repo, base, get, save, parse, error }) {
  const name = z.string().trim().min(1).max(200),
    notes = z.string().trim().max(4000).default("");
  const version = z.number().int().min(1);
  const siteSchema = z.object({
    name,
    location: z.string().trim().max(500).default(""),
    notes,
  });
  const projectSchema = z.object({
    name,
    notes,
    siteIds: z
      .array(z.string().uuid())
      .min(1)
      .max(100)
      .transform((ids) => [...new Set(ids)]),
    status: z
      .enum(["planned", "active", "paused", "completed"])
      .default("planned"),
    startDate: z.iso.date().nullable().default(null),
    targetDate: z.iso.date().nullable().default(null),
  });
  const checkVersion = (r, v) => {
    if (r.version !== v)
      throw error(409, "This record changed. Reopen the editor before saving.");
  };
  const checkProject = (req, p) => {
    for (const id of p.siteIds)
      if (!repo.get(req.wid, "site", id))
        throw error(400, "Every project site must belong to this workspace.");
    if (p.startDate && p.targetDate && p.startDate > p.targetDate)
      throw error(400, "Target date must be on or after the start date.");
  };
  app.get(`${base}/organization`, (req, res) => {
    const records = types.flatMap((t) =>
      repo.list(req.wid, t).map((r) => ({ ...r, type: t })),
    );
    const stats = (field, id) => {
      const linked = records.filter((r) => r[field] === id),
        tasks = linked.filter((r) => r.type === "gardenTask");
      return {
        recordCount: linked.filter((r) => r.type === "specimen").length,
        areaCount: linked.filter((r) => r.type === "area").length,
        supplyCount: linked.filter((r) => r.type === "supply").length,
        taskCount: tasks.filter((t) => t.status !== "cancelled").length,
        completedTasks: tasks.filter((t) => t.status === "completed").length,
        dueTasks: tasks.filter(
          (t) => t.status === "pending" && Date.parse(t.dueAt) <= Date.now(),
        ).length,
      };
    };
    res.json({
      sites: repo
        .list(req.wid, "site")
        .map((s) => ({ ...s, ...stats("siteId", s.id) })),
      projects: repo
        .list(req.wid, "project")
        .map((p) => ({ ...p, ...stats("projectId", p.id) })),
    });
  });
  app.post(`${base}/sites`, (req, res) =>
    res
      .status(201)
      .json(
        save(
          req,
          "site",
          { ...parse(siteSchema, req.body), version: 1 },
          "site.created",
        ),
      ),
  );
  app.patch(`${base}/sites/:rid`, (req, res) => {
    const record = get(req, "site"),
      body = parse(siteSchema.extend({ version }), req.body);
    checkVersion(record, body.version);
    res.json(
      save(
        req,
        "site",
        { ...record, ...body, version: record.version + 1 },
        "site.updated",
      ),
    );
  });
  app.post(`${base}/projects`, (req, res) => {
    const body = parse(projectSchema, req.body);
    checkProject(req, body);
    res
      .status(201)
      .json(
        save(
          req,
          "project",
          {
            ...body,
            version: 1,
            completedAt: body.status === "completed" ? now() : null,
          },
          "project.created",
        ),
      );
  });
  app.patch(`${base}/projects/:rid`, (req, res) => {
    const record = get(req, "project"),
      body = parse(projectSchema.extend({ version }), req.body);
    checkVersion(record, body.version);
    checkProject(req, body);
    const assigned = types
      .flatMap((t) => repo.list(req.wid, t))
      .some(
        (r) =>
          r.projectId === record.id &&
          r.siteId &&
          !body.siteIds.includes(r.siteId),
      );
    if (assigned)
      throw error(
        409,
        "This site still has records assigned to the project. Reassign those records before removing it.",
      );
    res.json(
      save(
        req,
        "project",
        {
          ...record,
          ...body,
          version: record.version + 1,
          completedAt:
            body.status === "completed" ? record.completedAt || now() : null,
        },
        "project.updated",
      ),
    );
  });
  app.put(`${base}/organization/:type/:rid`, (req, res) => {
    if (!types.includes(req.params.type))
      throw error(400, "Unsupported collection record type.");
    const body = parse(
      z.object({ ...organizationFields, version: z.number().int().min(0) }),
      req.body,
    );
    res.json(
      repo.transaction(() => {
        const record = get(req, req.params.type);
        if ((record.organizationVersion || 0) !== body.version)
          throw error(
            409,
            "This assignment changed. Reopen the editor before saving.",
          );
        const updated = {
          ...record,
          siteId: body.siteId,
          projectId: body.projectId,
          organizationVersion: body.version + 1,
          ...(record.version ? { version: record.version + 1 } : {}),
        };
        validateOrganization(repo, req.wid, updated, error);
        validateLinks(repo, req.wid, req.params.type, updated, error);
        const saved = repo.put(req.wid, req.params.type, updated);
        repo.audit(
          req.wid,
          req.user.id,
          "organization.updated",
          record.name || record.title || record.id,
        );
        return saved;
      }),
    );
  });
}
