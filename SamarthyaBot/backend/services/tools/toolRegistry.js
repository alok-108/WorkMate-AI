const { TOOL_PACKS } = require('../../config/constants');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const { Client } = require('ssh2');
const workerClient = require('../worker/workerClient');
const sandbox = require('../security/sandboxService');
const platform = require('../system/platform');

// ────────────────────────────────────────────────────────────
// REAL Tool Definitions — No more simulations!
// ────────────────────────────────────────────────────────────

/**
 * Security: Command Blacklist Map
 * Prevent the AI (or user injection) from autonomously executing critically
 * destructive host/remote commands. Covers both *nix and Windows.
 * NOTE: anchored to the start of each (trimmed) command SEGMENT — see
 * assertCommandSafe(), which splits chained commands so that something like
 * `echo hi && rm -rf /` cannot slip past the blacklist.
 */
const BLOCKED_COMMANDS = /^(sudo\s+)?(rm\s+-[a-z]*[rf]|rmdir|mkfs|dd\b|fdisk|shutdown|reboot|poweroff|halt|init\s+[06]|killall\s+-9|wget\s+.*\.sh|curl\s+.*\.sh|chmod\s+-R\s+777|chown\s+-R.*:.*\/|del\s+\/|rd\s+\/s|format\s+[a-z]:|diskpart|:\(\)\s*\{)/im;

/**
 * Split a raw command into individually-checkable segments so chained /
 * piped / substituted commands are all validated, not just the first one.
 */
function splitCommandSegments(command) {
    return String(command)
        // Split on every shell separator/substitution: && || ; | & newline $( `
        .split(/&&|\|\||[;\n\r&|]|\$\(|`/)
        .map(s => s.trim())
        .filter(Boolean);
}

/**
 * Unified command safety gate. Returns { ok: boolean, reason?: string }.
 * Runs every segment through the blacklist AND the workspace sandbox.
 */
function assertCommandSafe(command, { checkWorkspace = true } = {}) {
    if (!command || typeof command !== 'string') {
        return { ok: false, reason: '❌ No command provided.' };
    }
    for (const segment of splitCommandSegments(command)) {
        if (BLOCKED_COMMANDS.test(segment)) {
            return {
                ok: false,
                reason: `❌ Security Block: "${segment}" matches a restricted pattern (recursive delete, disk format, reboot, fork-bomb, remote shell download, etc.).`,
            };
        }
    }
    // Workspace + dangerous-pattern checks (fork bombs, /dev/sd*, etc.)
    // Skipped for remote (SSH) targets, whose filesystem layout differs.
    if (checkWorkspace) {
        const sandboxCheck = sandbox.validateCommand(command);
        if (!sandboxCheck.allowed) {
            return { ok: false, reason: sandboxCheck.reason };
        }
    } else {
        // Still apply the always-on dangerous-pattern guard for remote hosts.
        for (const pattern of sandbox.blockedPatterns) {
            if (pattern.test(command)) {
                return { ok: false, reason: `🛡️ Safety Guard: remote command blocked — dangerous pattern detected.` };
            }
        }
    }
    return { ok: true };
}

/**
 * Workspace path safety gate for file operations. Honours
 * RESTRICT_TO_WORKSPACE (disabled => always allowed).
 */
function assertPathSafe(filePath) {
    const check = sandbox.validatePath(filePath);
    return { ok: check.allowed, reason: check.reason };
}

/**
 * Safe directory — tools can only operate within this sandbox
 * Change this to allow broader access (at your own risk)
 */
const BASE_DIR = path.join(os.homedir(), 'SamarthyaBot_Files');

async function getSafeDir(user) {
    let dir = BASE_DIR;
    if (user && (user._id || user.id)) {
        dir = path.join(BASE_DIR, String(user._id || user.id));
    }
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) { }
    return dir;
}

const toolDefinitions = {

    // ─────────── WEB SEARCH (Real via DuckDuckGo) ───────────
    web_search: {
        name: 'web_search',
        description: 'Search the web for information using DuckDuckGo',
        descriptionHi: 'इंटरनेट पर जानकारी खोजें',
        riskLevel: 'low',
        category: 'search',
        parameters: {
            query: { type: 'string', required: true, description: 'Search query' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const query = encodeURIComponent(args.query);

                // Use html.duckduckgo.com for much better real-time snippets than their JSON API
                const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }

                const html = await response.text();

                // Extract snippets using regex
                const snippetRegex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
                let match;
                let snippets = [];

                while ((match = snippetRegex.exec(html)) !== null && snippets.length < 4) {
                    // Strip inner HTML tags (like <b> tags for bolding)
                    const cleanText = match[1].replace(/<[^>]*>?/gm, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
                    if (cleanText) snippets.push(cleanText);
                }

                let results = '';
                if (snippets.length > 0) {
                    results += `🔍 **Top Real-time Results:**\n\n`;
                    snippets.forEach((snippet, i) => {
                        results += `${i + 1}. ${snippet}\n`;
                    });
                } else {
                    results = `🔍 No instant snippets found for "${args.query}". Try Google: https://www.google.com/search?q=${query}`;
                }

                // Try to extract some URLs as well
                const urlRegex = /<a class="result__url" href="([^"]+)">/g;
                const urls = [];
                while ((match = urlRegex.exec(html)) !== null && urls.length < 3) {
                    // Un-escape duckduckgo redirect wrapper if present
                    let extractedUrl = match[1];
                    if (extractedUrl.includes('?q=')) {
                        const qMatch = extractedUrl.match(/\?q=([^&]+)/);
                        if (qMatch) extractedUrl = decodeURIComponent(qMatch[1]);
                    }
                    if (extractedUrl && !urls.includes(extractedUrl) && extractedUrl.startsWith('http')) urls.push(extractedUrl);
                }

                if (urls.length > 0) {
                    results += `\n🔗 **Sources:**\n${urls.map(u => `• ${u}`).join('\n')}`;
                }

                return { success: true, result: results };
            } catch (error) {
                return { success: false, result: `❌ Search failed: ${error.message}` };
            }
        }
    },

    // ─────────── CALCULATOR (Real, safe eval) ───────────
    calculate: {
        name: 'calculate',
        description: 'Perform mathematical calculations',
        descriptionHi: 'गणितीय गणना करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            expression: { type: 'string', required: true, description: 'Math expression to evaluate' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const sanitized = args.expression.replace(/[^0-9+\-*/().%\s]/g, '');
                const result = Function('"use strict"; return (' + sanitized + ')')();
                return {
                    success: true,
                    result: `🧮 **Calculation:**\n${args.expression} = **${result}**\n\n💡 GST tip: For 18% GST on ₹${result}, total = ₹${(result * 1.18).toFixed(2)}`
                };
            } catch (e) {
                return { success: false, result: `❌ Calculation error: ${e.message}` };
            }
        }
    },

    // ─────────── WEATHER (Real via Open-Meteo — Free, No API key!) ───────────
    weather_info: {
        name: 'weather_info',
        description: 'Get real-time weather for any city',
        descriptionHi: 'शहर का रियल-टाइम मौसम जानें',
        riskLevel: 'low',
        category: 'search',
        parameters: {
            city: { type: 'string', required: true, description: 'City name' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                // Step 1: Geocode city name
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.city)}&count=1`);
                const geoData = await geoRes.json();

                if (!geoData.results || geoData.results.length === 0) {
                    return { success: false, result: `❌ City "${args.city}" not found. Try English name.` };
                }

                const { latitude, longitude, name, country } = geoData.results[0];

                // Step 2: Get weather
                const weatherRes = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia/Kolkata`
                );
                const weather = await weatherRes.json();
                const c = weather.current;

                const weatherCodes = {
                    0: '☀️ Clear sky', 1: '🌤️ Mainly clear', 2: '⛅ Partly cloudy',
                    3: '☁️ Overcast', 45: '🌫️ Fog', 48: '🌫️ Rime fog',
                    51: '🌦️ Light drizzle', 53: '🌦️ Moderate drizzle', 55: '🌧️ Dense drizzle',
                    61: '🌧️ Slight rain', 63: '🌧️ Moderate rain', 65: '🌧️ Heavy rain',
                    71: '🌨️ Slight snow', 73: '🌨️ Moderate snow', 75: '❄️ Heavy snow',
                    80: '🌦️ Rain showers', 81: '🌧️ Moderate showers', 82: '⛈️ Violent showers',
                    95: '⛈️ Thunderstorm', 96: '⛈️ Thunderstorm with hail'
                };

                const desc = weatherCodes[c.weather_code] || '🌡️ Unknown';

                return {
                    success: true,
                    result: `🌤️ **Weather for ${name}, ${country}**\n\n` +
                        `${desc}\n` +
                        `🌡️ Temperature: **${c.temperature_2m}°C**\n` +
                        `💧 Humidity: **${c.relative_humidity_2m}%**\n` +
                        `💨 Wind: **${c.wind_speed_10m} km/h**\n\n` +
                        `🕐 Updated: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                };
            } catch (error) {
                return { success: false, result: `❌ Weather fetch failed: ${error.message}` };
            }
        }
    },

    // ─────────── FILE READ (Real — FULL OS ACCESS) ───────────
    file_read: {
        name: 'file_read',
        description: 'Read contents of any file on the system. Provide absolute path or filename (defaults to user home directory).',
        descriptionHi: 'फ़ाइल की सामग्री पढ़ें',
        riskLevel: 'medium',
        category: 'file',
        parameters: {
            path: { type: 'string', required: true, description: 'Absolute path or filename' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                // Normalize: LLM may use file_path, filename, file_name, etc.
                const argPath = args.path || args.file_path || args.filename || args.file_name || args.file;
                if (!argPath) return { success: false, result: '❌ Please provide a file path/name.' };
                // Resolve absolute (cross-platform) vs. workspace-relative paths
                let filePath = path.isAbsolute(argPath) ? path.resolve(argPath) : path.resolve(SAFE_DIR, argPath);

                // Enforce workspace sandbox (no-op when RESTRICT_TO_WORKSPACE=false)
                const guard = assertPathSafe(filePath);
                if (!guard.ok) return { success: false, result: guard.reason };

                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    const files = await fs.readdir(filePath);
                    return {
                        success: true,
                        result: `📁 **Directory listing: ${argPath}**\n\n${files.map(f => `• ${f}`).join('\n') || '(empty folder)'}`
                    };
                }

                // Don't read files over 1MB
                if (stat.size > 1024 * 1024) {
                    return { success: false, result: `❌ File too large (${(stat.size / 1024).toFixed(1)}KB). Max 1MB.` };
                }

                const content = await fs.readFile(filePath, 'utf-8');
                const ext = path.extname(filePath).slice(1).toLowerCase();

                return {
                    success: true,
                    result: `📄 **File: ${argPath}** (${stat.size} bytes)\n\n\`\`\`\n${content}\n\`\`\``
                };
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // List available files instead
                    try {
                        const files = await fs.readdir(SAFE_DIR);
                        return {
                            success: false,
                            result: `❌ File not found: "${argPath}"\n\n📁 Available files in SamarthyaBot_Files:\n${files.map(f => `• ${f}`).join('\n') || '(empty — write a file first!)'}`
                        };
                    } catch (e) {
                        return { success: false, result: `❌ File not found: "${argPath}"` };
                    }
                }
                return { success: false, result: `❌ File read error: ${error.message}` };
            }
        }
    },

    // ─────────── FILE WRITE (Real — FULL OS ACCESS) ───────────
    file_write: {
        name: 'file_write',
        description: 'Write/create any file on the system. Provide absolute path or filename (defaults to user home directory).',
        descriptionHi: 'फ़ाइल बनाएं या लिखें',
        riskLevel: 'medium',
        category: 'file',
        parameters: {
            path: { type: 'string', required: true, description: 'Absolute path or filename' },
            content: { type: 'string', required: true, description: 'Content to write' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                // Normalize: LLM may use file_path, filename, etc.
                const argPath = args.path || args.file_path || args.filename || args.file_name || args.file;
                if (!argPath) return { success: false, result: '❌ Please provide a file path/name.' };
                // Resolve absolute (cross-platform) vs. workspace-relative paths
                let filePath = path.isAbsolute(argPath) ? path.resolve(argPath) : path.resolve(SAFE_DIR, argPath);

                // Enforce workspace sandbox (no-op when RESTRICT_TO_WORKSPACE=false)
                const guard = assertPathSafe(filePath);
                if (!guard.ok) return { success: false, result: guard.reason };

                // Create subdirectories if needed
                await fs.mkdir(path.dirname(filePath), { recursive: true });

                const argContent = args.content ?? args.data ?? args.body ?? args.text ?? "";
                await fs.writeFile(filePath, String(argContent), 'utf-8');
                const stat = await fs.stat(filePath);

                return {
                    success: true,
                    result: `✅ **File written successfully!**\n\n📄 Path: ~/SamarthyaBot_Files/${argPath}\n📏 Size: ${stat.size} bytes\n🕐 Time: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                };
            } catch (error) {
                return { success: false, result: `❌ File write error: ${error.message}` };
            }
        }
    },

    // ─────────── DIRECTORY LIST (Real — FULL OS ACCESS) ───────────
    file_list: {
        name: 'file_list',
        description: 'List all files in a directory. Provide absolute path (defaults to user home directory).',
        descriptionHi: 'फ़ोल्डर की सभी फाइलें दिखाएं',
        riskLevel: 'low',
        category: 'file',
        parameters: {
            path: { type: 'string', required: false, description: 'Absolute directory path to list' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const targetDir = args.path
                    ? (path.isAbsolute(args.path) ? path.resolve(args.path) : path.resolve(SAFE_DIR, args.path))
                    : SAFE_DIR;

                // Enforce workspace sandbox (no-op when RESTRICT_TO_WORKSPACE=false)
                const guard = assertPathSafe(targetDir);
                if (!guard.ok) return { success: false, result: guard.reason };

                const files = await fs.readdir(targetDir, { withFileTypes: true });
                if (files.length === 0) {
                    return { success: true, result: `📁 ${targetDir} is empty.` };
                }

                let listing = `📁 **${targetDir}**\n\n`;
                for (const f of files) {
                    const icon = f.isDirectory() ? '📂' : '📄';
                    try {
                        const stat = await fs.stat(path.join(targetDir, f.name));
                        const size = f.isDirectory() ? 'folder' : `${(stat.size / 1024).toFixed(1)}KB`;
                        listing += `${icon} ${f.name} (${size})\n`;
                    } catch (e) {
                        listing += `${icon} ${f.name}\n`;
                    }
                }
                return { success: true, result: listing };
            } catch (error) {
                return { success: false, result: `❌ List error: ${error.message}` };
            }
        }
    },

    // ─────────── SEND EMAIL (Real via Nodemailer + Gmail) ───────────
    send_email: {
        name: 'send_email',
        description: 'Send a real email via Gmail SMTP',
        descriptionHi: 'ईमेल भेजें (Gmail)',
        riskLevel: 'high',
        category: 'email',
        parameters: {
            to: { type: 'string', required: true, description: 'Recipient email' },
            subject: { type: 'string', required: true, description: 'Email subject' },
            body: { type: 'string', required: true, description: 'Email body. CAUTION: You MUST use \\n for newlines instead of actual linebreaks inside this string.' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const emailUser = process.env.SMTP_EMAIL;
                const emailPass = process.env.SMTP_PASSWORD;

                if (!emailUser || !emailPass) {
                    return {
                        success: false,
                        result: `❌ **Email not configured!**\n\n🔧 Setup steps:\n1. Go to Google Account → Security → App Passwords\n2. Generate an App Password for "Mail"\n3. Add to .env:\n\`\`\`\nSMTP_EMAIL=your_gmail@gmail.com\nSMTP_PASSWORD=your_16_char_app_password\n\`\`\`\n4. Restart server`
                    };
                }

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: emailUser,
                        pass: emailPass
                    }
                });

                const isHtml = args.body.includes('<') && args.body.includes('>');

                const info = await transporter.sendMail({
                    from: `"SamarthyaBot" <${emailUser}>`,
                    to: args.to,
                    subject: args.subject,
                    [isHtml ? 'html' : 'text']: args.body
                });

                return {
                    success: true,
                    result: `✅ **Email sent successfully!**\n\n📧 To: ${args.to}\n📋 Subject: ${args.subject}\n🆔 Message ID: ${info.messageId}\n🕐 Sent at: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                };
            } catch (error) {
                return { success: false, result: `❌ Email failed: ${error.message}` };
            }
        }
    },

    // ─────────── NOTE/REMINDER (Real — saves to filesystem) ───────────
    note_take: {
        name: 'note_take',
        description: 'Save a note to ~/SamarthyaBot_Files/notes/',
        descriptionHi: 'नोट सेव करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            title: { type: 'string', required: true, description: 'Note title' },
            content: { type: 'string', required: true, description: 'Note content' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const notesDir = path.join(SAFE_DIR, 'notes');
                await fs.mkdir(notesDir, { recursive: true });

                const filename = `${args.title.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')}_${Date.now()}.md`;
                const filePath = path.join(notesDir, filename);

                const noteContent = `# ${args.title}\n\n_Created: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}_\n\n${args.content}`;
                await fs.writeFile(filePath, noteContent, 'utf-8');

                return {
                    success: true,
                    result: `📝 **Note saved!**\n\n📄 File: ~/SamarthyaBot_Files/notes/${filename}\n📋 Title: ${args.title}\n🕐 Time: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
                };
            } catch (error) {
                return { success: false, result: `❌ Note save error: ${error.message}` };
            }
        }
    },

    // ─────────── REMINDER (Real — writes to file + shows time) ───────────
    reminder_set: {
        name: 'reminder_set',
        description: 'Set a reminder (saved to file)',
        descriptionHi: 'रिमाइंडर सेट करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            message: { type: 'string', required: true, description: 'Reminder message' },
            time: { type: 'string', required: false, description: 'When to remind (IST)' },
            isoDate: { type: 'string', required: false, description: 'When to remind exactly, specified as ISO-8601 UTC date string (e.g. 2026-03-02T10:00:00Z)' },
            delayInSeconds: { type: 'number', required: false, description: 'If the requested time is relative (like "in 20 seconds" or "after 5 minutes"), specify total seconds here (e.g. 20, 300) for high precision.' }
        },
        execute: async (args, userContext) => {
            try {
                // Fallbacks if LLM hallucinated keys
                const message = args.message || args.description || 'Reminder';
                const delayInput = args.delayInSeconds || args.time_in_seconds || args.seconds || 0;

                let delayMs = 0;
                let gcalLink = '';
                const gcalTitle = encodeURIComponent(message);

                if (delayInput > 0) {
                    delayMs = delayInput * 1000;
                    const d = new Date(Date.now() + delayMs);
                    const dEnd = new Date(d.getTime() + 30 * 60000);
                    const formatIso = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${formatIso(d)}/${formatIso(dEnd)}`;
                } else if (args.isoDate) {
                    try {
                        const targetTime = new Date(args.isoDate);
                        if (!isNaN(targetTime)) {
                            delayMs = Math.max(0, targetTime.getTime() - Date.now());
                            const dEnd = new Date(targetTime.getTime() + 30 * 60000); // +30 mins
                            const formatIso = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                            gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${formatIso(targetTime)}/${formatIso(dEnd)}`;
                        }
                    } catch (e) { }
                }

                if (!gcalLink) {
                    gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}`;
                }

                return {
                    success: true,
                    notificationParams: {
                        message: message,
                        delayMs: delayMs || 5000 // default 5s if can't parse
                    },
                    result: `⏰ **Live Reminder set!**\n\n💬 ${message}\n🕐 Time: ${args.time || 'No specific time'}\n\n_Browser notification scheduled! Please keep this tab open._\n\n✨ **[Add to Google Calendar](${gcalLink})** (Gets you email & web notifications!)`
                };
            } catch (error) {
                return { success: false, result: `❌ Reminder error: ${error.message}` };
            }
        }
    },

    // ─────────── SYSTEM INFO (Real OS data) ───────────
    system_info: {
        name: 'system_info',
        description: 'Get system information (CPU, RAM, OS)',
        descriptionHi: 'सिस्टम की जानकारी प्राप्त करें',
        riskLevel: 'low',
        category: 'system',
        parameters: {},
        execute: async (args, userContext) => {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const uptime = os.uptime();

            const hours = Math.floor(uptime / 3600);
            const mins = Math.floor((uptime % 3600) / 60);

            return {
                success: true,
                result: `🖥️ **System Information**\n\n` +
                    `💻 OS: ${os.type()} ${os.release()} (${os.arch()})\n` +
                    `🏠 Hostname: ${os.hostname()}\n` +
                    `👤 User: ${os.userInfo().username}\n` +
                    `🧠 CPU: ${cpus[0]?.model || 'Unknown'} (${cpus.length} cores)\n` +
                    `💾 RAM: ${(usedMem / 1073741824).toFixed(1)}GB / ${(totalMem / 1073741824).toFixed(1)}GB (${((usedMem / totalMem) * 100).toFixed(0)}% used)\n` +
                    `💿 Free RAM: ${(freeMem / 1073741824).toFixed(1)}GB\n` +
                    `⏱️ Uptime: ${hours}h ${mins}m\n` +
                    `📂 Home: ${os.homedir()}\n` +
                    `🕐 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`
            };
        }
    },

    // ─────────── DEVOPS / STREAMING EXECUTION (Go Worker Integration) ───────────
    devops_execute_stream: {
        name: 'devops_execute_stream',
        description: `Run long or complex shell commands (like npm install, git push, vercel deploy) and stream the output back. Required for any heavy DevOps/Auto-Coder tasks. Uses the Go micro-worker when available, with an automatic native fallback on every OS. Host OS: ${platform.describe()}. Use commands valid for this OS.`,
        descriptionHi: 'लाइव शेल कमांड चलाएं',
        riskLevel: 'critical',
        category: 'system',
        parameters: {
            command: { type: 'string', required: true, description: 'Command to execute safely via Go' },
            dir: { type: 'string', required: false, description: 'Working directory for the command' }
        },
        execute: async (args, userContext) => {
            const safe = assertCommandSafe(args.command);
            if (!safe.ok) return { success: false, result: safe.reason };

            return new Promise((resolve) => {
                let liveLog = '';

                // Let the Go worker handle the heavy lifting!
                workerClient.executeCommand(args.command, args.dir || '', (data, type) => {
                    // Collect live output
                    liveLog += data + '\\n';
                    // Optional: If we had a websocket to the frontend dashboard, we'd emit it here!
                }).then(({ success, exitCode, output, elapsed }) => {
                    // Combine whatever was streamed
                    const finalOutput = output || liveLog;

                    if (!success) {
                        resolve({
                            success: false,
                            result: `❌ Execution Failed (Code ${exitCode}):\n\`\`\`\n${finalOutput.substring(finalOutput.length > 3000 ? finalOutput.length - 3000 : 0)}\n\`\`\``
                        });
                        return;
                    }
                    resolve({
                        success: true,
                        result: `✅ **Success:** \`${args.command}\`\n⏱️ Elapsed: ${elapsed}ms\n\n\`\`\`\n${finalOutput.substring(0, 3000)}\n\`\`\``
                    });
                }).catch(err => {
                    resolve({ success: false, result: `❌ Worker Error: ${err.message}` });
                });
            });
        }
    },

    // ─────────── LEGACY RUN COMMAND (Kept for instant small commands) ───────────
    run_command: {
        name: 'run_command',
        description: `Run basic, instant shell commands natively. Host OS: ${platform.describe()}. IMPORTANT — use commands valid for this OS: on Windows use 'dir', 'type', 'copy'; on macOS/Linux use 'ls', 'cat', 'cp'. To open a URL/file/app prefer the 'open_path' tool (it auto-picks start/open/xdg-open).`,
        descriptionHi: 'शेल कमांड चलाएं',
        riskLevel: 'critical',
        category: 'system',
        parameters: {
            command: { type: 'string', required: true, description: 'Shell command to execute (must match the host OS)' }
        },
        execute: async (args, userContext) => {
            const safe = assertCommandSafe(args.command);
            if (!safe.ok) return { success: false, result: safe.reason };

            const { shell } = platform.getShell();
            return new Promise((resolve) => {
                exec(args.command, { timeout: 15000, maxBuffer: 1024 * 1024, shell, windowsHide: true }, (error, stdout, stderr) => {
                    if (error) {
                        resolve({
                            success: false,
                            result: `❌ Command failed:\n\`\`\`\n${stderr || error.message}\n\`\`\``
                        });
                        return;
                    }
                    resolve({
                        success: true,
                        result: `💻 **Command:** \`${args.command}\`\n\n\`\`\`\n${(stdout || '(no output)').substring(0, 3000)}\n\`\`\``
                    });
                });
            });
        }
    },

    // ─────────── REMOTE VPS DEPLOYMENT (SSH Stream) ───────────
    ssh_deploy: {
        name: 'ssh_deploy',
        description: 'Login to a remote VPS server via SSH and execute commands autonomously (e.g., git pull, npm run build, pm2 restart).',
        descriptionHi: 'रिमोट सर्वर पर कमांड चलाएं',
        riskLevel: 'critical',
        category: 'system',
        parameters: {
            host: { type: 'string', required: true, description: 'Server IP or Hostname' },
            username: { type: 'string', required: true, description: 'SSH Username (e.g., root)' },
            password: { type: 'string', required: false, description: 'SSH Password (if key is not used)' },
            privateKeyPath: { type: 'string', required: false, description: 'Absolute path to local SSH private key file (if password is not used)' },
            command: { type: 'string', required: true, description: 'Command string to run on the remote VPS (e.g., "cd /var/www && git pull")' }
        },
        execute: async (args, userContext) => {
            const safe = assertCommandSafe(args.command, { checkWorkspace: false });
            if (!safe.ok) return { success: false, result: safe.reason };

            return new Promise(async (resolve) => {
                const conn = new Client();
                let outputLog = '';

                // Build SSH config
                const config = {
                    host: args.host,
                    port: 22,
                    username: args.username,
                    readyTimeout: 10000 // 10s connection timeout
                };

                // Auth strategy
                if (args.password) {
                    config.password = args.password;
                } else if (args.privateKeyPath) {
                    try {
                        config.privateKey = await fs.readFile(args.privateKeyPath, 'utf8');
                    } catch (e) {
                        return resolve({ success: false, result: `❌ Failed to read private key at ${args.privateKeyPath}: ${e.message}` });
                    }
                } else {
                    return resolve({ success: false, result: `❌ Missing Authentication. Provide either 'password' or 'privateKeyPath'.` });
                }

                conn.on('ready', () => {
                    outputLog += `[SSH] Connected to ${args.username}@${args.host} successfully.\n`;
                    outputLog += `[SSH] Executing: ${args.command}\n\n`;

                    conn.exec(args.command, (err, stream) => {
                        if (err) {
                            conn.end();
                            return resolve({ success: false, result: `❌ Command Execution Error:\n\`\`\`\n${err.message}\n\`\`\`` });
                        }

                        stream.on('close', (code, signal) => {
                            conn.end();
                            const success = code === 0;
                            const statusIcon = success ? '✅' : '❌';

                            resolve({
                                success: success,
                                result: `${statusIcon} **SSH Execution Complete** (Exit Code: ${code})\n\n\`\`\`\n${outputLog.substring(outputLog.length > 3000 ? outputLog.length - 3000 : 0)}\n\`\`\``
                            });
                        }).on('data', (data) => {
                            outputLog += data.toString();
                        }).stderr.on('data', (data) => {
                            outputLog += data.toString();
                        });
                    });
                }).on('error', (err) => {
                    resolve({ success: false, result: `❌ SSH Connection Error to ${args.host}: ${err.message}` });
                });

                // Start connection
                conn.connect(config);
            });
        }
    },

    // ─────────── GST REMINDER (Real — saves reminder files) ───────────
    gst_reminder: {
        name: 'gst_reminder',
        description: 'Set GST filing reminder with real deadlines',
        descriptionHi: 'GST फाइलिंग रिमाइंडर',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            gstType: { type: 'string', required: true, description: 'GST return type (GSTR-1, GSTR-3B, etc.)' },
            dueDate: { type: 'string', required: false, description: 'Due date' }
        },
        execute: async (args, userContext) => {
            const gstDates = {
                'GSTR-1': { day: 11, desc: '11th of next month', late: '₹50/day (₹20 for nil)' },
                'GSTR-3B': { day: 20, desc: '20th of next month', late: '₹50/day (₹20 for nil) + 18% interest' },
                'GSTR-9': { day: 31, desc: 'December 31st', late: '₹200/day (max ₹5000)' },
                'GSTR-4': { day: 30, desc: 'April 30th (annual)', late: '₹50/day (₹20 for nil)' },
                'GSTR-2A': { day: 0, desc: 'Auto-populated', late: 'N/A' }
            };

            const info = gstDates[args.gstType?.toUpperCase()] || null;

            // Save reminder to file
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const remindersDir = path.join(SAFE_DIR, 'reminders');
                await fs.mkdir(remindersDir, { recursive: true });
                const reminder = {
                    type: 'gst',
                    gstType: args.gstType,
                    dueDate: info?.desc || args.dueDate || 'Unknown',
                    createdAt: new Date().toISOString()
                };
                await fs.writeFile(
                    path.join(remindersDir, `gst_${args.gstType}_${Date.now()}.json`),
                    JSON.stringify(reminder, null, 2)
                );
            } catch (e) { /* non-critical */ }

            if (info) {
                return {
                    success: true,
                    result: `🏢 **GST Reminder Set!**\n\n📋 Return: **${args.gstType.toUpperCase()}**\n📅 Due: **${info.desc}**\n💸 Late Fee: ${info.late}\n\n⚠️ Late filing se penalty + interest lagti hai!\n📄 Reminder saved to ~/SamarthyaBot_Files/reminders/`
                };
            }

            return {
                success: true,
                result: `🏢 GST Reminder Set for ${args.gstType}\nDue: ${args.dueDate || 'Check GST portal'}\n\n📄 Reminder saved.`
            };
        }
    },

    // ─────────── UPI LINK GENERATOR (Real deep link) ───────────
    upi_generate: {
        name: 'upi_generate',
        description: 'Generate a real UPI payment link',
        descriptionHi: 'UPI पेमेंट लिंक बनाएं',
        riskLevel: 'medium',
        category: 'tool',
        parameters: {
            amount: { type: 'number', required: true, description: 'Amount in INR' },
            upiId: { type: 'string', required: true, description: 'UPI ID to receive payment' },
            name: { type: 'string', required: false, description: 'Payee name' },
            note: { type: 'string', required: false, description: 'Payment note' }
        },
        execute: async (args, userContext) => {
            const params = new URLSearchParams({
                pa: args.upiId,
                am: String(args.amount),
                cu: 'INR',
                tn: args.note || 'Payment'
            });
            if (args.name) params.set('pn', args.name);

            const upiLink = `upi://pay?${params.toString()}`;

            return {
                success: true,
                result: `💳 **UPI Payment Link Generated!**\n\n` +
                    `• **UPI ID:** ${args.upiId}\n` +
                    `• **Amount:** ₹${args.amount}\n` +
                    `• **Payee:** ${args.name || 'N/A'}\n` +
                    `• **Note:** ${args.note || 'Payment'}\n\n` +
                    `🔗 Link: \`${upiLink}\`\n\n` +
                    `📱 Click on phone to open GPay/PhonePe/Paytm with pre-filled details!`
            };
        }
    },

    // ─────────── SUMMARIZE TEXT (via Gemini API) ───────────
    summarize_text: {
        name: 'summarize_text',
        description: 'Summarize a long text or document',
        descriptionHi: 'लंबे टेक्स्ट का सारांश',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            text: { type: 'string', required: true, description: 'Text to summarize' }
        },
        execute: async (args, userContext) => {
            const words = args.text.split(/\s+/).length;
            // The LLM itself will summarize this — tool just provides metadata
            return {
                success: true,
                result: `📄 **Text to Summarize** (${words} words):\n\n${args.text.substring(0, 500)}${args.text.length > 500 ? '...' : ''}\n\n_The AI will now provide a concise summary._`
            };
        }
    },

    // ─────────── CALENDAR (saves events to file) ───────────
    calendar_schedule: {
        name: 'calendar_schedule',
        description: 'Schedule a calendar event (saved locally)',
        descriptionHi: 'कैलेंडर में इवेंट शेड्यूल करें',
        riskLevel: 'medium',
        category: 'calendar',
        parameters: {
            title: { type: 'string', required: true, description: 'Event title' },
            date: { type: 'string', required: true, description: 'Event date' },
            time: { type: 'string', required: false, description: 'Event time (IST)' },
            isoDate: { type: 'string', required: false, description: 'Event exact datetime as ISO-8601 UTC string (e.g. 2026-03-02T10:00:00Z)' }
        },
        execute: async (args, userContext) => {
            try {
                const SAFE_DIR = await getSafeDir(userContext);
                const calDir = path.join(SAFE_DIR, 'calendar');
                await fs.mkdir(calDir, { recursive: true });

                const event = {
                    title: args.title,
                    date: args.date,
                    time: args.time || 'All day',
                    createdAt: new Date().toISOString()
                };

                const filename = `event_${Date.now()}.json`;
                await fs.writeFile(path.join(calDir, filename), JSON.stringify(event, null, 2));

                let gcalLink = '';
                const gcalTitle = encodeURIComponent(args.title);
                if (args.isoDate) {
                    try {
                        const d = new Date(args.isoDate);
                        if (!isNaN(d)) {
                            const dEnd = new Date(d.getTime() + 60 * 60000); // 1 hour duration
                            const formatIso = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                            gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${formatIso(d)}/${formatIso(dEnd)}`;
                        }
                    } catch (e) { }
                }
                if (!gcalLink) {
                    gcalLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}`;
                }

                return {
                    success: true,
                    result: `📅 **Event Scheduled!**\n\n📋 Title: ${args.title}\n📆 Date: ${args.date}\n🕐 Time: ${args.time || 'All day'}\n📄 Saved file: \`calendar/${filename}\`\n\n✨ **[Add to Google Calendar](${gcalLink})** (Gets you email & web notifications!)`
                };
            } catch (error) {
                return { success: false, result: `❌ Calendar error: ${error.message}` };
            }
        }
    },

    // ─────────── ADVANCED BROWSER AUTOMATION (Puppeteer) ───────────
    browser_action: {
        name: 'browser_action',
        description: 'Auto-control a chromium browser. It can navigate, click, type, and read the screen autonomously. Use this to create Github repos, write docs, or scrape web UI.',
        descriptionHi: 'ब्राउज़र पे ऑटोमैटिक काम करें',
        riskLevel: 'high',
        category: 'browser',
        parameters: {
            url: { type: 'string', required: true, description: 'URL to navigate to or interact with.' },
            actions: {
                type: 'string',
                required: false,
                description: 'JSON array of actions. Format: [{"type":"click","selector":"#submit"},{"type":"type","selector":"#email","text":"my@email.com"},{"type":"wait","ms":2000},{"type":"extract","selector":"body"}]'
            }
        },
        execute: async (args, userContext) => {
            return new Promise(async (resolve) => {
                const puppeteer = require('puppeteer-core');
                let browser;
                let log = `🌐 **Browser Automation Started:** ${args.url}\n`;

                try {
                    // Discover an installed Chromium-based browser across Windows/macOS/Linux.
                    const validPath = platform.findBrowser();
                    if (!validPath) {
                        return resolve({
                            success: false,
                            result: `❌ No Chrome/Edge/Brave/Chromium browser found for Puppeteer on this ${platform.OS} machine.\n\n💡 Install Google Chrome, or set CHROME_PATH in your .env to the browser executable path.`
                        });
                    }

                    browser = await puppeteer.launch({
                        executablePath: validPath,
                        headless: false, // Make it visible to the user!
                        defaultViewport: null,
                        // --no-sandbox is required on many Linux servers / containers.
                        args: platform.isLinux ? ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'] : ['--start-maximized'],
                    });

                    const page = await browser.newPage();
                    await page.goto(args.url, { waitUntil: 'networkidle2' });
                    log += `✅ Loaded: ${args.url}\n`;

                    if (args.actions) {
                        const actionsList = JSON.parse(args.actions);
                        for (let act of actionsList) {
                            if (act.type === 'click') {
                                await page.click(act.selector);
                                log += `🖱️ Clicked: ${act.selector}\n`;
                            } else if (act.type === 'type') {
                                await page.type(act.selector, act.text);
                                log += `⌨️ Typed "${act.text}" into ${act.selector}\n`;
                            } else if (act.type === 'wait') {
                                await new Promise(r => setTimeout(r, act.ms));
                                log += `⏳ Waited ${act.ms}ms\n`;
                            } else if (act.type === 'extract') {
                                const text = await page.$eval(act.selector, el => el.innerText);
                                log += `📄 Extracted text from ${act.selector}:\n\`\`\`\n${text.substring(0, 500)}...\n\`\`\`\n`;
                            }
                        }
                    }

                    // Leave browser open for the user if it's a visual task
                    setTimeout(() => browser.close(), 60000);

                    resolve({ success: true, result: log + '\n✨ Browser task completed successfully.' });
                } catch (err) {
                    if (browser) await browser.close();
                    resolve({ success: false, result: `❌ Browser Action Failed:\n${err.message}\n\nLogs:\n${log}` });
                }
            });
        }
    },

    // ─────────── CAPTURE DESKTOP SCREENSHOT (Real OS screenshot) ───────────
    capture_desktop_screenshot: {
        name: 'capture_desktop_screenshot',
        description: 'Capture a screenshot of the host desktop for screen understanding.',
        descriptionHi: 'स्क्रीनशॉट लें',
        riskLevel: 'medium',
        category: 'system',
        parameters: {},
        execute: async (args, userContext) => {
            return new Promise((resolve) => {
                const screenshot = require('screenshot-desktop');
                screenshot({ format: 'png' })
                    .then((imgRaw) => {
                        const base64 = imgRaw.toString('base64');
                        resolve({
                            success: true,
                            result: `📸 **Screenshot Captured successfully!**\nUse the analyze_screen tool or your vision capabilities to see what is on screen.\n[IMAGE_DATA_BASE64_READY_INTERNAL_USE]`
                        });
                    })
                    .catch((err) => {
                        resolve({ success: false, result: `❌ Screenshot failed: ${err.message}` });
                    });
            });
        }
    },

    // ─────────── SCHEDULE BACKGROUND TASK (Autonomous Mode) ───────────
    schedule_background_task: {
        name: 'schedule_background_task',
        description: 'Schedule a recurring or delayed task for the AI to execute automatically in the background without user intervention.',
        descriptionHi: 'ऑटोमैटिक टास्क सेट करें',
        riskLevel: 'high',
        category: 'system',
        parameters: {
            taskName: { type: 'string', required: true, description: 'Short name for the background task' },
            prompt: { type: 'string', required: true, description: 'Detailed prompt/instructions of what the AI should do when the task runs' },
            intervalMinutes: { type: 'number', required: true, description: 'How often to run in minutes. 0 means run exactly once.' },
            startDelayMinutes: { type: 'number', required: false, description: 'Delay before first run in minutes. Default 0.' }
        },
        execute: async (args, userContext) => {
            try {
                const BackgroundJob = require('../../models/BackgroundJob');
                const startDelay = args.startDelayMinutes || 0;
                const nextRunAt = new Date(Date.now() + startDelay * 60000);

                const job = new BackgroundJob({
                    userId: userContext._id || userContext.id,
                    taskName: args.taskName,
                    prompt: args.prompt,
                    intervalMinutes: args.intervalMinutes,
                    nextRunAt: nextRunAt
                });

                await job.save();

                return {
                    success: true,
                    result: `⏳ **Background Task Scheduled!**\n\n🎯 Task: ${args.taskName}\n🔄 Interval: ${args.intervalMinutes === 0 ? 'Run once' : `Every ${args.intervalMinutes}m`}\n🕒 Next run: ${nextRunAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n\n_The AI will autonomously execute this task in the background._`
                };
            } catch (err) {
                return { success: false, result: `❌ Schedule failed: ${err.message}` };
            }
        }
    },

    // ─────────── SIMULATE TASK (Task Replay Mode) ───────────
    simulate_task: {
        name: 'simulate_task',
        description: 'Simulate a complex action without actually executing it. Explain what would happen, files touched, and APIs called.',
        descriptionHi: 'टास्क का सिमुलेशन करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            taskDecription: { type: 'string', required: true, description: 'Description of the task to simulate' }
        },
        execute: async (args, userContext) => {
            return {
                success: true,
                result: `🧪 **TASK SIMULATION MODE ACTIVE**\n\nI have analyzed the request: "${args.taskDecription}"\n\nIf executed, the following sequence would occur:\n1. 🔍 Validation step\n2. 📄 File operations (Safe mode preview)\n3. 📤 Network request (Dry run)\n\n_No actual system state was changed._`
            };
        }
    },

    // ─────────── OPEN PATH/URL/APP (Cross-platform: start | open | xdg-open) ───────────
    open_path: {
        name: 'open_path',
        description: 'Open a URL, file, folder or application with the system default handler. Auto-selects the right command for the OS (Windows: start, macOS: open, Linux: xdg-open). Use this instead of guessing OS-specific open commands.',
        descriptionHi: 'URL/फ़ाइल/ऐप खोलें',
        riskLevel: 'medium',
        category: 'system',
        parameters: {
            target: { type: 'string', required: true, description: 'A URL (https://...), an absolute file/folder path, or an application name' }
        },
        execute: async (args, userContext) => {
            const target = String(args.target || args.url || args.path || args.app || '');
            if (!target) return { success: false, result: '❌ Please provide a URL, file path or app to open.' };

            // SECURITY: reject shell metacharacters. We spawn WITHOUT a shell
            // (args array), but this is defense-in-depth against any handler
            // that re-parses (e.g. cmd.exe `start`) and command substitution.
            if (/[`$;&|<>(){}\n\r"'\\]/.test(target)) {
                return { success: false, result: '❌ Refused: the target contains characters that are not allowed for safety.' };
            }

            const { spawn } = require('child_process');
            // Build [binary, ...args] with NO shell interpolation.
            let bin, spawnArgs;
            if (platform.isWindows) {
                bin = 'cmd';
                spawnArgs = ['/c', 'start', '', target]; // empty title arg required by start
            } else if (platform.isMac) {
                bin = 'open';
                spawnArgs = [target];
            } else {
                bin = 'xdg-open';
                spawnArgs = [target];
            }

            return new Promise((resolve) => {
                let child;
                try {
                    child = spawn(bin, spawnArgs, { windowsHide: true, stdio: 'ignore' });
                } catch (err) {
                    return resolve({ success: false, result: `❌ Could not open "${target}" on ${platform.OS}: ${err.message}` });
                }
                const timer = setTimeout(() => { try { child.kill(); } catch (_) {} resolve({ success: true, result: `🚀 Opened **${target}** (${platform.OS}).` }); }, 8000);
                child.on('error', (err) => { clearTimeout(timer); resolve({ success: false, result: `❌ Could not open "${target}" on ${platform.OS}: ${err.message}` }); });
                child.on('spawn', () => { clearTimeout(timer); resolve({ success: true, result: `🚀 Opened **${target}** using the system default handler (${platform.OS}).` }); });
            });
        }
    },

    // ─────────── HTTP REQUEST (Generic REST/API caller) ───────────
    http_request: {
        name: 'http_request',
        description: 'Make an HTTP request to any REST API or webhook and return the response. Supports GET/POST/PUT/PATCH/DELETE, custom headers and JSON body.',
        descriptionHi: 'API रिक्वेस्ट भेजें',
        riskLevel: 'medium',
        category: 'tool',
        parameters: {
            url: { type: 'string', required: true, description: 'Full URL (must start with http:// or https://)' },
            method: { type: 'string', required: false, description: 'HTTP method (GET default)' },
            headers: { type: 'string', required: false, description: 'JSON object of request headers' },
            body: { type: 'string', required: false, description: 'Request body (JSON string or raw text)' }
        },
        execute: async (args, userContext) => {
            try {
                const url = args.url;
                if (!/^https?:\/\//i.test(url || '')) {
                    return { success: false, result: '❌ URL must start with http:// or https://' };
                }
                const method = (args.method || 'GET').toUpperCase();
                let headers = {};
                if (args.headers) {
                    try { headers = typeof args.headers === 'string' ? JSON.parse(args.headers) : args.headers; } catch (e) { /* ignore bad headers */ }
                }
                const opts = { method, headers };
                if (args.body && method !== 'GET' && method !== 'HEAD') {
                    opts.body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
                    if (!Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
                        headers['Content-Type'] = 'application/json';
                    }
                }

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 20000);
                const res = await fetch(url, { ...opts, signal: controller.signal });
                clearTimeout(timer);

                const text = await res.text();
                const preview = text.length > 3000 ? text.slice(0, 3000) + '\n…(truncated)' : text;
                return {
                    success: res.ok,
                    result: `🌐 **${method} ${url}**\nStatus: ${res.status} ${res.statusText}\n\n\`\`\`\n${preview || '(empty body)'}\n\`\`\``
                };
            } catch (error) {
                return { success: false, result: `❌ HTTP request failed: ${error.message}` };
            }
        }
    },

    // ─────────── SECURE PASSWORD / TOKEN GENERATOR ───────────
    password_generate: {
        name: 'password_generate',
        description: 'Generate a cryptographically secure random password, API token or secret key.',
        descriptionHi: 'सुरक्षित पासवर्ड बनाएं',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            length: { type: 'number', required: false, description: 'Length of the password (default 20, max 128)' },
            symbols: { type: 'boolean', required: false, description: 'Include symbols (default true)' }
        },
        execute: async (args, userContext) => {
            try {
                const crypto = require('crypto');
                const length = Math.min(Math.max(parseInt(args.length) || 20, 8), 128);
                const useSymbols = args.symbols !== false && args.symbols !== 'false';
                const lower = 'abcdefghijklmnopqrstuvwxyz';
                const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const digits = '0123456789';
                const symbols = '!@#$%^&*()-_=+[]{}<>?';
                const charset = lower + upper + digits + (useSymbols ? symbols : '');

                const bytes = crypto.randomBytes(length);
                let pwd = '';
                for (let i = 0; i < length; i++) pwd += charset[bytes[i] % charset.length];

                return {
                    success: true,
                    result: `🔐 **Secure ${length}-char password generated:**\n\n\`${pwd}\`\n\n_Generated with crypto.randomBytes — never stored, never logged._`
                };
            } catch (error) {
                return { success: false, result: `❌ Password generation failed: ${error.message}` };
            }
        }
    },

    // ─────────── QR CODE GENERATOR (great for UPI links) ───────────
    qr_generate: {
        name: 'qr_generate',
        description: 'Generate a QR code image URL for any text, link or UPI payment string. Returns a ready-to-share PNG link.',
        descriptionHi: 'QR कोड बनाएं',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            data: { type: 'string', required: true, description: 'Text/URL/UPI string to encode' },
            size: { type: 'number', required: false, description: 'Image size in px (default 300)' }
        },
        execute: async (args) => {
            const data = args.data || args.text || args.url;
            if (!data) return { success: false, result: '❌ Provide data to encode.' };
            const size = Math.min(Math.max(parseInt(args.size) || 300, 100), 1000);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
            return {
                success: true,
                result: `📱 **QR Code generated!**\n\nEncodes: \`${data}\`\n\n🔗 Image: ${qrUrl}\n\n_Open the link to view/download the QR._`
            };
        }
    },

    // ─────────── CURRENCY CONVERTER (free, no key) ───────────
    currency_convert: {
        name: 'currency_convert',
        description: 'Convert an amount between currencies using live exchange rates (e.g. USD to INR).',
        descriptionHi: 'करेंसी कन्वर्ट करें',
        riskLevel: 'low',
        category: 'search',
        parameters: {
            amount: { type: 'number', required: true, description: 'Amount to convert' },
            from: { type: 'string', required: true, description: 'Source currency code (e.g. USD)' },
            to: { type: 'string', required: true, description: 'Target currency code (e.g. INR)' }
        },
        execute: async (args) => {
            try {
                const from = String(args.from || 'USD').toUpperCase();
                const to = String(args.to || 'INR').toUpperCase();
                const amount = Number(args.amount) || 0;
                const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
                const data = await res.json();
                if (data.result !== 'success' || !data.rates?.[to]) {
                    return { success: false, result: `❌ Could not get rate for ${from}→${to}.` };
                }
                const rate = data.rates[to];
                const converted = (amount * rate).toFixed(2);
                return {
                    success: true,
                    result: `💱 **${amount} ${from} = ${converted} ${to}**\n\n📈 Rate: 1 ${from} = ${rate} ${to}\n🕐 As of ${data.time_last_update_utc || 'now'}`
                };
            } catch (error) {
                return { success: false, result: `❌ Currency conversion failed: ${error.message}` };
            }
        }
    },

    // ─────────── CRYPTO PRICE (CoinGecko, free) ───────────
    crypto_price: {
        name: 'crypto_price',
        description: 'Get the current price of a cryptocurrency (e.g. bitcoin, ethereum) in INR/USD.',
        descriptionHi: 'क्रिप्टो कीमत जानें',
        riskLevel: 'low',
        category: 'search',
        parameters: {
            coin: { type: 'string', required: true, description: 'Coin id (e.g. bitcoin, ethereum, dogecoin)' },
            currency: { type: 'string', required: false, description: 'Fiat currency (default inr)' }
        },
        execute: async (args) => {
            try {
                const coin = String(args.coin || 'bitcoin').toLowerCase().replace(/\s+/g, '-');
                const vs = String(args.currency || 'inr').toLowerCase();
                const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true`);
                const data = await res.json();
                if (!data[coin] || data[coin][vs] === undefined) {
                    return { success: false, result: `❌ Coin "${coin}" not found. Use ids like bitcoin, ethereum, solana.` };
                }
                const price = data[coin][vs];
                const change = data[coin][`${vs}_24h_change`];
                const arrow = change >= 0 ? '🟢▲' : '🔴▼';
                return {
                    success: true,
                    result: `🪙 **${coin.toUpperCase()}**\n\n💰 Price: **${price.toLocaleString()} ${vs.toUpperCase()}**\n${arrow} 24h: ${change?.toFixed(2)}%`
                };
            } catch (error) {
                return { success: false, result: `❌ Crypto price failed: ${error.message}` };
            }
        }
    },

    // ─────────── URL SHORTENER (is.gd, free) ───────────
    url_shorten: {
        name: 'url_shorten',
        description: 'Shorten a long URL into a compact shareable link.',
        descriptionHi: 'URL छोटा करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            url: { type: 'string', required: true, description: 'Long URL to shorten' }
        },
        execute: async (args) => {
            try {
                if (!/^https?:\/\//i.test(args.url || '')) {
                    return { success: false, result: '❌ Provide a valid http(s) URL.' };
                }
                const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(args.url)}`);
                const short = (await res.text()).trim();
                if (!short.startsWith('http')) {
                    return { success: false, result: `❌ Shortening failed: ${short}` };
                }
                return { success: true, result: `🔗 **Short URL:** ${short}\n\nOriginal: ${args.url}` };
            } catch (error) {
                return { success: false, result: `❌ URL shorten failed: ${error.message}` };
            }
        }
    },

    // ─────────── IP GEOLOCATION (ip-api, free) ───────────
    ip_geolocate: {
        name: 'ip_geolocate',
        description: 'Look up geolocation, ISP and org details for an IP address (or the host public IP if none given).',
        descriptionHi: 'IP की लोकेशन पता करें',
        riskLevel: 'low',
        category: 'search',
        parameters: {
            ip: { type: 'string', required: false, description: 'IP address (leave empty for this machine\'s public IP)' }
        },
        execute: async (args) => {
            try {
                const ip = (args.ip || '').trim();
                const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
                const d = await res.json();
                if (d.status !== 'success') {
                    return { success: false, result: `❌ Lookup failed: ${d.message || 'unknown'}` };
                }
                return {
                    success: true,
                    result: `🌍 **IP ${d.query}**\n\n📍 ${d.city}, ${d.regionName}, ${d.country}\n🛰️ ISP: ${d.isp}\n🏢 Org: ${d.org || 'N/A'}\n🕐 Timezone: ${d.timezone}\n🗺️ Lat/Lon: ${d.lat}, ${d.lon}`
                };
            } catch (error) {
                return { success: false, result: `❌ IP geolocation failed: ${error.message}` };
            }
        }
    },

    // ─────────── TRANSLATE TEXT (MyMemory, free — great for Hindi) ───────────
    translate_text: {
        name: 'translate_text',
        description: 'Translate text between languages (e.g. English to Hindi). Uses ISO codes like en, hi, ta, bn, mr.',
        descriptionHi: 'टेक्स्ट का अनुवाद करें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            text: { type: 'string', required: true, description: 'Text to translate' },
            to: { type: 'string', required: true, description: 'Target language code (e.g. hi for Hindi)' },
            from: { type: 'string', required: false, description: 'Source language code (default auto/en)' }
        },
        execute: async (args) => {
            try {
                const text = args.text;
                if (!text) return { success: false, result: '❌ Provide text to translate.' };
                const from = (args.from || 'en').toLowerCase();
                const to = (args.to || 'hi').toLowerCase();
                const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
                const data = await res.json();
                const translated = data?.responseData?.translatedText;
                if (!translated) return { success: false, result: '❌ Translation failed.' };
                return {
                    success: true,
                    result: `🌐 **Translation (${from}→${to}):**\n\n${translated}`
                };
            } catch (error) {
                return { success: false, result: `❌ Translation failed: ${error.message}` };
            }
        }
    },

    // ─────────── CLIPBOARD COPY (cross-platform) ───────────
    clipboard_copy: {
        name: 'clipboard_copy',
        description: 'Copy text to the system clipboard. Works on Windows (clip), macOS (pbcopy) and Linux (xclip/xsel/wl-copy).',
        descriptionHi: 'क्लिपबोर्ड पर कॉपी करें',
        riskLevel: 'low',
        category: 'system',
        parameters: {
            text: { type: 'string', required: true, description: 'Text to copy to clipboard' }
        },
        execute: async (args) => {
            const text = args.text ?? '';
            return new Promise((resolve) => {
                let cmd;
                if (platform.isWindows) cmd = 'clip';
                else if (platform.isMac) cmd = 'pbcopy';
                else cmd = 'xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null || wl-copy';

                const { shell } = platform.getShell();
                const child = exec(cmd, { shell, windowsHide: true }, (error) => {
                    if (error) {
                        return resolve({ success: false, result: `❌ Clipboard copy failed (${platform.OS}). On Linux install xclip/xsel/wl-clipboard.` });
                    }
                    resolve({ success: true, result: `📋 Copied ${String(text).length} characters to clipboard.` });
                });
                child.stdin.write(String(text));
                child.stdin.end();
            });
        }
    },

    // ─────────── HASH / CHECKSUM ───────────
    hash_text: {
        name: 'hash_text',
        description: 'Compute a cryptographic hash (md5, sha1, sha256, sha512) of a text string.',
        descriptionHi: 'टेक्स्ट का हैश निकालें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            text: { type: 'string', required: true, description: 'Text to hash' },
            algorithm: { type: 'string', required: false, description: 'md5 | sha1 | sha256 (default) | sha512' }
        },
        execute: async (args) => {
            try {
                const crypto = require('crypto');
                const algo = (args.algorithm || 'sha256').toLowerCase();
                const allowed = ['md5', 'sha1', 'sha256', 'sha512'];
                if (!allowed.includes(algo)) {
                    return { success: false, result: `❌ Algorithm must be one of: ${allowed.join(', ')}` };
                }
                const digest = crypto.createHash(algo).update(String(args.text ?? '')).digest('hex');
                return { success: true, result: `🔑 **${algo.toUpperCase()}**\n\n\`${digest}\`` };
            } catch (error) {
                return { success: false, result: `❌ Hashing failed: ${error.message}` };
            }
        }
    },

    // ─────────── BASE64 ENCODE / DECODE ───────────
    base64_tool: {
        name: 'base64_tool',
        description: 'Encode text to Base64 or decode Base64 back to text.',
        descriptionHi: 'Base64 एनकोड/डिकोड',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            text: { type: 'string', required: true, description: 'Input text or base64 string' },
            mode: { type: 'string', required: false, description: 'encode (default) | decode' }
        },
        execute: async (args) => {
            try {
                const mode = (args.mode || 'encode').toLowerCase();
                const input = String(args.text ?? '');
                if (mode === 'decode') {
                    const out = Buffer.from(input, 'base64').toString('utf-8');
                    return { success: true, result: `🔓 **Decoded:**\n\n${out}` };
                }
                const out = Buffer.from(input, 'utf-8').toString('base64');
                return { success: true, result: `🔒 **Base64:**\n\n\`${out}\`` };
            } catch (error) {
                return { success: false, result: `❌ Base64 ${args.mode || 'encode'} failed: ${error.message}` };
            }
        }
    },

    // ─────────── WORLD CLOCK / TIMEZONE ───────────
    timezone_now: {
        name: 'timezone_now',
        description: 'Get the current date and time in any timezone (e.g. Asia/Kolkata, America/New_York, UTC).',
        descriptionHi: 'किसी टाइमज़ोन का समय जानें',
        riskLevel: 'low',
        category: 'tool',
        parameters: {
            timezone: { type: 'string', required: false, description: 'IANA timezone (default Asia/Kolkata)' }
        },
        execute: async (args) => {
            try {
                const tz = args.timezone || 'Asia/Kolkata';
                const now = new Date().toLocaleString('en-US', {
                    timeZone: tz, dateStyle: 'full', timeStyle: 'long'
                });
                return { success: true, result: `🕐 **${tz}**\n\n${now}` };
            } catch (error) {
                return { success: false, result: `❌ Invalid timezone "${args.timezone}". Use IANA names like Asia/Kolkata.` };
            }
        }
    }
};

