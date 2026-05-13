require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGO_URI;

// Store uploads in memory for quick CSV parsing.
const upload = multer({ storage: multer.memoryStorage() });

const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// Hardcoded roles and private hashes for internal access links.
const roles = {
  "tenured-rm": { title: "Tenured RM", tag: "Tenured RM", hash: "a8x92kd7q1" },
  "new-rm": { title: "New RM", tag: "New RM", hash: "kd82js9a0x" },
  bsm: { title: "BSM", tag: "BSM", hash: "91ksla8x2q" },
};

// MongoDB client and database connection
let db = null;
let mongoClient = null;
let mongoRetryTimeout = null;

const connectToMongo = async () => {
  if (!mongoUri) {
    console.error("MONGO_URI is not set. Skipping MongoDB connection.");
    return null;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(mongoUri);
    }
    await mongoClient.connect();
    db = mongoClient.db("leaderboard");
    console.log("Connected to MongoDB successfully!");
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error.message || error);
    db = null;
    scheduleMongoRetry();
    return null;
  }
};

const scheduleMongoRetry = () => {
  if (mongoRetryTimeout) {
    return;
  }
  mongoRetryTimeout = setTimeout(() => {
    mongoRetryTimeout = null;
    connectToMongo();
  }, 10000);
};

const toNumberOrString = (value) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? String(value).trim() : asNumber;
};

const normalizeRankedEntries = (entries) => {
  const cleaned = entries
    .filter((entry) => entry && entry.name)
    .map((entry, index) => {
      const rankValue = Number(entry.rank);
      return {
        ...entry,
        name: String(entry.name).trim(),
        teamName: entry.teamName ? String(entry.teamName).trim() : "",
        rank: Number.isNaN(rankValue) ? index + 1 : rankValue,
      };
    });

  return cleaned.sort((a, b) => a.rank - b.rank);
};

// Get leaderboard entries from MongoDB.
const getLeaderboardEntries = async (role) => {
  if (!db) {
    return [];
  }
  try {
    const collection = db.collection(role);
    const entries = await collection
      .find({ _id: { $ne: "metadata" } })
      .sort({ rank: 1 })
      .toArray();
    return normalizeRankedEntries(entries);
  } catch (error) {
    console.error("Error fetching leaderboard entries:", error);
    return [];
  }
};

// Get the last update time for a role.
const getUpdatedAt = async (role) => {
  if (!db) {
    return null;
  }
  try {
    const collection = db.collection(role);
    const metadata = await collection.findOne({ _id: "metadata" });
    return metadata ? metadata.updatedAt : null;
  } catch (error) {
    return null;
  }
};

