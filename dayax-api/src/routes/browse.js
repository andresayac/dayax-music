import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack, mapArtist, mapAlbum, mapSection } from '../mappers.js';

const router = Router();

// Helper: extract thumbnail URL at a minimum width from any shape
function getTh(thumbContainer, minW) {
    const list = extractThumbList(thumbContainer);
    if (!list.length) return '';
    const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
    const m = sorted.find(t => (t.width || 0) >= minW);
    return (m || sorted[sorted.length - 1])?.url || '';
}

function extractThumbList(item) {
    if (!item) return [];
    if (Array.isArray(item)) return item.filter(t => t && t.url);
    if (Array.isArray(item.contents)) {
        const all = [];
        for (const c of item.contents) {
            if (c.url) { all.push(c); continue; }
            if (c.image?.sources) { all.push(...c.image.sources); continue; }
            if (c.thumbnails) { all.push(...c.thumbnails); continue; }
        }
        if (all.length) return all;
    }
    if (item.image?.sources) return item.image.sources;
    if (item.url) return [item];
    if (item.thumbnails) return extractThumbList(item.thumbnails);
    return [];
}

// ─────────────────────────── CHART / HOME ───────────────────────────

// GET /api/chart — home feed with trending tracks, playlists, etc.
router.get('/chart', async (req, res) => {
    try {
        const yt = await getInnertube();
        const home = await yt.music.getHomeFeed();

        const sections = home.sections || [];
        const tracks = [];
        const albums = [];

        for (const section of sections) {
            const contents = section.contents || [];
            for (const item of contents) {
                // MusicResponsiveListItem = playable tracks
                const track = mapTrack(item);
                if (track && tracks.length < 20) {
                    tracks.push(track);
                    continue;
                }
                // MusicTwoRowItem with album ID = albums
                const id = item.id || '';
                if (id.startsWith('MPREb') && albums.length < 20) {
                    const album = mapAlbum(item);
                    if (album) albums.push(album);
                }
            }
        }

        res.json({
            tracks: { data: tracks, total: tracks.length },
            artists: { data: [], total: 0 },
            albums: { data: albums, total: albums.length },
        });
    } catch (err) {
        console.error('[chart]', err.message);
        res.status(500).json({ error: 'Failed to load charts', message: err.message });
    }
});

// Helper to parse home feed sections into our format
function parseSections(rawSections) {
    return (rawSections || [])
        .map(section => {
            const mapped = mapSection(section);
            if (!mapped || !mapped.items.length) return null;

            const tracks = [];
            const albums = [];
            const playlists = [];

            for (const item of mapped.items) {
                const track = mapTrack(item);
                if (track) { tracks.push(track); continue; }

                const id = item.id || item.endpoint?.payload?.browseId || '';
                const title = item.title?.text || '';

                if (id.startsWith('MPREb')) {
                    const album = mapAlbum(item);
                    if (album) albums.push(album);
                } else if (title) {
                    const subtitle = item.subtitle?.text || '';
                    const thumbs = item.thumbnail || item.thumbnails || [];
                    playlists.push({
                        id: id || '',
                        title,
                        description: subtitle,
                        cover: getTh(thumbs, 226),
                        cover_small: getTh(thumbs, 56),
                        cover_medium: getTh(thumbs, 226),
                        cover_big: getTh(thumbs, 500),
                    });
                }
            }

            return {
                title: mapped.title,
                strapline: mapped.strapline,
                tracks,
                albums,
                playlists,
            };
        })
        .filter(Boolean);
}

