'use strict';

/**
 * Upload command - downloads from a direct URL and sends it.
 */

const { downloadAndSend } = require('../download-manager');
const { sendReact, presenceUpdate } = require('../utils');
const { isValidUrl, parseArgs } = require('../validator');
const { handleAPIError } = require('../error-handler');
const msgMgr = require('../message-manager');
const { logger } = require('../../logger');

module.exports = {
    name: 'upload',
    aliases: ['up', 'direct'],
    description: 'Download and upload from a direct URL',

    async execute(sock, msg, from, args) {
        if (!msg?.key || !from) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const { urls, flags } = parseArgs(args);
        const url = urls[0];

        if (!url || !isValidUrl(url)) {
            await sendReact(sock, from, msg, '❓');
            await msgMgr.sendTemp(sock, from, 
                `⚠️ *Usage*\n*.upload <link>* — direct download\n\n_Example: .upload https://example.com/video.mp4_`, 
                8000);
            return;
        }

        const isAudio = flags.audio || flags.mp3;
        const quality = flags.hd ? 'hd' : flags.low ? 'low' : 'sd';

        await sendReact(sock, from, msg, '⏳');
        await presenceUpdate(sock, from, isAudio ? 'recording' : 'composing');

        try {
            await downloadAndSend(sock, from, url, 'Upload', quality, isAudio);
            await sendReact(sock, from, msg, '✅');
        } catch (err) {
            const fe = handleAPIError(err, 'Upload');
            await msgMgr.sendTemp(sock, from, `❌ ${fe.message}`, 5000);
            await sendReact(sock, from, msg, '❌');
            logger(`[Upload] Error: ${err.message}`);
        }
    },
};
