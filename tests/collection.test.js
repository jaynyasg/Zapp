import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

const dir = mkdtempSync(join(tmpdir(), "mg-collection-"));
const { app, db, repo } = createApp({ dataDir: dir, aiEnabled: false });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("collection records preserve dated evidence and measurements independently of lessons", async () => {
  const a = request.agent(app),
    b = request.agent(app);
  for (const [agent, email] of [
    [a, "a@collection.test"],
    [b, "b@collection.test"],
  ])
    await agent
      .post("/api/auth/register")
      .send({ name: "Recorder", email, password: "records-passphrase-long" })
      .expect(201);
  const w = (
    await a
      .post("/api/workspaces")
      .send({ name: "Collection", kind: "home" })
      .expect(201)
  ).body.id;
  const other = (
    await b
      .post("/api/workspaces")
      .send({ name: "Other", kind: "home" })
      .expect(201)
  ).body.id;
  const root = `/api/workspaces/${w}`;
  const p = (
    await a
      .post(root + "/specimens")
      .send({
        name: "Plant A",
        kind: "plant",
        notes: "Window shelf",
        measurementLabel: "Recorded dimension",
        unit: "cm",
      })
      .expect(201)
  ).body;
  await b.get(root + "/specimens").expect(403);
  const foreign = repo.put(other, "media", {
    title: "Private image",
    mime: "image/jpeg",
    status: "stored",
  });
  await a
    .post(root + `/specimens/${p.id}/observations`)
    .send({
      notes: "Not my image",
      observedAt: "2026-01-01T12:00:00.000Z",
      mediaId: foreign.id,
    })
    .expect(400);
  await a
    .post(root + `/specimens/${p.id}/observations`)
    .send({
      notes: "First record",
      observedAt: "2026-01-01T12:00:00.000Z",
      measurement: 10,
    })
    .expect(201);
  const issue = (
    await a
      .post(root + `/specimens/${p.id}/observations`)
      .send({
        notes: "Visible mark to document",
        kind: "issue",
        observedAt: "2026-01-03T12:00:00.000Z",
        measurement: 12,
      })
      .expect(201)
  ).body;
  const detail = (await a.get(root + `/specimens/${p.id}`).expect(200)).body;
  assert.deepEqual(
    detail.observations.map((o) => o.measurement),
    [10, 12],
  );
  assert.equal(detail.observations[1].status, "open");
  assert.equal(repo.list(w, "lesson").length, 0);
  assert.equal(repo.list(w, "procedure").length, 0);
  await a
    .patch(root + `/observations/${issue.id}`)
    .send({
      status: "resolved",
      version: 1,
      resolutionNote: "Reviewed and recorded.",
    })
    .expect(200);
  await a
    .patch(root + `/observations/${issue.id}`)
    .send({ status: "open", version: 1 })
    .expect(409);
  const updated = (await a.get(root + `/specimens/${p.id}`).expect(200)).body
    .observations[1];
  assert.ok(updated.resolvedAt);
  assert.equal(updated.resolutionNote, "Reviewed and recorded.");
  const image = repo.put(w, "media", {
    title: "Evidence",
    mime: "image/jpeg",
    status: "stored",
  });
  await a
    .post(root + `/specimens/${p.id}/observations`)
    .send({
      notes: "Attached evidence",
      mediaId: image.id,
      observedAt: "2026-01-04T12:00:00Z",
    })
    .expect(201);
  await a.delete(root + `/media/${image.id}`).expect(409);
  await a
    .post(root + "/members")
    .send({ email: "b@collection.test", role: "member" })
    .expect(201);
  await b
    .patch(root + `/observations/${issue.id}`)
    .send({ status: "open", version: 2 })
    .expect(403);
  await b
    .patch(`/api/workspaces/${other}/observations/${issue.id}`)
    .send({ status: "resolved", version: 2 })
    .expect(404);
});