// GET /api/home — full home feed with sections (supports mood filtering)
router.get('/home', async (req, res) => {
    try {
        const yt = await getInnertube();
        const moodParams = req.query.params;

        if (moodParams) {
            // Mood filter: use raw browse action with chip params
            const response = await yt.actions.execute('/browse', {
                browseId: 'FEmusic_home',
                params: moodParams,
                client: 'YTMUSIC',
            });

            const rawData = response?.data;
            const tabContent = rawData?.contents?.singleColumnBrowseResultsRenderer
                ?.tabs?.[0]?.tabRenderer?.content;

            // Parse section list from response
            const rawSections = tabContent?.sectionListRenderer?.contents || [];
            const parsedSections = [];

            // Also extract chips from the filtered response
            const filteredChips = [];
            const chipCloud = rawData?.header?.musicHeaderRenderer?.chipClouds?.[0]
                || tabContent?.sectionListRenderer?.header?.chipCloudRenderer;
            const rawChips = chipCloud?.chips || [];
            for (const chip of rawChips) {
                const text = chip?.chipCloudChipRenderer?.text?.runs?.[0]?.text || '';
                const params = chip?.chipCloudChipRenderer?.navigationEndpoint?.browseEndpoint?.params || '';
                const selected = chip?.chipCloudChipRenderer?.isSelected || false;
                if (text) filteredChips.push({ text, params, selected });
            }

            for (const raw of rawSections) {
                const shelf = raw.musicShelfRenderer || raw.musicCarouselShelfRenderer;
                if (!shelf) continue;

                const title = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                    || shelf.header?.musicShelfBasicHeaderRenderer?.title?.runs?.[0]?.text
                    || shelf.title?.runs?.[0]?.text || '';
                const strapline = shelf.header?.musicCarouselShelfBasicHeaderRenderer?.strapline?.runs?.[0]?.text || '';
                const contents = shelf.contents || [];

                const tracks = [];
                const albums = [];
                const playlists = [];

                for (const c of contents) {
                    // MusicResponsiveListItem = tracks in shelves
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
                            const artistId = artistRuns.find(r => r.navigationEndpoint?.browseEndpoint?.browseId)
                                ?.navigationEndpoint?.browseEndpoint?.browseId || '';
                            const thumbs = listItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];

                            tracks.push({
                                id: videoId,
                                title: trackTitle,
                                title_short: trackTitle.length > 40 ? trackTitle.substring(0, 40) + '…' : trackTitle,
                                duration: 0,
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
                            });
                            continue;
                        }
                    }

                    // MusicTwoRowItemRenderer = albums/playlists in carousels
                    const twoRow = c.musicTwoRowItemRenderer;
                    if (twoRow) {
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
                }

                if (tracks.length || albums.length || playlists.length) {
                    parsedSections.push({ title, strapline, tracks, albums, playlists });
                }
            }

            return res.json({ chips: filteredChips, sections: parsedSections });
        }

        // Default: no mood filter
        const home = await yt.music.getHomeFeed();

        // Extract mood chips from header
        const chips = [];
        const rawChips = home.header?.chips || home.chips || [];
        for (const chip of rawChips) {
            const text = chip.text?.text || chip.title?.text || chip.text || '';
            const params = chip.endpoint?.payload?.params || '';
            if (text) chips.push({ text, params });
        }

        const sections = parseSections(home.sections);

        res.json({ chips, sections });
    } catch (err) {
        console.error('[home]', err.message);
        res.status(500).json({ error: 'Failed to load home feed', message: err.message });
    }
});

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
                    // Extract color from the solid background
                    const color = item.icon_type ? null : (item.solid?.color || null);
                    moodButtons.push({ text, browseId, params, color });
                    continue;
                }

                // Try as track first
                const track = mapTrack(item);
                if (track) { tracks.push(track); continue; }

                // Try as album
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
                const btn = item.musicNavigationButtonRenderer;
                if (!btn) return null;
                const text = btn.buttonText?.runs?.[0]?.text || '';
                const browseId = btn.clickCommand?.browseEndpoint?.browseId || '';
                const params = btn.clickCommand?.browseEndpoint?.params || '';
                // Background color
                const bgColor = btn.solid?.leftStripeColor
                    ? `#${(btn.solid.leftStripeColor >>> 0).toString(16).padStart(8, '0').substring(2)}`
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
                    id: browseId,
                    title: itemTitle,
                    description: subtitle,
                    cover: getTh(thumbs, 226),
                    cover_small: getTh(thumbs, 56),
                    cover_medium: getTh(thumbs, 226),
                    cover_big: getTh(thumbs, 500),
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

// ─────────────────────────── ARTIST ───────────────────────────

// GET /api/artist/:id
router.get('/artist/:id', async (req, res) => {
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

        const getTh = (list, minW) => {
            if (!list.length) return '';
            const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
            const m = sorted.find(t => (t.width || 0) >= minW);
            return (m || sorted[sorted.length - 1])?.url || '';
        };

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

// GET /api/artist/:id/top — top tracks
router.get('/artist/:id/top', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const yt = await getInnertube();
        const artist = await yt.music.getArtist(req.params.id);

        const sections = artist.sections || [];
        let songItems = [];

        for (const section of sections) {
            const title = section.header?.title?.text?.toLowerCase() || '';
            if (title.includes('song') || title.includes('cancion') || title.includes('popular')) {
                songItems = section.contents || [];
                break;
            }
        }

        // Fallback: first section with playable items
        if (!songItems.length) {
            for (const section of sections) {
                const items = section.contents || [];
                const mapped = items.map(mapTrack).filter(Boolean);
                if (mapped.length > 0) {
                    return res.json({ data: mapped.slice(0, limit), total: mapped.length });
                }
            }
        }

        const mapped = songItems.slice(0, limit).map(mapTrack).filter(Boolean);
        res.json({ data: mapped, total: mapped.length });
    } catch (err) {
        console.error('[artist/top]', err.message);
        res.status(500).json({ error: 'Failed to load top tracks', message: err.message });
    }
});

// GET /api/artist/:id/albums
router.get('/artist/:id/albums', async (req, res) => {
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

// ─────────────────────────── ALBUM ───────────────────────────

// GET /api/album/:id
router.get('/album/:id', async (req, res) => {
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

        const getTh = (list, minW) => {
            if (!list.length) return '';
            const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
            const m = sorted.find(t => (t.width || 0) >= minW);
            return (m || sorted[sorted.length - 1])?.url || '';
        };

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

// ─────────────────────────── PLAYLIST ───────────────────────────

// GET /api/playlist/:id
router.get('/playlist/:id', async (req, res) => {
    try {
        const yt = await getInnertube();
        const playlist = await yt.music.getPlaylist(req.params.id);

        const header = playlist.header;
        const title = header?.title?.text || '';
        const thumbs = header?.thumbnails || header?.thumbnail || [];
        const description = header?.description?.text || header?.subtitle?.text || '';
        const trackCount = header?.song_count?.text || header?.second_subtitle?.text || '';

        // Map tracks
        const tracks = (playlist.contents || []).map(mapTrack).filter(Boolean);

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

// ─────────────────────────── LYRICS ───────────────────────────

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

// ─────────────────────────── UP NEXT / RELATED ───────────────────────────

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

// ─────────────────────────── TRACK INFO ───────────────────────────

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

// ─────────────────────────── RECAP ───────────────────────────

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

// ─────────────────────────── SEARCH SUGGESTIONS ───────────────────────────

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

// ─────────────────────────── NEW RELEASES ───────────────────────────

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

// ─────────────────────────── GET QUEUE ───────────────────────────

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
