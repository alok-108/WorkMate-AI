# Component licenses (checked 2026-08-05)

| Component | License | Commercial use OK? | Notes |
|---|---|---|---|
| LeAgent | Apache-2.0 | Yes | Not MIT, but permissive; patent grant included. |
| Everfern | MIT | Yes | |
| Coworker | MIT | Yes | |
| Fazm | MIT (claimed in README) | Yes, probably | No LICENSE file in the repo as of this check -- README says MIT but nothing enforces it. Also macOS-only (Swift); no Windows/Linux build exists. |
| SamarthyaBot | Apache-2.0 | Yes | Small project (4 stars, 0 forks) -- treat as early-stage, review code before relying on it for GST/UPI/IRCTC flows. |
| Skales | **Business Source License 1.1** | **No** | Explicitly: "You may NOT use the Licensed Work to provide a commercial SaaS, managed hosting, or any competing commercial product to third parties without prior written consent from the Licensor." Converts to Apache-2.0 on 2030-04-19. |
| GhostDesk | **Functional Source License 1.1 (FSL-1.1-ALv2)** | **No** | Prohibits "Competing Use" -- offering a commercial product/service that substitutes for GhostDesk or offers substantially similar functionality. Converts to Apache-2.0 two years after each release. |

## Why this matters

WorkMate AI's stated goal is to be a commercial product that beats larger commercial competitors
and other competitors. Skales (multi-agent orchestration) and GhostDesk
(legacy app automation) are exactly the kind of thing their licenses
prohibit bundling into: a commercial product that competes with what the
licensor could otherwise sell.

The original plan's tech-stack table describes all seven components as
uniformly "Open-source" / "MIT-licensed" -- that's not accurate for these
two, and Apache-2.0 (not MIT) for LeAgent and SamarthyaBot.

## Options, in order of least to most disruptive

1. **Ask for a commercial license / written consent** from the Skales
   author (Mario Simic) and GhostDesk author (Yoann Vanitou). Both
   licenses explicitly anticipate this path.
2. **Ship without them.** LeAgent + Everfern + Coworker + SamarthyaBot
   already cover planning, computer control, desktop UI, and India
   workflows. Voice (Fazm) is macOS-only regardless. Multi-agent
   orchestration and legacy-app automation would need to be either
   dropped from the pitch or built in-house.
3. **Wait for the license conversion dates** (2030 for Skales per-version;
   two years per release for GhostDesk) -- not practical for a near-term
   launch.
4. **Use them for internal ops only** (e.g., WorkMate's own team uses
   GhostDesk internally to automate something) -- both licenses permit
   internal/non-commercial use. Just can't ship them to customers as part
   of a paid product.

`integration/index.js` in this scaffold defaults `enableMultiAgent` and
`enableLegacyAutomation` to `false` for this reason -- they're opt-in
flags, not the default, until one of the above is resolved.
