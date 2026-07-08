let allItems = [];
let activeFilter = "All";
let activeSlingFilter = "All";
let currentId = null;
const STORAGE_KEY = "fieldDemoV11";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function init() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    const seedData = await response.json();
    const stored = localStorage.getItem(STORAGE_KEY);
    allItems = stored ? JSON.parse(stored) : seedData;
    registerEvents();
    render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  } catch (error) {
    $("#heroTitle").textContent = "Load error";
    $("#heroSummary").textContent = String(error);
  }
}

function registerEvents() {
  $$(".nav-button").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.nav)));

  $$(".filter-pill[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      $$(".filter-pill[data-filter]").forEach((x) => x.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderList();
    });
  });

  $$(".sling-filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeSlingFilter = button.dataset.sling;
      $$(".sling-filter").forEach((x) => x.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderSlingStore();
    });
  });

  $("#searchInput").addEventListener("input", renderList);
  $("#resetButton").addEventListener("click", resetDemo);
  $("#syncButton").addEventListener("click", simulateSync);
  $("#newLoanButton").addEventListener("click", () => alert("Demo: Take-out form would register ID tag, equipment, loaned by, used at, date out and expected return."));

  $$(".status-select button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".status-select button").forEach((x) => x.classList.remove("active-status"));
      button.classList.add("active-status");
    });
  });

  $("#saveTaskButton").addEventListener("click", saveCurrent);
}

function navigate(viewId) {
  $$(".view").forEach((view) => view.classList.remove("is-active"));
  $("#" + viewId).classList.add("is-active");
  $$(".nav-button").forEach((button) => button.classList.toggle("is-active", button.dataset.nav === viewId));
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allItems));
}

function completionPercent(items = allItems) {
  const effective = items.filter((item) => item.status !== "N/A");
  if (!effective.length) return 0;
  const done = effective.filter((item) => item.status === "Approved").length;
  return Math.round((done / effective.length) * 100);
}

function render() {
  renderHome();
  renderList();
  renderSlingStore();
  renderFindings();
  renderManagement();
}

function renderHome() {
  const percent = completionPercent();
  const approved = allItems.filter((item) => item.status === "Approved").length;
  const openFindings = allItems.filter((item) => item.status === "Defect" || item.status === "Follow-up").length;
  $("#heroTitle").textContent = percent + "% approved";
  $("#heroSummary").textContent = approved + " approved / " + allItems.length + " active checks • " + openFindings + " open findings";
  $("#progressPercent").textContent = percent + "%";
  $("#progressRing").style.background = "conic-gradient(var(--green) " + (percent * 3.6) + "deg,#243b50 0deg)";

  const modules = groupBy(allItems, "module");
  const icons = {"Daily Deck Rounds":"☑","Maintenance Program":"▣","Fire & Safety":"🔥","Life Saving Appliances":"🛟","Sling Store":"⚓"};
  $("#moduleGrid").innerHTML = Object.entries(modules).map(([module, items]) => {
    const remaining = items.filter((item) => item.status !== "Approved" && item.status !== "N/A").length;
    return '<button class="module-card" data-module="' + escapeHtml(module) + '"><span class="icon">' + (icons[module] || "▦") + '</span><strong>' + escapeHtml(module) + '</strong><small>' + remaining + ' remaining • ' + completionPercent(items) + '% approved</small></button>';
  }).join("");

  $$("#moduleGrid .module-card").forEach((button) => {
    button.addEventListener("click", () => {
      const module = button.dataset.module;
      if (module === "Sling Store") navigate("slingView");
      else {
        navigate("itemsView");
        $("#searchInput").value = module;
        renderList();
      }
    });
  });

  renderSlingAlerts();

  const areas = groupBy(allItems, "area");
  $("#areaOverview").innerHTML = Object.entries(areas).map(([area, items]) => {
    const remaining = items.filter((item) => item.status !== "Approved" && item.status !== "N/A").length;
    return '<button class="deck-row" data-area="' + escapeHtml(area) + '"><div><strong>' + escapeHtml(area) + '</strong><small>' + completionPercent(items) + '% approved</small></div><span class="badge">' + remaining + ' remaining</span></button>';
  }).join("");

  $$("#areaOverview .deck-row").forEach((button) => {
    button.addEventListener("click", () => {
      navigate("itemsView");
      $("#searchInput").value = button.dataset.area;
      renderList();
    });
  });
}

