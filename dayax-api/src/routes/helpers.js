import { mapTrack, mapArtist, mapAlbum, mapSection } from '../mappers.js';

// Helper: extract thumbnail URL at a minimum width from any shape
export function getTh(thumbContainer, minW) {
    const list = extractThumbList(thumbContainer);
    if (!list.length) return '';
    const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
    const m = sorted.find(t => (t.width || 0) >= minW);
    return (m || sorted[sorted.length - 1])?.url || '';
}

export function extractThumbList(item) {
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

// Helper to parse home feed sections into our format
export function parseSections(rawSections) {
    return (rawSections || [])
        .map(section => {
            const mapped = mapSection(section);
            if (!mapped || !mapped.items.length) return null;

            const tracks = [];
            const albums = [];
            const playlists = [];

            for (const item of mapped.items) {
                const track = mapTrack(item);
                if (track) {
                    // Skip video items — only include songs
                    if (track.item_type === 'video') continue;
                    tracks.push(track);
                    continue;
                }

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

            if (!tracks.length && !albums.length && !playlists.length) return null;

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
