'use strict';

const { OWNER_NUMBER } = require('../config');
const msgMgr = require('./message-manager');
const { safeExecute } = require('./error-handler');

async function sendReact(sock, from, msg, emoji) {
    if (!sock || !from || !msg?.key || !emoji) return;
    await msgMgr.react(sock, from, msg.key, emoji);
}

async function presenceUpdate(sock, from, type = 'composing') {
    if (!sock || !from) return;
    await safeExecute(() => sock.sendPresenceUpdate(type, from), 'PresenceUpdate');
}

const db = require('./db');

function isOwner(sender) {
    if (!sender) return false;
    if (sender.replace(/\D/g, '') === OWNER_NUMBER.replace(/\D/g, '')) return true;
    const modEntry = db.get('mods', sender);
    return !!modEntry?.mod;
}

async function isGroupAdmin(sock, from, sender) {
    if (!sock || !from || !sender) return false;
    if (!from.endsWith('@g.us')) return false;
    try {
        const meta = await sock.groupMetadata(from);
        const p = meta?.participants?.find(x => x.id === sender);
        return p?.admin === 'admin' || p?.admin === 'superadmin';
    } catch { return false; }
}

/**
 * Truncate string to max characters.
 */
function truncate(str, max = 50) {
    if (!str || typeof str !== 'string') return 'Unknown';
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/**
 * Formats a message with a premium aesthetic.
 */
function formatPremium(title, content) {
    const top = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
    const mid = `┃  ✨  *${title?.toUpperCase()}*  ✨\n`;
    const sep = `┣━━━━━━━━━━━━━━━━━━━━━━━━┛\n`;
    const bot = `┃ 🚀 _Powered by Supreme MD_`;
    
    return `${top}${mid}${sep}\n${content}\n\n${bot}`;
}

module.exports = { 
    sendReact, 
    presenceUpdate, 
    isOwner, 
    isGroupAdmin, 
    truncate,
    formatPremium 
};
