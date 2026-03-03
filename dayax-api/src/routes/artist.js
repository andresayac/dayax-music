import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack, mapAlbum } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/artist/:id
router.get('/:id', async (req, res) => {
    try {
        const yt = await getInnertube();
        const artist = await yt.music.getArtist(req.params.id);

        const header = artist.header;
        const name = header?.title?.text || header?.name?.text || '';
        const thumbs = header?.thumbnails || header?.thumbnail?.contents || [];
        const thumbList = Array.isArray(thumbs) ? thumbs : [];
        const subscribers = header?.subscribers?.text || header?.subscriber_count?.text || '';

        let nbFan = 0;
        if (subscribers) {
            const match = subscribers.toLowerCase().replace(/\s/g, '').match(/([\d.]+)\s*(m|k|mil|millones)?/);
            if (match) {
                nbFan = parseFloat(match[1]);
                if (match[2] === 'm' || match[2] === 'millones') nbFan *= 1_000_000;
                else if (match[2] === 'k' || match[2] === 'mil') nbFan *= 1_000;
                nbFan = Math.round(nbFan);
            }
        }

        const description = header?.description?.text || '';

        res.json({
            id: req.params.id,
            name,
            description,
            picture: getTh(thumbList, 120),
            picture_small: getTh(thumbList, 56),
            picture_medium: getTh(thumbList, 226),
            picture_big: getTh(thumbList, 500),
            nb_fan: nbFan,
        });
    } catch (err) {
        console.error('[artist]', err.message);
        res.status(500).json({ error: 'Failed to load artist', message: err.message });
    }
});

// GET /api/artist/:id/top — top tracks (with duration via full playlist)
router.get('/:id/top', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const yt = await getInnertube();

        // Step 1: Raw browse to find the songs shelf's bottomEndpoint (playlist ID)
        const response = await yt.actions.execute('/browse', {
            browseId: req.params.id,
            client: 'YTMUSIC',
        });
        const rawData = response?.data;
        const tabs = rawData?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
        const content = tabs[0]?.tabRenderer?.content;
        const rawSections = content?.sectionListRenderer?.contents || [];

        // Find the songs shelf (musicShelfRenderer) and its bottomEndpoint
        let songsPlaylistId = '';
        let fallbackItems = [];
        for (const s of rawSections) {
            const shelf = s.musicShelfRenderer;
            if (!shelf) continue;

            const title = (shelf.title?.runs?.[0]?.text || '').toLowerCase();
            const isSongs = title.includes('song') || title.includes('cancion') || title.includes('popular');

            if (isSongs || !fallbackItems.length) {
                // Extract bottomEndpoint playlist browseId
                const browseId = shelf.bottomEndpoint?.browseEndpoint?.browseId || '';
                if (browseId) songsPlaylistId = browseId;

                // Keep shelf contents as fallback
                fallbackItems = shelf.contents || [];
                if (isSongs) break;
            }
        }

        // Step 2: If we found a playlist ID, fetch it for full track list with duration
        if (songsPlaylistId) {
            try {
                // Strip VL prefix if present for getPlaylist()
                const playlistId = songsPlaylistId.startsWith('VL') ? songsPlaylistId.slice(2) : songsPlaylistId;
                let playlist = await yt.music.getPlaylist(playlistId);
                const allItems = [...(playlist.contents || [])];
                // Fetch remaining pages via continuation
                while (playlist.has_continuation) {
                    playlist = await playlist.getContinuation();
                    allItems.push(...(playlist.contents || []));
                }
                const tracks = allItems.map(mapTrack).filter(Boolean);
                return res.json({ data: tracks.slice(0, limit), total: tracks.length, playlistId });
            } catch (playlistErr) {
                console.warn('[artist/top] Playlist fetch failed, using fallback:', playlistErr.message);
            }
        }

        // Step 3: Fallback — map the raw shelf contents (no duration, limited items)
        const fallbackTracks = fallbackItems.map(c => {
            const li = c.musicResponsiveListItemRenderer;
            if (!li) return null;
            const videoId = li.playlistItemData?.videoId
                || li.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
                    ?.playNavigationEndpoint?.watchEndpoint?.videoId || '';
            if (!videoId) return null;
            const trackTitle = li.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                ?.text?.runs?.[0]?.text || '';
            const artistRuns = li.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
                ?.text?.runs || [];
            const artistName = artistRuns.map(r => r.text).filter(t => t && t !== ' • ' && t !== ' & ').join('');
            const artistId = artistRuns.find(r => r.navigationEndpoint?.browseEndpoint?.browseId)
                ?.navigationEndpoint?.browseEndpoint?.browseId || '';
            const thumbs = li.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
            return {
                id: videoId, title: trackTitle,
                title_short: trackTitle.length > 40 ? trackTitle.substring(0, 40) + '…' : trackTitle,
                duration: 0, videoId,
                artist: { id: artistId, name: artistName, picture: getTh(thumbs, 56), picture_small: getTh(thumbs, 56), picture_medium: getTh(thumbs, 226) },
                album: { id: '', title: '', cover: getTh(thumbs, 120), cover_small: getTh(thumbs, 56), cover_medium: getTh(thumbs, 226), cover_big: getTh(thumbs, 500) },
            };
        }).filter(Boolean);

        res.json({ data: fallbackTracks.slice(0, limit), total: fallbackTracks.length, playlistId: '' });
    } catch (err) {
        console.error('[artist/top]', err.message);
        res.status(500).json({ error: 'Failed to load top tracks', message: err.message });
    }
});

// GET /api/artist/:id/albums
router.get('/:id/albums', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const yt = await getInnertube();
        const artist = await yt.music.getArtist(req.params.id);

        const sections = artist.sections || [];
        let albumItems = [];

        for (const section of sections) {
            const title = section.header?.title?.text?.toLowerCase() || '';
            if (title.includes('album') || title.includes('single') || title.includes('discogra')) {
                albumItems = [...albumItems, ...(section.contents || [])];
            }
        }

        const mapped = albumItems.slice(0, limit).map(mapAlbum).filter(Boolean);
        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[artist/albums]', err.message);
        res.status(500).json({ error: 'Failed to load albums', message: err.message });
    }
});

export default router;
