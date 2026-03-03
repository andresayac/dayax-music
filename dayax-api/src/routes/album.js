import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/album/:id
router.get('/:id', async (req, res) => {
    try {
        const yt = await getInnertube();
        const album = await yt.music.getAlbum(req.params.id);

        const header = album.header;
        const title = header?.title?.text || '';
        const thumbs = header?.thumbnails || header?.thumbnail?.contents || [];
        const thumbList = Array.isArray(thumbs) ? thumbs : [];
        const artists = header?.artists || header?.author || [];
        const year = header?.year?.text || header?.subtitle?.text || '';
        const description = header?.description?.text || '';

        const artistName = Array.isArray(artists)
            ? artists.map(a => a.name?.text || a.name || a.text || '').filter(Boolean).join(', ')
            : '';
        const artistId = Array.isArray(artists) && artists[0]?.channel_id
            ? artists[0].channel_id
            : '';

        // Map tracks, overriding album info
        const tracks = (album.contents || [])
            .map(item => {
                const mapped = mapTrack(item);
                if (mapped) {
                    mapped.album = {
                        id: req.params.id,
                        title,
                        cover: getTh(thumbList, 120),
                        cover_small: getTh(thumbList, 56),
                        cover_medium: getTh(thumbList, 226),
                        cover_big: getTh(thumbList, 500),
                    };
                    if (!mapped.artist.name && artistName) {
                        mapped.artist.name = artistName;
                        mapped.artist.id = artistId;
                    }
                }
                return mapped;
            })
            .filter(Boolean);

        res.json({
            id: req.params.id,
            title,
            description,
            cover: getTh(thumbList, 120),
            cover_small: getTh(thumbList, 56),
            cover_medium: getTh(thumbList, 226),
            cover_big: getTh(thumbList, 500),
            nb_tracks: tracks.length,
            release_date: year,
            artist: {
                id: artistId,
                name: artistName,
                picture: '',
            },
            tracks: { data: tracks },
        });
    } catch (err) {
        console.error('[album]', err.message);
        res.status(500).json({ error: 'Failed to load album', message: err.message });
    }
});

export default router;
