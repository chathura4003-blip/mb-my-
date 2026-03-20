'use strict';

const { detectLinks } = require('../url-detector');
const uploader = require('../uploader');
const cache = require('../cache');
const { logger } = require('../../logger');
const { showQualityMenu } = require('../handler');
const { getMetadata } = require('../download-manager');

/**
 * Auto-Download Event Handler
 */
async function handleAutoDL(sock, msg, from, text) {
    const link = detectLinks(text);
    if (!link) return false;

    logger(`[Auto-DL] Detected ${link.platform} link: ${link.url}`);

    // Check cache first
    const cachedFile = cache.get(link.url);
    if (cachedFile) {
        await uploader.notifyProgress(sock, from, `[${link.platform}] Cache Hit! Sending... 📤`);
        await uploader.send(sock, from, cachedFile, {
            caption: `*${link.platform} (Cached)*\n\nURL: ${link.url}`
        });
        return true;
    }

    // Optional: Send buttons instead of auto-downloading everything
    // This addresses the "Buttons" requirement.
    try {
        const meta = await getMetadata(link.url);
        if (meta) {
            await showQualityMenu(sock, from, meta, msg.key.participant || msg.key.remoteJid);
            return true;
        }
    } catch (err) {
        logger(`[Auto-DL] Metadata error: ${err.message}`);
    }

    // Fallback if metadata fails or we want true "Auto"
    try {
        // Use the advanced download manager (handles fallbacks, progress bars, and compression)
        const success = await require('../download-manager').downloadAndSend(sock, from, link.url, link.platform, '720', false);
        return success;
    } catch (err) {
        logger(`[Auto-DL] Error: ${err.message}`);
        return false;
    }
}

module.exports = { handleAutoDL };
