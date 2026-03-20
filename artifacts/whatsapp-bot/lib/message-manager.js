'use strict';

const { logger } = require('../logger');

/**
 * Manages message sending with auto-delete for temporary messages.
 * Keeps conversations clean by removing status/error messages after a delay.
 */
class MessageManager {
    constructor() {
        this.pending = new Map(); // jid → { key, timer }
    }

    /**
     * Send a message that auto-deletes after `ms` milliseconds.
     * Retries if "No sessions" error occurs (common during initial sync).
     */
    async sendTemp(sock, jid, text, ms = 6000, attempt = 1) {
        if (!sock || !jid || !text) return null;
        try {
            const sent = await sock.sendMessage(jid, { text });
            if (!sent?.key) return sent;

            this._cancelPending(jid);

            const timer = setTimeout(async () => {
                this.pending.delete(jid);
                try { await sock.sendMessage(jid, { delete: sent.key }); } catch {}
            }, ms);
            timer.unref();

            this.pending.set(jid, { key: sent.key, timer });
            return sent;
        } catch (err) {
            if (err.message?.includes('No sessions') && attempt <= 3) {
                logger(`[MsgMgr] "No sessions" for ${jid} — forcing metadata sync (Attempt ${attempt}/3)...`);
                if (jid.endsWith('@g.us')) {
                    try { await sock.groupMetadata(jid); } catch {}
                }
                await new Promise(r => setTimeout(r, 2000));
                return this.sendTemp(sock, jid, text, ms, attempt + 1);
            }
            logger(`[MsgMgr] sendTemp: ${err.message}`);
            return null;
        }
    }

    /**
     * Send a permanent message (no auto-delete).
     * Retries if "No sessions" error occurs.
     */
    async send(sock, jid, content, attempt = 1) {
        if (!sock || !jid || !content) return null;
        try {
            return await sock.sendMessage(jid, content);
        } catch (err) {
            if (err.message?.includes('No sessions') && attempt <= 3) {
                logger(`[MsgMgr] "No sessions" for ${jid} — forcing metadata sync (Attempt ${attempt}/3)...`);
                if (jid.endsWith('@g.us')) {
                    try { await sock.groupMetadata(jid); } catch {}
                }
                await new Promise(r => setTimeout(r, 2000));
                return this.send(sock, jid, content, attempt + 1);
            }
            // 403 = permission denied (group admin-only, or bot removed) — suppress noise
            if (!err.message?.includes('403')) {
                logger(`[MsgMgr] send: ${err.message}`);
            }
            return null;
        }
    }

    /**
     * React to a message with an emoji.
     */
    async react(sock, jid, msgKey, emoji) {
        if (!sock || !jid || !msgKey || !emoji) return;
        try {
            await sock.sendMessage(jid, { react: { text: emoji, key: msgKey } });
        } catch {}
    }

    /**
     * Delete a message by key.
     */
    async delete(sock, jid, msgKey) {
        if (!sock || !jid || !msgKey) return false;
        try {
            await sock.sendMessage(jid, { delete: msgKey });
            return true;
        } catch { return false; }
    }

    _cancelPending(jid) {
        const rec = this.pending.get(jid);
        if (rec?.timer) clearTimeout(rec.timer);
        this.pending.delete(jid);
    }

    cleanup() {
        for (const { timer } of this.pending.values()) {
            if (timer) clearTimeout(timer);
        }
        this.pending.clear();
    }
}

module.exports = new MessageManager();
