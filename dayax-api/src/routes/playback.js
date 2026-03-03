import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack, mapArtist, mapAlbum } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/lyrics/:videoId
router.get('/lyrics/:videoId', async (req, res) => {
    try {
        const yt = await getInnertube();
        const lyrics = await yt.music.getLyrics(req.params.videoId);

        if (!lyrics) {
            return res.json({ lyrics: null, source: null });
        }

        res.json({
            lyrics: lyrics.description?.text || lyrics.description || null,
            source: lyrics.footer?.text || lyrics.footer || null,
        });
    } catch (err) {
        console.error('[lyrics]', err.message);
        // Lyrics not always available, so 200 with null
        res.json({ lyrics: null, source: null });
    }
});

// GET /api/up-next/:videoId
router.get('/up-next/:videoId', async (req, res) => {
    try {
        const yt = await getInnertube();
        const upNext = await yt.music.getUpNext(req.params.videoId);

        const tracks = (upNext?.contents || []).map(item => {
            // PlaylistPanelVideo items
            const videoId = item.video_id || item.id || '';
            if (!videoId) return null;
            const title = item.title?.text || '';
            const artists = item.artists?.map(a => a.name || '') || [];
            const album = item.album?.name || item.album?.text || '';
            const thumbs = item.thumbnail || item.thumbnails || [];
            const duration = item.duration?.seconds || 0;

            return {
                id: videoId,
                title,
                title_short: title.length > 40 ? title.substring(0, 40) + '…' : title,
                duration,
                videoId,
                artist: {
                    id: item.artists?.[0]?.channel_id || '',
                    name: artists.join(', '),
                    picture: getTh(thumbs, 56),
                    picture_small: getTh(thumbs, 56),
                    picture_medium: getTh(thumbs, 226),
                },
                album: {
                    id: '',
                    title: album,
                    cover: getTh(thumbs, 120),
                    cover_small: getTh(thumbs, 56),
                    cover_medium: getTh(thumbs, 226),
                    cover_big: getTh(thumbs, 500),
                },
            };
        }).filter(Boolean);

        res.json({
            data: tracks,
            total: tracks.length,
            playlist_id: upNext?.playlist_id || null,
        });
    } catch (err) {
        console.error('[up-next]', err.message);
        res.status(500).json({ error: 'Failed to load up next', message: err.message });
    }
});

// GET /api/related/:videoId
router.get('/related/:videoId', async (req, res) => {
    try {
        const yt = await getInnertube();
        const related = await yt.music.getRelated(req.params.videoId);

        const sections = (related || []).map(section => {
            const title = section.header?.title?.text || '';
            const tracks = (section.contents || []).map(mapTrack).filter(Boolean);
            const albums = (section.contents || []).map(mapAlbum).filter(Boolean);
            const artists = (section.contents || []).map(mapArtist).filter(Boolean);
            return { title, tracks, albums, artists };
        }).filter(s => s.tracks.length || s.albums.length || s.artists.length);

        res.json({ sections });
    } catch (err) {
        console.error('[related]', err.message);
        res.status(500).json({ error: 'Failed to load related', message: err.message });
    }
});

// GET /api/track/:videoId — detailed track info (YTMUSIC client)
router.get('/track/:videoId', async (req, res) => {
    try {
        const yt = await getInnertube();
        const info = await yt.music.getInfo(req.params.videoId);

        const basic = info.basic_info || {};
        const thumbs = basic.thumbnail || [];

        // Extract artist/channel info
        const channelId = basic.channel_id || '';
        const channelName = basic.author || '';

        // Extract tabs for lyrics/related
        const tabs = info.tabs || [];

        // Music video type detection
        const musicVideoType = basic.music_video_type || basic.musicVideoType || '';

        res.json({
            id: basic.id || req.params.videoId,
            title: basic.title || '',
            duration: basic.duration || 0,
            videoId: req.params.videoId,
            channel: {
                id: channelId,
                name: channelName,
            },
            thumbnail: getTh(thumbs, 120),
            thumbnail_small: getTh(thumbs, 56),
            thumbnail_medium: getTh(thumbs, 226),
            thumbnail_big: getTh(thumbs, 500),
            is_live: basic.is_live || false,
            is_private: basic.is_private || false,
            view_count: basic.view_count || 0,
            short_description: basic.short_description || '',
            music_video_type: musicVideoType,
            has_video_content: musicVideoType === 'MUSIC_VIDEO_TYPE_OMV' || musicVideoType === 'MUSIC_VIDEO_TYPE_UGC',
            tabs: tabs.map(t => t.title || ''),
        });
    } catch (err) {
        console.error('[track/info]', err.message);
        res.status(500).json({ error: 'Failed to load track info', message: err.message });
    }
});

export default router;
