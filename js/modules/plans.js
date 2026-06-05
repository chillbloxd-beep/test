import { state, saveLocal, addHistory } from "../core/state.js";
import { command, apiPost, apiGet } from "../core/worker.js";
import { groupOptions, resolveTargets } from "../core/ui.js";
import { escapeHtml } from "../core/diagnostics.js";

export function render(root){
  root.innerHTML = `<section class="grid2"><div class="card"><h2>Plans / Schedules</h2><label>Name</label><input id="planName" value="Weekday Study Mode"><label>Target</label><select id="planTarget">${groupOptions()}</select><label>Schedule type</label><select id="planType"><option>once</option><option>daily</option><option>weekdays</option><option>weekends</option><option>every_x_minutes</option><option>custom_sg_time</option></select><label>SG Time / interval</label><input id="planTime" value="07:30"><label>Actions JSON</label><textarea id="planActions">[["START_WINDOWS_LIVE",{}],["WINDOWS_CLOSE_PROCESS_GROUP",{"group":"games"}]]</textarea><div class="controls"><button id="savePlan">Save Local Plan</button><button id="saveWorkerPlan">Save To Worker</button><button id="loadWorkerPlans">Load Worker Plans</button><button id="runPlan">Run Now</button></div><pre id="planOut"></pre></div><div class="card"><h2>Local Plans</h2>${state.savedPlans.map((p,i)=>`<div class="rule-card"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.type)} • ${escapeHtml(p.time)}</p><button data-run-plan="${i}">Run</button><button data-del-plan="${i}" class="danger">Delete</button></div>`).join("")||"<p>No local plans.</p>"}</div></section>`;
  document.getElementById("savePlan").onclick=savePlan;
  document.getElementById("saveWorkerPlan").onclick=saveWorkerPlan;
  document.getElementById("loadWorkerPlans").onclick=loadWorkerPlans;
  document.getElementById("runPlan").onclick=()=>runPlan(currentPlan());
  root.querySelectorAll("[data-run-plan]").forEach(b=>b.onclick=()=>runPlan(state.savedPlans[Number(b.dataset.runPlan)]));
  root.querySelectorAll("[data-del-plan]").forEach(b=>b.onclick=()=>{state.savedPlans.splice(Number(b.dataset.delPlan),1);saveLocal();render(root);});
}
function currentPlan(){return{id:"plan_"+Date.now(),name:document.getElementById("planName").value,target:document.getElementById("planTarget").value,type:document.getElementById("planType").value,time:document.getElementById("planTime").value,timezone:"Asia/Singapore",actions:JSON.parse(document.getElementById("planActions").value),enabled:true,createdAt:Date.now()};}
function savePlan(){const p=currentPlan();state.savedPlans.unshift(p);saveLocal();addHistory("Saved local plan",p);document.getElementById("planOut").textContent="Saved local plan."}
async function saveWorkerPlan(){try{const r=await apiPost("/api/schedules", currentPlan());document.getElementById("planOut").textContent=JSON.stringify(r,null,2)}catch(e){document.getElementById("planOut").textContent="Save failed: "+e.message}}
async function loadWorkerPlans(){try{const r=await apiGet("/api/schedules");document.getElementById("planOut").textContent=JSON.stringify(r,null,2)}catch(e){document.getElementById("planOut").textContent="Load failed: "+e.message}}
function runPlan(p){const targets=resolveTargets(p.target);for(const d of targets) for(const [cmd,payload] of p.actions) command(cmd,payload,d.deviceId);addHistory("Ran plan",{plan:p.name,targets:targets.map(d=>d.deviceId)});}
