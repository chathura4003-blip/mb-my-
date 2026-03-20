'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const { DOWNLOAD_DIR } = require('../config');

const CACHE_DIR = DOWNLOAD_DIR;
const CACHE_FILE = path.join(CACHE_DIR, 'cache-metadata.json');

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let cacheMetadata = {};

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            cacheMetadata = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (e) {
            logger(`[Cache] Error loading cache: ${e.message}`);
            cacheMetadata = {};
        }
    }
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheMetadata, null, 2));
    } catch (e) {
        logger(`[Cache] Error saving cache: ${e.message}`);
    }
}

loadCache();

const cache = {
    get: (url, quality = 'sd', audioOnly = false) => {
        const key = `${url}|${quality}|${audioOnly}`;
        const entry = cacheMetadata[key];
        if (entry && fs.existsSync(entry.path)) {
            logger(`[Cache] Hit for ${key}`);
            return entry.path;
        }
        return null;
    },
    set: (url, filePath, quality = 'sd', audioOnly = false) => {
        const key = `${url}|${quality}|${audioOnly}`;
        cacheMetadata[key] = {
            path: filePath,
            timestamp: Date.now()
        };
        saveCache();
        logger(`[Cache] Stored ${key}`);
    },
    cleanup: () => {
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
        const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
        let count = 0;
        
        // Age-based cleanup
        for (const [key, entry] of Object.entries(cacheMetadata)) {
            if (now - entry.timestamp > MAX_AGE) {
                if (fs.existsSync(entry.path)) {
                    fs.unlinkSync(entry.path);
                }
                delete cacheMetadata[key];
                count++;
            }
        }

        // Size-based cleanup (if still too large)
        let totalSize = 0;
        const entries = Object.entries(cacheMetadata).map(([key, entry]) => {
            try {
                const size = fs.existsSync(entry.path) ? fs.statSync(entry.path).size : 0;
                totalSize += size;
                return { key, ...entry, size };
            } catch { return { key, ...entry, size: 0 }; }
        });

        if (totalSize > MAX_SIZE) {
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a.timestamp - b.timestamp);
            for (const entry of entries) {
                if (totalSize <= MAX_SIZE * 0.8) break; // Keep 20% buffer
                if (fs.existsSync(entry.path)) {
                    fs.unlinkSync(entry.path);
                }
                delete cacheMetadata[entry.key];
                totalSize -= entry.size;
                count++;
            }
        }
        
        if (count > 0) {
            saveCache();
            logger(`[Cache] Cleaned up ${count} entries (Age/Size overflow)`);
        }
    },
    clear: () => {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file !== 'cache-metadata.json') {
                fs.unlinkSync(path.join(CACHE_DIR, file));
            }
        }
        cacheMetadata = {};
        saveCache();
        logger(`[Cache] All files cleared`);
    }
};

module.exports = cache;
