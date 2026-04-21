const net = require("net");
const { exec } = require("child_process");

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port, host: "127.0.0.1" })
      .once("connect", () => {
        socket.end();
        resolve(true);
      })
      .once("error", () => {
        resolve(false);
      });
  });
}

function getPidsOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano -p tcp | findstr :${port}`, (err, stdout) => {
      if (err || !stdout) return resolve([]);

      const pids = new Set();
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      resolve(Array.from(pids));
    });
  });
}

function tryKillPid(pid) {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /F /T`, () => resolve());
  });
}

async function freePortIfNeeded(port) {
  const open = await isPortOpen(port);
  if (!open) return true;

  const pids = await getPidsOnPort(port);
  if (pids.length === 0) return false;

  for (const pid of pids) {
    await tryKillPid(pid);
  }

  await new Promise((r) => setTimeout(r, 500));
  return !(await isPortOpen(port));
}

module.exports = { freePortIfNeeded };
