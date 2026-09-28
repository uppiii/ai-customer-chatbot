import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const url = 'http://127.0.0.1:3000/';
const serverArgs = ['-m', 'http.server', '3000', '--bind', '127.0.0.1'];

async function isServerReady() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(700) });
    return response.ok;
  } catch {
    return false;
  }
}

async function openBrowser() {
  if (process.platform === 'win32') {
    const browserPaths = [
      {
        name: 'Microsoft Edge',
        candidates: [
          join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        ]
      },
      {
        name: 'Google Chrome',
        candidates: [
          join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
        ]
      }
    ];

    for (const browser of browserPaths) {
      const executable = browser.candidates.find((candidate) => existsSync(candidate));
      if (!executable) continue;

      const child = spawn(executable, [url], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log(`Opening the app in ${browser.name}: ${url}`);
      return;
    }

    console.log('Chrome or Edge was not found in its standard install folder; opening the Windows default browser.');
    await execFileAsync('cmd.exe', ['/c', 'start', '', url]);
    return;
  }

  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  await execFileAsync(command, [url]);
}

async function start() {
  if (await isServerReady()) {
    console.log(`App server is already running. Opening ${url}`);
    await openBrowser();
    return;
  }

  const server = spawn('python', serverArgs, { stdio: 'inherit' });
  let stopping = false;

  server.on('error', (error) => {
    console.error(`Could not start the local server: ${error.message}`);
    process.exitCode = 1;
  });

  server.on('exit', (code) => {
    if (!stopping && code !== 0 && code !== null) {
      console.error(`Local server stopped with exit code ${code}.`);
    }
    process.exitCode = code ?? 0;
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerReady()) {
      console.log(`App is running at ${url}`);
      try {
        await openBrowser();
      } catch (error) {
        console.error(`Could not open a browser automatically: ${error.message}`);
        console.log(`Open this URL manually: ${url}`);
      }
      break;
    }
    if (server.exitCode !== null) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!(await isServerReady())) {
    console.error('The server did not become ready. Check whether port 3000 is already in use.');
    server.kill();
    process.exitCode = 1;
    return;
  }

  const stopServer = () => {
    stopping = true;
    server.kill();
  };
  process.once('SIGINT', stopServer);
  process.once('SIGTERM', stopServer);
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
