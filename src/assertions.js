// src/assertions.js
import fs from "node:fs";
import net from "node:net";
import axios from "axios";
import { sh, resolveServiceContainerId } from "./orchestrator.js";

export async function runAssertion(spec, { projectName, cwd }) {
  const parts = splitArgs(spec);
  const [type, ...rest] = parts;

  switch (type) {
    case "httpOk": {
      const url = rest[0];
      const ok = await httpStatus(url, "GET", undefined, 200);
      return ok ? pass(`httpOk ${url}`) : fail(`Expected 200 from ${url}`);
    }
    case "httpStatus": {
      const [method, url, codeStr, maybeJson] = rest;
      const status = Number(codeStr);
      const body = parseMaybeJson(maybeJson);
      const ok = await httpStatus(url, method, body, status);
      return ok ? pass(`httpStatus ${method} ${url} == ${status}`) : fail(`Expected ${status} from ${url}`);
    }
    case "portOpen": {
      const port = Number(rest[0]); const host = rest[1] || "127.0.0.1";
      const ok = await isPortOpen(host, port, 3000);
      return ok ? pass(`portOpen ${host}:${port}`) : fail(`Port not open ${host}:${port}`);
    }
    case "fileExists": {
      // fileExists [container:<svc>] <path>
      if (rest[0]?.startsWith("container:")) {
        const svc = rest[0].split(":")[1];
        const path = rest.slice(1).join(" ");
        const id = await resolveServiceContainerId(svc, projectName, cwd);
        const { code } = await sh(`docker exec ${id} test -f ${shellEscape(path)}`);
        return code === 0 ? pass(`fileExists ${svc}:${path}`) : fail(`Missing file ${svc}:${path}`);
      } else {
        const p = rest.join(" ");
        return fs.existsSync(p) ? pass(`fileExists ${p}`) : fail(`Missing file ${p}`);
      }
    }
    case "logContains": {
      // logContains container:<svc> "text"
      const [target, ...txtParts] = rest;
      if (!target?.startsWith("container:")) return fail(`logContains requires container:<svc>`);
      const svc = target.split(":")[1];
      const text = stripQuotes(txtParts.join(" "));
      const id = await resolveServiceContainerId(svc, projectName, cwd);
      const { stdout } = await sh(`docker logs --tail=1000 ${id}`);
      return stdout.includes(text) ? pass(`logContains ${svc} "${text}"`) : fail(`Log missing "${text}"`);
    }
    case "commandSucceeds": {
      // commandSucceeds [container:<svc>] "<cmd>"
      if (rest[0]?.startsWith("container:")) {
        const svc = rest[0].split(":")[1];
        const cmd = stripQuotes(rest.slice(1).join(" "));
        const id = await resolveServiceContainerId(svc, projectName, cwd);
        const { code, stderr } = await sh(`docker exec ${id} bash -lc ${shellQuote(cmd)}`);
        return code === 0 ? pass(`command OK in ${svc}`) : fail(`Command failed in ${svc}: ${stderr}`);
      } else {
        const cmd = stripQuotes(rest.join(" "));
        const { code, stderr } = await sh(`bash -lc ${shellQuote(cmd)}`, { cwd });
        return code === 0 ? pass(`command OK`) : fail(`Command failed: ${stderr}`);
      }
    }
    default:
      return fail(`Unknown assertion: ${type}`);
  }
}

// export async function waitFor(spec, { projectName, cwd }) {
//   // waitFor: httpOk <url> <timeoutSec>
//   const parts = splitArgs(spec);
//   const [type, ...rest] = parts;

//   if (type === "httpOk") {
//     const url = rest[0]; const timeoutSec = Number(rest[1] || 60);
//     const start = Date.now();
//     while (Date.now() - start < timeoutSec * 1000) {
//       if (await httpStatus(url, "GET", undefined, 200)) return pass(`waitFor httpOk ${url}`);
//       await sleep(1000);
//     }
//     return fail(`Timeout waiting for ${url} to return 200`);
//   }

//   // Add more waitFor kinds later (portOpen, logContains)
//   return fail(`Unknown waitFor: ${type}`);
// }

