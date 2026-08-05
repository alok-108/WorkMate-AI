const Conversation = require('../models/Conversation');
const User = require('../models/User');
const plannerService = require('../services/planner/plannerService');
const securityService = require('../services/security/securityService');

/**
 * Handle a message arriving from an external channel (Discord, etc.).
 * Resolves/creates a per-channel user, routes through the agentic planner
 * (so slash-commands like /help, /status, /new all work), and persists the
 * conversation. Returns the assistant's text reply.
 */
exports.handleExternalMessage = async (message, externalUserId, channel = 'external') => {
    try {
        if (!message || !message.trim()) return '🤔 Empty message.';

        const email = `${channel}_${externalUserId}@samarthya.local`;
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                name: `${channel} user`,
                email,
                password: `${channel}_user`,
                language: 'hinglish',
                workType: 'personal',
                activePack: 'personal',
                source: channel
            });
        }

        // Most recent active conversation for this channel (last 24h)
        let conversation = await Conversation.findOne({
            userId: user._id,
            source: channel,
            isActive: { $ne: false },
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ updatedAt: -1 });

        const previousMessages = conversation?.messages?.slice(-6)?.map(m => ({
            role: m.role, content: m.content
        })) || [];

        const result = await plannerService.processMessage(user, previousMessages, message);

        // Honour a /new (reset) slash-command: deactivate the old thread so the
        // next message starts a fresh conversation.
        if (result.command?.action === 'new_conversation') {
            if (conversation) { conversation.isActive = false; await conversation.save(); }
            return result.response;
        }

        if (!conversation) {
            conversation = new Conversation({ userId: user._id, title: message.substring(0, 40), source: channel, messages: [] });
        }
        conversation.messages.push({ role: 'user', content: message });
        conversation.messages.push({
            role: 'assistant',
            content: result.response,
            toolCalls: result.toolCalls,
            language: result.language,
            metadata: { tokensUsed: result.tokensUsed, model: result.model }
        });
        await conversation.save();

        return result.response;
    } catch (error) {
        console.error(`External message (${channel}) error:`, error.message);
        return '❌ Kuch error aa gaya processing mein. Please try again.';
    }
};

// Send message and get AI response
exports.sendMessage = async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        const userId = req.user.id;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Get or create conversation
        let conversation;
        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId });
            if (!conversation) {
                return res.status(404).json({ success: false, message: 'Conversation not found' });
            }
        } else {
            conversation = await Conversation.create({
                userId,
                title: message.substring(0, 60) + (message.length > 60 ? '...' : ''),
                messages: [],
                context: {
                    activePack: user.activePack,
                    language: user.language
                }
            });
        }

        // Add user message
        conversation.messages.push({
            role: 'user',
            content: message,
            language: user.language
        });

        // Process through planner
        const conversationHistory = conversation.messages.slice(-20).map(m => ({
            role: m.role,
            content: m.content
        }));

        const result = await plannerService.processMessage(user, conversationHistory, message);

        // Add assistant response
        conversation.messages.push({
            role: 'assistant',
            content: result.response,
            language: result.language,
            toolCalls: result.toolCalls,
            metadata: {
                tokensUsed: result.tokensUsed,
                model: result.model,
                sensitiveDataDetected: result.sensitiveDataWarnings.map(w => w.type)
            }
        });

        // Honour a /new (reset) slash-command on the web channel: deactivate the
        // current conversation so the UI knows to open a fresh one.
        if (result.command?.action === 'new_conversation') {
            conversation.isActive = false;
        }

        await conversation.save();

        // Emit via socket if available
        if (req.io) {
            req.io.to(userId).emit('message', {
                conversationId: conversation._id,
                message: {
                    role: 'assistant',
                    content: result.response,
                    toolCalls: result.toolCalls,
                    sensitiveDataWarnings: result.sensitiveDataWarnings,
                    timestamp: new Date()
                }
            });
        }

        res.json({
            success: true,
            conversationId: conversation._id,
            command: result.command || null,
            message: {
                role: 'assistant',
                content: result.response,
                toolCalls: result.toolCalls,
                sensitiveDataWarnings: result.sensitiveDataWarnings,
                tokensUsed: result.tokensUsed,
                model: result.model,
                language: result.language
            }
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all conversations
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ isActive: true })
            .select('title context isPinned createdAt updatedAt')
            .sort({ isPinned: -1, updatedAt: -1 })
            .limit(50);

        res.json({ success: true, conversations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single conversation with messages
exports.getConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.id
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        res.json({ success: true, conversation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
    try {
        await Conversation.findOneAndUpdate(
            { _id: req.params.id },
            { isActive: false }
        );
        res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Pin/Unpin conversation
exports.togglePin = async (req, res) => {
    try {
        const conv = await Conversation.findOne({ _id: req.params.id });
        if (!conv) return res.status(404).json({ success: false, message: 'Not found' });

        conv.isPinned = !conv.isPinned;
        await conv.save();

        res.json({ success: true, isPinned: conv.isPinned });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
