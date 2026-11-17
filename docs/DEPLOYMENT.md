<!-- generated-by: gsd-doc-writer -->

# Deployment

## Local release

`npm ci && npm run build` produces the frontend. `npm start` runs the API and worker and serves that frontend. Local URL: http://127.0.0.1:3001. This build has not been published to a hosting provider.

## Container

The Dockerfile uses Node 24 Debian slim, builds the frontend, removes development dependencies and runs as the node user. It exposes port 3001 and includes a `/health` check.

```sh
docker build -t mastergrow .
docker run --name mastergrow -p 3001:3001 -v mastergrow-data:/app/data --env-file .env -e HOST=0.0.0.0 mastergrow
```

The container requires `HOST=0.0.0.0`; a copied local `.env` sets HOST=127.0.0.1, so override it with `-e HOST=0.0.0.0` when using that file. For public hosting, terminate TLS at a trusted proxy, set `APP_ORIGIN` to the exact HTTPS origin, `COOKIE_SECURE=true`, `NODE_ENV=production`, and configure `TRUST_PROXY` for the actual topology. Never expose raw uploads as a static volume.

<!-- VERIFY: Docker build and runtime were not executed in this session. Validate on the chosen hosting environment. -->

## Persistence and recovery

Use one persistent volume for the complete `DATA_DIR`; it contains the SQLite database and private uploads. Stop the application before making a filesystem backup, copy the entire directory including SQLite sidecar files, and restart. Test restoring a backup in a separate directory before relying on it. Protect backups with access controls and encryption appropriate to your deployment.

Run only one replica. The queue is database-backed but does not implement distributed job leasing. Interrupted processing restarts automatically. Failed provider requests are retried by the user, not in an unbounded automatic loop.

## Before inviting public users

Implement email verification/password recovery, storage quotas and retention/deletion management; validate HTTPS and reverse-proxy settings; perform backup restore and independent security tests; choose malware scanning and content retention policies. Existing auth, role and tenant checks are useful foundations, not a production certification.

GitHub Actions in `.github/workflows/check.yml` runs tests, build, browser verification and dependency audit after push. Its hosted execution has not been observed here.
