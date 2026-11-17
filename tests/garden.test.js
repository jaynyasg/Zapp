import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

const dir = mkdtempSync(join(tmpdir(), "mg-garden-"));
const { app, db, repo } = createApp({ dataDir: dir, aiEnabled: false });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function fixture(label) {
  const a = request.agent(app);
  await a
    .post("/api/auth/register")
    .send({
      name: label,
      email: `${label}@garden.test`,
      password: "garden-test-passphrase",
    })
    .expect(201);
  const w = (
    await a
      .post("/api/workspaces")
      .send({ name: label, kind: "home" })
      .expect(201)
  ).body.id;
  const root = `/api/workspaces/${w}`;
  const plant = (
    await a
      .post(root + "/specimens")
      .send({ name: "Plant A", kind: "plant" })
      .expect(201)
  ).body;
  return { a, w, root, plant };
}
test("collection layouts enforce workspace, occupancy and stale move protection", async () => {
  const { a, w, root, plant } = await fixture("layout");
  const other = await fixture("outsider");
  await other.a.get(root + "/garden").expect(403);
  const area = (
    await a
      .post(root + "/areas")
      .send({ name: "Shelf", rows: 2, columns: 3 })
      .expect(201)
  ).body;
  await a
    .post(root + "/areas")
    .send({ name: "Huge", rows: 99, columns: 1 })
    .expect(400);
  const path = root + `/specimens/${plant.id}/placement`;
  await a
    .put(path)
    .send({ areaId: area.id, row: 2, column: 0, version: 0 })
    .expect(400);
  await a
    .put(path)
    .send({ areaId: other.plant.id, row: 0, column: 0, version: 0 })
    .expect(400);
  await a
    .put(path)
    .send({ areaId: area.id, row: 0, column: 0, version: 0 })
    .expect(200);
  await a
    .put(path)
    .send({ areaId: area.id, row: 1, column: 0, version: 0 })
    .expect(409);
  const plant2 = repo.put(w, "specimen", { name: "Plant B", kind: "plant" });
  await a
    .put(root + `/specimens/${plant2.id}/placement`)
    .send({ areaId: area.id, row: 0, column: 0, version: 0 })
    .expect(409);
  await a.put(path).send({ areaId: null, version: 1 }).expect(200);
  await a
    .put(root + `/specimens/${plant2.id}/placement`)
    .send({ areaId: area.id, row: 0, column: 0, version: 0 })
    .expect(200);
  const snapshot = (await a.get(root + "/garden").expect(200)).body;
  assert.equal(snapshot.placements.filter((p) => p.areaId).length, 1);
  assert.equal(repo.list(w, "lesson").length, 0);
});
test("user tasks persist deadlines, support snooze and completion, and export escaped calendar alarms", async () => {
  const { a, root, plant } = await fixture("tasks");
  const task = (
    await a
      .post(root + "/garden-tasks")
      .send({
        title: "Photograph, shelf",
        notes: "Line one\nLine two",
        specimenId: plant.id,
        dueAt: "2020-01-01T12:00:00.000Z",
      })
      .expect(201)
  ).body;
  let state = (await a.get(root + "/garden")).body;
  assert.equal(state.dueTasks.length, 1);
  const calendar = await a
    .get(root + `/garden-tasks/${task.id}/calendar`)
    .expect(200);
  assert.match(calendar.text, /BEGIN:VALARM/);
  assert.match(calendar.text, /SUMMARY:Photograph\\, shelf/);
  await a
    .patch(root + `/garden-tasks/${task.id}`)
    .send({ version: 1, dueAt: "2099-01-01T12:00:00.000Z" })
    .expect(200);
  await a
    .patch(root + `/garden-tasks/${task.id}`)
    .send({ version: 1, status: "completed" })
    .expect(409);
  await a
    .patch(root + `/garden-tasks/${task.id}`)
    .send({ version: 2, status: "completed" })
    .expect(200);
  state = (await a.get(root + "/garden")).body;
  assert.equal(state.dueTasks.length, 0);
  assert.ok(state.tasks[0].completedAt);
  assert.equal(state.tasks[0].specimenId, plant.id);
  assert.equal(state.tasks[0].notes, "Line one\nLine two");
  const foreign = await fixture("taskforeign");
  await a
    .post(root + "/garden-tasks")
    .send({
      title: "Bad link",
      specimenId: foreign.plant.id,
      dueAt: "2099-01-01T12:00:00.000Z",
    })
    .expect(400);
});
test("inventory uses user thresholds and auditable stock changes without negative stock or lost updates", async () => {
  const { a, w, root, plant } = await fixture("stock");
  await a
    .post(root + "/supplies")
    .send({
      name: "Labels",
      unit: "pieces",
      quantity: 2,
      reorderAt: 3,
      targetQuantity: 1,
    })
    .expect(400);
  await a
    .post(root + "/supplies")
    .send({
      name: "Labels",
      unit: "pieces",
      quantity: 2,
      reorderAt: 3,
      targetQuantity: 10,
      specimenId: plant.id,
    })
    .expect(400);
  const material = repo.put(w, "specimen", {
    name: "Labels",
    kind: "material",
  });
  const supply = (
    await a
      .post(root + "/supplies")
      .send({
        name: "Labels",
        unit: "pieces",
        quantity: 2,
        reorderAt: 3,
        targetQuantity: 10,
        specimenId: material.id,
      })
      .expect(201)
  ).body;
  let state = (await a.get(root + "/garden")).body;
  assert.equal(state.restock[0].suggestedQuantity, 8);
  const path = root + `/supplies/${supply.id}/adjustments`;
  await a
    .post(path)
    .send({ version: 1, delta: -3, note: "Too much" })
    .expect(400);
  await a
    .post(path)
    .send({ version: 1, delta: 8, note: "Restocked" })
    .expect(200);
  await a
    .post(path)
    .send({ version: 1, delta: -1, note: "Stale tab" })
    .expect(409);
  state = (await a.get(root + "/garden")).body;
  assert.equal(state.supplies[0].quantity, 10);
  assert.equal(state.restock.length, 0);
  assert.equal(state.adjustments.length, 1);
  assert.equal(state.adjustments[0].note, "Restocked");
  const actor = db
    .prepare(
      "SELECT actor FROM audit WHERE workspace_id=? AND action='supply.adjusted'",
    )
    .get(w).actor;
  assert.ok(db.prepare("SELECT id FROM users WHERE id=?").get(actor));
  await a
    .patch(root + `/supplies/${supply.id}`)
    .send({
      name: "Labels",
      unit: "boxes",
      reorderAt: 3,
      targetQuantity: 10,
      specimenId: material.id,
      version: 2,
    })
    .expect(400);
  await a
    .patch(root + `/supplies/${supply.id}`)
    .send({
      name: "Labels",
      unit: "pieces",
      reorderAt: 10,
      targetQuantity: 20,
      specimenId: material.id,
      version: 2,
    })
    .expect(200);
  state = (await a.get(root + "/garden")).body;
  assert.equal(state.restock[0].suggestedQuantity, 10);
});
