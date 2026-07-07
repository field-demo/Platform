let allTasks = [];
let frequencyFilter = "All";
let currentTaskId = null;

const STORAGE_KEY = "amosFieldInterfaceDemoV2";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function init() {
  const response = await fetch("data.json");
  const seedData = await response.json();
  const stored = localStorage.getItem(STORAGE_KEY);
  allTasks = stored ? JSON.parse(stored) : seedData;
  registerEvents();
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

function registerEvents() {
  $$(".nav-button, .quick-card[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  $$(".filter-pill").forEach((button) => {
    button.addEventListener("click", () => {
      frequencyFilter = button.dataset.filter;
      $$(".filter-pill").forEach((b) => b.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderTaskList();
    });
  });

  $("#searchInput").addEventListener("input", renderTaskList);
  $("#syncButton").addEventListener("click", simulateSync);
  $("#resetButton").addEventListener("click", resetDemo);
  $("#demoSearchTag").addEventListener("click", () => {
    navigate("roundsView");
    $("#searchInput").value = "FH-UDK-032";
    renderTaskList();
  });

  $$(".status-select button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".status-select button").forEach((b) => b.classList.remove("active-status"));
      button.classList.add("active-status");
    });
  });

  $("#saveTaskButton").addEventListener("click", saveCurrentTask);
}

function navigate(viewId) {
  $$(".view").forEach((view) => view.classList.remove("is-active"));
  $("#" + viewId).classList.add("is-active");

  $$(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === viewId);
  });

  if (viewId === "roundsView") renderTaskList();
  if (viewId === "findingsView") renderFindings();
  if (viewId === "managementView") renderManagement();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
}

function completionPercent(tasks = allTasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === "Completed").length / tasks.length) * 100);
}

function render() {
  renderHome();
  renderTaskList();
  renderFindings();
  renderManagement();
}

function renderHome() {
  const percent = completionPercent();
  const completed = allTasks.filter((task) => task.status === "Completed").length;
  const findings = allTasks.filter((task) => task.status === "Defect" || task.status === "Follow-up").length;

  $("#heroTitle").textContent = `${percent}% completed`;
  $("#heroSummary").textContent = `${completed} completed / ${allTasks.length} total inspection tasks`;
  $("#progressPercent").textContent = `${percent}%`;
  $("#progressRing").style.background = `conic-gradient(var(--green) ${percent * 3.6}deg,#243b50 0deg)`;
  $("#findingCount").textContent = `${findings} open`;

  const areas = groupBy(allTasks, "area");
  $("#deckOverview").innerHTML = Object.entries(areas).map(([area, tasks]) => {
    const remaining = tasks.filter((task) => task.status !== "Completed" && task.status !== "N/A").length;
    const percentArea = completionPercent(tasks);
    return `<button class="deck-row" data-area="${escapeHtml(area)}">
      <div><strong>${escapeHtml(area)}</strong><small>${percentArea}% completed</small></div>
      <span class="badge">${remaining ? remaining + " remaining" : "Complete"}</span>
    </button>`;
  }).join("");

  $$("#deckOverview .deck-row").forEach((button) => {
    button.addEventListener("click", () => {
      navigate("roundsView");
      $("#searchInput").value = button.dataset.area;
      renderTaskList();
    });
  });
}

function renderTaskList() {
  const search = ($("#searchInput")?.value || "").toLowerCase().trim();
  const filtered = allTasks.filter((task) => {
    const matchesFrequency = frequencyFilter === "All" || task.frequency === frequencyFilter;
    const searchable = `${task.localTag} ${task.amosId} ${task.equipment} ${task.area} ${task.deck} ${task.location} ${task.task} ${task.frequency}`.toLowerCase();
    return matchesFrequency && searchable.includes(search);
  });

  $("#taskList").innerHTML = filtered.map(taskCardHtml).join("") || emptyState("No matching inspection tasks");
  $$("#taskList .task-card").forEach((card) => {
    card.addEventListener("click", () => openTask(card.dataset.id));
  });
}