function renderSlingAlerts() {
  const sling = allItems.filter((item) => item.module === "Sling Store");
  const out = sling.filter((item) => item.loanStatus === "Out").length;
  const overdue = sling.filter((item) => item.loanStatus === "Overdue").length;
  const quarantine = sling.filter((item) => item.loanStatus === "Quarantine").length;
  const certDue = sling.filter((item) => item.certificateStatus === "Expiring Soon").length;
  $("#slingAlerts").innerHTML =
    alertRow("Out on loan", out, "Out") +
    alertRow("Overdue", overdue, "Overdue") +
    alertRow("Quarantine", quarantine, "Quarantine") +
    alertRow("Certificates due soon", certDue, "Follow-up");
}

function alertRow(label, count, status) {
  return '<button class="deck-row" data-sling-shortcut="' + escapeHtml(status) + '"><div><strong>' + escapeHtml(label) + '</strong><small>Sling Store</small></div><span class="status ' + statusClass(status) + '">' + count + '</span></button>';
}

function renderList() {
  const search = ($("#searchInput") ? $("#searchInput").value : "").toLowerCase();
  const filtered = allItems.filter((item) => {
    const matchesFilter = activeFilter === "All" || item.frequency === activeFilter;
    return matchesFilter && JSON.stringify(item).toLowerCase().includes(search);
  });
  $("#taskList").innerHTML = filtered.map(cardHtml).join("") || emptyState("No matching items");
  $$("#taskList .task-card").forEach((card) => card.addEventListener("click", () => openItem(card.dataset.id)));
}

function renderSlingStore() {
  const sling = allItems.filter((item) => item.module === "Sling Store");
  $("#loanOut").textContent = sling.filter((i) => i.loanStatus === "Out").length;
  $("#loanOverdue").textContent = sling.filter((i) => i.loanStatus === "Overdue").length;
  $("#loanQuarantine").textContent = sling.filter((i) => i.loanStatus === "Quarantine").length;
  $("#loanCertDue").textContent = sling.filter((i) => i.certificateStatus === "Expiring Soon").length;

  const filtered = sling.filter((item) => activeSlingFilter === "All" || item.loanStatus === activeSlingFilter);
  $("#loanList").innerHTML = filtered.map(cardHtml).join("") || emptyState("No sling store items");
  $$("#loanList .task-card").forEach((card) => card.addEventListener("click", () => openItem(card.dataset.id)));
}

function cardHtml(item) {
  const cert = item.certificateStatus ? '<p>Cert: ' + escapeHtml(item.certificateStatus) + (item.nextDue ? ' • Due ' + escapeHtml(item.nextDue) : '') + '</p>' : '';
  const loan = item.loanStatus ? '<p>Loan: ' + escapeHtml(item.loanStatus) + (item.loanedTo ? ' • ' + escapeHtml(item.loanedTo) : '') + (item.usedAt ? ' • ' + escapeHtml(item.usedAt) : '') + '</p>' : '';
  const comment = item.comment ? '<p>' + escapeHtml(item.comment) + '</p>' : '';
  return '<button class="task-card" data-id="' + escapeHtml(item.id) + '"><div><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.module) + ' • ' + escapeHtml(item.location) + '</p><p>' + escapeHtml(item.localTag) + ' • ' + escapeHtml(item.frequency) + '</p>' + cert + loan + comment + '</div><div class="badges"><span class="badge">' + escapeHtml(item.category) + '</span><span class="status ' + statusClass(item.status) + '">' + escapeHtml(item.status) + '</span>' + (item.loanStatus ? '<span class="status ' + statusClass(item.loanStatus) + '">' + escapeHtml(item.loanStatus) + '</span>' : '') + '</div></button>';
}

