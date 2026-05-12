const apiBase = "/api/employees";

const leaderboardBody = document.getElementById("leaderboardBody");
const podium = document.getElementById("podium");
const searchInput = document.getElementById("searchInput");
const openWizardBtn = document.getElementById("openWizardBtn");
const editWizard = document.getElementById("editWizard");
const closeWizardBtn = document.getElementById("closeWizardBtn");
const wizardSelect = document.getElementById("wizardSelect");
const wizardName = document.getElementById("wizardName");
const wizardScore = document.getElementById("wizardScore");
const wizardSaveBtn = document.getElementById("wizardSaveBtn");
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

function setWizardOpen(isOpen) {
  editWizard.classList.toggle("is-open", isOpen);
  editWizard.setAttribute("aria-hidden", String(!isOpen));
}

function populateWizard() {
  wizardSelect.innerHTML = "";
  const sorted = sortByScore(employees);

  sorted.forEach((employee) => {
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = `${employee.name} (Score: ${employee.score})`;
    wizardSelect.appendChild(option);
  });

  if (sorted.length) {
    wizardSelect.value = sorted[0].id;
    wizardName.value = sorted[0].name;
    wizardScore.value = sorted[0].score;
  } else {
    wizardName.value = "";
    wizardScore.value = "";
  }
}

function updateWizardFields(id) {
  const employee = employees.find((emp) => emp.id === id);
  if (!employee) {
    return;
  }
  wizardName.value = employee.name;
  wizardScore.value = employee.score;
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

    row.append(rankCell, nameCell, scoreCell);
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

openWizardBtn.addEventListener("click", () => {
  populateWizard();
  setWizardOpen(true);
});

closeWizardBtn.addEventListener("click", () => {
  setWizardOpen(false);
});

wizardSelect.addEventListener("change", (event) => {
  updateWizardFields(event.target.value);
});

wizardSaveBtn.addEventListener("click", async () => {
  const id = wizardSelect.value;
  const name = wizardName.value.trim();
  const score = Number(wizardScore.value);

  if (!id || !name || Number.isNaN(score)) {
    return;
  }

  await updateEmployee(id, { name, score });
  setWizardOpen(false);
});

loadEmployees();
