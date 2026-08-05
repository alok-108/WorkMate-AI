/**
 * Chat Slash-Command Handler  (OpenClaw-style control commands)
 * ------------------------------------------------------------------
 * Lets users control the agent directly from any channel (Web / Telegram
 * / Discord) using `/command` syntax — without spending an LLM call.
 *
 * Supported:
 *   /help                 Show this help
 *   /status               Agent status: provider, model, pack, host OS
 *   /tools  | /skills     List the tools available in the current pack
 *   /pack [name]          Show or switch the active tool pack
 *   /model                Show the active AI provider + model
 *   /whoami               Show the current user + permissions
 *   /clear | /reset | /new  Start a fresh conversation
 *   /memory               Show how many memories are stored
 *   /version              Show SamarthyaBot version
 */

const path = require('path');
const toolRegistry = require('../tools/toolRegistry');
const platform = require('../system/platform');
const { TOOL_PACKS } = require('../../config/constants');

let VERSION = '0.0.0';
try {
    VERSION = require(path.join(__dirname, '../../../package.json')).version;
} catch (_) { /* ignore */ }

function isCommand(message) {
    return typeof message === 'string' && message.trim().startsWith('/');
}

/**
 * Handle a slash command.
 * @returns {{ handled: boolean, response?: string, action?: string }}
 *   `action` is an optional signal the caller can act on (e.g. 'new_conversation').
 */
async function handleCommand(message, user = {}) {
    const raw = message.trim();
    const [cmdToken, ...rest] = raw.slice(1).split(/\s+/);
    const cmd = (cmdToken || '').toLowerCase();
    const arg = rest.join(' ').trim();
    const activePack = user.activePack || 'personal';

    switch (cmd) {
        case 'help':
        case 'commands':
        case 'h':
            return {
                handled: true,
                response:
                    `🤖 **SamarthyaBot Commands**\n\n` +
                    `\`/status\` — agent status (provider, model, OS)\n` +
                    `\`/tools\` — list available skills in your pack\n` +
                    `\`/pack [name]\` — show/switch tool pack (student, business, developer, personal)\n` +
                    `\`/model\` — show active AI model\n` +
                    `\`/whoami\` — your profile & permissions\n` +
                    `\`/memory\` — stored memory count\n` +
                    `\`/new\` (or \`/clear\`, \`/reset\`) — start a fresh chat\n` +
                    `\`/version\` — SamarthyaBot version\n\n` +
                    `_Type any normal message to talk to the AI agent._`
            };

        case 'status':
        case 'stat': {
            const provider = (process.env.ACTIVE_PROVIDER || 'gemini').toUpperCase();
            const model = process.env.ACTIVE_MODEL || process.env.OLLAMA_MODEL || 'gemini-2.5-flash';
            const offline = process.env.USE_OLLAMA === 'true';
            const toolCount = toolRegistry.getToolsForPack(activePack).length;
            return {
                handled: true,
                response:
                    `🟢 **SamarthyaBot is ONLINE**\n\n` +
                    `🧠 Provider: **${provider}**${offline ? ' (offline)' : ''}\n` +
                    `🤖 Model: **${model}**\n` +
                    `🎒 Active Pack: **${activePack}** (${toolCount} skills)\n` +
                    `💻 Host: **${platform.describe()}**\n` +
                    `📦 Version: **v${VERSION}**`
            };
        }

        case 'tools':
        case 'skills': {
            const tools = toolRegistry.getToolsForPack(activePack);
            const list = tools
                .map(t => `• \`${t.name}\` — ${t.description?.split('.')[0] || ''}`)
                .join('\n');
            return {
                handled: true,
                response: `🛠️ **${tools.length} skills available** (pack: ${activePack})\n\n${list}`
            };
        }

        case 'pack': {
            if (!arg) {
                const names = Object.keys(TOOL_PACKS).map(k => `• **${k}** — ${TOOL_PACKS[k].description}`).join('\n');
                return {
                    handled: true,
                    response: `🎒 Active pack: **${activePack}**\n\nAvailable packs:\n${names}\n\n_Switch with_ \`/pack <name>\``
                };
            }
            const target = arg.toLowerCase();
            if (!TOOL_PACKS[target]) {
                return { handled: true, response: `❌ Unknown pack "${target}". Options: ${Object.keys(TOOL_PACKS).join(', ')}` };
            }
            // Persist the switch when the user object is a saveable model.
            try {
                user.activePack = target;
                if (typeof user.save === 'function') await user.save();
            } catch (_) { /* best effort */ }
            return {
                handled: true,
                action: 'switch_pack',
                actionValue: target,
                response: `✅ Switched to **${target}** pack (${TOOL_PACKS[target].tools.length} skills).`
            };
        }

        case 'model': {
            const provider = (process.env.ACTIVE_PROVIDER || 'gemini').toUpperCase();
            const model = process.env.ACTIVE_MODEL || process.env.OLLAMA_MODEL || 'gemini-2.5-flash';
            return {
                handled: true,
                response: `🤖 Active model: **${model}** via **${provider}**\n\n_Change it from the CLI:_ \`samarthya model\``
            };
        }

        case 'whoami': {
            const name = user.name || user.username || 'User';
            const perms = user.permissions ? JSON.stringify(user.permissions) : 'defaults';
            return {
                handled: true,
                response: `👤 **${name}**\n🎒 Pack: ${activePack}\n🗣️ Language: ${user.language || 'auto'}\n🔐 Permissions: ${perms}`
            };
        }

        case 'memory':
        case 'mem': {
            let count = 'unknown';
            try {
                const Memory = require('../../models/Memory');
                count = await Memory.countDocuments({ userId: user._id || user.id });
            } catch (_) { /* ignore */ }
            return { handled: true, response: `🧠 You have **${count}** stored memories.` };
        }

        case 'new':
        case 'clear':
        case 'reset':
            return {
                handled: true,
                action: 'new_conversation',
                response: `🆕 Started a fresh conversation. Previous context cleared.`
            };

        case 'version':
        case 'v':
            return { handled: true, response: `📦 SamarthyaBot **v${VERSION}** — Made in India 🇮🇳` };

        default:
            return {
                handled: true,
                response: `❓ Unknown command \`/${cmd}\`. Type \`/help\` to see all commands.`
            };
    }
}

module.exports = { isCommand, handleCommand };