// ────────────────────────────────────────────────────────────
// Tool Registry Class
// ────────────────────────────────────────────────────────────

class ToolRegistry {
    constructor() {
        this.tools = toolDefinitions;
        this.loadPlugins();
    }

    async loadPlugins() {
        try {
            const pluginDir = path.join(BASE_DIR, 'plugins');
            await fs.mkdir(pluginDir, { recursive: true });
            const files = await fs.readdir(pluginDir);
            let loaded = 0;

            for (const file of files) {
                if (file.endsWith('.js')) {
                    const pluginPath = path.join(pluginDir, file);
                    try {
                        const plugin = require(pluginPath);
                        if (plugin && plugin.name && typeof plugin.execute === 'function') {
                            this.registerTool(plugin.name, plugin);
                            loaded++;
                        }
                    } catch (e) {
                        console.error(`Failed to load plugin ${file}:`, e.message);
                    }
                }
            }
            if (loaded > 0) console.log(`🔌 Loaded ${loaded} custom plugins from ${pluginDir}`);
        } catch (e) {
            // Ignore if directory doesn't exist yet
        }
    }

    getAllTools() {
        return Object.values(this.tools);
    }

    getToolsForPack(packName) {
        const pack = TOOL_PACKS[packName];
        if (!pack) return this.getAllTools();
        return pack.tools
            .map(toolName => this.tools[toolName])
            .filter(Boolean);
    }

    getTool(name) {
        return this.tools[name] || null;
    }

    async executeTool(name, args, user) {
        const tool = this.getTool(name);
        if (!tool) {
            return { success: false, result: `Tool "${name}" not found` };
        }

        try {
            const startTime = Date.now();
            const result = await tool.execute(args, user);
            result.executionTime = Date.now() - startTime;
            return result;
        } catch (error) {
            return { success: false, result: `Tool execution error: ${error.message}` };
        }
    }

    registerTool(name, definition) {
        this.tools[name] = definition;
    }
}

module.exports = new ToolRegistry();
