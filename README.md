# WorkMate AI

**A free, open-source, privacy-first AI agent platform — built for how India's back office actually works.**

## The idea

Every serious AI "computer use" agent on the market today — Manus Desktop, Claude Cowork, and similar desktop assistants — shares the same shape: a single cloud-hosted agent, priced as a monthly subscription, built around a generic Western software stack (Gmail, Slack, Stripe). That's a fine product for a US knowledge worker. It is close to useless for the actual back office of an Indian BPO, IT services shop, or e-commerce operator, whose daily work runs through Tally, the GST portal, UPI, and IRCTC — and whose customer and financial data often *cannot* leave the premises for compliance or trust reasons, let alone be piped through a third-party cloud API.

WorkMate AI's bet is narrow and specific: instead of building one more agent from scratch, assemble the best permissively-licensed open-source agent projects that already exist — screen/computer control, desktop orchestration, multi-agent planning — behind one coherent local interface, running against a local LLM (Ollama) on the user's own machine. The result:

- **Free forever, not "free trial."** The covered stack is MIT/Apache-2.0. There is no subscription to hit a paywall on.
- **Nothing leaves the device.** No cloud round-trip is required to read a bank statement, file a GST return, or process customer PII — the model, the data, and the automation all run locally.
- **India's actual software stack is a first-class citizen**, not an integration nobody built. GST, UPI, and IRCTC workflows are wired in via SamarthyaBot rather than left as "roadmap."

That's the whole thesis: **the pieces to build this already exist and are already free — the missing part was someone actually wiring them together for this market.** This repo is that wiring.

## What's actually in here

WorkMate AI is an **orchestration layer**, not a fifth agent reinventing what the other four already do well:

| Component | License | What it contributes |
|---|---|---|
| [LeAgent](https://github.com/vixues/LeAgent) | Apache-2.0 | Planning/self-correction engine, offline tool library, FastAPI backend |
| [Everfern](https://github.com/Everfern-AI/Everfern) | MIT | Screen/mouse/keyboard control, browser agent ("Navis") |
| [coworker](https://github.com/accomplish-ai/coworker) | MIT | Desktop AI-coworker interface, file/document/browser automation |
| [SamarthyaBot](https://github.com/mebishnusahu0595/SamarthyaBot) | Apache-2.0 | India-specific workflows (GST, UPI, IRCTC), multi-LLM RPA engine, Telegram/Discord/WhatsApp channels |

`integration/index.js` is the orchestrator: it starts each component with its *real* entrypoint (each one is a genuinely different toolchain — see below), exposes a single localhost-bound, token-authenticated WebSocket API, and routes tasks (`automate`, `india-workflow`, `voice-command`, ...) to the right backend. `ui/index.html` is the control surface — a chat interface plus quick actions for common India-specific tasks (GST returns, Tally reconciliation).

**Deliberately not included:** [Skales](https://github.com/skalesapp/skales) (multi-agent orchestration) and [GhostDesk](https://github.com/YV17labs/GhostDesk) (legacy-app automation via sandboxed desktop) were part of the original concept but are licensed under Business Source License 1.1 and FSL-1.1-ALv2 respectively — both explicitly prohibit using the software inside a competing commercial product without the author's written consent. Shipping them here would undercut the "actually free and open" claim that's the whole point of this project. See [LICENSING.md](LICENSING.md) for the full breakdown and the path to including them later (permission, or an in-house replacement). Fazm (voice control) was evaluated too, but it's a macOS-native Swift app with no Windows/Linux build, so it's not part of the Windows integration — voice input instead falls back to the browser's own Speech Recognition API in the UI.

## Why this is worth building, not just gluing together

The honest version of "revolutionary": nothing in this stack is individually novel — that's the point. Everfern already reimplements Claude Cowork's computer-use loop; LeAgent already does agentic planning; SamarthyaBot already speaks GST/UPI/IRCTC. What doesn't exist anywhere else is:

1. **A local-first stack aimed at India specifically**, where the default posture is "your data stays on your machine" rather than "trust our cloud."
2. **One coherent interface** instead of four separate apps a BPO's ops team would have to learn and juggle.
3. **A cost structure competitors structurally can't match** — they're VC-funded companies that need subscription revenue; this is MIT/Apache-2.0 code plus a local model, so the marginal cost of running it is your own electricity bill.

## Current status (honest, as of this integration work)

This is real, working infrastructure with real, documented rough edges — not a polished demo:

- ✅ **SamarthyaBot** — fully wired and verified end-to-end: local MongoDB, local Ollama (`llama3.2`), health-checked over HTTP.
- 🟡 **LeAgent, Everfern, coworker** — installed, with two genuine upstream bugs found and patched in LeAgent (`start.ps1` had a parenthesis-mismatch bug that broke its own Node-version check, plus a UTF-8/Windows-PowerShell-5.1 incompatibility). All three are currently blocked in this dev environment by three separate, well-understood, non-code issues: antivirus software racing a package installer's file writes, a missing Visual Studio C++ toolchain needed to compile one native module, and Windows Developer Mode being off (blocks symlink creation). None of these are product defects — they're a snapshot of what actually happens integrating four independent, real-world open-source projects on a real Windows machine, not a curated success story.

Documenting the rough edges honestly is itself part of the pitch: this is what genuine open-source integration work looks like, and every blocker above has a known, unglamorous fix.

## Getting started

See [`setup-windows.ps1`](setup-windows.ps1) for the Windows setup path (clones each component with the correct license, installs the right tool per repo — `uv` for LeAgent, `pnpm` for coworker, plain `npm` for Everfern/SamarthyaBot — pulls a local Ollama model). See [LICENSING.md](LICENSING.md) before enabling anything beyond the four components listed above.

## License

The integration layer in this repo (`integration/`, `ui/`, `setup-windows.ps1`) is original work. Each vendored component under its own top-level directory retains its own upstream license (LICENSE file included in each) — see [LICENSING.md](LICENSING.md) for the full table and what it means for commercial use.
