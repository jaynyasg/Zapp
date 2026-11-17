import { resolve } from "node:path";
import { createApp } from "./app.js";
import { startWorker } from "./processor.js";
const dataDir = resolve(process.env.DATA_DIR || "data");
const { app, db, repo } = createApp({ dataDir });
const stop = startWorker({ db, repo, dataDir });
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      "MasterGrow listening on http://127.0.0.1:" + (process.env.PORT || 3001),
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
