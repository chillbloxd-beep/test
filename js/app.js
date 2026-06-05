import { APP_CONFIG } from "../config.js";
import { state } from "./core/state.js";
import { runBootDiagnostics } from "./core/diagnostics.js";
import { initUi, updatePills } from "./core/ui.js";
import { connect } from "./core/worker.js";

window.addEventListener("error", event => {
  const boot = document.getElementById("bootStatus");
  if (boot) boot.innerHTML += `<div class="modal-error">Runtime error: ${event.message}</div>`;
  console.error(event.error || event.message);
});
window.addEventListener("unhandledrejection", event => {
  const boot = document.getElementById("bootStatus");
  if (boot) boot.innerHTML += `<div class="modal-error">Promise error: ${event.reason?.message || event.reason}</div>`;
  console.error(event.reason);
});

async function boot() {
  const bootLines = document.getElementById("bootLines");
  const line = msg => bootLines.innerHTML += `<div>${msg}</div>`;
  try {
    state.cfg = APP_CONFIG;
    line("config.js loaded.");
    await runBootDiagnostics();
    document.getElementById("bootStatus").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    initUi();
    updatePills();
    document.getElementById("topStatus").textContent = "Dashboard ready. Run Diagnostics or Connect.";
    if (state.cfg.AUTO_CONNECT_ON_LOAD) connect();
  } catch (err) {
    line(`<span style="color:#fecaca">Boot failed: ${err.message}</span>`);
    console.error(err);
  }
}
boot();