// Update the last update time for a role.
const updateMetadata = async (role) => {
  if (!db) {
    return;
  }
  try {
    const collection = db.collection(role);
    await collection.updateOne(
      { _id: "metadata" },
      { $set: { updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error updating metadata:", error);
  }
};

// Clear all entries for a role (keep metadata).
const clearLeaderboard = async (role) => {
  if (!db) {
    return;
  }
  try {
    const collection = db.collection(role);
    await collection.deleteMany({ _id: { $ne: "metadata" } });
    await updateMetadata(role);
  } catch (error) {
    console.error("Error clearing leaderboard:", error);
  }
};

// Save leaderboard entries to MongoDB.
const saveLeaderboardEntries = async (role, entries) => {
  if (!db) {
    return;
  }
  try {
    const collection = db.collection(role);
    // Clear existing entries (but not metadata)
    await collection.deleteMany({ _id: { $ne: "metadata" } });
    
    // Insert new entries
    if (entries.length > 0) {
      await collection.insertMany(
        entries.map((entry) => ({
          rank: entry.rank,
          teamName: entry.teamName || "",
          name: entry.name,
          hotLeadPerRm: entry.hotLeadPerRm ?? "",
          loginActiveRmPct: entry.loginActiveRmPct ?? "",
          jvPerNewRm: entry.jvPerNewRm ?? "",
          hotLead: entry.hotLead ?? "",
          login: entry.login ?? "",
          fd: entry.fd ?? "",
        }))
      );
    }
    
    // Update metadata
    await updateMetadata(role);
  } catch (error) {
    console.error("Error saving leaderboard entries:", error);
  }
};

// Parse CSV content and convert into ranked entries.
const normalizeHeader = (header) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCsvBuffer = (buffer, role) => {
  const raw = buffer.toString("utf-8").replace(/^\uFEFF/, "").trim();
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) {
    return [];
  }

  console.log(`[CSV Parse] Role: ${role}, Total lines: ${lines.length}`);
  const headerCells = lines[0].split(",").map((cell) => cell.trim());
  const hasHeader = headerCells.some((cell) => /[a-zA-Z]/.test(cell));
  console.log(`[CSV Parse] Headers: ${hasHeader ? "detected" : "not detected"}`, headerCells.slice(0, 3));

  const headerMap = hasHeader
    ? headerCells.map((cell) => normalizeHeader(cell))
    : [];

  const dataLines = hasHeader ? lines.slice(1) : lines;

  const entries = dataLines
    .map((line, index) => {
      const cells = line.split(",").map((cell) => cell.trim());
      if (!cells.length) {
        return null;
      }

      const getValue = (aliases) => {
        if (!hasHeader) {
          return null;
        }
        const matchIndex = headerMap.findIndex((key) => aliases.includes(key));
        return matchIndex >= 0 ? cells[matchIndex] : "";
      };

      const getPositional = (pos) => (cells[pos] ? cells[pos] : "");

      const entry = {
        rank: getValue(["rank", "sr", "sno", "#"]) || getPositional(0) || index + 1,
        teamName: getValue(["teamname", "team", "teamdetails", "bsmdetails"]) || getPositional(1) || "",
        name: getValue(["name", "rmname", "bsmname"]) || getPositional(2) || "",
        hotLeadPerRm: toNumberOrString(getValue(["hotleadperrm", "hotleadperrm%", "hotleadper"]) || getPositional(3) || ""),
        loginActiveRmPct: toNumberOrString(getValue(["loginsactiverm%", "loginactiverm%", "loginsactiverm", "loginsactive"]) || getPositional(4) || ""),
        jvPerNewRm: toNumberOrString(getValue(["jvpernewrm", "jvpernew"]) || getPositional(5) || ""),
        hotLead: toNumberOrString(getValue(["hotlead", "hotleads"]) || getPositional(3) || ""),
        login: toNumberOrString(getValue(["login", "logins"]) || getPositional(4) || ""),
        fd: toNumberOrString(getValue(["fd", "fds"]) || getPositional(5) || ""),
      };

      if (!entry.name) {
        return null;
      }

      return entry;
    })
    .filter(Boolean);

  return normalizeRankedEntries(entries);
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
app.get("/api/leaderboard/:role", async (req, res) => {
  const role = req.params.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (!db) {
    res.status(503).json({ error: "Database unavailable. Please try again shortly." });
    return;
  }

  const entries = await getLeaderboardEntries(role);
  const updatedAt = await getUpdatedAt(role);
  res.json({
    updatedAt,
    entries,
  });
});

// Upload CSV and overwrite role data.
app.post("/api/upload", upload.single("csv"), async (req, res) => {
  const role = req.body.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (!db) {
    res.status(503).json({ error: "Database unavailable. Please try again shortly." });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "CSV file missing" });
    return;
  }

  try {
    const entries = parseCsvBuffer(req.file.buffer, role);
    if (!entries.length) {
      res.status(400).json({ error: "No valid rows found in the CSV." });
      return;
    }

    console.log(`Uploading ${entries.length} rows for ${role}`);
    await saveLeaderboardEntries(role, entries);

    const updatedAt = await getUpdatedAt(role);
    res.json({
      updatedAt,
      entries,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Upload failed. Please try again." });
  }
});

// Clear a leaderboard.
app.post("/api/clear", async (req, res) => {
  const role = req.body.role;
  if (!roles[role]) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (!db) {
    res.status(503).json({ error: "Database unavailable. Please try again shortly." });
    return;
  }

  await clearLeaderboard(role);
  const updatedAt = await getUpdatedAt(role);
  res.json({ updatedAt, entries: [] });
});

// Start server and connect to MongoDB
const startServer = async () => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  await connectToMongo();
};

startServer();
