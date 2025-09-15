// src/reporters.js
import fs from "node:fs";

export function writeJson(result, out = "docusor-report.json") {
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
}

export function writeMarkdown(result, out = "DOCUSOR_REPORT.md") {
  const lines = [];
  lines.push(`# Docs Verified: ${result.overallOk ? "✅" : "❌"}`);
  lines.push("");
  for (const r of result.steps) {
    const label = r.step.kind === "shell" ? r.step.cmd : `${r.step.kind}: ${r.step.spec}`;
    lines.push(`**Step ${r.index + 1}:** \`${label}\` — ${r.ok ? "✅ Passed" : "❌ Failed"}`);
    if (!r.ok) {
      if (r.stderr) lines.push(`\n\`\`\`stderr\n${String(r.stderr).substring(0, 2000)}\n\`\`\``);
      if (r.stdout) lines.push(`\n\`\`\`stdout\n${String(r.stdout).substring(0, 2000)}\n\`\`\``);
      break;
    }
  }
  fs.writeFileSync(out, lines.join("\n"));
}
