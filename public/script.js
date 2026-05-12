// Determine which page is active (leaderboard or admin).
const page = document.body.dataset.page;

// Format ISO timestamps for display.
const formatDateTime = (iso) => {
  if (!iso) {
    return "--";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString();
};

// Show a small success/error toast on the admin page.
const showToast = (message) => {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
};

// Render leaderboard rows with top-3 highlights.
const renderRows = (rows) => {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = "";

  rows.forEach((entry) => {
    const row = document.createElement("tr");
    row.classList.add(`rank-${entry.rank}`);

    const rankCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "rank-badge";
    badge.textContent = entry.rank;
    rankCell.appendChild(badge);

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name;

    const scoreCell = document.createElement("td");
    scoreCell.textContent = entry.score;

    row.append(rankCell, nameCell, scoreCell);
    tbody.appendChild(row);
  });
};

let leaderboardEntries = [];

const applySearchFilter = () => {
  const searchInput = document.getElementById("leaderboardSearch");
  const searchEmpty = document.getElementById("searchEmpty");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filtered = query
    ? leaderboardEntries.filter((entry) => entry.name.toLowerCase().includes(query))
    : leaderboardEntries;

  renderRows(filtered);

  if (searchEmpty) {
    searchEmpty.hidden = filtered.length > 0 || !query;
  }
};

// Fetch and render leaderboard data for the role page.
const updateLeaderboard = async () => {
  const role = document.body.dataset.role;
  const emptyState = document.getElementById("emptyState");
  const wrap = document.getElementById("leaderboardWrap");
  const lastUpdated = document.getElementById("lastUpdated");

  try {
    const response = await fetch(`/api/leaderboard/${role}`);
    const payload = await response.json();
    const entries = payload.entries || [];
    leaderboardEntries = entries;

    if (!entries.length) {
      emptyState.hidden = false;
      wrap.hidden = true;
      const searchEmpty = document.getElementById("searchEmpty");
      if (searchEmpty) {
        searchEmpty.hidden = true;
      }
    } else {
      emptyState.hidden = true;
      wrap.hidden = false;
      applySearchFilter();
    }

    if (lastUpdated) {
      lastUpdated.textContent = formatDateTime(payload.updatedAt);
    }
  } catch (error) {
    if (lastUpdated) {
      lastUpdated.textContent = "--";
    }
  }
};

// Fetch last updated timestamp for the selected role in admin.
const updateAdminTimestamp = async () => {
  const role = document.getElementById("roleSelect").value;
  const output = document.getElementById("adminUpdated");
  if (!output) {
    return;
  }
  try {
    const response = await fetch(`/api/leaderboard/${role}`);
    const payload = await response.json();
    output.textContent = formatDateTime(payload.updatedAt);
  } catch (error) {
    output.textContent = "--";
  }
};

// Leaderboard page init.
if (page === "leaderboard") {
  updateLeaderboard();
  // Refresh often to reflect admin CSV uploads.
  setInterval(updateLeaderboard, 5000);

  const searchInput = document.getElementById("leaderboardSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applySearchFilter();
    });
  }
}

// Admin page init.
if (page === "admin") {
  const form = document.getElementById("uploadForm");
  const roleSelect = document.getElementById("roleSelect");
  const csvInput = document.getElementById("csvInput");
  const clearBtn = document.getElementById("clearBtn");

  updateAdminTimestamp();

  roleSelect.addEventListener("change", () => {
    updateAdminTimestamp();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!csvInput.files.length) {
      showToast("Please select a CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("role", roleSelect.value);
    formData.append("csv", csvInput.files[0]);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      showToast("Leaderboard updated successfully.");
      csvInput.value = "";
      updateAdminTimestamp();
    } else {
      showToast("Upload failed. Please check the CSV format.");
    }
  });

  clearBtn.addEventListener("click", async () => {
    const role = roleSelect.value;
    const response = await fetch("/api/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (response.ok) {
      showToast("Leaderboard cleared.");
      updateAdminTimestamp();
    } else {
      showToast("Unable to clear leaderboard.");
    }
  });
}
