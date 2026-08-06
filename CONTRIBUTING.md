# Contributing to WorkMate AI

This project is young, honest about its rough edges, and genuinely open to help. If the idea in the [README](README.md) — a free, local-first, India-specific AI agent stack — is something you'd want to exist, there's real work to do here.

## Ways to contribute

**Code**
- Harden `integration/index.js` — right now it launches each component's real entrypoint and exposes a token-gated WebSocket API, but the health-check/readiness logic is basic and Everfern/coworker (both GUI apps, not headless services) need a better integration story than "spawn and hope."
- A Linux/macOS equivalent of `setup-windows.ps1`. Everything so far has only been exercised on Windows.
- Extend SamarthyaBot's India workflows (GST/UPI/IRCTC/Tally) with real test coverage against sandbox/staging environments.
- An in-house, permissively-licensed replacement for the multi-agent orchestration and legacy-app automation that [Skales](https://github.com/skalesapp/skales) and [GhostDesk](https://github.com/YV17labs/GhostDesk) would otherwise provide — see [LICENSING.md](LICENSING.md) for why they're excluded. This is probably the single highest-leverage gap.

**Non-code**
- Testing the setup script on a machine that isn't this one and reporting exactly where it breaks (it will — see the "Current status" section of the README for the specific environment issues found so far).
- Improving documentation, especially anything that would've saved you time figuring something out.
- Flagging licensing issues in vendored components — this project cares about the "actually free and open" claim being true, not just marketed.

## Getting set up

1. Read [LICENSING.md](LICENSING.md) first — it explains what's included, what's deliberately excluded, and why.
2. Run [`setup-windows.ps1`](setup-windows.ps1) (Windows) to clone the four vendored components with the correct tooling per repo.
3. Read the "Current status" section of the [README](README.md) before filing an issue for something already known and documented there.

## Submitting changes

Open a pull request against `main`. Keep the scope of a PR narrow and explain the *why*, not just the *what* — this repo already has more context written down than most, and PRs that engage with that context (rather than ignoring it) are easier to review.

## Want to talk to me directly?

If you're interested in contributing, have questions about the direction of the project, or just want to connect — email **alok_ps2603mth16@iitp.ac.in**.
