const apiBase = "/api/employees";

const leaderboardBody = document.getElementById("leaderboardBody");
const podium = document.getElementById("podium");
const searchInput = document.getElementById("searchInput");
const employeeForm = document.getElementById("employeeForm");
const employeeId = document.getElementById("employeeId");
const nameInput = document.getElementById("nameInput");
const scoreInput = document.getElementById("scoreInput");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

let employees = [];

function sortByScore(list) {
  return [...list].sort((a, b) => b.score - a.score);
}

function getFilteredEmployees() {
  const query = searchInput.value.trim().toLowerCase();
  const sorted = sortByScore(employees);
  if (!query) {
    return sorted;
  }
  return sorted.filter((emp) => emp.name.toLowerCase().includes(query));
}

function setFormMode(editing) {
  saveBtn.textContent = editing ? "Update Employee" : "Add Employee";
}

function resetForm() {
  employeeId.value = "";
  nameInput.value = "";
  scoreInput.value = "";
  setFormMode(false);
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-btn ${className}`.trim();
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderPodium() {
  const sorted = sortByScore(employees).slice(0, 3);
  podium.innerHTML = "";

  const honors = ["Champion", "1st Runner-up", "2nd Runner-up"];

  for (let i = 0; i < 3; i += 1) {
    const employee = sorted[i];
    const rank = i + 1;
    const card = document.createElement("div");
    card.className = `podium-card rank-${rank}`;

    const badge = document.createElement("span");
    badge.className = "podium-rank";
    badge.textContent = String(rank);

    const name = document.createElement("strong");
    name.textContent = employee ? employee.name : "Open Slot";

    const honor = document.createElement("span");
    honor.className = "podium-honor";
    honor.textContent = honors[i];

    const score = document.createElement("div");
    score.className = "podium-score";
    score.textContent = employee ? String(employee.score) : "-";

    card.append(badge, name, honor, score);
    podium.appendChild(card);
  }
}

function renderLeaderboard() {
  const data = getFilteredEmployees();
  leaderboardBody.innerHTML = "";

  renderPodium();

  const sortedAll = sortByScore(employees);
  const rankMap = new Map(sortedAll.map((employee, index) => [employee.id, index + 1]));

  data.forEach((employee) => {
    const row = document.createElement("tr");
    const rank = rankMap.get(employee.id) ?? 0;

    if (rank <= 3) {
      return;
    }

    if (rank <= 3) {
      row.classList.add(`rank-${rank}`);
    }

    const rankCell = document.createElement("td");
    const rankBadge = document.createElement("span");
    rankBadge.className = "rank-badge";
    rankBadge.textContent = String(rank);
    rankCell.appendChild(rankBadge);

    const nameCell = document.createElement("td");
    nameCell.textContent = employee.name;

    const scoreCell = document.createElement("td");
    scoreCell.className = "score";
    scoreCell.dataset.score = String(employee.score);
    scoreCell.textContent = String(employee.score);

    const actionCell = document.createElement("td");
    const editBtn = createActionButton("Edit", "", () => startEdit(employee));
    const deleteBtn = createActionButton("Delete", "danger", () => deleteEmployee(employee.id));
    actionCell.append(editBtn, deleteBtn);

    row.append(rankCell, nameCell, scoreCell, actionCell);
    leaderboardBody.appendChild(row);
  });
}


async function loadEmployees() {
  const response = await fetch(apiBase);
  employees = await response.json();
  renderLeaderboard();
}

async function addEmployee(payload) {
  await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await loadEmployees();
}

async function updateEmployee(id, payload) {
  await fetch(`${apiBase}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await loadEmployees();
}

async function deleteEmployee(id) {
  await fetch(`${apiBase}/${id}`, { method: "DELETE" });
  await loadEmployees();
}

function startEdit(employee) {
  employeeId.value = employee.id;
  nameInput.value = employee.name;
  scoreInput.value = employee.score;
  setFormMode(true);
}

employeeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const score = Number(scoreInput.value);

  if (!name || Number.isNaN(score)) {
    return;
  }

  const payload = { name, score };
  if (employeeId.value) {
    await updateEmployee(employeeId.value, payload);
  } else {
    await addEmployee(payload);
  }

  resetForm();
});

cancelBtn.addEventListener("click", () => {
  resetForm();
});

searchInput.addEventListener("input", () => {
  renderLeaderboard();
});

loadEmployees();
