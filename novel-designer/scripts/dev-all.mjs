// 一键启动：后端 (node:http + node:sqlite) + 前端 (vite dev)
// 零依赖，仅用 node 自带的 child_process。
// 用法：node scripts/dev-all.mjs
import { spawn } from 'node:child_process';
import process from 'node:process';
import fs from 'node:fs';

// 解析一个支持 --experimental-sqlite 的 node（优先 manager 22.22.2-2，退回 process.execPath）
function resolveNode() {
  const candidates = [
    'C:\\Users\\Administrator\\.workbuddy\\binaries\\node\\versions\\22.22.2-2\\node.exe',
    'C:\\Users\\Administrator\\.workbuddy\\binaries\\node\\versions\\22.22.2\\node.exe',
    '/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-2/node.exe',
    '/c/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  // 兜底：当前解释器
  return process.execPath;
}

const NODE = resolveNode();
// esno（tsx）运行器：后端 TS 直接跑，不需要任何打包或 --experimental flag
const ESNO_CLI = 'node_modules/esno/esno.js';
const procs = [];

function out(msg) {
  process.stdout.write(`${msg}\n`);
}

function start(name, cmd, args, color) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream, sink) => {
    stream.on('data', (b) => {
      const s = b.toString();
      for (const line of s.split('\n')) {
        if (line.trim()) sink.write(`${tag} ${line}\n`);
      }
    });
  };
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on('exit', (code) => {
    out(`${tag} 退出，code=${code}`);
    procs.forEach((q) => {
      try {
        q.kill();
      } catch {
        /* ignore */
      }
    });
    process.exit(code ?? 0);
  });
  procs.push(p);
}

start('server', NODE, [ESNO_CLI, 'server/index.ts'], '36');
start('web', 'npx', ['vite'], '35');

process.on('SIGINT', () => {
  procs.forEach((p) => {
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  });
  process.exit(0);
});