function taskCardHtml(task) {
  return `<button class="task-card" data-id="${escapeHtml(task.id)}">
    <div>
      <h3>${task.route}. ${escapeHtml(task.equipment)}</h3>
      <p>${escapeHtml(task.location)}</p>
      <p>${escapeHtml(task.localTag)} • ${escapeHtml(task.deck)}</p>
    </div>
    <div class="badges">
      <span class="badge">${escapeHtml(task.frequency)}</span>
      <span class="status ${statusClass(task.status)}">${escapeHtml(task.status)}</span>
    </div>
  </button>`;
}

function openTask(taskId) {
  currentTaskId = taskId;
  const task = allTasks.find((item) => item.id === taskId);
  if (!task) return;

  $("#dialogMeta").textContent = `${task.frequency} • ${task.simulatedWO}`;
  $("#dialogEquipment").textContent = task.equipment;
  $("#dialogLocation").textContent = `${task.location} • ${task.deck}`;
  $("#dialogLocalTag").textContent = `Local tag: ${task.localTag}`;
  $("#dialogAmosId").textContent = `AMOS ID: ${task.amosId}`;
  $("#dialogTask").textContent = task.task;
  $("#commentInput").value = task.comment || "";
  $("#severitySelect").value = task.severity || "";

  $$(".status-select button").forEach((button) => {
    button.classList.toggle("active-status", button.dataset.status === task.status);
  });

  $("#taskDialog").showModal();
}

function saveCurrentTask() {
  const task = allTasks.find((item) => item.id === currentTaskId);
  if (!task) return;

  const activeStatus = $(".status-select button.active-status");
  task.status = activeStatus ? activeStatus.dataset.status : task.status;
  task.comment = $("#commentInput").value.trim();
  task.severity = $("#severitySelect").value;
  task.updatedAt = new Date().toISOString();

  saveState();
  render();
}

function renderFindings() {
  const findings = allTasks.filter((task) => task.status === "Defect" || task.status === "Follow-up");
  $("#findingsList").innerHTML = findings.map(taskCardHtml).join("") || emptyState("No open defects or follow-up items");
  $$("#findingsList .task-card").forEach((card) => {
    card.addEventListener("click", () => openTask(card.dataset.id));
  });
}

function renderManagement() {
  const completed = allTasks.filter((task) => task.status === "Completed").length;
  const remaining = allTasks.filter((task) => task.status !== "Completed" && task.status !== "N/A").length;
  const defects = allTasks.filter((task) => task.status === "Defect").length;
  const follow = allTasks.filter((task) => task.status === "Follow-up").length;

  $("#managerCompletion").textContent = completionPercent() + "%";
  $("#managerRemaining").textContent = remaining;
  $("#managerDefects").textContent = defects;
  $("#managerFollow").textContent = follow;

  $("#frequencyStats").innerHTML = ["1W", "1M", "4M"].map((frequency) => {
    const tasks = allTasks.filter((task) => task.frequency === frequency);
    return progressRow(frequency, tasks);
  }).join("");

  const areas = groupBy(allTasks, "area");
  $("#areaStats").innerHTML = Object.entries(areas).map(([area, tasks]) => progressRow(area, tasks)).join("");
}

function progressRow(label, tasks) {
  const percent = completionPercent(tasks);
  const done = tasks.filter((task) => task.status === "Completed").length;
  return `<div class="stat-row">
    <div class="stat-top"><span>${escapeHtml(label)}</span><span>${done}/${tasks.length} • ${percent}%</span></div>
    <div class="bar"><div style="width:${percent}%"></div></div>
  </div>`;
}

function simulateSync() {
  $("#syncButton").textContent = "…";
  setTimeout(() => {
    $("#syncButton").textContent = "✓";
    setTimeout(() => $("#syncButton").textContent = "↻", 900);
  }, 700);
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] || "Unknown";
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {});
}

function emptyState(text) {
  return `<div class="panel"><h3>${escapeHtml(text)}</h3><p class="muted">Try another filter or search term.</p></div>`;
}

function statusClass(status) {
  return status.replace("/", "\/");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

init();
