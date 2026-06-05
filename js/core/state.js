export const state = {
  cfg: null,
  connected: false,
  ws: null,
  devices: new Map(),
  frames: new Map(),
  tabsByDevice: new Map(),
  cleanLogs: [],
  dirtyLogs: [],
  diagnostics: [],
  planningHistory: [],
  savedRules: JSON.parse(localStorage.getItem("scc_v71_rules") || "[]"),
  savedPlans: JSON.parse(localStorage.getItem("scc_v71_plans") || "[]"),
  savedGroups: JSON.parse(localStorage.getItem("scc_v71_groups") || "[]"),
  savedPolicies: JSON.parse(localStorage.getItem("scc_v71_policies") || "[]"),
  ping: { dashboard: [], device: new Map(), live: new Map() },
  mode: localStorage.getItem("scc_v71_mode") || "simple",
  errors: 0,
  warnings: 0,
  lastWsError: null,
  lastApiError: null
};

export function saveLocal(){
  localStorage.setItem("scc_v71_rules", JSON.stringify(state.savedRules));
  localStorage.setItem("scc_v71_plans", JSON.stringify(state.savedPlans));
  localStorage.setItem("scc_v71_groups", JSON.stringify(state.savedGroups));
  localStorage.setItem("scc_v71_policies", JSON.stringify(state.savedPolicies));
}

export function addClean(text, data = {}) {
  const entry = { time: Date.now(), text, data };
  state.cleanLogs.unshift(entry);
  state.cleanLogs = state.cleanLogs.slice(0, 500);
  addDirty("clean", entry);
}

export function addHistory(event, data = {}) {
  const entry = { time: Date.now(), event, data };
  state.planningHistory.unshift(entry);
  state.planningHistory = state.planningHistory.slice(0, 500);
  addClean("Planning: " + event, data);
}

export function addDirty(type, data) {
  state.dirtyLogs.unshift({ time: Date.now(), type, data });
  state.dirtyLogs = state.dirtyLogs.slice(0, 1000);
}

export function addError(text, data = {}) {
  state.errors++;
  state.lastApiError = text;
  addClean("ERROR: " + text, data);
}

export function addWarning(text, data = {}) {
  state.warnings++;
  addClean("WARNING: " + text, data);
}

export function addPing(arr, ms) {
  arr.push({ time: Date.now(), ms: Math.round(ms) });
  const cutoff = Date.now() - 20 * 60 * 1000;
  while (arr.length && arr[0].time < cutoff) arr.shift();
}

export function arrFor(map, key) {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
}

export function stats(arr) {
  arr = arr || [];
  const now = Date.now();
  const avg = list => list.length ? Math.round(list.reduce((a,b)=>a+b.ms,0)/list.length) : null;
  return {
    now: arr.length ? arr[arr.length-1].ms : null,
    s10: avg(arr.filter(x => now - x.time <= 10000)),
    s30: avg(arr.filter(x => now - x.time <= 30000)),
    avg: avg(arr)
  };
}

export function fmtMs(v) { return v == null ? "--" : `${v}ms`; }
export function pingText(arr) { const s = stats(arr); return `${fmtMs(s.now)} / ${fmtMs(s.s10)} / ${fmtMs(s.s30)} / ${fmtMs(s.avg)}`; }
export function allDevices() { return [...state.devices.values()].sort((a,b)=>(b.online===true)-(a.online===true)||(b.lastSeen||0)-(a.lastSeen||0)); }

export function pairedDevices(){
  const groups = new Map();
  for (const d of allDevices()) {
    const group = d.pairingGroup || d.extra?.health?.browserPairing?.pairingGroup || d.deviceId.replace(/-(chrome|edge)$/,"");
    if (!groups.has(group)) groups.set(group, { group, windows:null, chrome:null, edge:null, others:[] });
    const g = groups.get(group);
    if (d.type === "windows") g.windows = d;
    else if (d.type === "chrome") g.chrome = d;
    else if (d.type === "edge") g.edge = d;
    else g.others.push(d);
  }
  return [...groups.values()];
}

export function deviceWarnings(d) {
  const warnings = [];
  const now = Date.now();
  if (d.lastSeen && now - d.lastSeen > (state.cfg.STALE_DEVICE_SECONDS || 35) * 1000) warnings.push("device stale");
  const f = state.frames.get(d.deviceId);
  if (f?.capturedAt && now - f.capturedAt > (state.cfg.FROZEN_FRAME_SECONDS || 30) * 1000) warnings.push("live frozen");
  const dp = stats(state.ping.device.get(d.deviceId)||[]).now;
  const lp = stats(state.ping.live.get(d.deviceId)||[]).now;
  if (dp && dp > state.cfg.HIGH_DEVICE_PING_MS) warnings.push("high device ping");
  if (lp && lp > state.cfg.HIGH_LIVE_PING_MS) warnings.push("high live ping");
  return warnings;
}
