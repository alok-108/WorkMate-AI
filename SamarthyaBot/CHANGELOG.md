# 📋 Changelog

All notable changes to SamarthyaBot are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [2.3.0] - 2026-06-01

### Added — Cross-Platform
- **Runtime OS detection** — new `backend/services/system/platform.js` is the single source of truth for OS-specific shell, open command, browser discovery, clipboard and port management across Windows / macOS / Linux
- **Native Node fallback for the Go worker** — `devops_execute_stream` now works on every OS even when the Go binary isn't built for the host (auto-falls back, no more restart loops)
- **Host OS in the system prompt** — the LLM is told the exact OS so it only emits valid commands

### Added — New Skills (10)
- `open_path` (cross-platform start/open/xdg-open), `http_request` (any REST API), `password_generate` (crypto-secure), `qr_generate`, `currency_convert`, `crypto_price`, `url_shorten`, `ip_geolocate`, `translate_text` (Hindi & more), `clipboard_copy`, `hash_text`, `base64_tool`, `timezone_now` — **34 built-in skills total**

### Added — Chat Slash-Commands
- `/help`, `/status`, `/tools`, `/pack`, `/model`, `/whoami`, `/memory`, `/new`, `/version` — work on Web, Telegram & Discord, instantly, with no LLM call

### Security
- **Workspace sandbox now enforced** in `file_read` / `file_write` / `file_list` (was previously bypassed)
- **Chained-command blacklist** — every segment of `&&`, `||`, `;`, `|`, `$()` and backticks is validated, closing the `echo x && rm -rf /` bypass; added Windows-destructive patterns and `sudo` prefix coverage
- `http_request` blocks non-`http(s)` schemes (e.g. `file://`)

### Fixed
- CLI: removed Unix-only `2>/dev/null` from the onboard install step (broke Windows `cmd`); use `--omit=dev`
- CLI: spawn the server via `process.execPath` and run `npm` through the platform-correct shim
- Browser automation: broader Chrome/Edge/Brave/Chromium discovery + `--no-sandbox` on Linux

---

## [2.2.0] - 2026-03-05

### Added
- **Extreme SEO & GEO Optimization** — 85+ NPM keywords, structured data, Open Graph tags
- **GitHub Community Files** — CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- **Issue & PR Templates** — Structured bug reports, feature requests
- **Frontend SEO** — JSON-LD structured data, Open Graph meta, robots.txt, sitemap.xml
- **GEO-Optimized README** — FAQ section, authority statements, use-case examples
- `samarthyabot` CLI alias — both `samarthya` and `samarthyabot` now work

### Changed
- Expanded package description for NPM search discoverability
- Updated `package.json` with homepage, bugs, funding URLs

---

## [2.1.0] - 2026-03-04

### Added
- **Premium CLI Experience** — Large ASCII banner with Indian flag colors (saffron, white, green)
- **Interactive Setup Wizard** (`samarthya onboard`) — Step-by-step guided API key and channel configuration
- **Loading Spinners & Progress Bars** — Animated terminal output during setup and boot
- **New CLI Commands** — `samarthya telegram`, `samarthya discord`, `samarthya config`, `samarthya model`
- **Auto-Tunnel** — Automatic LocalTunnel + Telegram webhook setup from `samarthya onboard`
- **Model Selector** — Interactive multi-provider model switching with 9 providers and 20+ models
- **Boot Sequence Animation** — Professional startup with step-by-step status indicators

---

## [2.0.0] - 2026-03-03

### Added
- **Multi-Provider LLM Hub** — Gemini, Claude, DeepSeek, Qwen, OpenRouter, Ollama support
- **Discord Bot Integration** — Full two-way Discord chat with mention-only mode
- **Workspace Security Sandbox** — File/exec restricted to configurable workspace folder
- **Heartbeat Periodic Tasks** — Autonomous task execution from `HEARTBEAT.md` every N minutes
- **Groq/Whisper Voice Transcription** — Voice notes → text in Telegram
- **Sub-Agent Spawn Service** — Non-blocking background agents for long-running tasks
- **Go Micro-Worker** — Live terminal streaming via WebSocket for `npm build`, `git push`, etc.
- **Plugin System** — Drop a `.js` file, get a new AI tool — zero restart
- **Puppeteer Browser Controller** — Real DOM interaction, scraping, clicking, navigating
- **SSH Deployment** — Deploy to remote VPS via password or PEM key from chat
- **Screen Vision** — Gemini Vision analyzes screenshots for UI understanding

### Changed
- Complete React dashboard redesign with dark theme and glassmorphism
- ReAct autonomous planner with multi-step reasoning

---

## [1.1.4] - 2026-02-28

### Added
- God-Mode features on landing page (Browser DOM, Go Worker, SSH previews)

### Changed
- Moved God Mode UI into frontend Capabilities module

---

## [1.0.0] - 2026-02-25

### Added
- Initial release
- Gemini AI integration
- Telegram bot with webhook
- Basic file management
- Email sending via Nodemailer
- MongoDB encrypted memory
- AES-256-CBC encryption for memories
- Express REST API + Socket.IO realtime
- React web dashboard

---

[2.2.0]: https://github.com/mebishnusahu0595/SamarthyaBot/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/mebishnusahu0595/SamarthyaBot/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/mebishnusahu0595/SamarthyaBot/compare/v1.1.4...v2.0.0
[1.1.4]: https://github.com/mebishnusahu0595/SamarthyaBot/compare/v1.0.0...v1.1.4
[1.0.0]: https://github.com/mebishnusahu0595/SamarthyaBot/releases/tag/v1.0.0
