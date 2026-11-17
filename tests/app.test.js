import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app.js";

const dir = mkdtempSync(join(tmpdir(), "mastergrow-test-"));
const { app, db } = createApp({ dataDir: dir, aiEnabled: false });
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const owner = request.agent(app),
  member = request.agent(app),
  outsider = request.agent(app);
let wid, pid, aid;
test("accounts reject weak passwords and create private authenticated workspaces", async () => {
  await owner
    .post("/api/auth/register")
    .send({ name: "Owner", email: "owner@test.com", password: "short" })
    .expect(400);
  await owner
    .post("/api/auth/register")
    .send({
      name: "Owner",
      email: "owner@test.com",
      password: "correct-horse-battery",
    })
    .expect(201);
  const w = await owner
    .post("/api/workspaces")
    .send({ name: "Operations", kind: "facility" })
    .expect(201);
  wid = w.body.id;
  await outsider.get(`/api/workspaces/${wid}/journals`).expect(401);
  await outsider
    .post("/api/auth/register")
    .send({
      name: "Other",
      email: "other@test.com",
      password: "correct-horse-battery",
    })
    .expect(201);
  await outsider.get(`/api/workspaces/${wid}/journals`).expect(403);
  await owner
    .post(`/api/workspaces/${wid}/journals`)
    .set("Origin", "https://evil.example")
    .send({ title: "Injected", body: "No" })
    .expect(403);
});
test("journal persists and audit attributes mutations", async () => {
  await owner
    .post(`/api/workspaces/${wid}/journals`)
    .send({ title: "Opening notes", body: "Reviewed the visitor register." })
    .expect(201);
  const j = await owner.get(`/api/workspaces/${wid}/journals`).expect(200);
  assert.equal(j.body[0].title, "Opening notes");
  const a = await owner.get(`/api/workspaces/${wid}/audit`).expect(200);
  assert.ok(
    a.body.some((x) => x.action === "journal.created" && x.actor === "Owner"),
  );
});
test("procedure approvals freeze versions and assignments retain approved content", async () => {
  await member
    .post("/api/auth/register")
    .send({
      name: "Member",
      email: "member@test.com",
      password: "correct-horse-battery",
    })
    .expect(201);
  await owner
    .post(`/api/workspaces/${wid}/members`)
    .send({ email: "member@test.com", role: "member" })
    .expect(201);
  const p = await owner
    .post(`/api/workspaces/${wid}/procedures`)
    .send({
      title: "Visitor records",
      summary: "Record visits.",
      steps: ["Enter visitor name", "Record departure"],
      questions: [],
      gaps: [],
    })
    .expect(201);
  pid = p.body.id;
  await member
    .post(`/api/workspaces/${wid}/procedures/${pid}/approve`)
    .send({ version: 1 })
    .expect(403);
  await owner
    .post(`/api/workspaces/${wid}/procedures/${pid}/approve`)
    .send({ version: 1 })
    .expect(409);
  await owner
    .post(`/api/workspaces/${wid}/procedures/${pid}/submit`)
    .send({ version: 1 })
    .expect(200);
  await owner
    .post(`/api/workspaces/${wid}/procedures/${pid}/approve`)
    .send({ version: 2 })
    .expect(409);
  await owner
    .post(`/api/workspaces/${wid}/procedures/${pid}/approve`)
    .send({ version: 1 })
    .expect(200);
  await owner
    .patch(`/api/workspaces/${wid}/procedures/${pid}`)
    .send({ title: "Changed", version: 1 })
    .expect(409);
  const members = await owner.get(`/api/workspaces/${wid}/members`);
  const uid = members.body.find((x) => x.email === "member@test.com").id;
  const a = await owner
    .post(`/api/workspaces/${wid}/assignments`)
    .send({ procedureId: pid, userId: uid, dueDate: "2027-01-01" })
    .expect(201);
  aid = a.body.id;
  await owner
    .post(`/api/workspaces/${wid}/assignments/${aid}/complete`)
    .send({})
    .expect(403);
  await member
    .post(`/api/workspaces/${wid}/assignments/${aid}/complete`)
    .send({})
    .expect(200);
  const list = await member.get(`/api/workspaces/${wid}/assignments`);
  assert.equal(list.body[0].snapshot.title, "Visitor records");
  assert.ok(list.body[0].completedAt);
  await owner
    .post(`/api/workspaces/${wid}/procedures/${pid}/revise`)
    .send({ version: 1 })
    .expect(201);
});
test("private uploads validate content and honestly wait for AI configuration", async () => {
  await owner
    .post(`/api/workspaces/${wid}/media`)
    .field("title", "Bad")
    .attach("file", Buffer.from("<script>alert(1)</script>"), "fake.png")
    .expect(415);
  const r = await owner
    .post(`/api/workspaces/${wid}/media`)
    .field("title", "Visitor policy")
    .field("analyze", "true")
    .attach(
      "file",
      Buffer.from("Write down the visitor name and arrival time."),
      "policy.txt",
    )
    .expect(201);
  assert.equal(r.body.status, "waiting_configuration");
  await outsider
    .get(`/api/workspaces/${wid}/media/${r.body.id}/file`)
    .expect(403);
  const file = await owner
    .get(`/api/workspaces/${wid}/media/${r.body.id}/file`)
    .expect(200);
  assert.match(file.text, /visitor/);
  await owner
    .post(`/api/workspaces/${wid}/media/${r.body.id}/retry`)
    .send({})
    .expect(503);
});
test("logout revokes session and invalid credentials are generic", async () => {
  await outsider.post("/api/auth/logout").expect(200);
  await outsider.get("/api/auth/me").expect(401);
  await outsider
    .post("/api/auth/login")
    .send({ email: "other@test.com", password: "wrong-password" })
    .expect(401);
});
