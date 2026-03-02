import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack, mapArtist, mapAlbum } from '../mappers.js';

const router = Router();

// GET /api/search/all?q=...&limit=10 — unified mixed search
router.get('/all', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ tracks: [], artists: [], albums: [] });

        const yt = await getInnertube();
        const search = await yt.music.search(q); // type: 'all'

        // Mixed results come in different sections
        const tracks = [];
        const artists = [];
        const albums = [];
        const playlists = [];

        const sections = search.contents || [];
        for (const section of sections) {
            const title = section.header?.title?.text?.toLowerCase() || '';
            const items = section.contents || [];

            for (const item of items) {
                const type = item.type || '';

                if (title.includes('song') || title.includes('cancion') || title.includes('video')) {
                    const t = mapTrack(item);
                    if (t && tracks.length < limit) tracks.push(t);
                } else if (title.includes('artist') || title.includes('artista')) {
                    const a = mapArtist(item);
                    if (a && artists.length < limit) artists.push(a);
                } else if (title.includes('album') || title.includes('álbum')) {
                    const a = mapAlbum(item);
                    if (a && albums.length < limit) albums.push(a);
                } else if (title.includes('playlist') || title.includes('lista')) {
                    // Playlists from search
                    const id = item.id || '';
                    const name = item.flex_columns?.[0]?.title?.text || item.title?.text || '';
                    const subtitle = item.flex_columns?.[1]?.title?.text || item.subtitle?.text || '';
                    const thumbs = item.thumbnail?.contents || item.thumbnails || [];
                    if (name && playlists.length < limit) {
                        playlists.push({
                            id,
                            title: name,
                            description: subtitle,
                            thumbnail: thumbs[0]?.url || '',
                        });
                    }
                } else {
                    // Unknown section → try mapping as track
                    const t = mapTrack(item);
                    if (t && tracks.length < limit) { tracks.push(t); continue; }
                    const a = mapArtist(item);
                    if (a && artists.length < limit) { artists.push(a); continue; }
                    const al = mapAlbum(item);
                    if (al && albums.length < limit) albums.push(al);
                }
            }
        }

        res.json({ tracks, artists, albums, playlists });
    } catch (err) {
        console.error('[search/all]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

// GET /api/search/tracks?q=...&limit=10
router.get('/tracks', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ data: [], total: 0 });

        const yt = await getInnertube();
        const search = await yt.music.search(q, { type: 'song' });

        // Flatten all sections' contents
        const allItems = [];
        const sections = search.contents || [];
        for (const section of sections) {
            const items = section.contents || [];
            allItems.push(...items);
        }

        const mapped = allItems
            .slice(0, limit)
            .map(mapTrack)
            .filter(Boolean);

        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[search/tracks]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

// GET /api/search/videos?q=...&limit=10
router.get('/videos', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ data: [], total: 0 });

        const yt = await getInnertube();
        const search = await yt.music.search(q, { type: 'video' });

        const allItems = [];
        const sections = search.contents || [];
        for (const section of sections) {
            allItems.push(...(section.contents || []));
        }

        const mapped = allItems
            .slice(0, limit)
            .map(mapTrack)
            .filter(Boolean);

        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[search/videos]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

// GET /api/search/artists?q=...&limit=10
router.get('/artists', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ data: [], total: 0 });

        const yt = await getInnertube();
        const search = await yt.music.search(q, { type: 'artist' });

        const allItems = [];
        const sections = search.contents || [];
        for (const section of sections) {
            allItems.push(...(section.contents || []));
        }

        const mapped = allItems
            .slice(0, limit)
            .map(mapArtist)
            .filter(Boolean);

        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[search/artists]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

// GET /api/search/albums?q=...&limit=10
router.get('/albums', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ data: [], total: 0 });

        const yt = await getInnertube();
        const search = await yt.music.search(q, { type: 'album' });

        const allItems = [];
        const sections = search.contents || [];
        for (const section of sections) {
            allItems.push(...(section.contents || []));
        }

        const mapped = allItems
            .slice(0, limit)
            .map(mapAlbum)
            .filter(Boolean);

        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[search/albums]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

// GET /api/search/playlists?q=...&limit=10
router.get('/playlists', async (req, res) => {
    try {
        const q = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        if (!q) return res.json({ data: [], total: 0 });

        const yt = await getInnertube();
        const search = await yt.music.search(q, { type: 'playlist' });

        const allItems = [];
        const sections = search.contents || [];
        for (const section of sections) {
            allItems.push(...(section.contents || []));
        }

        const mapped = allItems.slice(0, limit).map(item => {
            const title = item.flex_columns?.[0]?.title?.text || item.title?.text || '';
            const subtitle = item.flex_columns?.[1]?.title?.text || item.subtitle?.text || '';
            const id = item.id || item.endpoint?.payload?.browseId || '';
            const thumbs = item.thumbnail?.contents || item.thumbnails || [];
            const getTh = (list, minW) => {
                if (!list.length) return '';
                const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
                const m = sorted.find(t => (t.width || 0) >= minW);
                return (m || sorted[sorted.length - 1])?.url || '';
            };

            if (!title) return null;
            return {
                id,
                title,
                description: subtitle,
                cover: getTh(thumbs, 120),
                cover_small: getTh(thumbs, 56),
                cover_medium: getTh(thumbs, 226),
                cover_big: getTh(thumbs, 500),
            };
        }).filter(Boolean);

        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[search/playlists]', err.message);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
});

export default router;
