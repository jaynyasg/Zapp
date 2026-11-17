import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import { openDatabase, repository } from "../server/db.js";
import {
  validateMaterial,
  processNext,
  recoverJobs,
  extractSource,
} from "../server/processor.js";

test("model results reject malformed content and discard out-of-scope instructions", () => {
  assert.throws(() =>
    validateMaterial({ allowed: true, title: "x", steps: "not an array" }),
  );
  const blocked = validateMaterial({
    allowed: false,
    reason: "Out of scope",
    title: "x",
    summary: "",
    steps: ["untrusted"],
    questions: [],
    gaps: [],
  });
  assert.equal(blocked.allowed, false);
  assert.equal("steps" in blocked, false);
  assert.equal("summary" in blocked, false);
});
test("pictures are decoded and video frames include evidence limits and timestamps", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-extract-"));
  const db = openDatabase(dir);
  try {
    const image = join(dir, "uploads", "photo.png");
    await sharp({
      create: { width: 200, height: 120, channels: 3, background: "#abcdef" },
    })
      .png()
      .toFile(image);
    const pic = await extractSource(
      { mime: "image/png", storedName: "photo.png" },
      dir,
    );
    assert.equal(pic[1].source.media_type, "image/jpeg");
    assert.ok(pic[1].source.data.length > 10);
    const video = join(dir, "uploads", "clip.mp4");
    execFileSync(
      ffmpeg,
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=160x120:d=2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        video,
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    const frames = await extractSource(
      { mime: "video/mp4", storedName: "clip.mp4" },
      dir,
    );
    assert.match(frames[0].text, /Audio was NOT analyzed/);
    assert.ok(frames.some((x) => x.type === "image"));
    assert.ok(frames.some((x) => x.text?.includes("frame time")));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("worker creates source-linked draft and recovers interrupted jobs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mg-worker-"));
  const db = openDatabase(dir),
    repo = repository(db);
  try {
    db.prepare("INSERT INTO workspaces VALUES(?,?,?,?)").run(
      "w",
      "test",
      "home",
      new Date().toISOString(),
    );
    writeFileSync(
      join(dir, "uploads", "source"),
      "Record arrival time in the visitor book.",
    );
    const m = repo.put("w", "media", {
      title: "Visitor record",
      mime: "text/plain",
      storedName: "source",
      status: "processing",
    });
    recoverJobs(db, repo);
    assert.equal(repo.get("w", "media", m.id).status, "queued");
    await processNext({
      db,
      repo,
      dataDir: dir,
      generate: async () => ({
        allowed: true,
        title: "Visitor record",
        summary: "Record visitors.",
        steps: ["Record arrival time. [text]"],
        questions: ["Where is arrival time recorded?"],
        gaps: [],
      }),
    });
    assert.equal(repo.get("w", "media", m.id).status, "draft");
    const p = repo.list("w", "procedure")[0];
    assert.equal(p.sourceId, m.id);
    assert.equal(p.status, "draft");
    assert.equal(p.steps[0], "Record arrival time. [text]");
    const f = repo.put("w", "media", { ...m, id: undefined, status: "queued" });
    await processNext({
      db,
      repo,
      dataDir: dir,
      generate: async () => {
        throw new Error("secret provider detail");
      },
    });
    assert.equal(repo.get("w", "media", f.id).status, "failed");
    assert.doesNotMatch(repo.get("w", "media", f.id).processingError, /secret/);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
