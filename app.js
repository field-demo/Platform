let db = null;
let currentId = null;
let slingFilter = "All";
const KEY = "fieldDemoCleanV12";
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

async function init(){
  try{
    const res = await fetch("data.json", {cache:"no-store"});
    const seed = await res.json();
    const stored = localStorage.getItem(KEY);
    db = stored ? JSON.parse(stored) : seed;
    bind();
    render();
    if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  }catch(e){
    $("#homeTitle").textContent = "Load error";
    $("#homeText").textContent = String(e);
  }
}

function bind(){
  $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  $("#search").addEventListener("input", renderShift);
  $("#resetBtn").addEventListener("click", () => { localStorage.removeItem(KEY); location.reload(); });
  $("#syncBtn").addEventListener("click", syncDemo);
  $("#takeOutBtn").addEventListener("click", () => alert("Demo: Take Out form would register ID tag, equipment, borrowed by, used at, date out and expected return."));
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    slingFilter = t.dataset.sling;
    $$(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    renderSling();
  }));
  $("#saveBtn").addEventListener("click", saveItem);
}

function go(id){
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#" + id).classList.add("active");
  $$(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.go === id));
  render();
}

function save(){ localStorage.setItem(KEY, JSON.stringify(db)); }

function allItems(){ return db.items; }
function pct(items = allItems()){
  const effective = items.filter(i => i.status !== "N/A");
  if(!effective.length) return 0;
  return Math.round(effective.filter(i => i.status === "Approved").length / effective.length * 100);
}

function render(){
  renderHome();
  renderShift();
  renderSling();
  renderFindings();
  renderDash();
}

function renderHome(){
  const p = pct();
  const approved = allItems().filter(i => i.status === "Approved").length;
  const findings = allItems().filter(i => ["Defect","Follow-up"].includes(i.status)).length;
  $("#homeTitle").textContent = p + "% complete";
  $("#homeText").textContent = approved + " approved / " + allItems().length + " checks • " + findings + " open findings";
  $("#ringText").textContent = p + "%";
  $("#ring").style.background = "conic-gradient(var(--green) " + (p*3.6) + "deg,#243b50 0deg)";
  $("#findingsCount").textContent = findings + " open";

  const grouped = groupBy(allItems(), "module");
  $("#moduleList").innerHTML = Object.entries(grouped).map(([m, arr]) => {
    const rem = arr.filter(i => i.status !== "Approved" && i.status !== "N/A").length;
    return `<button class="moduleRow" data-module="${esc(m)}"><div><b>${esc(m)}</b><br><small>${pct(arr)}% complete</small></div><span class="badge">${rem} remaining</span></button>`;
  }).join("");
  $$("#moduleList .moduleRow").forEach(b => b.onclick = () => { go(b.dataset.module === "Sling Store" ? "sling" : "shift"); $("#search").value = b.dataset.module; renderShift(); });
}

function renderShift(){
  const q = ($("#search")?.value || "").toLowerCase();
  const arr = allItems().filter(i => JSON.stringify(i).toLowerCase().includes(q));
  $("#shiftList").innerHTML = arr.map(card).join("") || empty("No matching items");
  $$("#shiftList .card").forEach(c => c.onclick = () => openItem(c.dataset.id));
}

function renderSling(){
  const sling = allItems().filter(i => i.module === "Sling Store");
  $("#outCount").textContent = sling.filter(i => i.loan === "Out").length;
  $("#overdueCount").textContent = sling.filter(i => i.loan === "Overdue").length;
  $("#quarantineCount").textContent = sling.filter(i => i.loan === "Quarantine").length;
  $("#certCount").textContent = sling.filter(i => (i.cert || "").toLowerCase().includes("expiring")).length;
  const arr = sling.filter(i => slingFilter === "All" || i.loan === slingFilter);
  $("#slingList").innerHTML = arr.map(card).join("") || empty("No sling items");
  $$("#slingList .card").forEach(c => c.onclick = () => openItem(c.dataset.id));
}

function renderFindings(){
  const arr = allItems().filter(i => ["Defect","Follow-up"].includes(i.status) || ["Overdue","Quarantine"].includes(i.loan));
  $("#findingsList").innerHTML = arr.map(card).join("") || empty("No open findings");
  $$("#findingsList .card").forEach(c => c.onclick = () => openItem(c.dataset.id));
}

