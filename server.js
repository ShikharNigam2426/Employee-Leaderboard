const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3000;
const dataFile = path.join(__dirname, "data.json");

function readData() {
  const raw = fs.readFileSync(dataFile, "utf-8");
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const filePath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(filePath).replace(/^\.\.[/\\]/, "");
  const resolved = path.join(__dirname, safePath);

  if (!resolved.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".json": "application/json",
    };

    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(data);
  });
}

function parseBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      callback(JSON.parse(body || "{}"));
    } catch (error) {
      callback(null);
    }
  });
}

function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/employees") {
    const data = readData();
    sendJson(res, 200, data.employees);
    return;
  }

  if (req.method === "POST" && req.url === "/api/employees") {
    parseBody(req, (body) => {
      if (!body || !body.name) {
        sendJson(res, 400, { error: "Invalid payload" });
        return;
      }
      const data = readData();
      const newEmployee = {
        id: Date.now().toString(),
        name: body.name,
        score: Number(body.score) || 0,
      };
      data.employees.push(newEmployee);
      writeData(data);
      sendJson(res, 201, newEmployee);
    });
    return;
  }

  const match = req.url.match(/^\/api\/employees\/(.+)$/);
  if (match) {
    const id = match[1];
    if (req.method === "PUT") {
      parseBody(req, (body) => {
        if (!body || !body.name) {
          sendJson(res, 400, { error: "Invalid payload" });
          return;
        }
        const data = readData();
        const index = data.employees.findIndex((emp) => emp.id === id);
        if (index === -1) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        data.employees[index] = {
          ...data.employees[index],
          name: body.name,
          score: Number(body.score) || 0,
        };
        writeData(data);
        sendJson(res, 200, data.employees[index]);
      });
      return;
    }

    if (req.method === "DELETE") {
      const data = readData();
      const index = data.employees.findIndex((emp) => emp.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      const removed = data.employees.splice(index, 1)[0];
      writeData(data);
      sendJson(res, 200, removed);
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
