#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocsToSteps } from "./parser.js";
import { runSteps } from "./runner.js";
import { composeExists, composeUp, composeDown, loadEnvFile } from "./orchestrator.js";
import { writeJson, writeMarkdown } from "./reporters.js";

function labelFor(step) {
  return step.kind === "shell" ? step.cmd : `${step.kind}: ${step.spec}`;
}

function trunc(s, n = 1200) {
  if (!s) return "";
  const str = String(s);
  return str.length > n ? str.slice(0, n) + "\n[truncated]" : str;
}

function printFailureSummary(result) {
  const fail = result.steps.find(s => !s.ok);
  if (!fail) return;
  const idx = (fail.index ?? 0) + 1;
  const label = labelFor(fail.step);

  console.error("");
  console.error("──────────────── FAIL SUMMARY ────────────────");
  console.error(`Step #${idx}: ${label}`);
  if (fail.error) console.error(`Error: ${fail.error}`);
  if (fail.stdout) console.error(`stdout:\n${trunc(fail.stdout)}`);
  if (fail.stderr) console.error(`stderr:\n${trunc(fail.stderr)}`);
  console.error("──────────────────────────────────────────────");
  console.error("");
}

const HELP_GENERAL = `
docusor — Documentation-as-tests runner

USAGE
  docusor <command> [options]

COMMANDS
  run             Run a markdown doc as a test suite.
  install         Copy docusor.md into the current directory.
  help            Show this help message.

Run 'docusor <command> --help' for details on a specific command.
`;

const HELP_RUN = `
docusor run — Run a markdown doc as a test suite

USAGE
  docusor run [options] [DOC_PATH]
  docusor [options] [DOC_PATH]        (run is the default command)

ARGUMENTS
  DOC_PATH        Path to the markdown document to validate.
                  Defaults to README.md in the current directory.

OPTIONS
  --env-file <path>   Load environment variables from a .env file before
                      running steps. Variables are injected into every
                      shell command executed by docusor.

  -help, --help       Show this help message and exit.

EXAMPLES
  docusor                                  Validate README.md
  docusor run README.md                    Explicit subcommand
  docusor docs/QUICKSTART.md              Custom doc path
  docusor --env-file .env README.md       Inject env vars
  docusor run --env-file cfg/.env SETUP.md

OUTPUT
  docusor-report.json   Machine-readable step results
  DOCUSOR_REPORT.md     Human-readable markdown report

  Exit code 0 = all steps passed; exit code 1 = at least one failed.
`;

const HELP_INSTALL = `
docusor install — Copy docusor.md into the current directory

USAGE
  docusor install

DESCRIPTION
  Copies the bundled docusor.md reference file into the current working
  directory so you can use it as a starting point for your own doc tests.
  If docusor.md already exists in the directory the command exits without
  overwriting it.

OPTIONS
  -help, --help   Show this help message and exit.

EXAMPLES
  cd my-project
  docusor install       # creates ./docusor.md
`;

function printHelp(command) {
  if (command === "run") {
    console.log(HELP_RUN);
  } else if (command === "install") {
    console.log(HELP_INSTALL);
  } else {
    console.log(HELP_GENERAL);
  }
}

function runInstall() {
  const pkgRoot = path.dirname(fileURLToPath(import.meta.url), "..");
  const src = path.join(pkgRoot, "..", "docusor.md");
  const dest = path.join(process.cwd(), "docusor.md");

  if (!fs.existsSync(src)) {
    console.error(`docusor.md not found in package (looked at: ${src})`);
    process.exit(1);
  }

  if (fs.existsSync(dest)) {
    console.log("docusor.md already exists in this directory — skipping.");
    process.exit(0);
  }

  fs.copyFileSync(src, dest);
  console.log(`Installed docusor.md → ${dest}`);
  process.exit(0);
}

async function main() {
  // CLI usage:
  //   docusor [run] [--env-file <path>] [DOC_PATH]
  const args = process.argv.slice(2);

  const subcommand = args[0];

  // docusor help
  if (subcommand === "help") {
    printHelp();
    process.exit(0);
  }

  // docusor run --help  /  docusor install --help  /  docusor --help
  const hasHelp = args.includes("-help") || args.includes("--help");
  if (hasHelp) {
    if (subcommand === "run") {
      printHelp("run");
    } else if (subcommand === "install") {
      printHelp("install");
    } else {
      printHelp();
    }
    process.exit(0);
  }

  // Handle install subcommand
  if (subcommand === "install") {
    runInstall();
  }

  // Extract --env-file <path>
  let envFileArg;
  const envFlagIdx = args.indexOf("--env-file");
  if (envFlagIdx !== -1) {
    envFileArg = args[envFlagIdx + 1];
    args.splice(envFlagIdx, 2);
  }

  // Strip optional "run" subcommand
  if (args[0] === "run") args.shift();

  const docArg = args[0] || "README.md";

  const cwd = process.cwd();
  const docPath = path.isAbsolute(docArg) ? docArg : path.join(cwd, docArg);

  const envFilePath = envFileArg
    ? (path.isAbsolute(envFileArg) ? envFileArg : path.join(cwd, envFileArg))
    : undefined;
  if (envFilePath && !fs.existsSync(envFilePath)) {
    console.error(`Env file not found: ${envFilePath}`);
    process.exit(2);
  }
  const envVars = envFilePath ? loadEnvFile(path.dirname(envFilePath), path.basename(envFilePath)) : {};
  if (envFilePath) console.log("Loaded env file:", envFilePath);


  if (!fs.existsSync(docPath)) {
    console.error(`Doc not found: ${docPath}`);
    process.exit(2);
  }
const projectName = "vd_" + Math.random().toString(36).slice(2, 8);
const steps = parseDocsToSteps(docPath);


  if (composeExists(cwd)) {
    console.log("🔧 Bringing up docker-compose…");
    try { await composeUp(projectName, cwd, envFilePath); }
    catch (e) { console.error("compose up failed:", e.message); }
  }

  console.log(`▶️  Running ${steps.length} steps…`);

  const result = await runSteps(steps, { projectName, cwd, env: envVars });

  // Print per-step outcome
  for (const r of result.steps) {
    const idx = (r.index ?? 0) + 1;
    const label = labelFor(r.step);
    if (r.ok) {
      console.log(`✅ Step ${idx}: ${label}`);
    } else {
      console.error(`❌ Step ${idx}: ${label}`);
      if (r.error) console.error(`   Error: ${r.error}`);
      if (r.stdout) console.error(`   stdout:\n${trunc(r.stdout)}`);
      if (r.stderr) console.error(`   stderr:\n${trunc(r.stderr)}`);
      break; // MVP: stop at first failure
    }
  }

  if (composeExists(cwd)) {
    console.log("🧹 Bringing down docker-compose…");
    try { await composeDown(projectName, cwd, envFilePath); } catch {}
  }

  writeJson(result);
  writeMarkdown(result);

  if (!result.overallOk) {
    printFailureSummary(result);
    console.error("❌ Docs Failed");
    process.exit(1);
  }

  console.log("✅ Docs Verified");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
