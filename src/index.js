#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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

function printHelp() {
  console.log(`
docusor — Documentation-as-tests runner

USAGE
  docusor [run] [options] [DOC_PATH]

ARGUMENTS
  DOC_PATH        Path to the markdown document to validate.
                  Defaults to README.md in the current directory.

OPTIONS
  --env-file <path>   Load environment variables from a .env file before
                      running steps. Variables are injected into every
                      shell command executed by docusor.

  -help, --help       Show this help message and exit.

COMMANDS
  run             Explicitly invoke the run subcommand (optional).
                  Equivalent to omitting it entirely.

EXAMPLES
  # Validate the default README.md in the current directory
  docusor

  # Validate a specific markdown file
  docusor README.md

  # Use the explicit run subcommand
  docusor run README.md

  # Validate a doc in a subdirectory
  docusor docs/QUICKSTART.md

  # Inject environment variables from a .env file
  docusor --env-file .env README.md

  # Combine env file with a custom doc path
  docusor run --env-file config/.env docs/SETUP.md

OUTPUT
  docusor writes two report files after every run:
    docusor-report.json   Machine-readable step results
    DOCUSOR_REPORT.md     Human-readable markdown report

  Exit code 0 means all steps passed; exit code 1 means at least one failed.
`);
}

async function main() {
  // CLI usage:
  //   docusor [run] [--env-file <path>] [DOC_PATH]
  const args = process.argv.slice(2);

  // Handle -help / --help before any other processing
  if (args.includes("-help") || args.includes("--help")) {
    printHelp();
    process.exit(0);
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