export async function waitFor(spec, { projectName, cwd }) {
  // Supported:
  //   waitFor: httpOk <url> [timeoutSec]
  //   waitFor: portOpen [host] <port> [timeoutSec]
  //   waitFor: logContains container:<svc> "text" [timeoutSec]
  const parts = splitArgs(spec);
  const [type, ...rest] = parts;

  // helpers
  const parseTimeout = (n, def = 60) => {
    const num = Number(n);
    return Number.isFinite(num) && num > 0 ? num : def;
  };

  if (type === "httpOk") {
    const url = rest[0];
    const timeoutSec = parseTimeout(rest[1], 60);
    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
      if (await httpStatus(url, "GET", undefined, 200)) {
        return pass(`waitFor httpOk ${url}`);
      }
      await sleep(1000);
    }
    return fail(`Timeout waiting for ${url} to return 200`);
  }

  if (type === "portOpen") {
    // Forms:
    //   portOpen <port> [timeout]
    //   portOpen <host> <port> [timeout]
    let host = "127.0.0.1";
    let port;
    let timeoutSec = 60;

    if (rest.length >= 2 && /^\d+$/.test(rest[1])) {
      // host, port, [timeout]
      host = rest[0];
      port = Number(rest[1]);
      timeoutSec = parseTimeout(rest[2], 60);
    } else {
      // port, [timeout]
      port = Number(rest[0]);
      timeoutSec = parseTimeout(rest[1], 60);
    }

    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
      if (await isPortOpen(host, port, 1500)) {
        return pass(`waitFor portOpen ${host}:${port}`);
      }
      await sleep(1000);
    }
    return fail(`Timeout waiting for port ${host}:${port} to open`);
  }

  if (type === "logContains") {
    // logContains container:<svc> "text" [timeoutSec]
    const [target, ...txtAndMaybeTimeout] = rest;
    if (!target?.startsWith("container:")) {
      return fail(`waitFor logContains requires container:<svc>`);
    }
    let timeoutSec = 60;
    // If the last token is a number, treat it as timeout
    const last = txtAndMaybeTimeout[txtAndMaybeTimeout.length - 1];
    if (/^\d+$/.test(last)) {
      timeoutSec = parseTimeout(last, 60);
      txtAndMaybeTimeout.pop();
    }
    const svc = target.split(":")[1];
    const text = stripQuotes(txtAndMaybeTimeout.join(" "));
    const id = await resolveServiceContainerId(svc, projectName, cwd);

    const start = Date.now();
    while (Date.now() - start < timeoutSec * 1000) {
      const { stdout } = await sh(`docker logs --tail=1000 ${id}`);
      if (stdout.includes(text)) {
        return pass(`waitFor logContains ${svc} "${text}"`);
      }
      await sleep(1000);
    }
    return fail(`Timeout waiting for "${text}" to appear in logs of ${svc}`);
  }

  return fail(`Unknown waitFor: ${type}`);
}


// helpers
function pass(msg) { return { ok: true, message: msg }; }
function fail(msg) { return { ok: false, message: msg }; }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function httpStatus(url, method, body, expectCode) {
  try {
    const resp = await axios.request({ url, method, data: body, validateStatus: () => true, timeout: 8000 });
    return resp.status === expectCode;
  } catch { return false; }
}

function isPortOpen(host, port, timeoutMs = 2000) {
  return new Promise(res => {
    const s = new net.Socket();
    let done = false;
    const finalize = (ok) => { if (!done) { done = true; try { s.destroy(); } catch {} res(ok); } };
    s.setTimeout(timeoutMs);
    s.once("connect", () => finalize(true));
    s.once("timeout", () => finalize(false));
    s.once("error", () => finalize(false));
    s.connect(port, host);
  });
}

function splitArgs(s) {
  const out = [];
  let cur = "", inQ = false, qChar = null;
  for (let i=0;i<s.length;i++){
    const c=s[i];
    if ((c==='"' || c=="'")) {
      if (!inQ){ inQ=true; qChar=c; }
      else if (qChar===c){ inQ=false; qChar=null; }
      else cur += c;
    } else if (!inQ && /\s/.test(c)) {
      if (cur) { out.push(cur); cur=""; }
    } else cur+=c;
  }
  if (cur) out.push(cur);
  return out;
}
function stripQuotes(s){ return s?.replace(/^['"]|['"]$/g, "") ?? s; }
function shellQuote(s){ return `'${s.replace(/'/g, `'\\''`)}'`; }
function shellEscape(s){ return s.replace(/(["\\s'$`\\\\])/g,'\\\\$1'); }
function parseMaybeJson(s) {
  if (!s) return undefined;
  try { return JSON.parse(s); } catch { return s; }
}
