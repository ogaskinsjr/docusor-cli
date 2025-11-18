#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseDocsToSteps } from "./parser.js";
import { runSteps } from "./runner.js";
import { composeExists, composeUp, composeDown } from "./orchestrator.js";
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

async function main() {
const docArg = process.argv[2] || "README.md";
const cwd = process.cwd();

const docPath = path.isAbsolute(docArg) ? docArg : path.join(cwd, docArg);


if (!fs.existsSync(docPath)) {
  console.error(`Doc not found: ${docPath}`);
  process.exit(2);
  }
const projectName = "vd_" + Math.random().toString(36).slice(2, 8);
const steps = parseDocsToSteps(docPath);


  if (composeExists(cwd)) {
    console.log("🔧 Bringing up docker-compose…");
    try { await composeUp(projectName, cwd); }
    catch (e) { console.error("compose up failed:", e.message); }
  }

  console.log(`▶️  Running ${steps.length} steps…`);

  const result = await runSteps(steps, { projectName, cwd });

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
    try { await composeDown(projectName, cwd); } catch {}
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
