import { state, addClean, addDirty, addError, addPing, arrFor } from "./state.js";
import { diag } from "./diagnostics.js";
import { updatePills, renderCurrentView } from "./ui.js";

export function apiUrl(path) {
  const base = state.cfg.WORKER_BASE_URL.replace(/\/$/, "");
  const url = new URL(path, base);
  if (state.cfg.API_KEY) url.searchParams.set("key", state.cfg.API_KEY);
  return url.toString();
}
export async function apiGet(path) { const r = await fetch(apiUrl(path)); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }
export async function apiPost(path, body) { const r = await fetch(apiUrl(path), { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body || {}) }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); }

export function wsUrl() {
  const base = state.cfg.WORKER_BASE_URL.replace(/\/$/, "").replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const url = new URL(`/ws/${encodeURIComponent(state.cfg.ROOM_ID)}`, base);
  if (state.cfg.API_KEY) url.searchParams.set("key", state.cfg.API_KEY);
  url.searchParams.set("role", "admin");
  return url.toString();
}

export function connect() {
  if (state.ws) try { state.ws.close(); } catch {}
  const url = wsUrl();
  diag("WebSocket connecting", "warn", url.replace(/key=[^&]+/, "key=***"));
  const t0 = performance.now();
  const ws = new WebSocket(url);
  state.ws = ws;
  ws.onopen = () => { state.connected = true; diag("WebSocket connected", "ok", `${Math.round(performance.now()-t0)}ms`); addClean("WebSocket connected"); send({ type:"presence", role:"admin", admin:"dashboard-v7.1", sentAt:Date.now() }); updatePills(); };
  ws.onmessage = ev => { try { handleMessage(JSON.parse(ev.data)); } catch (err) { addError("Failed to parse WebSocket message", { data: String(ev.data).slice(0,500), err: err.message }); } };
  ws.onerror = () => { state.lastWsError = "Socket error event"; diag("WebSocket error", "bad", "Socket error event"); addError("WebSocket error"); updatePills(); };
  ws.onclose = () => { state.connected = false; diag("WebSocket closed", "warn", "Connection closed"); updatePills(); };
}

export function send(obj) { if (!state.ws || state.ws.readyState !== WebSocket.OPEN) { addError("WebSocket not connected", obj); return false; } state.ws.send(JSON.stringify(obj)); addDirty("ws_tx", obj); return true; }
export function command(command, payload = {}, targetDeviceId = null) { const id = "cmd-" + crypto.randomUUID(); return send({ type:"command", id, targetDeviceId, command:{ type: command.toUpperCase(), payload } }); }

export function handleMessage(msg) {
  addDirty("ws_rx", msg);
  if (msg.type === "status" || msg.type === "presence" || msg.deviceId) {
    const id = msg.deviceId || msg.id;
    if (id) {
      const old = state.devices.get(id) || {};
      const extra = msg.extra || {};
      state.devices.set(id, { ...old, ...msg, ...extra, deviceId:id, online:true, lastSeen:Date.now(), type: inferType(msg), pairingGroup: msg.pairingGroup || extra.health?.browserPairing?.pairingGroup || extra.pairingGroup });
    }
  }
  if (msg.type === "frame") {
    state.frames.set(msg.deviceId, msg);
    if (msg.capturedAt) addPing(arrFor(state.ping.live, msg.deviceId), Math.max(0, Date.now() - Number(msg.capturedAt)));
  }
  if (msg.type === "tabs") { const id = msg.deviceId || "browser"; state.tabsByDevice.set(id, msg.tabs || []); }
  if (msg.type === "command-result") {
    const cmd = String(msg.command || "").toUpperCase();
    if (cmd === "PING") {
      const sentAt = msg.payload?.sentAt || msg.result?.sentAt;
      const id = msg.deviceId || msg.payload?.deviceId || msg.result?.deviceId || msg.targetDeviceId;
      if (sentAt && id) addPing(arrFor(state.ping.device, id), Math.max(0, Date.now() - Number(sentAt)));
    }
  }
  updatePills(); renderCurrentView();
}

function inferType(msg) {
  const t = `${msg.type || ""} ${msg.deviceType || ""} ${msg.deviceId || ""} ${msg.browser || ""} ${msg.extra?.platform || ""}`.toLowerCase();
  if (t.includes("edge")) return "edge";
  if (t.includes("chrome")) return "chrome";
  if (t.includes("windows")) return "windows";
  return "unknown";
}
