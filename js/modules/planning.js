import { state, saveLocal, addHistory } from "../core/state.js";
import { command, apiPost, apiGet } from "../core/worker.js";
import { groupOptions, resolveTargets } from "../core/ui.js";
import { escapeHtml } from "../core/diagnostics.js";

const templates = [
  {name:"No Games",trigger:"PROCESS_GROUP_DETECTED",conditions:{cooldownSeconds:30,onlyDuringSession:false},actions:[["WINDOWS_CLOSE_PROCESS_GROUP",{group:"games"}],["WINDOWS_CAPTURE_ONCE",{}]]},
  {name:"No YouTube",trigger:"URL_MATCH",conditions:{match:"youtube.com",cooldownSeconds:10},actions:[["CLOSE_TAB",{}]]},
  {name:"Live Repair",trigger:"NO_FRAME_FOR_SECONDS",conditions:{seconds:20,cooldownSeconds:60},actions:[["WINDOWS_CAPTURE_ONCE",{}],["STOP_WINDOWS_LIVE",{}],["START_WINDOWS_LIVE",{}]]},
  {name:"High Lag Suggest Low Bandwidth",trigger:"HIGH_LIVE_PING",conditions:{ms:2500,seconds:30,cooldownSeconds:120,autoFix:false},actions:[["SET_LOW_BANDWIDTH_MODE",{}]]},
  {name:"Device Offline Alert",trigger:"DEVICE_OFFLINE",conditions:{seconds:60},actions:[["PING",{}]]},
  {name:"Browser Companion Missing",trigger:"BROWSER_COMPANION_MISSING",conditions:{cooldownSeconds:60},actions:[["GET_AGENT_HEALTH",{}]]}
];

export function render(root){
  root.innerHTML = `<section class="grid2"><div class="card"><h2>Planning Center</h2><p>Templates, triggers, conditions, multi-step actions, cooldowns, testing, and rule history.</p><label>Target group/device</label><select id="ptarget">${groupOptions()}</select><div class="button-grid">${templates.map((t,i)=>`<button data-template="${i}">${escapeHtml(t.name)}</button>`).join("")}</div></div><div class="card"><h2>Rule Builder</h2><label>Name</label><input id="rname" value="New Rule"><label>Trigger</label><select id="rtrigger">${["TIME","DEVICE_ONLINE","DEVICE_OFFLINE","PROCESS_DETECTED","URL_MATCH","TITLE_MATCH","MANUAL_MACRO","HIGH_DEVICE_PING","HIGH_LIVE_PING","NO_FRAME_FOR_SECONDS","PROCESS_GROUP_DETECTED","ACTIVE_WINDOW_MATCH","BROWSER_COMPANION_MISSING","REPEATED_OFFTASK","SESSION_STARTED","SESSION_ENDED"].map(x=>`<option>${x}</option>`).join("")}</select><label>Conditions JSON</label><textarea id="rcond">{"onlyDuringSession":false,"cooldownSeconds":30,"maxRunsPerHour":20}</textarea><label>Actions JSON</label><textarea id="ractions">[["PING",{}]]</textarea><div class="controls"><button id="testRule">Test/Simulate</button><button id="saveLocalRule">Save Local</button><button id="saveRule">Save To Worker</button><button id="loadRules">Load Worker Rules</button><button id="runRule">Run Now</button></div><pre id="ruleOut"></pre></div></section><section class="card"><h2>Local Rules</h2><div class="grid">${state.savedRules.map((r,i)=>`<div class="rule-card"><h3>${escapeHtml(r.name)}</h3><p>${escapeHtml(r.trigger)} → ${r.actions.length} action(s)</p><button data-run-local="${i}">Run</button><button data-del-local="${i}" class="danger">Delete</button></div>`).join("")||"<p>No local rules.</p>"}</div></section>`;
  root.querySelectorAll("[data-template]").forEach(b=>b.onclick=()=>loadTemplate(templates[Number(b.dataset.template)]));
  document.getElementById("testRule").onclick = testRule; document.getElementById("saveLocalRule").onclick = saveLocalRule; document.getElementById("saveRule").onclick = saveRule; document.getElementById("loadRules").onclick = loadRules; document.getElementById("runRule").onclick = () => run(currentRule());
  root.querySelectorAll("[data-run-local]").forEach(b=>b.onclick=()=>run(state.savedRules[Number(b.dataset.runLocal)]));
  root.querySelectorAll("[data-del-local]").forEach(b=>b.onclick=()=>{state.savedRules.splice(Number(b.dataset.delLocal),1);saveLocal();render(root);});
}
function loadTemplate(t){document.getElementById("rname").value=t.name;document.getElementById("rtrigger").value=t.trigger;document.getElementById("rcond").value=JSON.stringify(t.conditions,null,2);document.getElementById("ractions").value=JSON.stringify(t.actions,null,2)}
function currentRule(){return {id:"rule_"+Date.now(),name:document.getElementById("rname").value,trigger:document.getElementById("rtrigger").value,target:document.getElementById("ptarget").value,conditions:JSON.parse(document.getElementById("rcond").value),actions:JSON.parse(document.getElementById("ractions").value),enabled:true,createdAt:Date.now()};}
function testRule(){const rule=currentRule();const targets=resolveTargets(rule.target).map(d=>d.deviceId);document.getElementById("ruleOut").textContent=JSON.stringify({wouldRun:targets.length>0,matchedDevices:targets,conditions:"simulation",rule},null,2)}
function saveLocalRule(){state.savedRules.unshift(currentRule());saveLocal();addHistory("Saved local rule", state.savedRules[0]);document.getElementById("ruleOut").textContent="Saved locally."}
async function saveRule(){try{const r=await apiPost("/api/rules", currentRule());document.getElementById("ruleOut").textContent=JSON.stringify(r,null,2)}catch(e){document.getElementById("ruleOut").textContent="Save failed: "+e.message}}
async function loadRules(){try{const r=await apiGet("/api/rules");document.getElementById("ruleOut").textContent=JSON.stringify(r,null,2)}catch(e){document.getElementById("ruleOut").textContent="Load failed: "+e.message}}
function run(rule){const targets=resolveTargets(rule.target);for(const d of targets) for(const [cmd,payload] of rule.actions) command(cmd,payload,d.deviceId);addHistory("Ran rule", {rule, targets:targets.map(d=>d.deviceId)});}
