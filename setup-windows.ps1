# WorkMate AI - Windows setup
# Adapted from the Linux/apt-get Phase 1 script. Run from an elevated
# PowerShell if winget prompts for admin rights on any package.
#
# These five repos are NOT uniform npm packages -- each has its own real
# toolchain, verified against the actual repos on 2026-08-05:
#   LeAgent      Python/FastAPI + Vite frontend. No root package.json.
#                Run via its own start.ps1 (needs `uv`, PowerShell 7 --
#                Windows PowerShell 5.1 mis-parses its non-ASCII source
#                and fails; run with pwsh, not powershell.exe).
#   Everfern     Real npm project, but `npm start` launches a full
#                Electron GUI app (electron-forge start), not a headless
#                service. It's a desktop product in its own right.
#   coworker     pnpm workspace (pnpm-workspace.yaml). README requires
#                pnpm 9+, not npm. No plain "start" script -- "dev" is
#                the entry point.
#   fazm         No package.json anywhere. Swift/Xcode, macOS-only.
#                Cannot be built or run on Windows at all.
#   SamarthyaBot Real npm project, `npm start` works, but needs MongoDB
#                running and env vars (JWT secret, an LLM provider key
#                or Ollama) it will not prompt you for -- see its README.
#
# This script does NOT clone Skales or GhostDesk by default -- both have
# field-of-use license restrictions that conflict with shipping them in a
# commercial product. See LICENSING.md before using -IncludeRestricted.

param(
    [switch]$IncludeRestricted,
    [switch]$InstallDeps
)

$ErrorActionPreference = 'Stop'

function Test-Cmd($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "== Checking prerequisites ==" -ForegroundColor Cyan

if (Test-Cmd node) {
    Write-Host "Node found: $(node --version)"
} else {
    Write-Host "Installing Node.js LTS..."
    winget install -e --id OpenJS.NodeJS.LTS
}

if (Test-Cmd python) {
    Write-Host "Python found: $(python --version)"
} else {
    Write-Host "Installing Python..."
    winget install -e --id Python.Python.3.12
}

if (Test-Cmd git) {
    Write-Host "Git found: $(git --version)"
} else {
    Write-Host "Installing Git..."
    winget install -e --id Git.Git
}

if (Test-Cmd ollama) {
    Write-Host "Ollama found: $(ollama --version)"
} else {
    Write-Host "Installing Ollama..."
    winget install -e --id Ollama.Ollama
}

if (Test-Cmd pnpm) {
    Write-Host "pnpm found: $(pnpm --version)"
} else {
    Write-Host "Installing pnpm (required by coworker)..."
    npm install -g pnpm
}

if (Test-Cmd uv) {
    Write-Host "uv found: $(uv --version)"
} else {
    Write-Host "Installing uv (required by LeAgent's backend)..."
    pip install uv
}

if (Test-Cmd pwsh) {
    Write-Host "PowerShell 7 found: $(pwsh --version)"
} else {
    Write-Host "Installing PowerShell 7 (LeAgent's start.ps1 needs it -- Windows PowerShell 5.1 mis-reads its UTF-8 source)..."
    winget install -e --id Microsoft.PowerShell
}

if (Test-Cmd docker) {
    Write-Host "Docker found: $(docker --version)"
} else {
    Write-Host "Docker Desktop not found."
    Write-Host "Only needed for GhostDesk. Requires WSL2. Install manually from:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
}

if (Test-Cmd mongod) {
    Write-Host "MongoDB found."
} else {
    Write-Host "MongoDB not found -- SamarthyaBot needs it to start. Install manually from:" -ForegroundColor Yellow
    Write-Host "  https://www.mongodb.com/try/download/community" -ForegroundColor Yellow
}

Write-Host "`n== Pulling local LLM (llama3.2) =="
ollama pull llama3.2

Write-Host "`n== Cloning components (unrestricted licenses) ==" -ForegroundColor Cyan
$repos = @(
    @{ Name = "LeAgent";      Url = "https://github.com/vixues/LeAgent.git";               License = "Apache-2.0" }
    @{ Name = "Everfern";     Url = "https://github.com/Everfern-AI/Everfern.git";         License = "MIT" }
    @{ Name = "coworker";     Url = "https://github.com/accomplish-ai/coworker.git";       License = "MIT" }
    @{ Name = "fazm";         Url = "https://github.com/mediar-ai/fazm.git";               License = "MIT (per README; no LICENSE file); macOS-only, not buildable here" }
    @{ Name = "SamarthyaBot"; Url = "https://github.com/mebishnusahu0595/SamarthyaBot.git"; License = "Apache-2.0" }
)

foreach ($repo in $repos) {
    if (Test-Path $repo.Name) {
        Write-Host "$($repo.Name) already cloned, skipping."
    } else {
        Write-Host "Cloning $($repo.Name) ($($repo.License))..."
        git clone --depth 1 $repo.Url $repo.Name
    }
}

if ($IncludeRestricted) {
    Write-Host "`n== Cloning field-of-use-restricted components ==" -ForegroundColor Yellow
    Write-Host "Skales is Business Source License 1.1 and GhostDesk is FSL-1.1-ALv2." -ForegroundColor Yellow
    Write-Host "Both prohibit shipping them inside a competing commercial product without" -ForegroundColor Yellow
    Write-Host "the author's written consent. See LICENSING.md. Cloning for evaluation only." -ForegroundColor Yellow

    $restricted = @(
        @{ Name = "skales";    Url = "https://github.com/skalesapp/skales.git" }
        @{ Name = "GhostDesk"; Url = "https://github.com/YV17labs/GhostDesk.git" }
    )
    foreach ($repo in $restricted) {
        if (Test-Path $repo.Name) {
            Write-Host "$($repo.Name) already cloned, skipping."
        } else {
            git clone --depth 1 $repo.Url $repo.Name
        }
    }
} else {
    Write-Host "`nSkipping Skales and GhostDesk (restricted licenses). Re-run with -IncludeRestricted to clone them for evaluation." -ForegroundColor Yellow
}

if ($InstallDeps) {
    Write-Host "`n== Installing dependencies (correct tool per repo) ==" -ForegroundColor Cyan

    if (Test-Path "Everfern") {
        Write-Host "Everfern: npm install"
        Push-Location "Everfern"; npm install; Pop-Location
    }
    if (Test-Path "coworker") {
        Write-Host "coworker: pnpm install"
        Push-Location "coworker"; pnpm install; Pop-Location
    }
    if (Test-Path "SamarthyaBot") {
        Write-Host "SamarthyaBot: npm install"
        Push-Location "SamarthyaBot"; npm install; Pop-Location
    }
    if (Test-Path "LeAgent") {
        Write-Host "LeAgent: uv + npm deps are installed automatically by start.ps1 on first run."
    }
    Write-Host "fazm: skipped (macOS-only, no package.json)." -ForegroundColor Yellow
}

Write-Host "`n== Done ==" -ForegroundColor Cyan
Write-Host "Per-component start commands (these do NOT share one 'npm start'):"
Write-Host "  LeAgent:      cd LeAgent; pwsh .\start.ps1        (backend :7860, frontend :5173)"
Write-Host "  Everfern:     cd Everfern; npm start               (opens an Electron GUI window)"
Write-Host "  coworker:     cd coworker; pnpm dev:web             (see README for full dev setup)"
Write-Host "  SamarthyaBot: cd SamarthyaBot; npm start            (needs MongoDB running + .env config)"
Write-Host "  fazm:         not runnable on Windows"
