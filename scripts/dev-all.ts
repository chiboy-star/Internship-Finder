import { spawn } from 'child_process';

console.log('🚀 Launching dev server and 6-hour pipeline watcher concurrently...');
console.log('Notice: These background tasks only run while your computer is on.\n');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const nextDev = spawn(npmCmd, ['run', 'dev'], { stdio: 'inherit' });
const watcher = spawn(npmCmd, ['run', 'pipeline:watch'], { stdio: 'inherit' });

function cleanup() {
  nextDev.kill();
  watcher.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

