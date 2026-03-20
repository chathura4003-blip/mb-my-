'use strict';

const os = require('os');
const { sendReact, formatPremium } = require('../utils');
const { PREFIX } = require('../../config');
const msgMgr = require('../message-manager');

module.exports = {
    name: 'ping',
    aliases: ['alive', 'system', 'status'],
    description: 'System status and ping',

    async execute(sock, msg, from, args) {
        const cmdText = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || '';
        const cmd = cmdText.trim().toLowerCase().split(/\s+/)[0].slice(1);

        if (cmd === 'ping') {
            await sendReact(sock, from, msg, '🏓');
            const start = Date.now();
            const sent = await sock.sendMessage(from, { text: '🏓 Pinging…' });
            const latency = Date.now() - start;
            
            const pingContent = `🏓 *Pong!*\n⚡ Latency: *${latency}ms*`;
            const premiumPing = formatPremium('System Latency', pingContent);
            
            try {
                await sock.sendMessage(from, { edit: sent.key, text: premiumPing });
            } catch {
                await msgMgr.send(sock, from, { text: premiumPing });
            }
            await sendReact(sock, from, msg, '✅');
            return;
        }

        // alive / system / status
        await sendReact(sock, from, msg, '⚙️');
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);

        const procMem  = (process.memoryUsage().rss / 1048576).toFixed(1);

        const aliveContent =
            `⏱️ *Uptime:* ${h}h ${m}m\n` +
            `🔧 *Process:* ${procMem}MB RSS\n` +
            `🖥️ *OS:* ${os.type()} ${os.arch()}\n` +
            `🤖 *Prefix:* [ ${PREFIX} ]\n\n` +
            `_All systems operational_ ✅`;

        const premiumAlive = formatPremium('System Status', aliveContent);

        await msgMgr.send(sock, from, { text: premiumAlive });
        await sendReact(sock, from, msg, '✅');
    },
};
