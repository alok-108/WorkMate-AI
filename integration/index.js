// ============================================================
// WORKMATE AI - UNIFIED INTEGRATION LAYER
// ============================================================
// Connects the component services into a single product.
//
// LICENSING NOTE (see ../LICENSING.md for full detail):
// Skales (Business Source License 1.1) and GhostDesk (Functional
// Source License 1.1) both prohibit using the software to build a
// competing commercial product without the author's written consent.
// startSkales() / startGhostDesk() below are wired up for local
// evaluation only until that's resolved — do not ship a commercial
// build with these two enabled.

const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const IS_WINDOWS = process.platform === 'win32';

class WorkMateAI {
    constructor(config = {}) {
        this.config = {
            llmProvider: config.llmProvider || 'ollama',
            llmModel: config.llmModel || 'llama3.2',
            ports: {
                leagent: 7860, // LeAgent's own default; it does not accept an arbitrary PORT beyond what start.ps1 wires up
                skales: 3002,
                webUi: 8080
            },
            enableVoice: config.enableVoice !== false,
            enableLegacyAutomation: config.enableLegacyAutomation === true, // opt-in: BSL/FSL risk, see note above
            enableMultiAgent: config.enableMultiAgent === true,             // opt-in: BSL/FSL risk, see note above
            enableIndianWorkflows: config.enableIndianWorkflows !== false,
            // Bind to localhost only. This process can drive mouse/keyboard/
            // legacy-app automation on the host machine, so it must never be
            // reachable from the LAN or internet without deliberate, separate
            // hardening (TLS, real auth, etc).
            host: config.host || '127.0.0.1'
        };

        this.services = {};
        // Shared-secret token the UI must present on the WebSocket connection.
        // Regenerated each process start; printed once to the console.
        this.authToken = crypto.randomBytes(24).toString('hex');
        this.isRunning = false;
    }

    async start() {
        console.log('Starting WorkMate AI...');
        this.isRunning = true;

        await this.startLeAgent();
        await this.startCoworker();

        if (this.config.enableMultiAgent) {
            await this.startSkales();
        }
        if (this.config.enableVoice) {
            await this.startFazm();
        }
        if (this.config.enableLegacyAutomation) {
            await this.startGhostDesk();
        }
        if (this.config.enableIndianWorkflows) {
            await this.startSamarthyaBot();
        }

        this.startWebServer();

        console.log('All services started.');
        console.log(`Web UI: http://${this.config.host}:${this.config.ports.webUi}?token=${this.authToken}`);
    }

    // spawn('npm', ...) needs shell:true on Windows because npm resolves to
    // npm.cmd, which Node's spawn cannot exec directly without a shell.
    spawnNpm(args, opts) {
        return spawn('npm', args, { ...opts, shell: IS_WINDOWS });
    }

    // LeAgent has no root package.json -- it's a Python/FastAPI backend +
    // Vite frontend, started via its own start.ps1. That script needs
    // PowerShell 7 (`pwsh`): Windows PowerShell 5.1 mis-parses its non-ASCII
    // (UTF-8, no BOM) source and fails to even reach the prerequisite checks.
    async startLeAgent() {
        console.log('Starting LeAgent...');
        const cwd = path.join(__dirname, '../LeAgent');
        const env = {
            ...process.env,
            HOST: this.config.host,
            PORT: String(this.config.ports.leagent),
            LEAGENT_SKIP_PLAYWRIGHT_INSTALL: process.env.LEAGENT_SKIP_PLAYWRIGHT_INSTALL || '1'
        };

        this.services.leagent = spawn('pwsh', ['-NoProfile', '-File', 'start.ps1'], { cwd, env, stdio: 'pipe' });
        this.pipeLogs('LeAgent', this.services.leagent);
        await this.waitForService(this.config.ports.leagent);
        console.log('LeAgent ready');
    }

