import { state, saveLocal, addHistory } from "../core/state.js";
import { command } from "../core/worker.js";
import { groupOptions, resolveTargets } from "../core/ui.js";
import { escapeHtml } from "../core/diagnostics.js";

const builtins = [
  {name:"Study Mode",actions:[["START_WINDOWS_LIVE",{}],["WINDOWS_CLOSE_PROCESS_GROUP",{group:"games"}]],note:"Start live and close games."},
  {name:"Exam Mode",actions:[["START_WINDOWS_LIVE",{}],["WINDOWS_CLOSE_PROCESS_GROUP",{group:"games"}],["START_SINGLE_TASK",{url:"https://docs.google.com/"}]],note:"Strict browser/task mode."},
  {name:"No Games",actions:[["WINDOWS_CLOSE_PROCESS_GROUP",{group:"games"}]],note:"Close game process group."},
  {name:"No Chat",actions:[["WINDOWS_CLOSE_PROCESS_GROUP",{group:"chat"}]],note:"Close chat apps."},
  {name:"Low Bandwidth",actions:[["SET_LOW_BANDWIDTH_MODE",{}]],note:"FPS 1, JPEG 30."},
  {name:"Normal Bandwidth",actions:[["UNSET_LOW_BANDWIDTH_MODE",{}]],note:"Restore normal live settings."},
  {name:"Free Mode",actions:[["STOP_SINGLE_TASK",{}],["UNPAUSE_SCREEN",{}]],note:"Undo strict browser controls."}
];

export function render(root){
  root.innerHTML = `<section class="card"><h2>Policies</h2><label>Target group/device</label><select id="policyTarget">${groupOptions()}</select><div class="grid">${builtins.map((p,i)=>`<div class="rule-card"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.note)}</p><pre>${escapeHtml(JSON.stringify(p.actions,null,2))}</pre><button data-policy="${i}">Preview / Run</button></div>`).join("")}</div></section><section class="card"><h2>Saved Policies</h2><div class="grid">${state.savedPolicies.map((p,i)=>`<div class="rule-card"><h3>${escapeHtml(p.name)}</h3><button data-run-saved="${i}">Run</button><button data-del-saved="${i}" class="danger">Delete</button></div>`).join("")||"<p>No saved policies.</p>"}</div></section>`;
  root.querySelectorAll("[data-policy]").forEach(b=>b.onclick=()=>runPolicy(builtins[Number(b.dataset.policy)]));
  root.querySelectorAll("[data-run-saved]").forEach(b=>b.onclick=()=>runPolicy(state.savedPolicies[Number(b.dataset.runSaved)]));
  root.querySelectorAll("[data-del-saved]").forEach(b=>b.onclick=()=>{state.savedPolicies.splice(Number(b.dataset.delSaved),1);saveLocal();render(root);});
}
function runPolicy(p){if(!confirm(`Run policy "${p.name}"?\n\nThis will run ${p.actions.length} action(s).`))return;const targets=resolveTargets(document.getElementById("policyTarget").value);for(const d of targets) for(const [cmd,payload] of p.actions) command(cmd,payload,d.deviceId);addHistory("Ran policy",{policy:p.name,targets:targets.map(d=>d.deviceId)});}
