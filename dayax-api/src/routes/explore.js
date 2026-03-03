import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapAlbum } from '../mappers.js';
import { getTh } from './helpers.js';

const router = Router();

// GET /api/explore — full explore page with nav buttons, sections, moods
router.get('/explore', async (req, res) => {
    try {
        const yt = await getInnertube();
        const explore = await yt.music.getExplore();

        // Top navigation buttons (New releases, Charts, Moods & genres)
        const topButtons = (explore.top_buttons || []).map(btn => ({
            text: btn.button_text || '',
            browseId: btn.endpoint?.payload?.browseId || '',
            icon: btn.icon_type || '',
        }));

        // Sections: new albums, moods grid, trending, music videos
        const sections = (explore.sections || []).map(section => {
            const title = section.header?.title?.text || section.title?.text || '';
            const strapline = section.header?.strapline?.text || '';
            const items = section.contents || [];

            const tracks = [];
            const albums = [];
            const playlists = [];
            const moodButtons = [];

            for (const item of items) {
                // MusicNavigationButton (moods & genres grid)
                if (item.type === 'MusicNavigationButton') {
                    const text = item.button_text || '';
                    const browseId = item.endpoint?.payload?.browseId || '';
                    const params = item.endpoint?.payload?.params || '';
                    const bgColor = item.icon_style?.style?.color
                        ? `#${(item.icon_style.style.color >>> 0).toString(16).padStart(8, '0').slice(2, 8)}`
                        : null;
                    moodButtons.push({ text, browseId, params, bgColor });
                    continue;
                }

                const id = item.id || item.endpoint?.payload?.browseId || '';
                if (id.startsWith('MPREb')) {
                    const album = mapAlbum(item);
                    if (album) albums.push(album);
                } else {
                    const t = item.title?.text || '';
                    if (t) {
                        const subtitle = item.subtitle?.text || '';
                        const thumbs = item.thumbnail || item.thumbnails || [];
                        playlists.push({
                            id: id || '',
                            title: t,
                            description: subtitle,
                            cover: getTh(thumbs, 226),
                            cover_small: getTh(thumbs, 56),
                            cover_medium: getTh(thumbs, 226),
                            cover_big: getTh(thumbs, 500),
                        });
                    }
                }
            }

            return { title, strapline, tracks, albums, playlists, moodButtons };
        }).filter(s => s.tracks.length || s.albums.length || s.playlists.length || s.moodButtons.length);

        res.json({ topButtons, sections });
    } catch (err) {
        console.error('[explore]', err.message);
        res.status(500).json({ error: 'Failed to load explore', message: err.message });
    }
});

// GET /api/moods — full moods & genres browsing page
router.get('/moods', async (req, res) => {
    try {
        const yt = await getInnertube();
        const response = await yt.actions.execute('/browse', {
            browseId: 'FEmusic_moods_and_genres',
            client: 'YTMUSIC',
        });

        const rawData = response?.data;
        const tabs = rawData?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
        const content = tabs[0]?.tabRenderer?.content;
        const rawSections = content?.sectionListRenderer?.contents || [];

        const sections = rawSections.map(s => {
            const grid = s.gridRenderer;
            if (!grid) return null;

            const title = grid.header?.gridHeaderRenderer?.title?.runs?.[0]?.text || '';

            const items = (grid.items || []).map(item => {
                const nav = item.musicNavigationButtonRenderer;
                if (!nav) return null;
                const text = nav.buttonText?.runs?.[0]?.text || '';
                const browseId = nav.clickCommand?.browseEndpoint?.browseId || '';
                const params = nav.clickCommand?.browseEndpoint?.params || '';
                const bgColor = nav.solid?.leftStripeColor
                    ? `#${(nav.solid.leftStripeColor >>> 0).toString(16).padStart(8, '0').slice(2, 8)}`
                    : null;
                return { text, browseId, params, bgColor };
            }).filter(Boolean);

            return { title, items };
        }).filter(Boolean);

        res.json({ sections });
    } catch (err) {
        console.error('[moods]', err.message);
        res.status(500).json({ error: 'Failed to load moods', message: err.message });
    }
});

