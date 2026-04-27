# DocuSOR — Executable Documentation Verifier (All-in-One README)

[![Docs Verified](https://img.shields.io/badge/docs-verified-brightgreen)](./DOCUSOR_REPORT.md) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](#license)

DocuSOR turns your README into a test suite. It executes commands from fenced `bash` blocks in your docs, optionally brings up Docker Compose, evaluates assertions (`httpOk`, `httpStatus`, `portOpen`, `fileExists`, `logContains`, `commandSucceeds`) and waits (`waitFor`), and emits Markdown/JSON reports. Use it locally or in CI to keep onboarding instructions honest.

> **Open-core model:**  
> This repo is the **open-source DocuSOR CLI** (Apache-2.0).  

---

## Contents

- [Features](#features)  
- [Installation & Running (Option A: Docker)](#installation--running-option-a-docker)  
- [Installation & Running (Option B: npm CLI)](#installation--running-option-b-npm-cli)  
- [Authoring Your README (Runnable Docs)](#authoring-your-readme-runnable-docs)  
- [Assertions & Waits — Full Reference](#assertions--waits--full-reference)  
- [Outputs, Exit Codes, and Reports](#outputs-exit-codes-and-reports)  
- [GitHub Actions (CI) — Drop-in Workflow](#github-actions-ci--drop-in-workflow)  
- [Configuration & Defaults](#configuration--defaults)  
- [Troubleshooting](#troubleshooting)  
- [Development (Local + Docker)](#development-local--docker)  
- [FAQ](#faq)  
- [Security](#security)  
- [Contributing](#contributing)  
- [Code of Conduct](#code-of-conduct)  
- [Changelog](#changelog)  
- [Roadmap](#roadmap)  
- [Trademark & Logo Notice](#trademark--logo-notice)  
- [License](#license)  
- [Appendix: Helpful Snippets](#appendix-helpful-snippets)

---

## Features

- Runs `bash` code fences directly from `README.md`.
- Built-in assertions:
  - `httpOk <url>`
  - `httpStatus <METHOD> <url> <code> [jsonBody]`
  - `portOpen [host] <port>`
  - `fileExists [container:<svc>] <path>`
  - `logContains container:<svc> "text"`
  - `commandSucceeds [container:<svc>] "<cmd>"`
- Built-in waits:
  - `httpOk <url> [timeoutSec]`
  - `portOpen [host] <port> [timeoutSec]`
  - `logContains container:<svc> "text" [timeoutSec]`
- Auto-detects Docker Compose → `up -d` before run, `down -v` after.
- Generates:
  - `DOCUSOR_REPORT.md` — human-readable report
  - `docusor-report.json` — machine-readable report
- Stops on first failure (**MVP behavior**).
- Works locally and in CI.

---

## Installation & Running (Option A: Docker)

Use this for CI and clean local runs. It uses the host Docker via the socket. The DocuSOR Image is used from GHCR

```bash
docker run --rm -w /workspace -v "${PWD}:/workspace" -v //var/run/docker.sock:/var/run/docker.sock ghcr.io/ogaskinsjr/docusor-cli:latest README.md
```

This will:

- Execute runnable docs in `/workspace/README.md` (or the path you pass).
- Produce:
  - `DOCUSOR_REPORT.md`
  - `docusor-report.json`
- Return exit codes:
  - `0` — all checks passed
  - `1` — verification failed (assertion/wait failed)
  - `2` — fatal error (e.g., missing README, invalid directive, internal error)

---

## Installation & Running (Option B: npm CLI - Coming Soon to NPM Library)

Use this if you prefer a global/local CLI. Requires **Node ≥ 18**.

Global install:

```bash
npm install -g docusor-cli
docusor run README.md
```

Local (dev-dependency):

```bash
npm install --save-dev docusor-cli
npx docusor run README.md
```

You can point DocuSOR at any markdown file:

```bash
docusor run docs/GettingStarted.md
```

---

## Authoring Your README (Runnable Docs)

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
```

Rules & notes:

- `container:<svc>` uses the **Docker Compose service name**.
- `waitFor` has a default timeout of **60s** if omitted.
- `httpStatus` optional JSON body is supported for `POST`/`PUT` (see reference below).
- Non-directive lines (`#` that are not `assert:` / `waitFor:`) are treated as normal shell comments.

---

## Assertions & Waits — Full Reference

### Assertions

#### `httpOk <url>`

Passes on any **2xx** HTTP status.

```bash
# assert: httpOk http://localhost:8080/health
```

#### `httpStatus <METHOD> <url> <code> [jsonBody]`

Exact status match; body is optional JSON (for `POST`, `PUT`, etc.).

```bash
# assert: httpStatus GET http://localhost:8080/health 200
# assert: httpStatus POST http://localhost:8080/login 200 '{"user":"a","pass":"b"}'
```

#### `portOpen [host] <port>`

Checks if `<port>` is open on `host` (defaults to `127.0.0.1`).

```bash
# assert: portOpen 127.0.0.1 5432
# assert: portOpen 6379
```

#### `fileExists [container:<svc>] <path>`

Checks for a file either on the **host** or inside a **container**.

```bash
# assert: fileExists ./config/generated.yml
# assert: fileExists container:web /app/.cache/boot.log
```

#### `logContains container:<svc> "text"`

Scans ~1000 recent log lines for the given text.

```bash
# assert: logContains container:web "Started server"
```

#### `commandSucceeds [container:<svc>] "<cmd>"`

The command’s exit code must be `0` (success). Works on host or in a container.

```bash
# assert: commandSucceeds "echo ok"
# assert: commandSucceeds container:web "curl -sSf http://localhost:8080/health"
```

---

### Waits

Wait directives **poll until success or timeout**.

#### `waitFor: httpOk <url> [timeoutSec]`

```bash
# waitFor: httpOk http://localhost:8080/health 6s
```

#### `waitFor: portOpen [host] <port> [timeoutSec]`

```bash
# waitFor: portOpen 127.0.0.1 8080 60
# waitFor: portOpen 8080 30
```

#### `waitFor: logContains container:<svc> "text" [timeoutSec]`

```bash
# waitFor: logContains container:web "Started server on port 8080" 60
```

---

## Outputs, Exit Codes, and Reports

DocuSOR emits two outputs by default:

1. **`DOCUSOR_REPORT.md`** — human-readable summary
   - Includes a table of steps (`✅` / `❌`).
   - Collapsible stdout/stderr for failures (GitHub-friendly).

2. **`docusor-report.json`** — machine-readable details
   - Per-step status, timings, stdout/stderr.
   - Suitable for further processing by CI, dashboards, or DocuSOR Cloud.

### Exit Codes

- `0` — all checks passed
- `1` — verification failed (one or more assertions/waits failed)
- `2` — fatal error (missing README, invalid directive, internal error)

### Sample Markdown Report

```md
# Docs Verified: ✅

| # | Kind     | Step                                             | Result |
|---:|:--------|:-------------------------------------------------|:------:|
| 1  | shell   | `docker compose up -d`                           | ✅     |
| 2  | waitFor | `portOpen 127.0.0.1 8080`                        | ✅     |
| 3  | waitFor | `httpOk http://localhost:8080/health`            | ✅     |
| 4  | assert  | `httpStatus GET http://localhost:8080/health 200` | ✅    |
| 5  | assert  | `logContains container:web "Started server on port 8080"` | ✅ |
| 6  | assert  | `fileExists ./config/generated.yml`              | ✅     |
| 7  | assert  | `commandSucceeds "echo ok"`                      | ✅     |
```
## Configuration & Defaults

- **Input file**  
  - Default: `README.md` in the current working directory.  
  - Override by passing a path: `docusor docs/GettingStarted.md`.

- **Docker Compose auto-detection**  
  - If `docker-compose.yml` or `compose.yml` exists in the repo root:
    - Run `docker compose up -d` before any steps.
    - Run `docker compose down -v` after all steps (or on failure).

- **Failure policy**  
  - Stops on first failure (**MVP behavior**).
  - A `continue-on-fail` mode is planned.

- **HTTP timeouts**  
  - Assertion requests: ~8 seconds per HTTP call.
  - Waits poll up to their specified timeout (or a default, e.g. 60s).

- **Security**  
  - Commands run in your environment (or your containers).
  - Review docs before executing them, especially from untrusted sources.

---

## Troubleshooting

- **Docker not available**  
  - Ensure Docker Engine/Desktop is running.
  - On Linux, check access to `/var/run/docker.sock`.

- **Services slow to start**  
  - Use `waitFor: portOpen ...` before `waitFor: httpOk ...`.
  - Increase the timeout value (e.g. `waitFor: httpOk ... 90`).

- **Wrong `container:<svc>` name**  
  - Must match the **Compose service name** in `docker-compose.yml` / `compose.yml`.

- **Windows quirks**  
  - Recommended: use **WSL2** or run on Linux/CI.
  - Volume mounting and paths may behave differently on native Windows.

- **Logs too short for `logContains`**  
  - `logContains` scans ~1000 recent log lines.
  - Ensure your service logs the searched text at least once.

---

## Development (Local + Docker)

Local dev:

```bash
npm install
npm run test-run   # runs the CLI against README.md (or a test README)
```

Build & run the Docker image (for maintainers):

```bash
docker build -t ghcr.io/ogaskinsjr/docusor-cli:0.1.0 .
docker run --rm   -v /var/run/docker.sock:/var/run/docker.sock   -v "$PWD":/workspace   ghcr.io/ogaskinsjr/docusor-cli:0.1.0   /workspace/README_DEMO.md
```

---

## FAQ

**Why not just rely on tests?**  
Tests validate **code**; DocuSOR validates **docs + environment** end-to-end (prereqs, commands, runtime behavior). They are complementary. Tests can pass while onboarding docs are broken.

**How do I integrate with CI/CD?**
The docusor-report allows easy CI/CD integration, but a Cloud service to handle this for your enterprises is coming soon! :D

**Does this support non-HTTP apps (Kafka, DBs, microservices)?**  
Yes, via `portOpen`, `commandSucceeds`, `logContains`, `fileExists`. More domain-specific assertions (`dbQuery`, `kafkaRoundTrip`, etc.) are planned.

**Can I point at docs other than README.md?**  
Yes. Pass a path when invoking:

```bash
docusor docs/GettingStarted.md
```

---

## Security

DocuSOR executes commands from your docs. Treat docs like code:

- Review commands before running them, especially from untrusted repos.
- In CI, prefer isolated runners/containers and least-privilege credentials.
- Do not mount secrets or production data unless necessary.

To report vulnerabilities, open a private security advisory on GitHub or email the maintainers.

---

## Contributing

PRs are welcome.

Guidelines:

- Keep assertions **deterministic** and side-effect-free whenever possible.
- Minimize dependencies and keep the CLI lightweight.
- Add README examples to cover new features.
- Include basic tests or a sample doc that exercises your change.

Dev quickstart:

```bash
npm install
npm run test-run
```

Feel free to open an issue for discussion before a large change.

---

## Code of Conduct

Be respectful. Harassment, hate speech, and discrimination are not tolerated. Maintain a welcoming environment for all contributors and users.

This project follows a “be a good human” standard; a more formal Code of Conduct may be added as the community grows.

---

## Roadmap

Planned / exploring:

- `continue-on-fail` option and richer summary reports.
- Additional assertions:
  - `dbQuery` (basic DB connectivity / query check)
  - `kafkaRoundTrip` (produce/consume sanity checks)
  - `fileContains` (content checks for generated files)
- `docusor.yaml` config:
  - Timeouts, env vars, working dir, includes/excludes.
- JUnit/XML reporter for CI test summaries.
- DocuSOR Cloud:
  - Trusted badge + required GitHub status check.
  - Org-level dashboards, historical trends, SSO/SCIM, private runners, and more.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history, including all releases, new features, bug fixes, and deprecations.

---

## Trademark & Logo Notice

“DocuSOR”, the DocuSOR word mark, the dinosaur logo, and the “Docs Verified” badge are trademarks and/or copyrighted works of Omari Gaskins.

They are **not** licensed under the Apache-2.0 license.

You may use the name “DocuSOR” and the “Docs Verified” badge to accurately describe this project, but you may not:

- Use the name or logo in a way that suggests affiliation with or endorsement by the DocuSOR project or its author without permission.
- Rebrand your own service as “DocuSOR” or use confusingly similar branding.

© 2025 Omari Gaskins. All rights reserved on logo and branding assets.

---

## License

The **code** in this repository is licensed under the **Apache License, Version 2.0**.

You may obtain a copy of the License in the `LICENSE` file in this repository or at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an “AS IS” BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

The **name “DocuSOR” and associated logos/badges are not covered by this license**. See [Trademark & Logo Notice](./NOTICE).

---

## Appendix: Helpful Snippets

### Minimal runnable README example

```bash
# Install dependencies
npm install

# Start the app
npm start &

# waitFor: portOpen 127.0.0.1 3000 60
# assert: httpOk http://localhost:3000/health
```

### Example for separate docs file

```bash
# docs/GettingStarted.md

# Clone the repo
git clone https://github.com/your-org/your-app.git
cd your-app

# Start dependencies
docker compose up -d

# waitFor: portOpen 127.0.0.1 5432 60
# assert: portOpen 127.0.0.1 5432
```

Run:

```bash
docusor docs/<your-doc-name>
```

Happy verifying. ✅
