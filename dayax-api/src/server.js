import express from 'express';
import cors from 'cors';
import { getInnertube } from './innertube.js';
import searchRoutes from './routes/search.js';
import homeRoutes from './routes/home.js';
import exploreRoutes from './routes/explore.js';
import artistRoutes from './routes/artist.js';
import albumRoutes from './routes/album.js';
import playlistRoutes from './routes/playlist.js';
import playbackRoutes from './routes/playback.js';
import miscRoutes from './routes/misc.js';
import streamRoutes from './routes/stream.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allowed origins from env (comma-separated) or defaults for local dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3333', 'http://127.0.0.1:3333'];

// Middleware
app.use(cors({
    origin: allowedOrigins,
}));
app.use(express.json());

// Routes
app.use('/api/search', searchRoutes);
app.use('/api', homeRoutes);         // /api/chart, /api/home
app.use('/api', exploreRoutes);      // /api/explore, /api/moods, /api/genre/:params, /api/charts-browse, /api/new-releases
app.use('/api/artist', artistRoutes); // /api/artist/:id, /api/artist/:id/top, /api/artist/:id/albums
app.use('/api/album', albumRoutes);   // /api/album/:id
app.use('/api/playlist', playlistRoutes); // /api/playlist/:id
app.use('/api', playbackRoutes);     // /api/lyrics/:videoId, /api/up-next/:videoId, /api/related/:videoId, /api/track/:videoId
app.use('/api', miscRoutes);         // /api/recap, /api/suggestions, /api/queue
app.use('/api/stream', streamRoutes);

// Image proxy — fetches YouTube/Google CDN images server-side to bypass referrer restrictions
app.get('/api/img', async (req, res) => {
    const url = req.query.url;
    if (!url || typeof url !== 'string') {
        return res.status(400).send('Missing url parameter');
    }
    // Only proxy known Google/YouTube image domains
    const allowed = ['lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'i.ytimg.com', 'music.youtube.com'];
    try {
        const parsed = new URL(url);
        if (!allowed.some(d => parsed.hostname.endsWith(d))) {
            return res.status(403).send('Domain not allowed');
        }
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!response.ok) return res.status(response.status).send('Upstream error');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // cache 24h
        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Proxy error');
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
    // Pre-initialize Innertube so first request isn't slow
    console.log('[Server] Initializing Innertube...');
    await getInnertube();

    app.listen(PORT, () => {
        console.log(`[Server] Dayax API running on http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
});
