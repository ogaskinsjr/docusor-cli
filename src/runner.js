// src/runner.js
import { sh } from "./orchestrator.js";
import { runAssertion, waitFor, interpolateEnv } from "./assertions.js";
import { StepKind } from "./types.js";

export async function runSteps(steps, { projectName, cwd, env = {} }) {
  const results = [];
  let overallOk = true;

  for (var [i, step] of steps.entries()) {
    var j = i;
    console.log("Step " + (++j))
    const startedAt = new Date().toISOString();
    let ok = true, stdout = "", stderr = "", error;

    try {
      if (step.kind === StepKind.SHELL) {
        console.log("Received shell command, executing")
        const cmd = interpolateEnv(step.cmd, env);
        const r = await sh(cmd, { cwd, timeoutMs: (step.timeoutSec || 300) * 1000, env });
        ok = r.code === 0; stdout = r.stdout; stderr = r.stderr;
      } else if (step.kind === StepKind.ASSERT) {
        console.log("Received assert command, executing")
        const r = await runAssertion(step.spec, { projectName, cwd, env });
        ok = r.ok; stdout = r.message;
      } else if (step.kind === StepKind.WAIT_FOR) {
        console.log("Received wait for command, executing")
        const r = await waitFor(step.spec, { projectName, cwd, env });
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
