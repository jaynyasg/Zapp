import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";
const dir = mkdtempSync(join(tmpdir(), "mg-projects-"));
const { app, db, repo } = createApp({ dataDir: dir, aiEnabled: false });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function setup(label) {
  const a = request.agent(app);
  await a
    .post("/api/auth/register")
    .send({
      name: label,
      email: `${label}@projects.test`,
      password: "projects-test-passphrase",
    })
    .expect(201);
  const w = (
    await a
      .post("/api/workspaces")
      .send({ name: label, kind: "home" })
      .expect(201)
  ).body.id;
  const root = `/api/workspaces/${w}`;
  return { a, w, root };
}
test("multi-site projects validate ownership, dates, revisions and preserve assigned sites", async () => {
  const { a, w, root } = await setup("projects"),
    foreign = await setup("foreign");
  await foreign.a.get(root + "/organization").expect(403);
  const site = (
    await a
      .post(root + "/sites")
      .send({ name: "North", location: "North campus" })
      .expect(201)
  ).body;
  const south = (
    await a
      .post(root + "/sites")
      .send({ name: "South" })
      .expect(201)
  ).body;
  const remote = repo.put(foreign.w, "site", { name: "Private" });
  await a
    .post(root + "/projects")
    .send({ name: "Invalid", siteIds: [remote.id] })
    .expect(400);
  await a
    .post(root + "/projects")
    .send({
      name: "Invalid",
      siteIds: [site.id],
      startDate: "2026-11-17",
      targetDate: "2026-01-01",
    })
    .expect(400);
  const project = (
    await a
      .post(root + "/projects")
      .send({
        name: "Winter records",
        siteIds: [site.id, south.id],
        status: "active",
      })
      .expect(201)
  ).body;
  const plant = (
    await a
      .post(root + "/specimens")
      .send({
        name: "Plant A",
        kind: "plant",
        siteId: site.id,
        projectId: project.id,
      })
      .expect(201)
  ).body;
  assert.equal(plant.siteId, site.id);
  await a
    .patch(root + `/projects/${project.id}`)
    .send({
      name: project.name,
      siteIds: [south.id],
      status: "active",
      version: 1,
    })
    .expect(409);
  await a
    .patch(root + `/projects/${project.id}`)
    .send({
      name: project.name,
      siteIds: [site.id, south.id],
      status: "paused",
      version: 1,
    })
    .expect(200);
  await a
    .patch(root + `/projects/${project.id}`)
    .send({
      name: project.name,
      siteIds: [site.id],
      status: "active",
      version: 1,
    })
    .expect(409);
  const snapshot = (await a.get(root + "/organization")).body;
  assert.equal(snapshot.projects[0].recordCount, 1);
  assert.equal(snapshot.projects[0].status, "paused");
  await a
    .put(root + `/organization/specimen/${plant.id}`)
    .send({ siteId: south.id, projectId: project.id, version: 0 })
    .expect(200);
  await a
    .put(root + `/organization/specimen/${plant.id}`)
    .send({ siteId: site.id, projectId: project.id, version: 0 })
    .expect(409);
  assert.equal(repo.list(w, "lesson").length, 0);
});
test("organization prevents conflicting linked records and keeps legacy records assignable", async () => {
  const { a, w, root } = await setup("links");
  const north = (
    await a
      .post(root + "/sites")
      .send({ name: "North" })
      .expect(201)
  ).body;
  const south = (
    await a
      .post(root + "/sites")
      .send({ name: "South" })
      .expect(201)
  ).body;
  const project = (
    await a
      .post(root + "/projects")
      .send({ name: "Survey", siteIds: [north.id] })
      .expect(201)
  ).body;
  await a
    .post(root + "/areas")
    .send({
      name: "Bad",
      rows: 2,
      columns: 2,
      siteId: south.id,
      projectId: project.id,
    })
    .expect(400);
  const area = (
    await a
      .post(root + "/areas")
      .send({
        name: "Shelf",
        rows: 2,
        columns: 2,
        siteId: north.id,
        projectId: project.id,
      })
      .expect(201)
  ).body;
  const plant = (
    await a
      .post(root + "/specimens")
      .send({ name: "Legacy plant", kind: "plant" })
      .expect(201)
  ).body;
  await a
    .put(root + `/specimens/${plant.id}/placement`)
    .send({ areaId: area.id, row: 0, column: 0, version: 0 })
    .expect(200);
  await a
    .put(root + `/organization/specimen/${plant.id}`)
    .send({ siteId: south.id, projectId: null, version: 0 })
    .expect(409);
  await a
    .put(root + `/organization/specimen/${plant.id}`)
    .send({ siteId: north.id, projectId: project.id, version: 0 })
    .expect(200);
  const task = (
    await a
      .post(root + "/garden-tasks")
      .send({
        title: "Record photo",
        dueAt: "2026-01-01T10:00:00Z",
        specimenId: plant.id,
        siteId: north.id,
        projectId: project.id,
      })
      .expect(201)
  ).body;
  await a
    .put(root + `/organization/area/${area.id}`)
    .send({ siteId: south.id, projectId: null, version: 0 })
    .expect(409);
  await a
    .post(root + "/garden-tasks")
    .send({
      title: "Wrong site",
      dueAt: "2026-01-01T10:00:00Z",
      specimenId: plant.id,
      siteId: south.id,
    })
    .expect(409);
  await a
    .patch(root + `/garden-tasks/${task.id}`)
    .send({ version: 1, status: "completed" })
    .expect(200);
  const summary = (await a.get(root + "/organization")).body.projects[0];
  assert.equal(summary.completedTasks, 1);
  assert.equal(summary.taskCount, 1);
  const supply = (
    await a
      .post(root + "/supplies")
      .send({
        name: "Labels",
        unit: "pieces",
        quantity: 2,
        reorderAt: 3,
        targetQuantity: 10,
        siteId: south.id,
      })
      .expect(201)
  ).body;
  assert.equal(supply.siteId, south.id);
  const audit = db
    .prepare(
      "SELECT actor FROM audit WHERE workspace_id=? AND action='organization.updated'",
    )
    .get(w);
  assert.ok(db.prepare("SELECT id FROM users WHERE id=?").get(audit.actor));
});
