import { allDevices, pingText, state, deviceWarnings } from "../core/state.js";
import { command } from "../core/worker.js";
import { escapeHtml } from "../core/diagnostics.js";

export function render(root){
  const devices = allDevices();
  root.innerHTML = `<section class="card"><h2>Devices</h2><div class="grid">${devices.map(d=>{const warns=deviceWarnings(d);return `<div class="device-card ${d.online?"online":"offline"}"><h3>${escapeHtml(d.deviceName || d.deviceId)}</h3><p>${escapeHtml(d.deviceId)} • ${escapeHtml(d.type)}</p><p>Last seen: ${d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : "never"}</p><p>Device ping: ${pingText(state.ping.device.get(d.deviceId)||[])}</p><p>Live ping: ${pingText(state.ping.live.get(d.deviceId)||[])}</p><p>Active: ${escapeHtml(d.activeWindow?.title || d.activeWindow || "")}</p>${warns.map(w=>`<div class="warning-box">${escapeHtml(w)}</div>`).join("")}<div class="controls"><button data-cmd="PING" data-id="${d.deviceId}">Ping</button><button data-cmd="GET_AGENT_HEALTH" data-id="${d.deviceId}">Health</button><button data-cmd="WINDOWS_CAPTURE_ONCE" data-id="${d.deviceId}">Capture</button><button data-cmd="SET_LOW_BANDWIDTH_MODE" data-id="${d.deviceId}">Low</button><button data-cmd="UNSET_LOW_BANDWIDTH_MODE" data-id="${d.deviceId}">Normal</button></div></div>`}).join("") || "<p>No devices yet. Press Connect.</p>"}</div></section>`;
  root.querySelectorAll("[data-cmd]").forEach(b => b.onclick = () => command(b.dataset.cmd, b.dataset.cmd==="PING"?{pingId:crypto.randomUUID(),sentAt:Date.now()}: {}, b.dataset.id));
}