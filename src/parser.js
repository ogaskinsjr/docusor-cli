// src/parser.js
import fs from "node:fs";
import { marked } from "marked";
import { StepKind } from "./types.js";

export function parseDocsToSteps(docPath = "README.md") {
  const md = fs.readFileSync(docPath, "utf8");
  const tokens = marked.lexer(md);
  const steps = [];

  for (const t of tokens) {
    if (t.type === "code" && (t.lang || "").toLowerCase() === "bash") {
      const lines = t.text.split("\n");

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // comment directives
        if (line.startsWith("#")) {
          const a = line.match(/^#\s*assert:\s*(.+)$/i);
          if (a) { steps.push({ kind: StepKind.ASSERT, spec: a[1] }); continue; }

          const w = line.match(/^#\s*waitFor:\s*(.+)$/i);
          if (w) { steps.push({ kind: StepKind.WAIT_FOR, spec: w[1] }); continue; }

          const sp = line.match(/^#\s*spawn:\s*(.+)$/i);
          if (sp) { steps.push({ kind: StepKind.SPAWN, spec: sp[1] }); continue; }

          continue; // ignore other comments
        }

        // shell command
        steps.push({ kind: StepKind.SHELL, cmd: line, timeoutSec: 300 });
      }
    }
  }
  return steps;
}