// GET /api/genre/:params — browse a specific genre/mood category
router.get('/genre/:params', async (req, res) => {
    try {
        const yt = await getInnertube();
        const response = await yt.actions.execute('/browse', {
            browseId: 'FEmusic_moods_and_genres_category',
            params: req.params.params,
            client: 'YTMUSIC',
        });

        const rawData = response?.data;
        const tabs = rawData?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
        const content = tabs[0]?.tabRenderer?.content;
        const rawSections = content?.sectionListRenderer?.contents || [];

        const sections = rawSections.map(s => {
            const carousel = s.musicCarouselShelfRenderer || s.gridRenderer;
            if (!carousel) return null;

            const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                || carousel.header?.gridHeaderRenderer?.title?.runs?.[0]?.text || '';

            const items = carousel.contents || carousel.items || [];
            const playlists = items.map(c => {
                const twoRow = c.musicTwoRowItemRenderer;
                if (!twoRow) return null;
                const itemTitle = twoRow.title?.runs?.[0]?.text || '';
                const browseId = twoRow.navigationEndpoint?.browseEndpoint?.browseId || '';
                const subtitle = (twoRow.subtitle?.runs || []).map(r => r.text).join('');
                const thumbs = twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
                return {
                    id: browseId, title: itemTitle, description: subtitle,
                    cover: getTh(thumbs, 226), cover_small: getTh(thumbs, 56),
                    cover_medium: getTh(thumbs, 226), cover_big: getTh(thumbs, 500),
                };
            }).filter(Boolean);

            return { title, playlists };
        }).filter(Boolean);

        // Page title from header
        const pageTitle = rawData?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text
            || rawData?.header?.musicImmersiveHeaderRenderer?.title?.runs?.[0]?.text || '';

        res.json({ title: pageTitle, sections });
    } catch (err) {
        console.error('[genre]', err.message);
        res.status(500).json({ error: 'Failed to load genre', message: err.message });
    }
});

// GET /api/charts-browse — charts with country filtering
router.get('/charts-browse', async (req, res) => {
    try {
        const yt = await getInnertube();
        const params = req.query.params; // country filter params

        const browsePayload = { browseId: 'FEmusic_charts', client: 'YTMUSIC' };
        if (params) browsePayload.params = params;

        const response = await yt.actions.execute('/browse', browsePayload);
        const rawData = response?.data;

        const tabs = rawData?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
        const content = tabs[0]?.tabRenderer?.content;
        const rawSections = content?.sectionListRenderer?.contents || [];

        // Extract country chips if available
        const chipCloud = content?.sectionListRenderer?.header?.chipCloudRenderer;
        const countries = (chipCloud?.chips || []).map(chip => {
            const cr = chip.chipCloudChipRenderer;
            return {
                text: cr?.text?.runs?.[0]?.text || '',
                params: cr?.navigationEndpoint?.browseEndpoint?.params || '',
                selected: cr?.isSelected || false,
            };
        }).filter(c => c.text);

        const sections = [];

        for (const s of rawSections) {
            const shelf = s.musicShelfRenderer || s.musicCarouselShelfRenderer;
            if (!shelf) continue;

            const title = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                || shelf.header?.musicShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                || shelf.title?.runs?.[0]?.text || '';

            const tracks = [];
            const playlists = [];

            for (const c of (shelf.contents || [])) {
                const listItem = c.musicResponsiveListItemRenderer;
                if (listItem) {
                    const videoId = listItem.overlay?.musicItemThumbnailOverlayRenderer
                        ?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
                        || listItem.playlistItemData?.videoId || '';
                    if (videoId) {
                        const trackTitle = listItem.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer
                            ?.text?.runs?.[0]?.text || '';
                        const artistRuns = listItem.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer
                            ?.text?.runs || [];
                        const artistName = artistRuns.map(r => r.text).filter(t => t && t !== ' • ' && t !== ' & ').join('');
                        const thumbs = listItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
                        tracks.push({
                            id: videoId, title: trackTitle,
                            title_short: trackTitle.length > 40 ? trackTitle.substring(0, 40) + '…' : trackTitle,
                            duration: 0, videoId,
                            artist: { id: '', name: artistName, picture: getTh(thumbs, 56), picture_small: getTh(thumbs, 56), picture_medium: getTh(thumbs, 226) },
                            album: { id: '', title: '', cover: getTh(thumbs, 120), cover_small: getTh(thumbs, 56), cover_medium: getTh(thumbs, 226), cover_big: getTh(thumbs, 500) },
                        });
                        continue;
                    }
                }
                const twoRow = c.musicTwoRowItemRenderer;
                if (twoRow) {
                    const itemTitle = twoRow.title?.runs?.[0]?.text || '';
                    const browseId = twoRow.navigationEndpoint?.browseEndpoint?.browseId || '';
                    const subtitle = (twoRow.subtitle?.runs || []).map(r => r.text).join('');
                    const thumbs = twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
                    playlists.push({
                        id: browseId, title: itemTitle, description: subtitle,
                        cover: getTh(thumbs, 226), cover_small: getTh(thumbs, 56),
                        cover_medium: getTh(thumbs, 226), cover_big: getTh(thumbs, 500),
                    });
                }
            }

            if (tracks.length || playlists.length) {
                sections.push({ title, tracks, playlists });
            }
        }

        res.json({ countries, sections });
    } catch (err) {
        console.error('[charts-browse]', err.message);
        res.status(500).json({ error: 'Failed to load charts', message: err.message });
    }
});

