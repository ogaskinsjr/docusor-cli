// src/index.js
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseDocsToSteps } from "./parser.js";
import { runSteps } from "./runner.js";
import { composeExists, composeUp, composeDown } from "./orchestrator.js";
import { writeJson, writeMarkdown } from "./reporters.js";

async function main() {
  const doc = process.argv[2] || "README.md";
  const cwd = process.cwd();
  const projectName = "vd_" + Math.random().toString(36).slice(2, 8);

  if (!fs.existsSync(path.join(cwd, doc))) {
    console.error(`Doc not found: ${doc}`);
    process.exit(2);
  }

  const steps = parseDocsToSteps(doc);

  if (composeExists(cwd)) {
    console.log("🔧 Bringing up docker-compose…");
    try { await composeUp(projectName, cwd); }
    catch (e) { console.error("compose up failed:", e.message); }
  }

  console.log(`▶️  Running ${steps.length} steps…`);
  const result = await runSteps(steps, { projectName, cwd });

  if (composeExists(cwd)) {
    console.log("🧹 Bringing down docker-compose…");
    try { await composeDown(projectName, cwd); } catch {}
  }

  writeJson(result);
  writeMarkdown(result);

  console.log(result.overallOk ? "✅ Docs Verified" : "❌ Docs Failed");
  process.exit(result.overallOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