function openItem(id) {
  currentId = id;
  const item = allItems.find((x) => x.id === id);
  if (!item) return;
  $("#dialogMeta").textContent = item.module + " • " + item.frequency;
  $("#dialogTitle").textContent = item.title;
  $("#dialogLocation").textContent = item.location + " • " + item.deck;
  $("#dialogLocalTag").textContent = "Local tag: " + item.localTag;
  $("#dialogAmosId").textContent = "ID: " + item.amosId;
  $("#dialogCert").textContent = item.certificateStatus ? "Cert: " + item.certificateStatus : "No cert";
  $("#dialogTask").textContent = item.task;
  $("#checkpointList").innerHTML = (item.checkpoints || []).map((checkpoint) => "<li>" + escapeHtml(checkpoint) + "</li>").join("");
  $("#commentInput").value = item.comment || "";
  $("#severitySelect").value = item.severity || "";

  $("#loanBox").innerHTML = item.loanStatus ? '<strong>Loan details</strong><p>Status: ' + escapeHtml(item.loanStatus) + '</p><p>Type: ' + escapeHtml(item.loanType || "-") + '</p><p>Loaned to: ' + escapeHtml(item.loanedTo || "-") + '</p><p>Used at: ' + escapeHtml(item.usedAt || "-") + '</p><p>Date out: ' + escapeHtml(item.dateOut || "-") + '</p><p>Expected return: ' + escapeHtml(item.expectedReturn || "-") + '</p>' : "";

  $$(".status-select button").forEach((button) => button.classList.toggle("active-status", button.dataset.status === item.status));
  $("#taskDialog").showModal();
}

function saveCurrent() {
  const item = allItems.find((x) => x.id === currentId);
  const active = $(".status-select button.active-status");
  if (!item) return;
  item.status = active ? active.dataset.status : item.status;
  item.comment = $("#commentInput").value.trim();
  item.severity = $("#severitySelect").value;
  item.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function renderFindings() {
  const findings = allItems.filter((item) => item.status === "Defect" || item.status === "Follow-up" || item.loanStatus === "Overdue" || item.loanStatus === "Quarantine");
  $("#findingsList").innerHTML = findings.map(cardHtml).join("") || emptyState("No open findings");
  $$("#findingsList .task-card").forEach((card) => card.addEventListener("click", () => openItem(card.dataset.id)));
}

function renderManagement() {
  const remaining = allItems.filter((item) => item.status !== "Approved" && item.status !== "N/A").length;
  const defects = allItems.filter((item) => item.status === "Defect").length;
  const follow = allItems.filter((item) => item.status === "Follow-up").length;
  $("#managerCompletion").textContent = completionPercent() + "%";
  $("#managerRemaining").textContent = remaining;
  $("#managerDefects").textContent = defects;
  $("#managerFollow").textContent = follow;
  $("#moduleStats").innerHTML = Object.entries(groupBy(allItems, "module")).map(([module, items]) => progressRow(module, items)).join("");

  const sling = allItems.filter((item) => item.module === "Sling Store");
  $("#loanStats").innerHTML =
    progressRow("In Store", sling.filter((i) => i.loanStatus === "In Store")) +
    progressRow("Out", sling.filter((i) => i.loanStatus === "Out"), "Out") +
    progressRow("Overdue", sling.filter((i) => i.loanStatus === "Overdue"), "Overdue") +
    progressRow("Quarantine", sling.filter((i) => i.loanStatus === "Quarantine"), "Quarantine") +
    progressRow("Cert Expiring Soon", sling.filter((i) => i.certificateStatus === "Expiring Soon"), "Expiring Soon");
}

function progressRow(label, items, styleLabel) {
  const percent = completionPercent(items);
  const done = items.filter((item) => item.status === "Approved").length;
  const barClass = styleLabel === "Overdue" || styleLabel === "Quarantine" ? " red" : (styleLabel === "Out" || styleLabel === "Expiring Soon" ? " orange" : "");
  return '<div class="stat-row"><div class="stat-top"><span>' + escapeHtml(label) + '</span><span>' + done + '/' + items.length + ' • ' + percent + '%</span></div><div class="bar' + barClass + '"><div style="width:' + percent + '%"></div></div></div>';
}

function simulateSync() {
  $("#syncButton").textContent = "…";
  setTimeout(() => { $("#syncButton").textContent = "✓"; setTimeout(() => { $("#syncButton").textContent = "↻"; }, 900); }, 700);
}

function resetDemo() { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] || "Unknown";
    if (!groups[value]) groups[value] = [];
    groups[value].push(item);
    return groups;
  }, {});
}

function emptyState(text) { return '<div class="panel"><h3>' + escapeHtml(text) + '</h3><p class="muted">Try another filter or search term.</p></div>'; }

function statusClass(status) {
  if (status === "N/A") return "NA";
  if (status === "In Store") return "InStore";
  return status.replaceAll(" ", "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

init();
