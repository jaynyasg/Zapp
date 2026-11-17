import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";
import sharp from "sharp";

const dir = mkdtempSync(join(tmpdir(), "mg-learning-"));
const { app, db, repo } = createApp({ dataDir: dir, aiEnabled: false });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const owner = request.agent(app),
  outsider = request.agent(app);
let wid, pid, lesson;
test("lessons require approved procedures; progress is private, validated and persistent", async () => {
  const u = await owner
    .post("/api/auth/register")
    .send({
      name: "Teacher",
      email: "teacher@test.com",
      password: "a-long-test-password",
    })
    .expect(201);
  wid = (
    await owner
      .post("/api/workspaces")
      .send({ name: "Learning lab", kind: "facility" })
      .expect(201)
  ).body.id;
  pid = repo.put(wid, "procedure", {
    title: "Visitor register",
    summary: "Record arrival.",
    steps: ["Open the register", "Enter visitor name"],
    questions: ["Where is the name recorded?"],
    gaps: [],
    status: "draft",
    version: 1,
  }).id;
  await owner
    .post(`/api/workspaces/${wid}/lessons`)
    .send({ procedureId: pid })
    .expect(409);
  repo.put(wid, "procedure", {
    ...repo.get(wid, "procedure", pid),
    status: "approved",
  });
  lesson = (
    await owner
      .post(`/api/workspaces/${wid}/lessons`)
      .send({ procedureId: pid })
      .expect(201)
  ).body;
  assert.equal(lesson.status, "published");
  assert.equal(lesson.steps.length, 2);
  await owner
    .put(`/api/workspaces/${wid}/lessons/${lesson.id}/progress`)
    .send({ completed: [7] })
    .expect(400);
  await owner
    .put(`/api/workspaces/${wid}/lessons/${lesson.id}/progress`)
    .send({ completed: [0, 1] })
    .expect(200);
  const list = (await owner.get(`/api/workspaces/${wid}/lessons`).expect(200))
    .body;
  assert.ok(list[0].progress.completedAt);
  assert.ok(list[0].progress.updatedAt);
  await outsider
    .post("/api/auth/register")
    .send({
      name: "Outside",
      email: "outside@test.com",
      password: "another-long-password",
    })
    .expect(201);
  await outsider.get(`/api/workspaces/${wid}/lessons`).expect(403);
  await outsider
    .put(`/api/workspaces/${wid}/lessons/${lesson.id}/progress`)
    .send({ completed: [0] })
    .expect(403);
  assert.equal(repo.list(wid, "lesson-progress")[0].userId, u.body.id);
});
test("ordinary learners resume their own partial progress after signing in again", async () => {
  const learner = request.agent(app);
  await learner
    .post("/api/auth/register")
    .send({
      name: "Learner",
      email: "learner-progress@test.com",
      password: "learner-progress-passphrase",
    })
    .expect(201);
  await owner
    .post(`/api/workspaces/${wid}/members`)
    .send({ email: "learner-progress@test.com", role: "member" })
    .expect(201);
  const root = `/api/workspaces/${wid}/lessons`;
  assert.equal((await learner.get(root).expect(200)).body[0].progress, null);
  await learner
    .put(`${root}/${lesson.id}/progress`)
    .send({ completed: [0] })
    .expect(200);
  await learner.post("/api/auth/logout").expect(200);
  const freshSession = request.agent(app);
  await freshSession
    .post("/api/auth/login")
    .send({
      email: "learner-progress@test.com",
      password: "learner-progress-passphrase",
    })
    .expect(200);
  const resumed = (await freshSession.get(root).expect(200)).body[0].progress;
  assert.deepEqual(resumed.completed, [0]);
  assert.equal(resumed.completedAt, null);
  assert.ok(resumed.updatedAt);
  const finished = (
    await freshSession
      .put(`${root}/${lesson.id}/progress`)
      .send({ completed: [0, 1] })
      .expect(200)
  ).body;
  assert.ok(finished.completedAt);
  const repeated = (
    await freshSession
      .put(`${root}/${lesson.id}/progress`)
      .send({ completed: [0, 1] })
      .expect(200)
  ).body;
  assert.equal(repeated.completedAt, finished.completedAt);
  await freshSession
    .put(`${root}/${lesson.id}/progress`)
    .send({ completed: [0] })
    .expect(200);
  assert.equal(
    (await freshSession.get(root).expect(200)).body[0].progress.completedAt,
    null,
  );
  assert.ok((await owner.get(root).expect(200)).body[0].progress.completedAt);
});
test("assistant reports missing provider without fabricated replies; live checks require approved sources", async () => {
  await owner
    .post(`/api/workspaces/${wid}/assistant`)
    .send({ message: "Help me review my records" })
    .expect(503);
  assert.deepEqual(
    (await owner.get(`/api/workspaces/${wid}/assistant`).expect(200)).body,
    [],
  );
  await outsider.get(`/api/workspaces/${wid}/assistant`).expect(403);
  await owner
    .post(`/api/workspaces/${wid}/observe`)
    .send({ procedureId: pid, image: "not-an-image", step: 0 })
    .expect(400);
  const signals = (
    await owner.get(`/api/workspaces/${wid}/briefing`).expect(200)
  ).body;
  assert.ok(Array.isArray(signals));
});
test("PDF documents upload privately and wait for provider configuration", async () => {
  const doc = await owner
    .post(`/api/workspaces/${wid}/media`)
    .field("title", "Scanner document")
    .field("analyze", "true")
    .attach("file", Buffer.from("%PDF-1.4\nexample\n%%EOF"), "scan.pdf")
    .expect(201);
  assert.equal(doc.body.mime, "application/pdf");
  assert.equal(doc.body.status, "waiting_configuration");
  await outsider
    .get(`/api/workspaces/${wid}/media/${doc.body.id}/file`)
    .expect(403);
  await owner
    .post(`/api/workspaces/${wid}/media`)
    .field("title", "Fake document")
    .attach("file", Buffer.from("not a pdf"), "scan.pdf")
    .expect(415);
});
test("configured chat isolates user histories, supplies approved context, and observes valid camera frames", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "mg-ai-routes-"));
  let payload,
    refuse = false;
  const instance = createApp({
    dataDir,
    aiEnabled: true,
    respond: async (p) => {
      payload = p;
      return {
        allowed: !refuse,
        reply: refuse
          ? "unsafe generated content"
          : "Check the visitor register.",
        observations: ["A register is visible."],
        uncertainties: ["Cannot read the text."],
      };
    },
  });
  try {
    const teacher = request.agent(instance.app),
      learner = request.agent(instance.app);
    await teacher
      .post("/api/auth/register")
      .send({
        name: "Teacher",
        email: "first@test.com",
        password: "teacher-password-long",
      })
      .expect(201);
    const w = (
      await teacher
        .post("/api/workspaces")
        .send({ name: "Practice", kind: "facility" })
        .expect(201)
    ).body.id;
    const root = `/api/workspaces/${w}`;
    await learner
      .post("/api/auth/register")
      .send({
        name: "Learner",
        email: "second@test.com",
        password: "learner-password-long",
      })
      .expect(201);
    await teacher
      .post(root + "/members")
      .send({ email: "second@test.com", role: "member" })
      .expect(201);
    const p = instance.repo.put(w, "procedure", {
      title: "Visitor records",
      summary: "Keep a register.",
      steps: ["Record the name"],
      questions: [],
      gaps: [],
      status: "approved",
      version: 1,
    });
    instance.repo.put(w, "procedure", {
      title: "Unreviewed secret draft",
      summary: "Do not trust this",
      steps: [],
      status: "draft",
      version: 1,
    });
    const reply = await teacher
      .post(root + "/assistant")
      .send({ message: "What do my procedures say?" })
      .expect(200);
    assert.equal(reply.body[1].text, "Check the visitor register.");
    const context = JSON.parse(payload.content[0].text);
    assert.equal(context.approvedProcedures.length, 1);
    assert.deepEqual(
      (await learner.get(root + "/assistant").expect(200)).body,
      [],
    );
    refuse = true;
    const refusal = await teacher
      .post(root + "/assistant")
      .send({ message: "Out of scope request" })
      .expect(200);
    assert.ok(
      !JSON.stringify(refusal.body).includes("unsafe generated content"),
    );
    refuse = false;
    const jpeg = await sharp({
      create: { width: 30, height: 30, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    const observation = await teacher
      .post(root + "/observe")
      .send({
        procedureId: p.id,
        step: 0,
        image: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      })
      .expect(200);
    assert.ok(observation.body.checkedAt);
    assert.equal(payload.content[1].type, "image");
    assert.equal(instance.repo.list(w, "media").length, 0);
    await teacher.delete(root + "/assistant").expect(200);
    assert.deepEqual(
      (await teacher.get(root + "/assistant").expect(200)).body,
      [],
    );
  } finally {
    instance.db.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
