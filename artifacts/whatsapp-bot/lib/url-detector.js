'use strict';

const PLATFORMS = {
    YOUTUBE: /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/i,
    TIKTOK: /(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[@a-zA-Z0-9._-]+\/video\/\d+|https?:\/\/vm\.tiktok\.com\/[a-zA-Z0-9]+/i,
    INSTAGRAM: /(https?:\/\/)?(www\.)?instagram\.com\/(p|reels|reel|tv)\/[a-zA-Z0-9._-]+\/?/i,
    FACEBOOK: /(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/([^\s\/?#]+)/i,
    TWITTER: /(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9._-]+\/status\/\d+/i,
    PINTEREST: /(https?:\/\/)?(www\.|pin\.)?pinterest\.com\/pin\/\d+\/?/i,
    PORNHUB:   /(https?:\/\/)?(www\.)?pornhub\.com\/view_video\.php\?viewkey=[\w\d]+/i,
    XNXX:      /(https?:\/\/)?(www\.)?xnxx\.com\/video-[\w\d]+/i,
    XVIDEOS:   /(https?:\/\/)?(www\.)?xvideos\.com\/video[\d]+/i
};

/**
 * Detects and extracts a clean URL from text.
 */
function detectLinks(text) {
    if (!text) return null;
    
    for (const [platform, regex] of Object.entries(PLATFORMS)) {
        const match = text.match(regex);
        if (match) {
            // Clean the URL (remove trailing punctuation that text.match often grabs)
            let url = match[0].replace(/[.,!?]$/, '');
            return { platform, url };
        }
    }
    
    return null;
}

module.exports = { detectLinks, PLATFORMS };
