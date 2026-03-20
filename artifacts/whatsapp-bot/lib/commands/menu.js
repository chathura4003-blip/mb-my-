'use strict';

const path = require('path');
const { BOT_NAME, PREFIX, OWNER_NUMBER } = require('../../config');
const { sendReact } = require('../utils');
const msgMgr = require('../message-manager');

const LOGO = path.join(__dirname, '../../supreme_bot_logo.png');

module.exports = {
    name: 'menu',
    aliases: ['help', 'allmenu', 'commands', 'list', 'start'],
    description: 'Bot command menu',

    async execute(sock, msg, from) {
        await sendReact(sock, from, msg, '📜');

        const os = require('os');
        const { formatPremium } = require('../utils');
        
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);

        // Fetch sys stats
        const mem = process.memoryUsage();
        const rss = (mem.rss / 1024 / 1024).toFixed(1);

        const content = 
            `🛰️ *System Information*\n` +
            `• Uptime: ${h}h ${m}m\n` +
            `• Core Load: ${rss} MB / 512MB\n` +
            `• Platform: ${os.platform()} (${os.arch()})\n\n` +

            `📥 *Media Downloader*\n` +
            `• ${PREFIX}yt  <link/query>\n` +
            `• ${PREFIX}yta <link/query>\n` +
            `• ${PREFIX}tt  <link>\n\n` +

            `🔞 *Adult Section*\n` +
            `• ${PREFIX}ph · ${PREFIX}xnxx · ${PREFIX}xv\n\n` +

            `🔍 *Intelligent Search*\n` +
            `• ${PREFIX}yts   <query>\n` +
            `• ${PREFIX}wiki  <topic>\n\n` +

            `👑 *Administrative*\n` +
            `• ${PREFIX}kick · ${PREFIX}add · ${PREFIX}antilink\n\n` +

            `📊 *Utility*\n` +
            `• ${PREFIX}ping · ${PREFIX}alive · ${PREFIX}menu\n\n` +
            `_Use ${PREFIX}help <command> for details_`;

        const premiumMenu = formatPremium('Supreme MD Menu', content);

        try {
            const { default: fs } = await Promise.resolve().then(() => require('fs'));
            if (fs.existsSync(LOGO)) {
                await sock.sendMessage(from, { image: { url: LOGO }, caption: premiumMenu });
            } else {
                await msgMgr.send(sock, from, { text: premiumMenu });
            }
        } catch {
            await msgMgr.send(sock, from, { text: premiumMenu });
        }

        await sendReact(sock, from, msg, '✅');
    },
};
