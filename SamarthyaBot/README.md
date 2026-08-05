<!-- ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ HERO ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ -->

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:FF9933,50:FFFFFF,100:138808&height=200&section=header&text=SamarthyaBot&fontSize=70&fontColor=222222&animation=fadeIn&fontAlignY=38&desc=Privacy-First%20Local%20Agentic%20AI%20Operating%20System&descAlignY=60&descSize=18" width="100%" alt="SamarthyaBot"/>

<a href="https://github.com/mebishnusahu0595/SamarthyaBot">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=FF9933&center=true&vCenter=true&width=720&lines=Self-hosted+multi-agent+RPA+for+Windows%2C+macOS+%26+Linux;Writes+code+%E2%80%A2+Deploys+via+SSH+%E2%80%A2+Controls+browsers;34%2B+skills+%E2%80%A2+9+AI+providers+%E2%80%A2+100%25+offline+with+Ollama;Made+in+India+%F0%9F%87%AE%F0%9F%87%B3+for+the+world" alt="Typing SVG" />
</a>

<p>
  <strong>Multi-Agent · Autonomous · Privacy-First · Offline-Capable · Cross-Platform · Made in India 🇮🇳</strong>
</p>

<p>
  <a href="https://www.npmjs.com/package/samarthya-bot"><img src="https://img.shields.io/npm/v/samarthya-bot?color=FF9933&style=for-the-badge&logo=npm&logoColor=white&label=NPM" alt="NPM Version"></a>
  <a href="https://www.npmjs.com/package/samarthya-bot"><img src="https://img.shields.io/npm/dt/samarthya-bot?color=138808&style=for-the-badge&logo=npm&logoColor=white&label=Downloads" alt="NPM Downloads"></a>
  <a href="https://github.com/mebishnusahu0595/SamarthyaBot/stargazers"><img src="https://img.shields.io/github/stars/mebishnusahu0595/SamarthyaBot?style=for-the-badge&color=FFD600&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/mebishnusahu0595/SamarthyaBot/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-138808?style=for-the-badge" alt="MIT License"></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black" alt="Linux">
  <img src="https://img.shields.io/badge/Node.js-20_LTS-339933?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js 20 LTS">
  <img src="https://img.shields.io/badge/Go-Worker-00ADD8?style=flat&logo=go&logoColor=white" alt="Go Worker">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/MongoDB-Local-47A248?style=flat&logo=mongodb&logoColor=white" alt="MongoDB">
</p>

<p>
  <a href="#-quick-start-60-seconds">Quick Start</a> ·
  <a href="#️-cross-platform-by-design">Cross-Platform</a> ·
  <a href="#-skills-catalog-34-built-in-tools">Skills</a> ·
  <a href="#-chat-slash-commands">Commands</a> ·
  <a href="#-supported-ai-providers">AI Providers</a> ·
  <a href="#-frequently-asked-questions">FAQ</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

</div>

---

## 🤔 What is SamarthyaBot?

**SamarthyaBot** (समर्थ्य बोट) is a **privacy-first, self-hosted, multi-agent AI operating system** that runs entirely on **your** machine — Windows, macOS, or Linux. Unlike cloud assistants, it keeps your data local, encrypted, and under your control.

It is **not just a chatbot** — it's a full **RPA (Robotic Process Automation) agent** that can:

- ✍️ **Write code** and commit to GitHub
- 🚀 **Deploy to servers** via SSH (password or PEM key)
- 🌐 **Control real browsers** with Puppeteer (scrape, click, fill forms)
- 📧 **Send real emails** via SMTP
- 🇮🇳 **Handle Indian workflows** — GST, UPI, IRCTC, QR codes, Hindi/Hinglish
- 🧠 **Think autonomously** with a 20-step ReAct planning loop
- 💬 **Chat on Telegram, Discord & a Web Dashboard** — with `/slash` commands
- 🎙️ **Understand voice** via Groq/Whisper transcription
- 🔌 **Extend with plugins** — drop a `.js` file for a new skill

> **The most feature-rich, self-hosted AI agent that runs identically on all three OSes** — with 34 built-in skills, 9 AI providers, and a free fully-offline mode via Ollama.

---

## 🖥️ Cross-Platform by Design

SamarthyaBot **detects your OS at runtime** and adapts every shell command, file path, browser launch, and "open" action accordingly. No more "works on Linux, breaks on Windows."

