import { Router } from 'express';
import { getInnertube } from '../innertube.js';

const router = Router();

// GET /api/stream/download/:videoId — download audio file directly
router.get('/download/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const yt = await getInnertube();

        // Use IOS client (WEB uses SABR and doesn't return traditional URLs)
        const info = await yt.getBasicInfo(videoId, 'IOS');

        const allFormats = [
            ...(info.streaming_data?.adaptive_formats || []),
            ...(info.streaming_data?.formats || []),
        ].filter(f => (f.url || f.signature_cipher) && f.has_audio);

        // Prefer audio-only, sorted by bitrate (highest first)
        const audioOnly = allFormats
            .filter(f => !f.has_video)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        const bestFormat = audioOnly.length > 0
            ? audioOnly[0]
            : allFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        if (!bestFormat) {
            return res.status(404).json({ error: 'No downloadable audio formats found' });
        }

        // Decipher URL
        const url = await bestFormat.decipher(yt.session.player);

        // Determine file extension from mime type
        let ext = 'mp4';
        if (bestFormat.mime_type?.includes('webm')) ext = 'webm';
        else if (bestFormat.mime_type?.includes('mp4')) ext = 'm4a';

        // Build filename from video title
        const title = (info.basic_info?.title || videoId).replace(/[<>:"/\\|?*]/g, '_');
        const filename = `${title}.${ext}`;

        // Fetch the audio from YouTube
        const upstream = await fetch(url);
        if (!upstream.ok) {
            return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
        }

        // Set download headers
        const contentLength = bestFormat.content_length || upstream.headers.get('content-length');
        const mimeType = bestFormat.mime_type || upstream.headers.get('content-type') || 'audio/mp4';

        res.set('Content-Type', mimeType);
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        if (contentLength) res.set('Content-Length', String(contentLength));

        // Pipe the upstream response to the client
        const reader = upstream.body.getReader();
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); return; }
                if (!res.write(value)) {
                    await new Promise(resolve => res.once('drain', resolve));
                }
            }
        };
        await pump();
    } catch (err) {
        console.error('[download]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download', message: err.message });
        }
    }
});

// ─── URL Cache (avoid re-deciphering on every Range/seek request) ───
const urlCache = new Map(); // videoId -> { url, mime, bytes, duration, expires }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getAudioUrl(videoId) {
    const cached = urlCache.get(videoId);
    if (cached && cached.expires > Date.now()) return cached;

    const yt = await getInnertube();

    // Try IOS first, fall back to ANDROID if no formats
    const clients = ['IOS', 'ANDROID', 'WEB'];
    let info, allFormats = [];

    for (const client of clients) {
        console.log(`[stream] Trying client "${client}" for ${videoId}`);
        try {
            info = await yt.getBasicInfo(videoId, client);
        } catch (err) {
            console.error(`[stream] Client "${client}" failed:`, err.message);
            continue;
        }

        const sd = info.streaming_data;
        console.log(`[stream] streaming_data: ${sd ? 'present' : 'null/undefined'}`);

        if (!sd) continue;

        const rawAdaptive = sd.adaptive_formats || [];
        const rawFormats = sd.formats || [];
        console.log(`[stream] Raw formats: adaptive=${rawAdaptive.length}, combined=${rawFormats.length}`);

        // Log first few formats for debugging
        [...rawAdaptive, ...rawFormats].slice(0, 3).forEach((f, i) => {
            console.log(`[stream]   format[${i}]: mime=${f.mime_type}, has_audio=${f.has_audio}, has_video=${f.has_video}, url=${f.url ? 'yes' : 'no'}, cipher=${f.signature_cipher ? 'yes' : 'no'}`);
        });

        allFormats = [
            ...rawAdaptive,
            ...rawFormats,
        ].filter(f => (f.url || f.signature_cipher) && f.has_audio);

        console.log(`[stream] Formats after filter (has_audio + url/cipher): ${allFormats.length}`);

        if (allFormats.length > 0) break;
    }

    // Prefer audio-only, sorted by bitrate (highest first)
    const audioOnly = allFormats
        .filter(f => !f.has_video)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const best = audioOnly.length > 0
        ? audioOnly[0]
        : allFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (!best) throw new Error('No audio formats found');

    console.log(`[stream] Selected: mime=${best.mime_type}, bitrate=${best.bitrate}, audio_only=${!best.has_video}`);

    const url = await best.decipher(yt.session.player);

    // Normalize mime type to audio/* for browser compatibility
    let mime = 'audio/mp4';
    if (best.mime_type?.includes('webm')) mime = 'audio/webm';
    else if (best.mime_type?.includes('mp4')) mime = 'audio/mp4';

    const entry = {
        url,
        mime,
        bytes: best.content_length ? Number(best.content_length) : null,
        duration: best.approx_duration_ms
            ? Math.round(best.approx_duration_ms / 1000)
            : info.basic_info?.duration || 0,
        expires: Date.now() + CACHE_TTL,
    };
    urlCache.set(videoId, entry);
    return entry;
}

// GET /api/stream/:videoId — audio proxy (pipes bytes through server)
router.get('/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const audio = await getAudioUrl(videoId);

        // Build upstream request headers (forward Range for seeking)
        const fetchHeaders = {};
        if (req.headers.range) {
            fetchHeaders['Range'] = req.headers.range;
        }

        const upstream = await fetch(audio.url, { headers: fetchHeaders });

        if (!upstream.ok && upstream.status !== 206) {
            // URL might have expired, clear cache and retry once
            urlCache.delete(videoId);
            const retryAudio = await getAudioUrl(videoId);
            const retryUpstream = await fetch(retryAudio.url, { headers: fetchHeaders });
            if (!retryUpstream.ok && retryUpstream.status !== 206) {
                return res.status(502).json({ error: `Upstream error: ${retryUpstream.status}` });
            }
            return pipeResponse(req, res, retryUpstream, retryAudio);
        }

        return pipeResponse(req, res, upstream, audio);
    } catch (err) {
        console.error('[stream]', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream', message: err.message });
        }
    }
});

function pipeResponse(req, res, upstream, audio) {
    // Pass through status (200 full / 206 partial)
    res.status(upstream.status);
    res.set('Content-Type', audio.mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'no-cache');

    // Forward content headers from YouTube
    const contentRange = upstream.headers.get('content-range');
    const contentLength = upstream.headers.get('content-length');
    if (contentRange) res.set('Content-Range', contentRange);
    if (contentLength) res.set('Content-Length', contentLength);
    else if (audio.bytes && !req.headers.range) res.set('Content-Length', String(audio.bytes));

    // Pipe bytes with backpressure
    const reader = upstream.body.getReader();

    req.on('close', () => {
        reader.cancel().catch(() => { });
    });

    const pump = async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); return; }
                if (!res.write(value)) {
                    await new Promise(resolve => res.once('drain', resolve));
                }
            }
        } catch {
            res.end();
        }
    };
    return pump();
}

export default router;

