const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const platform = require('../system/platform');

/**
 * WorkerClient
 * ------------------------------------------------------------------
 * Streams long-running shell commands back to Node.
 *
 * Fast path : the pre-built Go micro-worker (`worker/samarthya-worker`).
 * Fallback  : a pure-Node executor using the platform shell.
 *
 * The Go binary is only shipped for one architecture, so on Windows /
 * macOS / unsupported CPUs we transparently fall back to Node. This is
 * what makes `devops_execute_stream` work on every OS.
 */
class WorkerClient {
    constructor() {
        this.workerProcess = null;
        this.pendingRequests = new Map();
        this.useNativeFallback = false; // flipped on when the Go binary can't run
        this.startAttempts = 0;

        const projectRoot = path.resolve(__dirname, '../../../');
        const binName = 'samarthya-worker' + (platform.isWindows ? '.exe' : '');
        this.workerPath = path.join(projectRoot, 'worker', binName);
    }

    /** Whether the Go binary exists for THIS platform. */
    _binaryAvailable() {
        try {
            return fs.existsSync(this.workerPath);
        } catch {
            return false;
        }
    }

    start() {
        if (this.workerProcess || this.useNativeFallback) return;

        if (!this._binaryAvailable()) {
            console.log('[Worker] Go micro-worker binary not found for this platform — using native Node executor.');
            this.useNativeFallback = true;
            return;
        }

        // Avoid infinite respawn loops if the binary exists but cannot run
        // (e.g. wrong CPU architecture). After 3 failed starts, fall back.
        if (this.startAttempts >= 3) {
            console.log('[Worker] Go worker failed repeatedly — switching to native Node executor.');
            this.useNativeFallback = true;
            return;
        }
        this.startAttempts++;

        console.log(`[Worker] Starting Go Micro-Worker from: ${this.workerPath}`);

        try {
            this.workerProcess = spawn(this.workerPath, [], {
                stdio: ['pipe', 'pipe', 'inherit'],
            });
        } catch (err) {
            console.error('[Worker] Could not spawn Go worker:', err.message);
            this.useNativeFallback = true;
            return;
        }

        this.workerProcess.on('error', (err) => {
            console.error('[Worker] Failed to start Go worker:', err.message);
            // Binary is present but not runnable on this host → go native.
            this.useNativeFallback = true;
            this.workerProcess = null;
        });

        this.workerProcess.on('exit', (code) => {
            this.workerProcess = null;
            if (this.useNativeFallback) return;
            if (this.startAttempts >= 3) {
                this.useNativeFallback = true;
                console.log('[Worker] Go worker keeps exiting — switching to native Node executor.');
                return;
            }
            console.log(`[Worker] Go worker exited with code ${code}. Restarting in 5s...`);
            setTimeout(() => this.start(), 5000);
        });

        // Reset attempt counter once we have stayed up for a while.
        setTimeout(() => { if (this.workerProcess) this.startAttempts = 0; }, 10000);

        // Listen to JSON stream line by line
        let buffer = '';
        this.workerProcess.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newlineIdx).trim();
                buffer = buffer.slice(newlineIdx + 1);

                if (line) {
                    try {
                        const parsed = JSON.parse(line);
                        this._handleResponse(parsed);
                    } catch (e) {
                        console.error('[Worker] JSON Parse Error from Go line:', line);
                    }
                }
            }
        });
    }

    _handleResponse(res) {
        if (!res.id || !this.pendingRequests.has(res.id)) {
            if (res.type === 'error') {
                console.error(`[Worker Msg] ${res.data}`);
            }
            return;
        }

        const handlers = this.pendingRequests.get(res.id);

        if (res.type === 'stdout' || res.type === 'stderr') {
            if (handlers.onStream) {
                handlers.onStream(res.data, res.type);
            } else {
                if (!handlers.buffer) handlers.buffer = '';
                handlers.buffer += res.data + '\n';
            }
        }
        else if (res.type === 'end') {
            const finalData = handlers.buffer || res.data;
            handlers.resolve({
                success: res.exitCode === 0,
                exitCode: res.exitCode,
                output: finalData,
                elapsed: res.elapsedTimeMs,
            });
            this.pendingRequests.delete(res.id);
        }
        else if (res.type === 'error') {
            handlers.resolve({
                success: false,
                exitCode: -1,
                output: res.data,
                elapsed: 0,
            });
            this.pendingRequests.delete(res.id);
        }
    }

    /**
     * Native pure-Node fallback executor. Runs the command through the
     * platform shell and streams stdout/stderr back via the callback,
     * resolving with the same shape the Go worker produces.
     */
    _executeNative(command, dir = '', streamCallback = null) {
        return new Promise((resolve) => {
            const { shell, flag } = platform.getShell();
            const flagArgs = flag.split(' ');
            const startTime = Date.now();
            let output = '';

            let child;
            try {
                child = spawn(shell, [...flagArgs, command], {
                    cwd: dir && fs.existsSync(dir) ? dir : process.cwd(),
                    env: process.env,
                    windowsHide: true,
                });
            } catch (err) {
                return resolve({ success: false, exitCode: -1, output: `Spawn error: ${err.message}`, elapsed: 0 });
            }

            // Hard timeout so a hung command can't wedge the agent forever.
            const timeout = setTimeout(() => {
                try { child.kill('SIGKILL'); } catch (_) { }
                output += '\n[timed out after 5 minutes]';
            }, 5 * 60 * 1000);

            const onData = (data, type) => {
                const text = data.toString();
                output += text;
                if (output.length > 1024 * 1024) output = output.slice(-1024 * 1024); // cap 1MB
                if (streamCallback) streamCallback(text, type);
            };

            child.stdout.on('data', (d) => onData(d, 'stdout'));
            child.stderr.on('data', (d) => onData(d, 'stderr'));

            child.on('error', (err) => {
                clearTimeout(timeout);
                resolve({ success: false, exitCode: -1, output: `${output}\n${err.message}`, elapsed: Date.now() - startTime });
            });

            child.on('close', (code) => {
                clearTimeout(timeout);
                resolve({
                    success: code === 0,
                    exitCode: code === null ? -1 : code,
                    output: output || '(no output)',
                    elapsed: Date.now() - startTime,
                });
            });
        });
    }

    executeCommand(command, dir = '', streamCallback = null) {
        // Decide on transport.
        if (!this.workerProcess && !this.useNativeFallback) {
            this.start();
        }
        if (this.useNativeFallback || !this.workerProcess) {
            return this._executeNative(command, dir, streamCallback);
        }

        return new Promise((resolve) => {
            const reqId = uuidv4();

            this.pendingRequests.set(reqId, {
                resolve,
                onStream: streamCallback,
                buffer: '',
            });

            const req = {
                id: reqId,
                command,
                dir,
                stream: true,
                timeoutMs: 0,
            };

            try {
                this.workerProcess.stdin.write(JSON.stringify(req) + '\n');
            } catch (err) {
                // Pipe broke mid-flight → fall back to native for this call.
                this.pendingRequests.delete(reqId);
                this.useNativeFallback = true;
                this._executeNative(command, dir, streamCallback).then(resolve);
            }
        });
    }

    stop() {
        if (this.workerProcess) {
            this.workerProcess.kill();
            this.workerProcess = null;
        }
    }
}

const workerClient = new WorkerClient();
module.exports = workerClient;
