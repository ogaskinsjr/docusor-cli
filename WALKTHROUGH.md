# DocuSOR — Executable Documentation Verifier (All-in-One README)

[![Docs Verified](https://img.shields.io/badge/docs-verified-brightgreen)](./DOCUSOR_REPORT.md) [![License: Apache 2.o](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

DocuSOR turns your README into a test suite. It executes commands from fenced `bash` blocks in your docs, optionally brings up Docker Compose, evaluates assertions (`httpOk`, `httpStatus`, `portOpen`, `fileExists`, `logContains`, `commandSucceeds`) and waits (`waitFor`), and emits Markdown/JSON reports. Use it locally or in CI to keep onboarding instructions honest.

CONTENTS: Features • Installation & Running (Option A: Docker) • Installation & Running (Option B: npm CLI) • Authoring Your README (Runnable Docs) • Assertions & Waits — Full Reference • Outputs / Exit Codes / Reports • GitHub Actions (CI) — Drop-in Workflow • Configuration & Defaults • Troubleshooting • Development (Local + Docker) • FAQ • Security • Contributing • Code of Conduct • Roadmap • Trademark Notice • License • Appendix: Helpful Snippets

FEATURES
- Runs `bash` code fences directly from `README.md`
- Built-in assertions: `httpOk <url>` • `httpStatus <METHOD> <url> <code> [jsonBody]` • `portOpen [host] <port>` • `fileExists [container:<svc>] <path>` • `logContains container:<svc> "text"` • `commandSucceeds [container:<svc>] "<cmd>"`
- Built-in waits: `httpOk <url> [timeoutSec]` • `portOpen [host] <port> [timeoutSec]` • `logContains container:<svc> "text" [timeoutSec]`
- Auto-detects Docker Compose → `up -d` before run, `down -v` after
- Generates `DOCUSOR_REPORT.md` + `docusor-report.json`
- Stops on first failure (MVP behavior)
- Works locally and in CI

INSTALLATION & RUNNING (OPTION A: DOCKER)
Use this for CI and clean local runs. It uses the host Docker via the socket.
docker run --rm
-v /var/run/docker.sock:/var/run/docker.sock
-v "$PWD":/workspace
ghcr.io/ogaskinsjr/docusor-mvp:0.1.0
/workspace/README.md

Produces: `DOCUSOR_REPORT.md`, `docusor-report.json` • Exit codes: `0` pass • `1` fail • `2` fatal error (e.g., missing README)

INSTALLATION & RUNNING (OPTION B: NPM CLI)
Use this if you prefer a global/local CLI without Docker. Requires Node ≥ 18.
npm install -g docusor-mvp
docusor README.md

Local (dev-dependency) is fine too:
npm install --save-dev docusor-mvp
npx docusor README.md


AUTHORING YOUR README (RUNNABLE DOCS)
Place setup steps in a fenced `bash` block. Use `# assert:` and `# waitFor:` as inline directives; non-directive lines execute as shell commands.
```bash
# Start your app (Compose will also be auto-started if compose.yml is present)
docker compose up -d

# Wait until service is reachable and healthy
# waitFor: portOpen 127.0.0.1 8080 30
# waitFor: httpOk http://localhost:8080/health 30

# Verify API responds
# assert: httpStatus GET http://localhost:8080/health 200

# Verify logs contain startup line (compose service "web")
# assert: logContains container:web "Started server on port 8080"

# Verify a file was created
# assert: fileExists ./config/generated.yml

# Require a command to succeed (host and container examples)
# assert: commandSucceeds "echo ok"
# assert: commandSucceeds container:web "curl -sSf http://localhost:8080/health"

Rules: container:<svc> uses the Docker Compose service name. waitFor has a default timeout of 60s if omitted. httpStatus optional JSON body is supported for POST/PUT.

ASSERTIONS & WAITS — FULL REFERENCE
Assertions:

httpOk <url> → pass on any 2xx. Example: # assert: httpOk http://localhost:8080/health

httpStatus <METHOD> <url> <code> [jsonBody] → exact status match; body is optional JSON. Examples:

# assert: httpStatus GET http://localhost:8080/health 200

# assert: httpStatus POST http://localhost:8080/login 200 '{"user":"a","pass":"b"}'

portOpen [host] <port> → defaults to 127.0.0.1. Examples: # assert: portOpen 127.0.0.1 5432 • # assert: portOpen 6379

fileExists [container:<svc>] <path> → host or container path. Examples: # assert: fileExists ./config/generated.yml • # assert: fileExists container:web /app/.cache/boot.log

logContains container:<svc> "text" → scans ~1000 recent log lines. Example: # assert: logContains container:web "Started server"

commandSucceeds [container:<svc>] "<cmd>" → exit code must be 0. Examples: # assert: commandSucceeds "echo ok" • # assert: commandSucceeds container:web "curl -sSf http://localhost:8080/health"
Waits:

waitFor: httpOk <url> [timeoutSec] → # waitFor: httpOk http://localhost:8080/health 45

waitFor: portOpen [host] <port> [timeoutSec] → # waitFor: portOpen 127.0.0.1 8080 60 or # waitFor: portOpen 8080 30

waitFor: logContains container:<svc> "text" [timeoutSec] → # waitFor: logContains container:web "Started server on port 8080" 60

OUTPUTS, EXIT CODES, AND REPORTS

DOCUSOR_REPORT.md — human-readable summary with a table of steps (✅/❌) and collapsible stdout/stderr for failures

docusor-report.json — machine-readable details (per-step status, timings, stdout/stderr)

Exit codes: 0 = all checks passed • 1 = verification failed • 2 = fatal error (e.g., missing README)
Sample Markdown report:
# Docs Verified: ✅

| # | Kind     | Step                                          | Result |
|---:|:--------|:----------------------------------------------|:------:|
| 1  | shell   | `docker compose up -d`                        | ✅ |
| 2  | waitFor | `portOpen 127.0.0.1 8080`                     | ✅ |
| 3  | waitFor | `httpOk http://localhost:8080/health`         | ✅ |
| 4  | assert  | `httpStatus GET http://localhost:8080/health 200` | ✅ |
| 5  | assert  | `logContains container:web "Started server on port 8080"` | ✅ |
| 6  | assert  | `fileExists ./config/generated.yml`           | ✅ |
| 7  | assert  | `commandSucceeds "echo ok"`                   | ✅ |

CONFIGURATION & DEFAULTS

Input: default README.md (override by passing a path to the CLI/Docker)

Docker Compose: if docker-compose.yml or compose.yml exists in repo root → docker compose up -d before steps; docker compose down -v after steps

Failure policy: stops on first failure (MVP). A continue-on-fail mode is planned

HTTP timeouts: assertion requests ~8s each; waits poll up to their timeout

Security: commands run in your environment; review docs before executing

TROUBLESHOOTING

Docker not available → start Docker Engine/Desktop; ensure access to /var/run/docker.sock

Services slow to start → use waitFor: portOpen … before waitFor: httpOk …; increase the timeout

container:<svc> name wrong → must match the Compose service name

Windows → use WSL2 or run on Linux/CI for best results

Logs too short → logContains scans ~1000 lines; ensure your service logs the searched text

DEVELOPMENT (LOCAL + DOCKER)
Local dev:
npm install
npm run test-run   # runs the CLI against README.md

Build & run the Docker image (maintainers):
docker build -t ghcr.io/ogaskinsjr/docusor-cli:0.1.0 .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD":/workspace ghcr.io/ogaskinsjr/docusor-cli:0.1.0 /workspace/README.md

FAQ

Why not just rely on tests? → Tests validate code; DocuSOR validates onboarding docs end-to-end (prereqs, commands, runtime behavior). They are complementary.

Can I run only locally and not in CI? → Yes. Docker (Option A) or CLI (Option B) both work locally.

Does this support non-HTTP apps (Kafka, DBs, microservices)? → Yes via portOpen, commandSucceeds, logContains, fileExists. More domain-specific assertions (DB query, Kafka round-trip) are planned.

Can I point at docs other than README.md? → Yes — pass a path when invoking (e.g., /workspace/docs/GettingStarted.md).

SECURITY
Review commands before running; DocuSOR executes what’s in your docs. In CI, prefer isolated runners/containers and least-privilege tokens. To report vulnerabilities, open a private advisory or email the maintainers.

CONTRIBUTING
PRs welcome. Keep assertions deterministic and side-effect-free; minimize dependencies; add README examples to cover new features; include basic tests or a sample doc that exercises the change. Dev quickstart:

npm install
npm run test-run

CODE OF CONDUCT
Be respectful. Harassment, hate speech, and discrimination are not tolerated. Maintain a welcoming environment for all contributors and users.

ROADMAP
continue-on-fail option • Additional assertions (dbQuery, kafkaRoundTrip, fileContains) • docusor.yaml config (timeouts, env, working dir) • JUnit reporter for CI test summaries • DocuSOR Cloud: trusted badge + required GitHub status check

TRADEMARK NOTICE
“DocuSOR” and “Docs Verified” may be trademarks of their respective owner(s). Use of the marks may be restricted for trust/badge features.