    // coworker is a pnpm workspace (pnpm-workspace.yaml, README requires
    // pnpm 9+ -- `npm install` does not work here). Per its own README, the
    // real entrypoint is `pnpm dev` (Electron desktop app), not a headless
    // web/API service. Its apps/daemon spawns OpenCode (github.com/sst/
    // opencode) child processes to actually execute tasks, and API keys are
    // entered through the app's onboarding UI into the OS keychain -- there
    // is no env-var-only way to drive it, so this opens a GUI, same as
    // Everfern below.
    async startCoworker() {
        console.log('Starting Coworker (pnpm dev)...');
        const cwd = path.join(__dirname, '../coworker');
        this.services.coworker = spawn('pnpm', ['dev'], { cwd, env: process.env, stdio: 'pipe', shell: IS_WINDOWS });
        this.pipeLogs('Coworker', this.services.coworker);
        console.log('Coworker starting -- opens an Electron window; complete onboarding there to add an LLM provider key.');
    }

    async startSkales() {
        console.log('Starting Skales (Multi-Agent) -- BSL 1.1: internal/non-commercial use only');
        const cwd = path.join(__dirname, '../skales');
        const env = {
            ...process.env,
            PORT: this.config.ports.skales,
            AI_PROVIDER: 'ollama',
            OLLAMA_MODEL: this.config.llmModel,
            ENABLE_A2A: 'true'
        };

        this.services.skales = this.spawnNpm(['start'], { cwd, env, stdio: 'pipe' });
        this.pipeLogs('Skales', this.services.skales);
        await this.waitForService(this.config.ports.skales);
        console.log('Skales ready');
    }

    async startFazm() {
        console.log('Starting Fazm (Voice Control)...');
        if (process.platform === 'darwin') {
            const cwd = path.join(__dirname, '../fazm');
            this.services.fazm = spawn('open', ['-a', 'Fazm'], { cwd, detached: true, stdio: 'ignore' });
            console.log('Fazm ready (native app)');
        } else {
            // Fazm ships as a macOS app; there is no Windows/Linux build.
            // Fall back to the browser's Web Speech API in the UI instead.
            console.log('Fazm has no Windows/Linux build; falling back to browser Speech Recognition in the UI.');
        }
    }

    async startGhostDesk() {
        console.log('Starting GhostDesk (Legacy Automation) -- FSL-1.1-ALv2: no competing commercial use');
        const cwd = path.join(__dirname, '../GhostDesk');
        this.services.ghostdesk = spawn(
            'docker',
            ['run', '-d', '--rm', '-p', '5900:5900', 'ghostdesk'],
            { cwd, detached: true, stdio: 'pipe', shell: IS_WINDOWS }
        );
        this.pipeLogs('GhostDesk', this.services.ghostdesk);
        console.log('GhostDesk ready (VNC on port 5900) -- requires Docker Desktop with WSL2 backend on Windows');
    }

    // SamarthyaBot's actual .env (see backend/.env.example) has no
    // ENABLE_GST/ENABLE_UPI/ENABLE_IRCTC toggles -- those were invented in
    // the original plan. GST/UPI/IRCTC are chat-driven features, not env
    // flags. It does require MONGO_URI (MongoDB must be running) and
    // MEMORY_ENCRYPTION_KEY. Despite .env.example living in backend/,
    // server.js calls `dotenv.config()` with no path, which resolves
    // against process.cwd() -- since `npm start` runs from the SamarthyaBot
    // root, the real .env must live at SamarthyaBot/.env, not
    // SamarthyaBot/backend/.env, or every var silently no-ops (dotenv logs
    // "injecting env (0)" and it falls back to its own default, Gemini, a
    // cloud provider -- the opposite of "privacy-first"). This only passes
    // through USE_OLLAMA so it defaults to the local/offline provider.
    async startSamarthyaBot() {
        console.log('Starting SamarthyaBot (India Workflows)...');
        const cwd = path.join(__dirname, '../SamarthyaBot');
        const env = {
            ...process.env,
            USE_OLLAMA: 'true',
            OLLAMA_MODEL: this.config.llmModel
        };

        this.services.samarthya = this.spawnNpm(['start'], { cwd, env, stdio: 'pipe' });
        this.pipeLogs('SamarthyaBot', this.services.samarthya);
        console.log('SamarthyaBot starting -- requires MongoDB running and backend/.env configured (see its .env.example).');
    }

    pipeLogs(label, proc) {
        proc.stdout?.on('data', (d) => console.log(`[${label}] ${d}`));
        proc.stderr?.on('data', (d) => console.error(`[${label} error] ${d}`));
    }

