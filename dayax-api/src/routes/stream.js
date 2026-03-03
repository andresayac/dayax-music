import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const router = Router();

// ─── Cache Configuration ───
const CACHE_DIR = join(process.cwd(), 'cache');
const CACHE_TTL = 60 * 60 * 1000;               // 1 hour
const CACHE_MAX_MB = Number(process.env.CACHE_MAX_MB) || 500;
const CLEANUP_INTERVAL = 10 * 60 * 1000;         // every 10 min

// Ensure cache dir exists
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// In-flight downloads: prevents duplicate downloads of the same video
const inFlight = new Map(); // videoId -> Promise<CacheEntry>

// ─── Shared: resolve best audio format with client fallback ───
async function resolveAudioFormat(videoId) {
    const yt = await getInnertube();
    const clients = ['IOS', 'ANDROID', 'WEB'];
    let info, allFormats = [];

    for (const client of clients) {
        console.log(`[stream] Trying client "${client}" for ${videoId}`);
        try {
            info = await yt.getBasicInfo(videoId, { client });
        } catch (err) {
            console.error(`[stream] Client "${client}" threw:`, err.message);
            continue;
        }

        const ps = info.playability_status;
        console.log(`[stream] playability_status: status=${ps?.status}, reason="${ps?.reason || 'none'}"`);

        if (ps?.status === 'LOGIN_REQUIRED' || ps?.status === 'UNPLAYABLE') continue;

        const sd = info.streaming_data;
        if (!sd) continue;

        allFormats = [
            ...(sd.adaptive_formats || []),
            ...(sd.formats || []),
        ].filter(f => (f.url || f.signature_cipher) && f.has_audio);

        if (allFormats.length > 0) break;
    }

    const audioOnly = allFormats
        .filter(f => !f.has_video)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const best = audioOnly[0] || allFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (!best) throw new Error('No audio formats found');

    console.log(`[stream] Selected: mime=${best.mime_type}, bitrate=${best.bitrate}`);
    return { yt, info, best };
}

// ─── File extension from MIME ───
function mimeToExt(mime) {
    if (mime?.includes('webm')) return '.webm';
    if (mime?.includes('mp4')) return '.m4a';
    return '.m4a';
}

function mimeFromExt(ext) {
    if (ext === '.webm') return 'audio/webm';
    return 'audio/mp4';
}

// ─── Find cached file (any extension) ───
function findCachedFile(videoId) {
    for (const ext of ['.m4a', '.webm']) {
        const filePath = join(CACHE_DIR, `${videoId}${ext}`);
        if (existsSync(filePath)) {
            const stat = statSync(filePath);
            // Check if file is expired
            if (Date.now() - stat.mtimeMs > CACHE_TTL) {
                try { unlinkSync(filePath); } catch { }
                return null;
            }
            // Check if file has content (not a partial download)
            if (stat.size === 0) {
                try { unlinkSync(filePath); } catch { }
                return null;
            }
            return { filePath, bytes: stat.size, mime: mimeFromExt(ext) };
        }
    }
    return null;
}

// ─── Download and cache audio file ───
async function ensureCached(videoId) {
    // 1. Check disk cache
    const cached = findCachedFile(videoId);
    if (cached) {
        console.log(`[cache] HIT ${videoId} (${(cached.bytes / 1024 / 1024).toFixed(1)}MB)`);
        return cached;
    }

    // 2. Check if already downloading (coalesce concurrent requests)
    if (inFlight.has(videoId)) {
        console.log(`[cache] WAIT ${videoId} (download in progress)`);
        return inFlight.get(videoId);
    }

    // 3. Download
    const downloadPromise = (async () => {
        console.log(`[cache] MISS ${videoId} — downloading...`);
        const start = performance.now();

        const { yt, info, best } = await resolveAudioFormat(videoId);
        const url = await best.decipher(yt.session.player);
        const ext = mimeToExt(best.mime_type);
        const filePath = join(CACHE_DIR, `${videoId}${ext}`);

        const upstream = await fetch(url);
        if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);

        // Write to disk
        const webStream = upstream.body;
        const nodeStream = Readable.fromWeb(webStream);
        await pipeline(nodeStream, createWriteStream(filePath));

        const stat = statSync(filePath);
        const elapsed = ((performance.now() - start) / 1000).toFixed(1);
        console.log(`[cache] SAVED ${videoId}${ext} (${(stat.size / 1024 / 1024).toFixed(1)}MB in ${elapsed}s)`);

        return {
            filePath,
            bytes: stat.size,
            mime: mimeFromExt(ext),
            title: info.basic_info?.title || videoId,
            duration: best.approx_duration_ms
                ? Math.round(best.approx_duration_ms / 1000)
                : info.basic_info?.duration || 0,
        };
    })();

    inFlight.set(videoId, downloadPromise);
    try {
        return await downloadPromise;
    } finally {
        inFlight.delete(videoId);
    }
}

