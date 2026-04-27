# DocuSOR — Agent Reference

DocuSOR turns Markdown files into executable test suites. It runs shell commands from fenced `bash` blocks and evaluates inline `assert` and `waitFor` directives written as comments.

## How It Works

DocuSOR scans every fenced ` ```bash ``` ` block in a Markdown file (default: `README.md`). Each line is one of three things:

1. **Shell command** — any non-comment line; executed directly
2. **`# assert: <spec>`** — evaluated once; fails immediately if false
3. **`# waitFor: <spec>`** — polls until true or timeout expires (default: 60s)

Lines starting with `#` that are not `assert:` or `waitFor:` are ignored as normal comments.

---

## Directives

### Assertions — `# assert: <spec>`

Run once. Pass or fail immediately.

```bash
# assert: httpOk <url>
```
GET the URL; passes on HTTP 200.

```bash
# assert: httpStatus <METHOD> <url> <statusCode> [jsonBody]
```
Any HTTP method and exact status code. `jsonBody` is an optional JSON string for POST/PUT.

```bash
# assert: portOpen [host] <port>
```
TCP connect check. `host` defaults to `127.0.0.1`.

```bash
# assert: fileExists <path>
# assert: fileExists container:<svc> <path>
```
Local filesystem check, or inside a named Docker Compose service container.

```bash
# assert: logContains container:<svc> "text"
```
Searches the last ~1000 log lines of the container for the given text.

```bash
# assert: commandSucceeds "<cmd>"
# assert: commandSucceeds container:<svc> "<cmd>"
```
Runs the command via `bash -lc`. Passes if exit code is 0. Works on host or inside a container.

---

### Waits — `# waitFor: <spec>`

Poll until condition is met or timeout expires. Default timeout: **60 seconds**.

```bash
# waitFor: httpOk <url> [timeoutSec]
```

```bash
# waitFor: portOpen [host] <port> [timeoutSec]
```

```bash
# waitFor: logContains container:<svc> "text" [timeoutSec]
```

---

## Full Directive Syntax Table

| Directive | Syntax |
|---|---|
| `httpOk` | `httpOk <url>` |
| `httpStatus` | `httpStatus <METHOD> <url> <code> [jsonBody]` |
| `portOpen` | `portOpen [host] <port>` |
| `fileExists` | `fileExists [container:<svc>] <path>` |
| `logContains` | `logContains container:<svc> "text"` |
| `commandSucceeds` | `commandSucceeds [container:<svc>] "<cmd>"` |
| `waitFor httpOk` | `waitFor: httpOk <url> [timeoutSec]` |
| `waitFor portOpen` | `waitFor: portOpen [host] <port> [timeoutSec]` |
| `waitFor logContains` | `waitFor: logContains container:<svc> "text" [timeoutSec]` |

---

## Rules

- Directives **must be inside** a fenced ` ```bash ``` ` block.
- `container:<svc>` refers to the **Docker Compose service name** (not the container name).
- Environment variables (`$VAR` or `${VAR}`) in directives are interpolated at runtime.
- Quotes around text arguments are stripped automatically — `"text"` and `'text'` both work.
- DocuSOR **stops on the first failure** (MVP behavior).
- If `docker-compose.yml` or `compose.yml` is present, DocuSOR auto-runs `up -d` before steps and `down -v` after.

---

## Recommended Pattern

Always place `waitFor` before `assert` when testing services that need startup time:

```bash
docker compose up -d

# waitFor: portOpen 8080 30
# waitFor: httpOk http://localhost:8080/health 60

# assert: httpOk http://localhost:8080/health
# assert: httpStatus GET http://localhost:8080/health 200
# assert: httpStatus POST http://localhost:8080/api/users 201 {"name":"test"}
# assert: portOpen 127.0.0.1 5432
# assert: fileExists container:api /app/config.json
# assert: logContains container:api "Server started"
# assert: commandSucceeds container:api "pg_isready -U postgres"
# assert: commandSucceeds "curl -sf http://localhost:8080/health"
```

---

## Run DocuSOR

**Docker (recommended for CI):**
```bash
docker run --rm -w /workspace \
  -v "${PWD}:/workspace" \
  -v //var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/ogaskinsjr/docusor-cli:latest README.md
```

**npm CLI:**
```bash
npx docusor run README.md
# or point at any markdown file:
npx docusor run docs/GettingStarted.md
```

---

## Outputs

| File | Description |
|---|---|
| `DOCUSOR_REPORT.md` | Human-readable Markdown table with ✅ / ❌ per step |
| `docusor-report.json` | Machine-readable JSON with status, timings, stdout/stderr |

**Exit codes:**
- `0` — all checks passed
- `1` — one or more assertions/waits failed
- `2` — fatal error (missing file, invalid directive, internal error)
