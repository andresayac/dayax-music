import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/playlist/:id
router.get('/:id', async (req, res) => {
    try {
        const yt = await getInnertube();
        let playlist = await yt.music.getPlaylist(req.params.id);

        const header = playlist.header;
        const title = header?.title?.text || '';
        const thumbs = header?.thumbnails || header?.thumbnail || [];
        const description = header?.description?.text || header?.subtitle?.text || '';
        const trackCount = header?.song_count?.text || header?.second_subtitle?.text || '';

        // Collect all tracks across continuation pages
        const allItems = [...(playlist.contents || [])];
        while (playlist.has_continuation) {
            playlist = await playlist.getContinuation();
            allItems.push(...(playlist.contents || []));
        }

        // Map tracks
        const tracks = allItems.map(mapTrack).filter(Boolean);

        res.json({
            id: req.params.id,
            title,
            description,
            cover: getTh(thumbs, 120),
            cover_small: getTh(thumbs, 56),
            cover_medium: getTh(thumbs, 226),
            cover_big: getTh(thumbs, 500),
            nb_tracks: tracks.length,
            track_count_text: trackCount,
            tracks: { data: tracks },
        });
    } catch (err) {
        console.error('[playlist]', err.message);
        res.status(500).json({ error: 'Failed to load playlist', message: err.message });
    }
});

export default router;
