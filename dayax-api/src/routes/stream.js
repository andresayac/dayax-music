import { Router } from 'express';
import { getInnertube } from '../innertube.js';

const router = Router();


const PARALLEL_CHUNKS = 8;                          // concurrent Range requests to YouTube
const MEM_CACHE_MAX_MB = Number(process.env.CACHE_MAX_MB) || 150;  // in-memory LRU cache
const MEM_CACHE_TTL = 10 * 60 * 1000;              // 10 min TTL


const memCache = new Map(); // videoId -> { buffer, mime, size, title, duration, ts }
let memCacheSize = 0;

function getCached(videoId) {
    const entry = memCache.get(videoId);
    if (!entry) return null;
    if (Date.now() - entry.ts > MEM_CACHE_TTL) {
        evict(videoId);
        return null;
    }
    // Move to end (LRU refresh)
    memCache.delete(videoId);
    memCache.set(videoId, entry);
    return entry;
}

function putCache(videoId, entry) {
    if (memCache.has(videoId)) evict(videoId);
    const maxBytes = MEM_CACHE_MAX_MB * 1024 * 1024;
    while (memCacheSize + entry.size > maxBytes && memCache.size > 0) {
        const oldest = memCache.keys().next().value;
        evict(oldest);
    }
    memCache.set(videoId, entry);
    memCacheSize += entry.size;
    console.log(`[mem] Cached ${videoId} (${(entry.size / 1024 / 1024).toFixed(1)}MB, total=${(memCacheSize / 1024 / 1024).toFixed(0)}MB, entries=${memCache.size})`);
}

function evict(videoId) {
    const entry = memCache.get(videoId);
    if (entry) {
        memCacheSize -= entry.size;
        memCache.delete(videoId);
    }
}

const inFlight = new Map();

async function resolveAudioFormat(videoId) {
    const yt = await getInnertube();
    // TV and YTMUSIC bypass YouTube CDN datacenter IP blocking
    const clients = ['TV', 'YTMUSIC', 'IOS', 'ANDROID', 'WEB'];
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
        if (ps?.status === 'LOGIN_REQUIRED' || ps?.status === 'UNPLAYABLE') {
            console.log(`[stream] ${ps.status}: ${ps.reason || 'no reason'}`);
            continue;
        }

        const sd = info.streaming_data;
        if (!sd) continue;

        allFormats = [
            ...(sd.adaptive_formats || []),
            ...(sd.formats || []),
        ].filter(f => (f.url || f.signature_cipher) && f.has_audio);

        if (allFormats.length > 0) {
            console.log(`[stream] OK with client "${client}" — ${allFormats.length} audio formats`);
            break;
        }
    }

    const audioOnly = allFormats
        .filter(f => !f.has_video)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const best = audioOnly[0] || allFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    if (!best) throw new Error('No audio formats found');

    console.log(`[stream] Selected: ${best.mime_type}, ${best.bitrate}bps, ${best.content_length || '?'} bytes`);
    return { yt, info, best };
}

async function downloadParallel(url, totalSize) {
    const chunkSize = Math.ceil(totalSize / PARALLEL_CHUNKS);
    const chunks = new Array(PARALLEL_CHUNKS);

    await Promise.all(
        Array.from({ length: PARALLEL_CHUNKS }, (_, i) => {
            const from = i * chunkSize;
            const to = Math.min(from + chunkSize - 1, totalSize - 1);
            return fetch(url, { headers: { Range: `bytes=${from}-${to}` } })
                .then(async (res) => {
                    if (!res.ok && res.status !== 206) throw new Error(`Chunk ${i}: ${res.status}`);
                    chunks[i] = Buffer.from(await res.arrayBuffer());
                });
        })
    );

    return Buffer.concat(chunks);
}

// ─── Sequential fallback ───
async function downloadSequential(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

// ─── Get audio buffer (from mem cache or download) ───
async function getAudioBuffer(videoId) {
    // 1. Memory cache
    const cached = getCached(videoId);
    if (cached) {
        console.log(`[mem] HIT ${videoId} (${(cached.size / 1024 / 1024).toFixed(1)}MB)`);
        return cached;
    }

    // 2. Coalesce concurrent requests
    if (inFlight.has(videoId)) {
        console.log(`[stream] WAIT ${videoId} (in-flight)`);
        return inFlight.get(videoId);
    }

    // 3. Download
    const promise = (async () => {
        const start = performance.now();

        const { yt, info, best } = await resolveAudioFormat(videoId);
        const url = await best.decipher(yt.session.player);
        const totalSize = Number(best.content_length);

        let buffer;
        if (totalSize > 0) {
            console.log(`[stream] Parallel: ${PARALLEL_CHUNKS} chunks, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
            buffer = await downloadParallel(url, totalSize);
        } else {
            buffer = await downloadSequential(url);
        }

        const mime = best.mime_type?.includes('webm') ? 'audio/webm' : 'audio/mp4';
        const elapsed = ((performance.now() - start) / 1000).toFixed(2);
        console.log(`[stream] Downloaded ${videoId} (${(buffer.length / 1024 / 1024).toFixed(1)}MB in ${elapsed}s)`);

        const entry = {
            buffer,
            mime,
            size: buffer.length,
            title: info.basic_info?.title || videoId,
            duration: best.approx_duration_ms
                ? Math.round(best.approx_duration_ms / 1000)
                : info.basic_info?.duration || 0,
            ts: Date.now(),
        };

        putCache(videoId, entry);
        return entry;
    })();

    inFlight.set(videoId, promise);
    try {
        return await promise;
    } finally {
        inFlight.delete(videoId);
    }
}

// ─── Serve buffer with Range support ───
function serveBuffer(req, res, entry, download = false) {
    const { buffer, mime, size, title } = entry;

    res.set('Content-Type', mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=3600');

    if (download && title) {
        const ext = mime.includes('webm') ? '.webm' : '.m4a';
        const safeName = title.replace(/[<>:"/\\|?*]/g, '_');
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName + ext)}"`);
    }

    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set('Content-Range', `bytes ${start}-${end}/${size}`);
        res.set('Content-Length', String(chunkSize));
        res.end(buffer.subarray(start, end + 1));
    } else {
        res.status(200);
        res.set('Content-Length', String(size));
        res.end(buffer);
    }
}

// ═══════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════

// GET /api/stream/:videoId — proxy audio stream
router.get('/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        if (videoId === 'download') return;

        const entry = await getAudioBuffer(videoId);
        serveBuffer(req, res, entry);
    } catch (err) {
        console.error('[stream]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream', message: err.message });
        }
    }
});

// GET /api/stream/download/:videoId — download audio
router.get('/download/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const entry = await getAudioBuffer(videoId);
        serveBuffer(req, res, entry, true);
    } catch (err) {
        console.error('[download]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download', message: err.message });
        }
    }
});

export default router;
