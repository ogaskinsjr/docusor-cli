// src/orchestrator.js
import fs from "node:fs";
import { spawn } from "node:child_process";

export function composeExists(cwd = process.cwd()) {
  return [
    "docker-compose.yml","docker-compose.yaml",
    "compose.yml","compose.yaml"
  ].some(f => fs.existsSync(`${cwd}/${f}`));
}

export async function composeUp(projectName = "vd_run", cwd = process.cwd()) {
  if (!composeExists(cwd)) return;
  await sh(`docker compose -p ${projectName} up -d`, { cwd });
}

export async function composeDown(projectName = "vd_run", cwd = process.cwd()) {
  if (!composeExists(cwd)) return;
  await sh(`docker compose -p ${projectName} down -v`, { cwd });
}

export async function resolveServiceContainerId(service, projectName = "vd_run", cwd = process.cwd()) {
  const { stdout } = await sh(`docker compose -p ${projectName} ps -q ${service}`, { cwd });
  return stdout.trim();
}

export function sh(cmd, { cwd, timeoutMs } = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    let killed = false;

    const t = timeoutMs ? setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeoutMs) : null;

    child.stdout.on("data", b => stdout += b.toString());
    child.stderr.on("data", b => stderr += b.toString());
    child.on("error", rej);
    child.on("close", code => {
      if (t) clearTimeout(t);
      if (killed) return rej(new Error(`Timeout ${timeoutMs}ms`));
      res({ code, stdout, stderr });
    });
  });
}
