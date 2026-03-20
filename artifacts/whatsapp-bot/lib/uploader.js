'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

const SIZE_LIMIT_MEDIA = 40 * 1024 * 1024; // 40 MB

/**
 * Smart Uploader System
 */
const uploader = {
    send: async (sock, jid, filePath, options = {}) => {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const isTooLarge = stats.size > SIZE_LIMIT_MEDIA;

        logger(`[Uploader] Sending ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB) to ${jid}`);

        const msgOptions = {
            caption: options.caption || `Downloaded by Antigravity`,
            footer: 'WhatsApp Bot Upgrade',
            headerType: 1
        };

        try {
            if (options.asDocument || isTooLarge) {
                if (isTooLarge && !options.asDocument) {
                    await sock.sendMessage(jid, { text: `⚠️ File is too large for media sending (${(stats.size/1024/1024).toFixed(1)}MB). Sending as document instead...` });
                }
                
                await sock.sendMessage(jid, {
                    document: { url: filePath },
                    mimetype: options.mimetype || 'application/octet-stream',
                    fileName: fileName
                });
            } else if (options.audioOnly || fileName.endsWith('.mp3') || fileName.endsWith('.m4a')) {
                const mime = fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';
                await sock.sendMessage(jid, {
                    audio: fs.readFileSync(filePath),
                    mimetype: mime,
                    ptt: false
                });
            } else {
                const mime = fileName.endsWith('.webp') ? 'image/webp' : 'video/mp4';
                await sock.sendMessage(jid, {
                    video: fs.readFileSync(filePath),
                    mimetype: mime,
                    caption: msgOptions.caption
                });
            }
            
            logger(`[Uploader] Sent ${fileName} successfully`);
            
            // Auto-cleanup after sending if requested
            if (options.cleanup !== false) {
                // We keep it in cache, but maybe we want to delete it if it's huge?
                // For now, let's keep it in cache until cache cleanup runs.
            }

            return true;
        } catch (err) {
            logger(`[Uploader] Error sending file: ${err.message}`);
            throw err;
        }
    },
    
    notifyProgress: async (sock, jid, text) => {
        try {
            const sent = await sock.sendMessage(jid, { text });
            return sent;
        } catch (err) {
            logger(`[Uploader] Error notifying progress: ${err.message}`);
        }
    },
    
    updateProgress: async (sock, jid, key, text) => {
        try {
            // Baileys message editing support
            await sock.sendMessage(jid, { text, edit: key });
        } catch (err) {
            logger(`[Uploader] Error updating progress: ${err.message}`);
        }
    }
};

module.exports = uploader;
