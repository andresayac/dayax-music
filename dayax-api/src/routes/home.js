import { Router } from 'express';
import { getInnertube } from '../innertube.js';
import { mapTrack, mapAlbum } from '../mappers.js';
import { getTh, parseSections } from './helpers.js';

const router = Router();

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
                if (track && track.item_type !== 'video' && tracks.length < 20) {
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

export default router;
