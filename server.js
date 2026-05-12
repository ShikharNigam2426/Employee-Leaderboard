require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT) || 3000;
// Store uploads in memory for quick CSV parsing.
const upload = multer({ storage: multer.memoryStorage() });

const dataDir = path.join(__dirname, "data");
const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// Hardcoded roles and private hashes for internal access links.
const roles = {
  "tenured-rm": { title: "Tenured RM", tag: "Tenured RM", hash: "a8x92kd7q1" },
  "new-rm": { title: "New RM", tag: "New RM", hash: "kd82js9a0x" },
  bsm: { title: "BSM", tag: "BSM", hash: "91ksla8x2q" },
};

// Resolve data file path for a given role.
const getDataPath = (role) => path.join(dataDir, `${role}.json`);

// Ensure the data directory exists on boot.
const ensureDataFolder = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Normalize entries: sort by score and regenerate ranks.
const normalizeEntries = (entries) => {
  return [...entries]
    .filter((entry) => entry && entry.name)
    .map((entry) => ({
      name: String(entry.name).trim(),
      score: Number(entry.score) || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      score: entry.score,
    }));
};

// Read a role JSON file safely.
const readDataFile = (role) => {
  const filePath = getDataPath(role);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return normalizeEntries(JSON.parse(raw));
  } catch (error) {
    return [];
  }
};

// Write role data to disk.
const writeDataFile = (role, data) => {
  const filePath = getDataPath(role);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Get file modified time for last updated timestamps.
const getUpdatedAt = (role) => {
  const filePath = getDataPath(role);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const stats = fs.statSync(filePath);
  return stats.mtime.toISOString();
};

// Parse CSV content and convert into ranked entries.
const parseCsvBuffer = (buffer) => {
  const raw = buffer.toString("utf-8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const entries = lines
    .map((line) => {
      const [name, marks] = line.split(",");
      if (!name || !marks) {
        return null;
      }
      const score = Number(marks.trim());
      if (Number.isNaN(score)) {
        return null;
      }
      return {
        name: name.trim(),
        score,
      };
    })
    .filter(Boolean);

  return normalizeEntries(entries);
};

// Very small template helper for HTML placeholders.
const renderTemplate = (fileName, data) => {
  const templatePath = path.join(viewsDir, fileName);
  const template = fs.readFileSync(templatePath, "utf-8");
  return Object.entries(data).reduce(
    (output, [key, value]) => output.replace(new RegExp(`{{${key}}}`, "g"), value),
    template
  );
};

// Parse JSON bodies and serve static assets.
app.use(express.json());
app.use(express.static(publicDir));

// Admin edit page.
app.get("/admin-edit", (req, res) => {
  res.send(renderTemplate("admin.html", {}));
});

// Role-based leaderboard pages protected by a private hash.
app.get("/:role/:hash", (req, res) => {
  const { role, hash } = req.params;
  const roleConfig = roles[role];
  if (!roleConfig || roleConfig.hash !== hash) {
    res.status(404).send("Not found");
    return;
  }

  res.send(
    renderTemplate("leaderboard.html", {
      ROLE_TITLE: roleConfig.title,
      ROLE_TAG: roleConfig.tag,
      ROLE_SLUG: role,
    })
  );
});

// Fetch leaderboard entries for a role.
app.get("/api/leaderboard/:role", (req, res) => {
  const role = req.params.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const entries = readDataFile(role);
  res.json({
    updatedAt: getUpdatedAt(role),
    entries,
  });
});

// Upload CSV and overwrite role data.
app.post("/api/upload", upload.single("csv"), (req, res) => {
  const role = req.body.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "CSV file missing" });
    return;
  }

  const entries = parseCsvBuffer(req.file.buffer);
  writeDataFile(role, entries);

  res.json({
    updatedAt: getUpdatedAt(role),
    entries,
  });
});

// Clear a leaderboard.
app.post("/api/clear", (req, res) => {
  const role = req.body.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  writeDataFile(role, []);
  res.json({ updatedAt: getUpdatedAt(role), entries: [] });
});

// Ensure data folder exists on startup.
ensureDataFolder();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
