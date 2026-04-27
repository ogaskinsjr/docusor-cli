// src/orchestrator.js
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function loadEnvFile(dir = process.cwd(), filename = ".env") {
  const envPath = path.join(dir, filename);
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l && !l.startsWith("#") && l.includes("="))
      .map(l => {
        const idx = l.indexOf("=");
        const key = l.slice(0, idx).trim();
        const val = l.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, val];
      })
  );
}

export function composeExists(cwd = process.cwd()) {
  return [
    "docker-compose.yml","docker-compose.yaml",
    "compose.yml","compose.yaml"
  ].some(f => fs.existsSync(`${cwd}/${f}`));
}

export async function composeUp(projectName = "vd_run", cwd = process.cwd(), envFile) {
  if (!composeExists(cwd)) return;
  const envFlag = envFile ? `--env-file "${envFile}"` : "";
  await sh(`docker compose -p ${projectName} ${envFlag} up -d`, { cwd });
}

export async function composeDown(projectName = "vd_run", cwd = process.cwd(), envFile) {
  if (!composeExists(cwd)) return;
  const envFlag = envFile ? `--env-file "${envFile}"` : "";
  await sh(`docker compose -p ${projectName} ${envFlag} down -v --rmi all`, { cwd });
}

export async function resolveServiceContainerId(service, projectName = "vd_run", cwd = process.cwd()) {
  const { stdout } = await sh(`docker compose -p ${projectName} ps -q ${service}`, { cwd });
  return stdout.trim();
}

export function spawnBackground(cmd, { cwd, env } = {}) {
  const child = spawn(cmd, {
    cwd,
    shell: true,
    stdio: "ignore",
    detached: true,
    env: env ? { ...process.env, ...env } : process.env,
  });
  child.unref();
  return child;
}

export function sh(cmd, { cwd, timeoutMs, env } = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    });
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
