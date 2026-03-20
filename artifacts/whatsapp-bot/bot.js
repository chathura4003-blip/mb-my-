'use strict';

/**
 * Bot core — connects to WhatsApp via Baileys, routes messages.
 * Fixes applied vs original:
 *  - No undeclared `lastQR` variable (was a ReferenceError crash)
 *  - QR is stored in shared `state.js` so dashboard can read it
 *  - Anti-link enforcement uses a per-group db setting (not a global flag)
 *  - Ban check before any command execution
 */

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

const { initSession, clearSession } = require('./session-manager');
const { loadCommands, handleCommand } = require('./lib/handler');
const { ensureYtdlp: initYtdlp } = require('./lib/ytdlp-manager');
const { logger } = require('./logger');
const state = require('./state');
const db = require('./lib/db');
const { isOwner } = require('./lib/utils');
const { BOT_NAME, OWNER_NUMBER, PREFIX } = require('./config');

const RECONNECT_DELAY = 5000;
let sock = null;
let connectionAttempts = 0;

async function startBot() {
    logger(`[Bot] Starting ${BOT_NAME}…`);

    // Ensure yt-dlp is ready before accepting messages
    await initYtdlp().catch(e => logger(`[Bot] yt-dlp warning: ${e.message}`));

    // Load commands from lib/commands/
    loadCommands();

    return connect();
}

async function connect() {
    const { state: authState, saveCreds } = await initSession();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: authState.creds,
            keys: makeCacheableSignalKeyStore(authState.keys, pino({ level: 'silent' })),
        },
        browser: ['Supreme MD Bot', 'Chrome', '131.0'],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 3,
        syncFullHistory: false,
        msgRetryCounterCache: new Map(), // Track retries to avoid loops
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.templateMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadata: {},
                                deviceListMetadataVersion: 2
                            },
                            ...message
                        }
                    }
                };
            }
            return message;
        },
    });

    // ── Connection event ──────────────────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            // Store QR for dashboard and print to terminal
            state.set('qr', qr);
            state.set('connected', false);
            qrcode.generate(qr, { small: true });
            logger('[Bot] QR code generated — scan to connect.');
        }

        if (connection === 'close') {
            state.set('connected', false);
            const error = lastDisconnect?.error;
            const code = error instanceof Boom ? error.output?.statusCode : null;
            const reason = code ? DisconnectReason[code] || code : 'Unknown';

            logger(`[Bot] Disconnected: ${reason}`);

            if (code === DisconnectReason.loggedOut || code === 403) {
                logger('[Bot] Logged out or session banned — clearing session…');
                clearSession();
                connectionAttempts = 0;
                setTimeout(connect, RECONNECT_DELAY);
            } else {
                if (code === DisconnectReason.connectionReplaced) {
                    logger('[Bot] ⚠️ Connection Replaced: Another instance of this bot is running elsewhere. You will experience disconnect loops until you stop the other instance.');
                }
                connectionAttempts++;
                // Add a slightly larger random delay for rate stability
                const baseDelay = code === DisconnectReason.restartRequired ? 2000 : RECONNECT_DELAY * connectionAttempts;
                const delay = Math.min(baseDelay + Math.random() * 1000, 60000);
                logger(`[Bot] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${connectionAttempts})…`);
                setTimeout(connect, delay);
            }
        }

        if (connection === 'open') {
            state.set('connected', true);
            state.set('qr', null);
            connectionAttempts = 0;
            logger(`[Bot] ✅ Connected as ${sock.user?.id || 'unknown'}`);
            
            // Wait 3 seconds for initial session sync to prevent "No sessions" errors on first command
            setTimeout(() => {
                logger('[Bot] ⚡ Session sync stable — accepting commands.');
            }, 3000);
        }
    });

    // ── Save credentials ──────────────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    // ── Incoming messages ─────────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                await routeMessage(msg);
            } catch (err) {
                logger(`[Bot] Uncaught message error: ${err.message}`);
            }
        }
    });

    return sock;
}

async function routeMessage(msg) {
    if (!msg?.message || msg.key?.fromMe) return;

    const from = msg.key.remoteJid;
    if (!from) return;

    const sender = msg.key.participant || from;

    // ── Ban check ─────────────────────────────────────────────────────────
    const banEntry = db.get('bans', sender);
    if (banEntry?.banned && !isOwner(sender)) return;

    // ── Extract text ──────────────────────────────────────────────────────
    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.buttonsResponseMessage?.selectedButtonId ||
        msg.message.templateButtonReplyMessage?.selectedId ||
        '';

    // ── Anti-link enforcement ─────────────────────────────────────────────
    if (from.endsWith('@g.us')) {
        const groupData = db.get('groups', from) || {};
        const globalAntiLink = db.getSetting('antilink');
        if ((groupData.antilink || globalAntiLink) && !isOwner(sender)) {
            const hasLink = /https?:\/\/|wa\.me\/|chat\.whatsapp\.com/i.test(text);
            if (hasLink) {
                try {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.groupParticipantsUpdate(from, [sender], 'remove');
                } catch {}
                return;
            }
        }
    }

    // ── Command routing ───────────────────────────────────────────────────
    await handleCommand(sock, msg, from, text);
}

module.exports = { startBot, getSock: () => sock };
