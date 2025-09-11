// src/runner.js
import { sh } from "./orchestrator.js";
import { runAssertion, waitFor } from "./assertions.js";
import { StepKind } from "./types.js";

export async function runSteps(steps, { projectName, cwd }) {
  const results = [];
  let overallOk = true;

  for (const [i, step] of steps.entries()) {
    const startedAt = new Date().toISOString();
    let ok = true, stdout = "", stderr = "", error;

    try {
      if (step.kind === StepKind.SHELL) {
        const r = await sh(step.cmd, { cwd, timeoutMs: (step.timeoutSec || 300) * 1000 });
        ok = r.code === 0; stdout = r.stdout; stderr = r.stderr;
      } else if (step.kind === StepKind.ASSERT) {
        const r = await runAssertion(step.spec, { projectName, cwd });
        ok = r.ok; stdout = r.message;
      } else if (step.kind === StepKind.WAIT_FOR) {
        const r = await waitFor(step.spec, { projectName, cwd });
        ok = r.ok; stdout = r.message;
      }
    } catch (e) {
      ok = false; error = e?.message || String(e);
    }

    const endedAt = new Date().toISOString();
    results.push({ index: i, step, ok, startedAt, endedAt, stdout, stderr, error });
    if (!ok) { overallOk = false; break; } // stop at first failure (MVP)
  }

  return { overallOk, steps: results };
}
