import { state, pingText } from "../core/state.js";
import { command } from "../core/worker.js";
import { escapeHtml } from "../core/diagnostics.js";

export function render(root){
  const frames = [...state.frames.values()];
  root.innerHTML = `<section class="card"><h2>Live Grid</h2><div class="grid">${frames.map(f=>`<div class="live-card"><h3>${escapeHtml(f.deviceName || f.deviceId)}</h3><img src="${f.dataUrl || ""}" alt="live frame"><p>${escapeHtml(f.tab?.title || "")}</p><p>Live: ${pingText(state.ping.live.get(f.deviceId)||[])}</p><p>Device: ${pingText(state.ping.device.get(f.deviceId)||[])}</p><p>Frame age: ${f.capturedAt ? Math.round((Date.now()-f.capturedAt)/1000)+"s" : "--"}</p><div class="controls"><button data-pop="${f.deviceId}">Popout</button><button data-cap="${f.deviceId}">Capture</button><button data-start="${f.deviceId}">Start</button><button data-stop="${f.deviceId}">Stop</button><button data-low="${f.deviceId}">Low</button><button data-normal="${f.deviceId}">Normal</button></div></div>`).join("") || "<p>No frames yet. Start live or capture once.</p>"}</div></section>`;
  root.querySelectorAll("[data-cap]").forEach(b=>b.onclick=()=>command("WINDOWS_CAPTURE_ONCE",{},b.dataset.cap));
  root.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>command("START_WINDOWS_LIVE",{},b.dataset.start));
  root.querySelectorAll("[data-stop]").forEach(b=>b.onclick=()=>command("STOP_WINDOWS_LIVE",{},b.dataset.stop));
  root.querySelectorAll("[data-low]").forEach(b=>b.onclick=()=>command("SET_LOW_BANDWIDTH_MODE",{},b.dataset.low));
  root.querySelectorAll("[data-normal]").forEach(b=>b.onclick=()=>command("UNSET_LOW_BANDWIDTH_MODE",{},b.dataset.normal));
  root.querySelectorAll("[data-pop]").forEach(b=>b.onclick=()=>popout(b.dataset.pop));
}
function popout(id){ const f = state.frames.get(id); if(!f) return alert("No frame"); const w = open("about:blank","live_"+id,"width=900,height=650"); w.document.write(`<title>${id}</title><body style="margin:0;background:#000;color:white;font-family:system-ui"><img src="${f.dataUrl}" style="width:100vw;height:90vh;object-fit:contain"><div style="padding:8px">Live ping: ${pingText(state.ping.live.get(id)||[])} | Device ping: ${pingText(state.ping.device.get(id)||[])}</div></body>`); }