function renderDash(){
  const items = allItems();
  $("#dashPct").textContent = pct() + "%";
  $("#dashRemaining").textContent = items.filter(i => i.status !== "Approved" && i.status !== "N/A").length;
  $("#dashDefects").textContent = items.filter(i => i.status === "Defect").length;
  $("#dashFollow").textContent = items.filter(i => i.status === "Follow-up").length;
  $("#progressList").innerHTML = Object.entries(groupBy(items, "module")).map(([m, arr]) => progress(m, arr)).join("");
  const sling = items.filter(i => i.module === "Sling Store");
  $("#loanStats").innerHTML = progress("Out on loan", sling.filter(i => i.loan === "Out"), "orange") + progress("Overdue", sling.filter(i => i.loan === "Overdue"), "red") + progress("Quarantine", sling.filter(i => i.loan === "Quarantine"), "red") + progress("Certificates due", sling.filter(i => (i.cert || "").toLowerCase().includes("expiring")), "orange");
}

function card(i){
  const cert = i.cert ? `<p>${esc(i.cert)}</p>` : "";
  const loan = i.loan ? `<p>Loan: ${esc(i.loan)} ${i.loanedTo ? "• " + esc(i.loanedTo) : ""}</p>` : "";
  const statusClass = cls(i.status);
  const loanBadge = i.loan ? `<span class="status ${cls(i.loan)}">${esc(i.loan)}</span>` : "";
  return `<button class="card" data-id="${esc(i.id)}"><div><h3>${esc(i.title)}</h3><p>${esc(i.module)} • ${esc(i.location)}</p><p>${esc(i.tag)} • ${esc(i.frequency)}</p>${cert}${loan}<p>${esc(i.detail)}</p></div><div class="cardBadges"><span class="badge">${esc(i.type)}</span><span class="status ${statusClass}">${esc(i.status)}</span>${loanBadge}</div></button>`;
}

function openItem(id){
  const i = allItems().find(x => x.id === id);
  if(!i) return;
  currentId = id;
  $("#dlgMeta").textContent = i.module + " • " + i.frequency;
  $("#dlgTitle").textContent = i.title;
  $("#dlgLocation").textContent = i.location;
  $("#dlgTag").textContent = "Tag: " + i.tag;
  $("#dlgStatus").textContent = i.status;
  $("#dlgCert").textContent = i.cert || "No cert";
  $("#dlgTask").textContent = i.detail;
  $("#dlgChecks").innerHTML = (i.checks || []).map(c => `<li>${esc(c)}</li>`).join("");
  $("#statusSelect").value = i.status;
  $("#comment").value = i.detail || "";
  $("#loanBox").innerHTML = i.loan ? `<b>Loan details</b><p>Status: ${esc(i.loan)}</p><p>Type: ${esc(i.loanType || "-")}</p><p>Borrowed by: ${esc(i.loanedTo || "-")}</p><p>Used at: ${esc(i.location || "-")}</p><p>Date out: ${esc(i.dateOut || "-")}</p><p>Expected return: ${esc(i.expectedReturn || "-")}</p>` : "";
  $("#dialog").showModal();
}

function saveItem(){
  const i = allItems().find(x => x.id === currentId);
  if(!i) return;
  i.status = $("#statusSelect").value;
  i.detail = $("#comment").value.trim();
  save();
  render();
}

function progress(label, arr, color){
  const p = pct(arr);
  const barClass = color === "red" ? " red" : color === "orange" ? " orange" : "";
  return `<div class="barRow"><div class="barTop"><span>${esc(label)}</span><span>${arr.length} items • ${p}%</span></div><div class="bar${barClass}"><div style="width:${p}%"></div></div></div>`;
}

function syncDemo(){
  $("#syncBtn").textContent = "…";
  setTimeout(() => { $("#syncBtn").textContent = "✓"; setTimeout(() => $("#syncBtn").textContent = "↻", 900); }, 650);
}

function groupBy(arr, key){
  return arr.reduce((g, x) => {
    const v = x[key] || "Unknown";
    if(!g[v]) g[v] = [];
    g[v].push(x);
    return g;
  }, {});
}

function cls(s){ return String(s || "").replaceAll(" ", "").replace("/", ""); }
function empty(t){ return `<div class="panel"><h3>${esc(t)}</h3><p class="muted">Try another search or filter.</p></div>`; }
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
init();