| Capability | 🪟 Windows | 🍎 macOS | 🐧 Linux |
| :--- | :---: | :---: | :---: |
| **Shell execution** | `cmd.exe` | `/bin/sh` | `/bin/sh` |
| **Open URL/file/app** | `start` | `open` | `xdg-open` |
| **Live terminal streaming** | ✅ Go worker → **Node fallback** | ✅ Go worker → **Node fallback** | ✅ Go worker |
| **Browser discovery** | Chrome / Edge / Brave | Chrome / Chromium / Edge / Brave | Chrome / Chromium / Edge / Brave |
| **Clipboard** | `clip` | `pbcopy` | `xclip` / `xsel` / `wl-copy` |
| **Port management (CLI)** | `netstat` + `taskkill` | `lsof` | `lsof` / `fuser` |

> ⚙️ **How it works:** A single source of truth — `backend/services/system/platform.js` — resolves OS-specific behaviour. The LLM is also told the exact host OS in its system prompt, so it only emits commands valid for your platform.

> 🔁 **Zero-binary fallback:** The optional ultra-fast Go micro-worker streams long commands. If its binary isn't built for your platform, SamarthyaBot **transparently falls back to a native Node executor** — so heavy DevOps tasks work everywhere, out of the box.

---

## 🚀 Quick Start (60 Seconds)