// ─── Serve file with Range support ───
function serveFile(req, res, entry, download = false) {
    const { filePath, bytes, mime } = entry;

    res.set('Content-Type', mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=3600');

    if (download && entry.title) {
        const ext = extname(filePath);
        const safeName = entry.title.replace(/[<>:"/\\|?*]/g, '_');
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName + ext)}"`);
    }

    const range = req.headers.range;

    if (range) {
        // Parse Range: bytes=START-END
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : bytes - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set('Content-Range', `bytes ${start}-${end}/${bytes}`);
        res.set('Content-Length', String(chunkSize));

        const stream = createReadStream(filePath, { start, end });
        stream.pipe(res);
    } else {
        // Full file
        res.status(200);
        res.set('Content-Length', String(bytes));

        const stream = createReadStream(filePath);
        stream.pipe(res);
    }
}

// ═══════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════

// GET /api/stream/:videoId — serve cached audio with Range support
router.get('/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        if (videoId === 'download') return; // skip, handled below

        const entry = await ensureCached(videoId);
        serveFile(req, res, entry);
    } catch (err) {
        console.error('[stream]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream', message: err.message });
        }
    }
});

// GET /api/stream/download/:videoId — download audio file
router.get('/download/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const entry = await ensureCached(videoId);
        serveFile(req, res, entry, true);
    } catch (err) {
        console.error('[download]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download', message: err.message });
        }
    }
});

// ═══════════════════════════════════════════════
//  CACHE CLEANUP
// ═══════════════════════════════════════════════

function cleanupCache() {
    try {
        const files = readdirSync(CACHE_DIR);
        let totalSize = 0;
        const entries = [];

        for (const file of files) {
            const filePath = join(CACHE_DIR, file);
            try {
                const stat = statSync(filePath);
                entries.push({ filePath, size: stat.size, mtime: stat.mtimeMs });
                totalSize += stat.size;
            } catch { continue; }
        }

        // Remove expired files
        const now = Date.now();
        let removed = 0;
        for (const e of entries) {
            if (now - e.mtime > CACHE_TTL) {
                try { unlinkSync(e.filePath); totalSize -= e.size; removed++; } catch { }
            }
        }

        // If still over max size, remove oldest first
        const maxBytes = CACHE_MAX_MB * 1024 * 1024;
        if (totalSize > maxBytes) {
            const sorted = entries
                .filter(e => existsSync(e.filePath))
                .sort((a, b) => a.mtime - b.mtime);

            for (const e of sorted) {
                if (totalSize <= maxBytes) break;
                try { unlinkSync(e.filePath); totalSize -= e.size; removed++; } catch { }
            }
        }

        if (removed > 0) {
            console.log(`[cache] Cleanup: removed ${removed} files, ${(totalSize / 1024 / 1024).toFixed(0)}MB remaining`);
        }
    } catch (err) {
        console.error('[cache] Cleanup error:', err.message);
    }
}

// Run cleanup on startup and periodically
cleanupCache();
setInterval(cleanupCache, CLEANUP_INTERVAL);

export default router;