// GET /api/new-releases — full new releases page (albums, singles, music videos)
router.get('/new-releases', async (req, res) => {
    try {
        const yt = await getInnertube();
        const response = await yt.actions.execute('/browse', {
            browseId: 'FEmusic_new_releases',
            client: 'YTMUSIC',
        });

        const rawData = response?.data;
        const tabs = rawData?.contents?.singleColumnBrowseResultsRenderer?.tabs || [];
        const content = tabs[0]?.tabRenderer?.content;
        const rawSections = content?.sectionListRenderer?.contents || [];

        const sections = rawSections.map(s => {
            const carousel = s.musicCarouselShelfRenderer || s.gridRenderer;
            if (!carousel) return null;

            const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                || carousel.header?.gridHeaderRenderer?.title?.runs?.[0]?.text || '';
            const strapline = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.strapline?.runs?.[0]?.text || '';

            const items = carousel.contents || carousel.items || [];
            const albums = [];
            const playlists = [];

            for (const c of items) {
                const twoRow = c.musicTwoRowItemRenderer;
                if (!twoRow) continue;

                const itemTitle = twoRow.title?.runs?.[0]?.text || '';
                const browseId = twoRow.navigationEndpoint?.browseEndpoint?.browseId || '';
                const subtitle = (twoRow.subtitle?.runs || []).map(r => r.text).join('');
                const thumbs = twoRow.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

                if (browseId.startsWith('MPREb')) {
                    albums.push({
                        id: browseId,
                        title: itemTitle,
                        cover: getTh(thumbs, 120),
                        cover_small: getTh(thumbs, 56),
                        cover_medium: getTh(thumbs, 226),
                        cover_big: getTh(thumbs, 500),
                        nb_tracks: 0,
                        year: '',
                        artist: { id: '', name: subtitle, picture: getTh(thumbs, 56) },
                    });
                } else if (itemTitle) {
                    playlists.push({
                        id: browseId,
                        title: itemTitle,
                        description: subtitle,
                        cover: getTh(thumbs, 226),
                        cover_small: getTh(thumbs, 56),
                        cover_medium: getTh(thumbs, 226),
                        cover_big: getTh(thumbs, 500),
                    });
                }
            }

            if (!albums.length && !playlists.length) return null;
            return { title, strapline, albums, playlists };
        }).filter(Boolean);

        // Page title from header
        const pageTitle = rawData?.header?.musicHeaderRenderer?.title?.runs?.[0]?.text
            || rawData?.header?.musicImmersiveHeaderRenderer?.title?.runs?.[0]?.text || 'New releases';

        res.json({ title: pageTitle, sections });
    } catch (err) {
        console.error('[new-releases]', err.message);
        res.status(500).json({ error: 'Failed to load new releases', message: err.message });
    }
});

export default router;
