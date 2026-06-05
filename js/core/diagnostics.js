import { state, addDirty, addPing, allDevices, pairedDevices, deviceWarnings } from "./state.js";
import { apiGet, wsUrl, connect } from "./worker.js";

export function diag(name, status, detail = "", data = {}) {
  const row = { time: Date.now(), name, status, detail, data };
  state.diagnostics.unshift(row);
  state.diagnostics = state.diagnostics.slice(0, 300);
  renderDiagnosticsList();
  addDirty("diagnostic", row);
  return row;
}

export async function runBootDiagnostics() {
  diag("HTML loaded", "ok", "index.html rendered");
  diag("JavaScript loaded", "ok", "app.js running");
  diag("Config loaded", state.cfg ? "ok" : "bad", state.cfg ? "APP_CONFIG available" : "APP_CONFIG missing");
  diag("Worker URL configured", state.cfg?.WORKER_BASE_URL ? "ok" : "bad", state.cfg?.WORKER_BASE_URL || "missing");
  diag("Room ID configured", state.cfg?.ROOM_ID ? "ok" : "bad", state.cfg?.ROOM_ID || "missing");
  diag("API key configured", state.cfg?.API_KEY ? "ok" : "warn", state.cfg?.API_KEY ? `present length ${state.cfg.API_KEY.length}` : "missing");
  diag("LocalStorage", testLocalStorage() ? "ok" : "bad", "Browser localStorage test");
  diag("Fetch support", typeof fetch === "function" ? "ok" : "bad", "fetch()");
  diag("WebSocket support", typeof WebSocket === "function" ? "ok" : "bad", "WebSocket()");
  diag("Required DOM", document.getElementById("viewRoot") ? "ok" : "bad", "#viewRoot");
  diag("Lazy loader", "ok", "Modules load only when tabs are opened");
}

export async function runFullDiagnostics() {
  state.diagnostics = [];
  await runBootDiagnostics();
  await runWorkerDiagnostics();
  await runWsDiagnostics(false);
  runDeviceDiagnostics();
  runLiveDiagnostics();
  runBrowserDiagnostics();
  runPlanningDiagnostics();
  diag("Full diagnostics", "ok", "Completed");
}

export async function runWorkerDiagnostics() {
  await checkApi("/api/time", "Time API");
  await checkApi("/api/device-state", "Device state API");
  await checkApi("/api/history", "History API");
  await checkApi("/api/rules", "Rules API");
  await checkApi("/api/schedules", "Schedules API");
}

export async function runWsDiagnostics(doConnect = true) {
  try {
    const url = wsUrl();
    diag("WebSocket URL generated", "ok", url.replace(/key=[^&]+/, "key=***"));
    if (doConnect) connect();
  } catch (err) { diag("WebSocket URL generated", "bad", err.message); }
}

export function runDeviceDiagnostics(){
  const devices = allDevices();
  diag("Devices discovered", devices.length ? "ok" : "warn", `${devices.length} device(s)`);
  for (const d of devices) {
    const w = deviceWarnings(d);
    diag(`Device ${d.deviceId}`, w.length ? "warn" : "ok", w.length ? w.join(", ") : "healthy-ish", d);
  }
}

export function runLiveDiagnostics(){
  diag("Live frames", state.frames.size ? "ok" : "warn", `${state.frames.size} frame source(s)`);
  for (const [id, f] of state.frames) {
    const ok = !!f.dataUrl && !!f.capturedAt;
    diag(`Live ${id}`, ok ? "ok" : "bad", ok ? `frame age ${Math.round((Date.now()-f.capturedAt)/1000)}s` : "missing dataUrl/capturedAt", f);
  }
}

export function runBrowserDiagnostics(){
  const pairs = pairedDevices();
  for (const p of pairs) {
    const hasBrowser = !!(p.chrome || p.edge);
    diag(`Pairing ${p.group}`, hasBrowser ? "ok" : "warn", `Windows=${!!p.windows}, Chrome=${!!p.chrome}, Edge=${!!p.edge}`);
  }
}

export function runPlanningDiagnostics(){
  diag("Local rules", state.savedRules.length ? "ok" : "warn", `${state.savedRules.length} local rule(s)`);
  diag("Local plans", state.savedPlans.length ? "ok" : "warn", `${state.savedPlans.length} local plan(s)`);
  diag("Local groups", state.savedGroups.length ? "ok" : "warn", `${state.savedGroups.length} local group(s)`);
  diag("Planning history", state.planningHistory.length ? "ok" : "warn", `${state.planningHistory.length} event(s)`);
}

async function checkApi(path, name) {
  const t0 = performance.now();
  try {
    const r = await apiGet(path);
    addPing(state.ping.dashboard, performance.now() - t0);
    diag(name, "ok", `${path} OK in ${Math.round(performance.now()-t0)}ms`, r);
  } catch (err) { diag(name, "bad", `${path}: ${err.message}`); }
}

function testLocalStorage() { try { localStorage.setItem("scc_test","1"); localStorage.removeItem("scc_test"); return true; } catch { return false; } }

export function exportDiagnosticReport(){
  const report = {
    exportedAt: new Date().toISOString(),
    config: {...state.cfg, API_KEY: state.cfg.API_KEY ? "***" : ""},
    diagnostics: state.diagnostics,
    devices: allDevices(),
    pairings: pairedDevices(),
    frames: [...state.frames.values()].map(f=>({deviceId:f.deviceId, capturedAt:f.capturedAt, hasDataUrl:!!f.dataUrl, title:f.tab?.title})),
    rules: state.savedRules,
    plans: state.savedPlans,
    groups: state.savedGroups,
    warnings: state.warnings,
    errors: state.errors
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)], {type:"application/json"}));
  a.download = `diagnostic-report-${Date.now()}.json`;
  a.click();
}

export function renderDiagnosticsList() {
  const box = document.getElementById("diagList");
  if (!box) return;
  box.innerHTML = state.diagnostics.map(d => `<div class="diag-step ${d.status}"><div><b>${escapeHtml(d.name)}</b><div class="small">${escapeHtml(d.detail)}</div></div><span class="pill ${d.status}">${d.status}</span></div>`).join("");
}

export function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
