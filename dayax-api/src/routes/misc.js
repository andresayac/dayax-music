import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/recap — year in review / listening recap
router.get('/recap', async (req, res) => {
    try {
        const yt = await getInnertube();
        const recap = await yt.music.getRecap();

        const sections = (recap.sections || []).map(section => {
            const title = section.header?.title?.text || section.title?.text || '';
            const items = (section.contents || []);
            const tracks = items.map(mapTrack).filter(Boolean);

            return { title, tracks };
        }).filter(s => s.tracks.length > 0);

        res.json({ sections });
    } catch (err) {
        console.error('[recap]', err.message);
        // Recap may not be available
        res.json({ sections: [] });
    }
});

// GET /api/suggestions?q=...
router.get('/suggestions', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ suggestions: [] });

        const yt = await getInnertube();
        const suggestions = await yt.music.getSearchSuggestions(q);

        const sections = suggestions || [];
        const mapped = [];
        for (const section of sections) {
            const items = section.contents || [];
            for (const item of items) {
                const text = item.suggestion?.runs?.map(r => r.text).join('')
                    || item.suggestion?.text
                    || '';
                if (text) mapped.push(text);
            }
        }

        res.json({ suggestions: mapped });
    } catch (err) {
        console.error('[suggestions]', err.message);
        res.json({ suggestions: [] });
    }
});

// GET /api/queue?videoIds=id1,id2 OR ?playlistId=RDCLAK...
// Batch-fetch track metadata for multiple video IDs or all tracks in a playlist
router.get('/queue', async (req, res) => {
    try {
        const yt = await getInnertube();
        const videoIdsParam = req.query.videoIds || '';
        const playlistId = req.query.playlistId || '';

        if (!videoIdsParam && !playlistId) {
            return res.status(400).json({ error: 'Provide videoIds or playlistId' });
        }

        const payload = { client: 'YTMUSIC' };
        if (playlistId) {
            payload.playlistId = playlistId;
        } else {
            payload.videoIds = videoIdsParam.split(',').map(id => id.trim()).filter(Boolean);
        }

        const response = await yt.actions.execute('/music/get_queue', payload);
        const rawData = response?.data;
        const queueDatas = rawData?.queueDatas || [];

        const tracks = queueDatas.map(qd => {
            const wrapper = qd?.content?.playlistPanelVideoWrapperRenderer;
            const renderer = wrapper?.primaryRenderer?.playlistPanelVideoRenderer
                || qd?.content?.playlistPanelVideoRenderer;
            if (!renderer) return null;

            const videoId = renderer.videoId || '';
            if (!videoId) return null;

            const title = renderer.title?.runs?.[0]?.text || '';
            const artistRuns = renderer.longBylineText?.runs || renderer.shortBylineText?.runs || [];
            const artistName = artistRuns.map(r => r.text).filter(t => t && t !== ' • ' && t !== ' & ').join('');
            const artistId = artistRuns.find(r => r.navigationEndpoint?.browseEndpoint?.browseId)
                ?.navigationEndpoint?.browseEndpoint?.browseId || '';
            const thumbs = renderer.thumbnail?.thumbnails || [];
            const durationText = renderer.lengthText?.runs?.[0]?.text || '';

            // Parse duration text (e.g. "3:45") to seconds
            let duration = 0;
            if (durationText) {
                const parts = durationText.split(':').map(Number);
                if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
                else if (parts.length === 2) duration = parts[0] * 60 + parts[1];
            }

            return {
                id: videoId,
                title,
                title_short: title.length > 40 ? title.substring(0, 40) + '…' : title,
                duration,
                videoId,
                artist: {
                    id: artistId,
                    name: artistName,
                    picture: getTh(thumbs, 56),
                    picture_small: getTh(thumbs, 56),
                    picture_medium: getTh(thumbs, 226),
                },
                album: {
                    id: '',
                    title: '',
                    cover: getTh(thumbs, 120),
                    cover_small: getTh(thumbs, 56),
                    cover_medium: getTh(thumbs, 226),
                    cover_big: getTh(thumbs, 500),
                },
            };
        }).filter(Boolean);

        res.json({ tracks, total: tracks.length });
    } catch (err) {
        console.error('[queue]', err.message);
        res.status(500).json({ error: 'Failed to load queue', message: err.message });
    }
});

export default router;
