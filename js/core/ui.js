import { state, allDevices, deviceWarnings } from "./state.js";
import { escapeHtml, renderDiagnosticsList, runFullDiagnostics, runWorkerDiagnostics, runWsDiagnostics, exportDiagnosticReport } from "./diagnostics.js";
import { connect } from "./worker.js";

const modules = new Map();
let currentTab = "home";

export function initUi() {
  document.body.classList.toggle("advanced-mode", state.mode === "advanced");
  document.body.classList.toggle("simple-mode", state.mode !== "advanced");
  document.getElementById("connectBtn").onclick = connect;
  document.getElementById("refreshBtn").onclick = renderCurrentView;
  document.getElementById("runDiagnosticsBtn").onclick = () => showTab("diagnostics");
  document.getElementById("modeBtn").onclick = toggleMode;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => showTab(b.dataset.tab));
  showTab("home");
}

export async function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const root = document.getElementById("viewRoot");
  root.innerHTML = `<div class="module-loading">Loading ${escapeHtml(tab)}...</div>`;
  try {
    if (tab === "diagnostics") {
      const tpl = document.getElementById("diagnosticsTemplate");
      root.innerHTML = tpl.innerHTML;
      document.getElementById("diagRunFull").onclick = runFullDiagnostics;
      document.getElementById("diagWorkerOnly").onclick = runWorkerDiagnostics;
      document.getElementById("diagWsOnly").onclick = () => runWsDiagnostics(true);
      document.getElementById("diagExport").onclick = exportDiagnosticReport;
      renderDiagnosticsList();
      return;
    }
    const mod = await loadModule(tab);
    root.innerHTML = "";
    await mod.render(root);
  } catch (err) {
    root.innerHTML = `<section class="card"><h2>Module failed: ${escapeHtml(tab)}</h2><div class="modal-error">${escapeHtml(err.message)}</div><pre>${escapeHtml(err.stack || "")}</pre></section>`;
  }
}

export function renderCurrentView() { if (currentTab && currentTab !== "diagnostics") showTab(currentTab); }

async function loadModule(tab) {
  if (modules.has(tab)) return modules.get(tab);
  const map = {
    home:"../modules/home.js", devices:"../modules/devices.js", live:"../modules/live.js",
    windows:"../modules/windows.js", browser:"../modules/browser.js", planning:"../modules/planning.js",
    policies:"../modules/policies.js", plans:"../modules/plans.js", groups:"../modules/groups.js",
    history:"../modules/history.js", sessions:"../modules/sessions.js", health:"../modules/health.js",
    install:"../modules/install.js", configgen:"../modules/configgen.js", debugger:"../modules/debugger.js",
    logs:"../modules/logs.js", advanced:"../modules/advanced.js", settings:"../modules/settings.js"
  };
  if (!map[tab]) throw new Error(`Unknown tab ${tab}`);
  const mod = await import(map[tab]); modules.set(tab, mod); return mod;
}

function toggleMode() {
  state.mode = state.mode === "advanced" ? "simple" : "advanced";
  localStorage.setItem("scc_v71_mode", state.mode);
  document.body.classList.toggle("advanced-mode", state.mode === "advanced");
  document.body.classList.toggle("simple-mode", state.mode !== "advanced");
  document.getElementById("modeBtn").textContent = state.mode === "advanced" ? "Simple Mode" : "Advanced Mode";
}

export function updatePills() {
  const warnings = allDevices().reduce((n,d)=>n+deviceWarnings(d).length,0);
  document.getElementById("workerPill").textContent = `Worker: ${state.ping.dashboard.length ? "ok" : "checking"}`;
  document.getElementById("workerPill").className = state.ping.dashboard.length ? "ok" : "warn";
  document.getElementById("wsPill").textContent = `WebSocket: ${state.connected ? "connected" : "disconnected"}`;
  document.getElementById("wsPill").className = state.connected ? "ok" : "bad";
  document.getElementById("devicePill").textContent = `Devices: ${state.devices.size}`;
  document.getElementById("livePill").textContent = `Live: ${state.frames.size}`;
  document.getElementById("warningPill").textContent = `Warnings: ${warnings + state.warnings}`;
  document.getElementById("warningPill").className = warnings || state.warnings ? "warn" : "ok";
  document.getElementById("errorPill").textContent = `Errors: ${state.errors}`;
  document.getElementById("errorPill").className = state.errors ? "bad" : "ok";
}

export function deviceOptions(filter = null) {
  let list = allDevices();
  if (filter) list = list.filter(filter);
  if (!list.length) return `<option value="${escapeHtml(state.cfg.DEFAULT_DEVICE_ID)}">${escapeHtml(state.cfg.DEFAULT_DEVICE_ID)}</option>`;
  return list.map(d => `<option value="${escapeHtml(d.deviceId)}">${escapeHtml(d.deviceName || d.deviceId)}</option>`).join("");
}

export function groupOptions(){
  const defaults = ["all-online","windows-only","browser-only"];
  const saved = state.savedGroups.map(g=>g.id);
  return [...defaults, ...saved].map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
}

export function resolveTargets(target){
  const list = allDevices();
  if (!target || target === "all-online") return list.filter(d=>d.online !== false);
  if (target === "windows-only") return list.filter(d=>d.type === "windows");
  if (target === "browser-only") return list.filter(d=>d.type === "chrome" || d.type === "edge");
  const group = state.savedGroups.find(g=>g.id === target);
  if (group) return list.filter(d=>group.devices.includes(d.deviceId));
  return list.filter(d=>d.deviceId === target);
}
