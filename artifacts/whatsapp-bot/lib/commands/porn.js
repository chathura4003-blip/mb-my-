'use strict';

const { sendReact } = require('../utils');
const msgMgr = require('../message-manager');
const db = require('../db');
const { downloadSmartVideo } = require('../download-manager');

function isNsfwEnabled(from) {
    const g = db.get('groups', from) || {};
    return !!g.nsfw;
}

module.exports = {
    name: 'porn',
    aliases: ['xvideo', 'phub', 'nsfwvideo'],
    description: 'Download adult videos (groups only, must be enabled by admin)',

    async execute(sock, msg, from, args) {
        if (!from.endsWith('@g.us')) {
            return msgMgr.sendTemp(sock, from, '🔞 NSFW video download is only available in groups.', 5000);
        }

        if (!isNsfwEnabled(from)) {
            return msgMgr.sendTemp(sock, from, '🔞 NSFW is not enabled in this group.\nAsk an admin: `.nsfw on`', 6000);
        }

        const url = args[0];
        if (!url || !url.startsWith('http')) {
            return msgMgr.sendTemp(sock, from, '⚠️ A valid video URL is required.\nUsage: `.porn <url>`', 5000);
        }

        await sendReact(sock, from, msg, '🔞');

        try {
            // Using the custom smart video downloader integrated in download-manager
            await downloadSmartVideo(sock, from, url, 'Full HD Video 🔥');
        } catch (err) {
            await msgMgr.sendTemp(sock, from, `❌ Download failed: ${err.message}`, 6000);
            await sendReact(sock, from, msg, '❌');
        }
    },
};