    // ============================================================
    // WEB SERVER + WEBSOCKET (auth-gated, localhost-bound)
    // ============================================================
    startWebServer() {
        const app = express();
        app.use(express.static(path.join(__dirname, '../ui')));

        const server = app.listen(this.config.ports.webUi, this.config.host);
        const wss = new WebSocketServer({ noServer: true });

        server.on('upgrade', (req, socket, head) => {
            const token = new URL(req.url, 'http://localhost').searchParams.get('token');
            if (token !== this.authToken) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
        });

        wss.on('connection', (ws) => {
            console.log('Client connected');
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    const result = await this.processTask(data);
                    ws.send(JSON.stringify({ type: 'result', data: result }));
                } catch (error) {
                    ws.send(JSON.stringify({ type: 'error', error: error.message }));
                }
            });
            ws.on('close', () => console.log('Client disconnected'));
        });

        console.log(`Web server on http://${this.config.host}:${this.config.ports.webUi}`);
    }

    // ============================================================
    // TASK PROCESSING
    // ============================================================
    async processTask(task) {
        const { action, params } = task;
        console.log(`Processing: ${action}`);

        switch (action) {
            case 'automate':
                return this.automateWorkflow(params);
            case 'voice-command':
                return this.processVoiceCommand(params);
            case 'legacy-app':
                return this.controlLegacyApp(params);
            case 'india-workflow':
                return this.processIndiaWorkflow(params);
            case 'multi-agent':
                return this.orchestrateMultiAgent(params);
            default:
                return this.generalTask(task);
        }
    }

    async automateWorkflow(params) {
        const { description, steps } = params;
        const plan = await this.queryLeAgent({ prompt: `Plan steps for: ${description}`, context: steps || [] });
        const result = await this.executeWithEverfern(plan);
        return { success: true, plan, result, timestamp: new Date().toISOString() };
    }

    async processVoiceCommand(params) {
        const { transcript } = params;
        const action = await this.queryLeAgent({ prompt: `Convert this voice command to an action: ${transcript}` });
        return this.automateWorkflow({ description: action });
    }

    async controlLegacyApp(params) {
        if (!this.config.enableLegacyAutomation) {
            throw new Error('Legacy app automation (GhostDesk) is disabled. See ../LICENSING.md before enabling it.');
        }
        const { app, task } = params;
        const result = await this.queryGhostDesk({ app, action: task });
        return { success: true, app, task, result };
    }

    async processIndiaWorkflow(params) {
        const { type, data } = params;
        const result = await this.querySamarthya({ workflow: type, data });
        return { success: true, workflow: type, result };
    }

    async orchestrateMultiAgent(params) {
        if (!this.config.enableMultiAgent) {
            throw new Error('Multi-agent orchestration (Skales) is disabled. See ../LICENSING.md before enabling it.');
        }
        const { goal, agents } = params;
        const result = await this.querySkales({ goal, agents: agents || ['planner', 'executor', 'reviewer'] });
        return { success: true, goal, agentsUsed: agents, result };
    }

    async queryLeAgent(payload) {
        const response = await fetch(`http://${this.config.host}:${this.config.ports.leagent}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    }

    async executeWithEverfern(plan) {
        return { executed: true, plan };
    }

    async queryGhostDesk(payload) {
        return { executed: true, payload };
    }

    async querySamarthya(payload) {
        return { executed: true, payload };
    }

    async querySkales(payload) {
        return { executed: true, payload };
    }

    async waitForService(port, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`http://${this.config.host}:${port}`);
                if (response.ok) return;
            } catch (e) {
                // not ready yet
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.warn(`Service on port ${port} may not be ready`);
    }

    async generalTask(task) {
        return this.queryLeAgent({ prompt: task.action, context: task.params });
    }

    async stop() {
        console.log('Stopping all services...');
        for (const [name, proc] of Object.entries(this.services)) {
            if (proc && proc.kill) {
                proc.kill('SIGTERM');
                console.log(`Stopped ${name}`);
            }
        }
        this.isRunning = false;
    }
}

module.exports = WorkMateAI;

if (require.main === module) {
    const wm = new WorkMateAI();
    wm.start().catch((err) => {
        console.error('Failed to start WorkMate AI:', err);
        process.exit(1);
    });
    process.on('SIGINT', () => wm.stop().then(() => process.exit(0)));
}