> **Prerequisites:** [Node.js 20 LTS](https://nodejs.org/) · [MongoDB](https://www.mongodb.com/try/download/community) (local)
> Free API keys: [Gemini](https://aistudio.google.com/api-keys) · [Ollama](https://ollama.com) (offline)

### 📦 Install from NPM (recommended)

```bash
# 1. Install globally (works on Windows, macOS, Linux)
npm install -g samarthya-bot

# 2. Interactive setup wizard — picks provider, keys, channels
samarthya onboard

# 3. Launch engine + dashboard
samarthya gateway

# 4. (Optional) Expose to internet & link Telegram
samarthya tunnel
```

🎉 Open **http://localhost:5000** for the dashboard.

### 🛠️ From source (development)

```bash
git clone https://github.com/mebishnusahu0595/SamarthyaBot.git
cd SamarthyaBot
npm install
samarthya onboard
npm run start
```

---

## ✨ Core Features

| Feature | Description | Status |
| :--- | :--- | :---: |
| 🖥️ **True Cross-Platform** | OS auto-detected; commands adapt to Windows/macOS/Linux | ✅ Live |
| 🤖 **Full RPA Engine** | Writes code, commits to GitHub, deploys to VPS | ✅ Live |
| ⚡ **Live Terminal** | Go micro-worker streaming + automatic Node fallback | ✅ Live |
| 🌍 **SSH Deployments** | Remote deploy via password or PEM key from a chat prompt | ✅ Live |
| 🕸️ **Browser Controller** | Puppeteer real DOM — scrape, click, navigate, fill forms | ✅ Live |
| 🛡️ **Hardened Sandbox** | Workspace path enforcement + chained-command blacklist | ✅ Live |
| 🧠 **Autonomous Planner** | 20-step ReAct loop with failure recovery & retries | ✅ Live |
| 💬 **Slash Commands** | `/status`, `/tools`, `/pack`, `/model` on every channel | ✅ Live |
| 🔐 **Encrypted Memory** | AES-256-CBC encrypted local memory in MongoDB | ✅ Live |
| 🇮🇳 **Indian Localization** | GST, UPI, QR codes, IRCTC, Hindi/Hinglish | ✅ Live |
| 🛠️ **34 Built-in Skills** | Files, web, crypto, translate, QR, currency & more | ✅ Live |
| 📱 **Telegram + Discord** | Two-way bots with webhooks, mentions & voice | ✅ Live |
| 🌐 **React Dashboard** | Dark glassmorphism UI with realtime updates | ✅ Live |
| 🔌 **Plugin System** | Drop a `.js` file → new AI skill, zero restart | ✅ Live |
| 🎙️ **Voice (Whisper)** | Groq/Whisper transcription for voice notes | ✅ Live |
| 💓 **Heartbeat Tasks** | Periodic autonomous tasks from `HEARTBEAT.md` | ✅ Live |

---

## 🧰 Skills Catalog (34 Built-in Tools)

<table>
<tr><th>📁 Files & System</th><th>🌐 Web & Network</th></tr>
<tr><td valign="top">

- `file_read` · `file_write` · `file_list`
- `run_command` *(OS-aware)*
- `devops_execute_stream` *(live)*
- `ssh_deploy`
- `open_path` *(start/open/xdg-open)*
- `clipboard_copy` *(cross-platform)*
- `capture_desktop_screenshot`
- `system_info`
- `schedule_background_task`

</td><td valign="top">

- `web_search` *(DuckDuckGo)*
- `weather_info` *(live)*
- `http_request` *(any REST API)*
- `url_shorten`
- `ip_geolocate`
- `crypto_price`
- `currency_convert`
- `browser_action` *(Puppeteer)*
- `send_email` *(SMTP)*

</td></tr>
<tr><th>🇮🇳 India & Productivity</th><th>🔐 Utilities & Security</th></tr>
<tr><td valign="top">

- `upi_generate` *(UPI deep link)*
- `qr_generate` *(QR for UPI/links)*
- `gst_reminder`
- `translate_text` *(Hindi & more)*
- `calculate` · `summarize_text`
- `note_take` · `reminder_set`
- `calendar_schedule`

</td><td valign="top">

- `password_generate` *(crypto-secure)*
- `hash_text` *(md5/sha1/256/512)*
- `base64_tool` *(encode/decode)*
- `timezone_now` *(world clock)*
- `simulate_task` *(dry-run)*
- 🔌 *+ unlimited custom plugins*

</td></tr>
</table>

---

## 💬 Chat Slash-Commands

Control the agent directly from **any channel** (Web, Telegram, Discord) — instant, no LLM call:

| Command | Action |
| :--- | :--- |
| `/help` | List all commands |
| `/status` | Provider, model, active pack & host OS |
| `/tools` `/skills` | List skills in your current pack |
| `/pack [name]` | Show or switch pack (student/business/developer/personal) |
| `/model` | Show active AI provider + model |
| `/memory` | Count of stored memories |
| `/whoami` | Your profile & permissions |
| `/new` `/clear` `/reset` | Start a fresh conversation |
| `/version` | SamarthyaBot version |

---

## 🧠 Supported AI Providers

| Provider | Models | Cost | Best For |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | gemini-2.5-flash / pro | 🟢 Free tier | Default, great balance |
| **Ollama** | Llama 3, Mistral, Dolphin | 🟢 Free (local) | 100% offline, zero data leakage |
| **Groq** | Llama 3.3 70B, Qwen3 32B | 🟢 Free tier | Fastest inference |
| **Anthropic** | Claude 3.5 Sonnet / Opus | 🟡 Paid | Smartest reasoning |
| **OpenAI** | GPT-5.2, GPT-5-mini, o3-mini | 🟡 Paid | Coding & agentic tasks |
| **DeepSeek** | DeepSeek Chat / Coder | 🟢 Budget | Affordable coding |
| **Qwen** | Qwen Max / Turbo | 🟢 Budget | Alibaba's best |
| **OpenRouter** | 100+ models | 🟡 Varies | Access any model |
| **Mistral** | Mistral Large 3, Devstral 2 | 🟡 Paid | EU privacy, code agents |

---

## 💬 Chat Channels & Integrations

| Channel | Setup | Status |
| :--- | :--- | :---: |
| **📱 Telegram** | Bot token + `samarthya tunnel` | ✅ Live |
| **🟣 Discord** | Bot token + intents + invite URL | ✅ Live |
| **🌐 Web Dashboard** | Built-in at `http://localhost:5000` | ✅ Live |
| **📱 WhatsApp** | Business API integration | 🔜 Coming |
| **💼 Slack** | Webhook + App | 📋 Planned |

<details>
<summary><b>📱 Telegram Setup</b></summary>

1. Open Telegram → `@BotFather` → `/newbot` → copy token
2. Add to `.env`: `TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN`
3. Run `samarthya gateway` then `samarthya tunnel` (new terminal). The tunnel auto-sets the webhook. 🚀

</details>

<details>
<summary><b>🟣 Discord Setup</b></summary>

1. https://discord.com/developers/applications → Application → Bot → copy token
2. Enable **MESSAGE CONTENT INTENT**
3. Add to `.env`:
   ```bash
   DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
   DISCORD_ALLOW_FROM=YOUR_USER_ID
   ```
4. OAuth2 → URL Generator → scope `bot` → invite → `samarthya gateway`

</details>

---

## 🔒 Security & Privacy

SamarthyaBot is **defense-in-depth** by default:

| Layer | What it does |
| :--- | :--- |
| 🏠 **Local control plane** | Runs entirely on your machine — zero cloud dependency |
| 🔐 **AES-256-CBC** | All memories & secrets encrypted at rest |
| 🛡️ **Workspace sandbox** | File reads/writes confined to the workspace (`RESTRICT_TO_WORKSPACE`) — **enforced in every file tool** |
| 🚫 **Command blacklist** | Blocks `rm -rf`, `mkfs`, `dd`, fork bombs, `format`, `del /f`, remote-shell downloads — **per-segment**, so `echo x && rm -rf /` is also blocked |
| 🌐 **SSRF guard** | `http_request` rejects non-`http(s)` schemes; `file://` is blocked |
| 🔑 **Secret-safe** | Generated passwords are never logged or stored |
| 🔌 **Offline mode** | Ollama = 100% offline, zero data leakage |
| 🚨 **Kill switch** | `samarthya stop` — instant shutdown |

> 🧪 Hardened in v2.3.0: the workspace sandbox is now wired into `file_read` / `file_write` / `file_list`, and the command guard validates **every** segment of chained commands. See [SECURITY.md](SECURITY.md) to report issues.

---

## 🏗️ Architecture

```
   Telegram / Discord / WebUI / CLI
                 │
                 ▼
  ┌────────────────────────────────────────────┐
  │          SamarthyaBot Gateway              │
  │           (Control Plane :5000)            │
  ├────────────────────────────────────────────┤
  │  ┌────────────┐ ┌──────────┐ ┌──────────┐  │
  │  │ Slash-Cmds │ │ Planner  │ │ LLM Hub  │  │
  │  │ (instant)  │ │ (ReAct)  │ │ (9 prov) │  │
  │  └────────────┘ └────┬─────┘ └────┬─────┘  │
  │                      │            │         │
  │  ┌───────────────────┴────────────┴──────┐ │
  │  │  Tools Engine (34 skills + plugins)   │ │
  │  └───────────────────┬───────────────────┘ │
  │                      │                      │
  │  ┌───────────┐ ┌─────┴──────┐ ┌──────────┐ │
  │  │ platform  │ │ Go Worker  │ │ Sandbox /│ │
  │  │  helper   │ │  + Node    │ │ Security │ │
  │  │ (OS-aware)│ │  fallback  │ │  guard   │ │
  │  └───────────┘ └────────────┘ └──────────┘ │
  │  ┌───────────┐ ┌────────────┐ ┌──────────┐ │
  │  │ Memory    │ │ Browser    │ │ Heartbeat│ │
  │  │ (AES-256) │ │(Puppeteer) │ │  / Cron  │ │
  │  └───────────┘ └────────────┘ └──────────┘ │
  └────────────────────────────────────────────┘
                 │
                 ▼
        MongoDB (Local, Encrypted)
```

---

## 🔌 Developing Plugins

Give your AI new superpowers — drop a `.js` file in `~/SamarthyaBot_Files/plugins/`:

```javascript
// weather.js
module.exports = {
  name: 'get_weather',
  description: 'Gets current weather for a city',
  parameters: { city: { type: 'string', required: true } },
  execute: async (args) => {
    const res = await fetch(`https://wttr.in/${args.city}?format=j1`);
    const data = await res.json();
    return {
      success: true,
      result: `${args.city}: ${data.current_condition[0].temp_C}°C`
    };
  }
};
```

Restart the gateway — the agent can now check weather autonomously! 🌦️

---

## 🛠️ CLI Commands

| Command | Action |
| :--- | :--- |
| `samarthya onboard` | Interactive setup wizard |
| `samarthya gateway` | Start backend engine + dashboard |
| `samarthya tunnel` | Expose to internet & link Telegram |
| `samarthya model` | Swap LLM provider/model |
| `samarthya telegram` / `discord` | Configure a channel |
| `samarthya config` | View current configuration |
| `samarthya status` | Show engine status |
| `samarthya stop` / `restart` | Stop / restart the gateway |

---

## 🏆 Comparison

|                        | OpenClaw       | PicoClaw          | **SamarthyaBot** 🇮🇳        |
| ---------------------- | -------------- | ----------------- | --------------------------- |
| **Cross-Platform**     | ✅             | ✅                | **✅ OS auto-adapts**       |
| **Browser Control**    | ❌ / search    | ❌ search only    | **✅ Real Puppeteer DOM**   |
| **Web Dashboard**      | ✅             | ❌ CLI only       | **✅ React glassmorphism**  |
| **Live Terminal**      | ❌             | ❌ async spawn    | **✅ Go + Node fallback**   |
| **Slash Commands**     | ✅             | partial           | **✅ Every channel**        |
| **Indian Workflows**   | ❌             | ❌                | **✅ GST/UPI/QR/IRCTC**     |
| **Encrypted Memory**   | ❌ plaintext   | ❌ markdown       | **✅ AES-256-CBC + Mongo**  |
| **Built-in Skills**    | 100+ external  | skills folder     | **34 built-in + plugins**   |
| **SSH Deploy**         | ❌             | ❌                | **✅ Password + PEM**       |
| **Install**            | moderate       | single binary     | **`npm i -g samarthya-bot`**|
| **AI Providers**       | many           | 3-4               | **9 providers, 20+ models** |

---

## 📊 Real-World Use Cases

- **🧑‍💻 Developers:** *"Create an Express REST API, push to GitHub, deploy to my VPS."*
- **📊 Business:** *"Calculate 18% GST on ₹50,000, make a UPI QR, email the invoice."*
- **🎓 Students:** *"Summarize the top 5 transformer papers and save notes."*
- **🏢 DevOps:** *"SSH into my server, check disk space, restart nginx if down."*
- **🇮🇳 Professionals:** *"Generate a UPI link for ₹2,500, translate this to Hindi."*

---

## 🗺️ Roadmap

- [x] **True cross-platform** (Windows / macOS / Linux auto-detect)
- [x] **Go micro-worker + Node fallback**
- [x] **34 built-in skills** (QR, currency, crypto, translate, hash…)
- [x] **Slash-commands** on every channel
- [x] **Hardened sandbox + command guard**
- [x] Full RPA · SSH deploy · Puppeteer browser
- [x] Telegram + Discord + Voice (Whisper)
- [ ] WhatsApp Business API
- [ ] Slack integration
- [ ] Docker Compose deployment
- [ ] RAG over local documents
- [ ] Multi-user role-based access

---

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

```bash
git clone https://github.com/mebishnusahu0595/SamarthyaBot.git
cd SamarthyaBot && npm install
```

<a href="https://github.com/mebishnusahu0595/SamarthyaBot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mebishnusahu0595/SamarthyaBot" alt="Contributors"/>
</a>

### ⭐ Star History

<a href="https://star-history.com/#mebishnusahu0595/SamarthyaBot&Date">
  <img src="https://api.star-history.com/svg?repos=mebishnusahu0595/SamarthyaBot&type=Date" width="600" alt="Star History Chart">
</a>

---

## ❓ Frequently Asked Questions

<details>
<summary><b>Does it really work on Windows, macOS and Linux?</b></summary>

Yes. SamarthyaBot detects your OS at runtime and adapts every shell command, file path, browser launch and "open" action. The LLM is told your exact OS so it only emits valid commands, and the live-terminal worker falls back to native Node if the Go binary isn't built for your platform.
</details>

<details>
<summary><b>Is SamarthyaBot free?</b></summary>

Yes — 100% free and open-source under MIT. It supports free providers like Gemini and Ollama (fully offline).
</details>

<details>
<summary><b>Does it work offline?</b></summary>

Yes. With **Ollama**, SamarthyaBot runs 100% offline with zero data leakage.
</details>

<details>
<summary><b>Is my data safe?</b></summary>

Everything runs on your machine. Memories are AES-256-CBC encrypted, file tools are sandboxed to your workspace, and dangerous commands are blocked per-segment.
</details>

<details>
<summary><b>How do I add a new skill?</b></summary>

Drop a `.js` file in `~/SamarthyaBot_Files/plugins/` with `name`, `description`, `parameters`, and an `execute` function. See [Developing Plugins](#-developing-plugins).
</details>

---

## 📄 License

**MIT License** — free to use, modify, and distribute.

Built with ❤️ in India 🇮🇳 by **[Bishnu Prasad Sahu](https://github.com/mebishnusahu0595)**

<div align="center">

**[📦 NPM](https://www.npmjs.com/package/samarthya-bot)** · **[🐙 GitHub](https://github.com/mebishnusahu0595/SamarthyaBot)** · **[🐛 Report Bug](https://github.com/mebishnusahu0595/SamarthyaBot/issues)** · **[✨ Request Feature](https://github.com/mebishnusahu0595/SamarthyaBot/issues)**

<sub>If SamarthyaBot helps you, please give it a ⭐ — it really helps!</sub>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:138808,50:FFFFFF,100:FF9933&height=100&section=footer" width="100%" alt=""/>

</div>
