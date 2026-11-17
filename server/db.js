import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function openDatabase(dir) {
  mkdirSync(join(dir, "uploads"), { recursive: true });
  const db = new DatabaseSync(join(dir, "mastergrow.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS members(workspace_id TEXT REFERENCES workspaces(id),user_id TEXT REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(workspace_id,user_id));
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),type TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS records_workspace_type ON records(workspace_id,type);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,workspace_id TEXT REFERENCES workspaces(id),actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS audit_workspace ON audit(workspace_id,created);`);
  return db;
}
export function repository(db) {
  const parse = (r) =>
    r
      ? {
          ...JSON.parse(r.data),
          id: r.id,
          workspaceId: r.workspace_id,
          createdAt: r.created,
        }
      : null;
  return {
    list(wid, type) {
      return db
        .prepare(
          "SELECT * FROM records WHERE workspace_id=? AND type=? ORDER BY created DESC",
        )
        .all(wid, type)
        .map(parse);
    },
    get(wid, type, rid) {
      return parse(
        db
          .prepare(
            "SELECT * FROM records WHERE workspace_id=? AND type=? AND id=?",
          )
          .get(wid, type, rid),
      );
    },
    put(wid, type, data) {
      const rid = data.id || id();
      const created = data.createdAt || now();
      db.prepare(
        "INSERT INTO records VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      ).run(rid, wid, type, JSON.stringify(data), created);
      return { ...data, id: rid, workspaceId: wid, createdAt: created };
    },
    transaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const value = fn();
        db.exec("COMMIT");
        return value;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    audit(wid, actor, action, target) {
      db.prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)").run(
        id(),
        wid,
        actor,
        action,
        target,
        now(),
      );
    },
  };
}
