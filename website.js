// website.js - VPS Controller
// Run with: node website.js (ports set in .yaml inputs)

const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const pty = require("node-pty");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PANEL_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Simple system action routes
app.get("/restart", (req, res) => {
  exec("sudo reboot", (err) => {
    if (err) return res.send("Failed: " + err.message);
    res.send("Rebooting system...");
  });
});

app.get("/info", (req, res) => {
  exec("uname -a && lsb_release -a", (err, stdout) => {
    if (err) return res.send("Error: " + err.message);
    res.send(`<pre>${stdout}</pre>`);
  });
});

app.get("/sudo/:cmd", (req, res) => {
  exec("sudo " + req.params.cmd, (err, stdout, stderr) => {
    if (err) return res.send("Error: " + stderr);
    res.send(`<pre>${stdout}</pre>`);
  });
});

// --- Web Terminal (xterm.js + socket.io) ---
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  const shell = process.env.SHELL || "bash";
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env,
  });

  ptyProcess.onData((data) => socket.emit("output", data));
  socket.on("input", (data) => ptyProcess.write(data));
  socket.on("resize", (size) => ptyProcess.resize(size.cols, size.rows));
  socket.on("disconnect", () => ptyProcess.kill());
});

// --- File Manager (basic) ---
app.get("/files", (req, res) => {
  exec("ls -lh", (err, stdout) => {
    if (err) return res.send("Error: " + err.message);
    res.send(`<pre>${stdout}</pre>`);
  });
});

// Root page
app.get("/", (req, res) => {
  res.send(`
    <h1>🖥 VPS Controller</h1>
    <button onclick="location.href='/restart'">Restart</button>
    <button onclick="location.href='/info'">System Info</button>
    <button onclick="location.href='/files'">File Manager</button>
    <br><br>
    <h2>Terminal</h2>
    <div id="terminal" style="width:100%; height:400px; background:black; color:white;"></div>
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xterm/lib/xterm.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm/css/xterm.css" />
    <script>
      const socket = io();
      const term = new Terminal();
      term.open(document.getElementById("terminal"));
      term.onData(data => socket.emit("input", data));
      socket.on("output", data => term.write(data));
    </script>
  `);
});

// Start
server.listen(port, () => {
  console.log("VPS Controller UI running on port", port);
});
        
