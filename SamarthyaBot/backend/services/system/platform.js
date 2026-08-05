/**
 * Cross-Platform System Helper for SamarthyaBot
 * ------------------------------------------------------------------
 * Single source of truth for OS-specific behaviour so that every tool
 * (shell exec, file open, browser launch, port kill) works identically
 * on Windows, macOS and Linux.
 *
 * The OS is detected ONCE at load time and cached, so the rest of the
 * codebase never has to re-check `process.platform`.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const PLATFORM = process.platform; // 'win32' | 'darwin' | 'linux' | ...

const isWindows = PLATFORM === 'win32';
const isMac = PLATFORM === 'darwin';
const isLinux = !isWindows && !isMac;

const OS = isWindows ? 'windows' : isMac ? 'mac' : 'linux';

/**
 * Returns the shell + flag used to run a raw command string.
 * Mirrors what Node's `exec()` does internally, but lets us pass it to
 * `spawn()` for live streaming.
 */
function getShell() {
    if (isWindows) {
        return { shell: process.env.ComSpec || 'cmd.exe', flag: '/d /s /c', shellSpawn: true };
    }
    return { shell: process.env.SHELL || '/bin/sh', flag: '-c', shellSpawn: false };
}

/**
 * The native command used to open a URL, file or folder with the
 * system default handler.
 *   Windows -> start ""   macOS -> open   Linux -> xdg-open
 */
function openCommand() {
    if (isWindows) return 'start ""';
    if (isMac) return 'open';
    return 'xdg-open';
}

/**
 * Build a fully-quoted "open this target" command for the current OS.
 */
function buildOpenCommand(target) {
    const safe = String(target).replace(/"/g, '');
    if (isWindows) return `start "" "${safe}"`;
    if (isMac) return `open "${safe}"`;
    return `xdg-open "${safe}"`;
}

/**
 * Discover an installed Chromium-based browser executable for Puppeteer.
 * Checks the common install locations for each OS plus a few env hints.
 * Returns an absolute path or `null` if nothing is found.
 */
function findBrowser() {
    const candidates = [];

    // Explicit override always wins
    if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
    if (process.env.PUPPETEER_EXECUTABLE_PATH) candidates.push(process.env.PUPPETEER_EXECUTABLE_PATH);

    if (isWindows) {
        const prog = process.env['ProgramFiles'] || 'C:\\Program Files';
        const progx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const local = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');
        candidates.push(
            path.join(prog, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(progx86, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(prog, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(progx86, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(prog, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
            path.join(progx86, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
        );
    } else if (isMac) {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
        );
    } else {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge',
            '/usr/bin/brave-browser',
            '/snap/bin/chromium'
        );
    }

    for (const candidate of candidates) {
        try {
            if (candidate && fs.existsSync(candidate)) return candidate;
        } catch (_) { /* ignore */ }
    }
    return null;
}

/**
 * Command to find + kill whatever process is listening on a TCP port.
 * Returned string is safe to run through the platform shell.
 */
function killPortCommand(port) {
    if (isWindows) {
        // Find PID via netstat, kill via taskkill
        return `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /PID %a /F`;
    }
    // lsof first, fuser as fallback
    return `lsof -t -i:${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || true`;
}

/**
 * Command to test whether a port is currently being listened on.
 */
function checkPortListeningCommand(port) {
    if (isWindows) return `netstat -ano | findstr :${port} | findstr LISTENING`;
    return `lsof -i:${port} -t 2>/dev/null`;
}

/**
 * Human-readable one-liner describing the host, handy for LLM prompts.
 */
function describe() {
    return `${os.type()} ${os.release()} (${OS}/${os.arch()})`;
}

module.exports = {
    PLATFORM,
    OS,
    isWindows,
    isMac,
    isLinux,
    getShell,
    openCommand,
    buildOpenCommand,
    findBrowser,
    killPortCommand,
    checkPortListeningCommand,
    describe,
};
