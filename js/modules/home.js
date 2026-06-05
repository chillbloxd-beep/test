import { state, pingText, pairedDevices, allDevices, deviceWarnings } from "../core/state.js";
import { command, connect } from "../core/worker.js";
import { escapeHtml } from "../core/diagnostics.js";

export function render(root){
  const warnings = allDevices().flatMap(d=>deviceWarnings(d).map(w=>`${d.deviceId}: ${w}`));
  root.innerHTML = `
    <section class="grid">
      <div class="card"><h2>Overview</h2><p>Connected: <b>${state.connected}</b></p><p>Devices: <b>${state.devices.size}</b></p><p>Live feeds: <b>${state.frames.size}</b></p><p>Dashboard ping: <b>${pingText(state.ping.dashboard)}</b></p></div>
      <div class="card"><h2>Quick Actions</h2><div class="button-grid"><button id="hConnect">Connect</button><button id="hStartAll">Start Live All</button><button id="hStopAll">Stop Live All</button><button id="hLowAll">Low Bandwidth All</button><button id="hNormalAll">Normal Mode All</button><button id="hPingAll">Ping All</button></div></div>
      <div class="card"><h2>Warnings</h2>${warnings.map(w=>`<div class="warning-box">${escapeHtml(w)}</div>`).join("") || "<p>No active warnings.</p>"}</div>
    </section>
    <section class="card"><h2>Paired Device View</h2><div class="grid">${pairedDevices().map(p=>`<div class="pair-card"><h3>${escapeHtml(p.group)}</h3><p>Windows: ${escapeHtml(p.windows?.deviceId || "missing")}</p><p>Chrome: ${escapeHtml(p.chrome?.deviceId || "missing")}</p><p>Edge: ${escapeHtml(p.edge?.deviceId || "missing")}</p></div>`).join("") || "<p>No pairings yet.</p>"}</div></section>`;
  document.getElementById("hConnect").onclick = connect;
  document.getElementById("hStartAll").onclick = () => [...state.devices.values()].forEach(d => command(d.type==="windows"?"START_WINDOWS_LIVE":"START_LIVE",{},d.deviceId));
  document.getElementById("hStopAll").onclick = () => [...state.devices.values()].forEach(d => command(d.type==="windows"?"STOP_WINDOWS_LIVE":"STOP_LIVE",{},d.deviceId));
  document.getElementById("hLowAll").onclick = () => [...state.devices.values()].forEach(d => command("SET_LOW_BANDWIDTH_MODE",{},d.deviceId));
  document.getElementById("hNormalAll").onclick = () => [...state.devices.values()].forEach(d => command("UNSET_LOW_BANDWIDTH_MODE",{},d.deviceId));
  document.getElementById("hPingAll").onclick = () => [...state.devices.values()].forEach(d => command("PING",{pingId:crypto.randomUUID(),sentAt:Date.now()},d.deviceId));
}