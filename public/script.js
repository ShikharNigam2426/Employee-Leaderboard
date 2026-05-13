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

// Format current date for dashboard
const formatCurrentDate = () => {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
};

// Format month-year for dashboard title
const formatMonthYear = () => {
  const options = { month: 'short', year: 'numeric' };
  return new Date().toLocaleDateString('en-US', options);
};

const roleColumns = {
  "bsm": [
    { key: "rank", label: "#", className: "col-rank" },
    { key: "name", label: "NAME", className: "col-name" },
    { key: "hotLeadPerRm", label: "HOT LEAD PER RM", className: "col-metric" },
    { key: "loginActiveRmPct", label: "LOGINS ACTIVE RM%", className: "col-metric" },
    { key: "jvPerNewRm", label: "JV PER NEW RM", className: "col-metric" },
  ],
  "tenured-rm": [
    { key: "rank", label: "#", className: "col-rank" },
    { key: "name", label: "NAME", className: "col-name" },
    { key: "hotLead", label: "HOT LEAD", className: "col-metric" },
    { key: "login", label: "LOGIN", className: "col-metric" },
    { key: "fd", label: "FD", className: "col-metric" },
  ],
  "new-rm": [
    { key: "rank", label: "#", className: "col-rank" },
    { key: "name", label: "NAME", className: "col-name" },
    { key: "login", label: "LOGIN", className: "col-metric" },
    { key: "hotLead", label: "HOT LEAD", className: "col-metric" },
  ],
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

const buildTableHead = (role) => {
  const headRow = document.getElementById("leaderboardHead");
  if (!headRow) {
    return;
  }
  headRow.innerHTML = "";
  const columns = roleColumns[role] || [];
  columns.forEach((column) => {
    const th = document.createElement("th");
    if (column.className) {
      th.className = column.className;
    }
    th.textContent = column.label;
    headRow.appendChild(th);
  });
};

// Render leaderboard rows with top-3 highlights.
const renderRows = (rows, role) => {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody) {
    return;
  }
  tbody.innerHTML = "";

  const columns = roleColumns[role] || [];

  rows.forEach((entry) => {
    const row = document.createElement("tr");
    row.classList.add(`rank-${entry.rank}`);

    columns.forEach((column) => {
      const cell = document.createElement("td");
      if (column.className) {
        cell.className = column.className;
      }

      if (column.key === "rank") {
        const badge = document.createElement("span");
        badge.className = "rank-badge";
        badge.textContent = entry.rank ?? "--";
        cell.appendChild(badge);
      } else if (column.key === "name") {
        const wrapper = document.createElement("div");
        wrapper.className = "name-stack";

        const main = document.createElement("div");
        main.className = "name-main";
        main.textContent = entry.name || "--";

        wrapper.appendChild(main);

        if (entry.teamName) {
          const sub = document.createElement("div");
          sub.className = "name-sub";
          sub.textContent = entry.teamName;
          wrapper.appendChild(sub);
        }

        cell.appendChild(wrapper);
      } else {
        const value = entry[column.key];
        cell.textContent = value === undefined || value === null || value === "" ? "--" : value;
      }

      row.appendChild(cell);
    });
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

  renderRows(filtered, document.body.dataset.role);

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
  // Set dashboard dates
  const dateDisplay = document.getElementById("currentDate");
  if (dateDisplay) {
    dateDisplay.textContent = formatCurrentDate();
  }
  
  const dashboardTitle = document.querySelector(".dashboard-title");
  if (dashboardTitle) {
    dashboardTitle.textContent = `Daily Leaderboard | ${formatMonthYear()}`;
  }

  buildTableHead(document.body.dataset.role);
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
      return;
    }

    let message = "Upload failed. Please check the CSV format.";
    try {
      const payload = await response.json();
      if (payload && payload.error) {
        message = payload.error;
      }
    } catch (error) {
      // Ignore JSON parse errors.
    }
    showToast(message);
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
