/**
 * Maps YouTube Music data → Dayax-compatible formats.
 * Handles various item types: MusicResponsiveListItem, MusicTwoRowItem, etc.
 */

/**
 * Safely extract text from YouTube.js text fields.
 * Text objects can be: string, { text: string, runs: [...] }, or other shapes.
 */
function getText(field) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return String(field);
    // Text objects with .text property (e.g., { text: "Fix You", runs: [...] })
    if (field.text && typeof field.text === 'string') return field.text;
    // Arrays of runs
    if (Array.isArray(field.runs)) {
        return field.runs.map(r => r.text || '').join('');
    }
    if (Array.isArray(field)) {
        return field.map(f => getText(f)).filter(Boolean).join(', ');
    }
    // Last resort — avoid [object Object]
    return '';
}

/**
 * Get thumbnail URL at desired minimum width.
 * Thumbnails can come in many different container shapes from YouTube.js.
 */
function getThumbnails(item) {
    if (!item) return [];
    // Direct array of { url, width, height }
    if (Array.isArray(item)) return item.filter(t => t && t.url);
    // Nested .contents (e.g., thumbnail: { contents: [...] })
    if (Array.isArray(item.contents)) {
        // contents can be thumbnail objects directly, or wrappers with image.sources
        const all = [];
        for (const c of item.contents) {
            if (c.url) { all.push(c); continue; }
            if (c.image?.sources) { all.push(...c.image.sources); continue; }
            if (c.thumbnails) { all.push(...c.thumbnails); continue; }
            if (Array.isArray(c)) { all.push(...c.filter(t => t?.url)); }
        }
        if (all.length) return all;
    }
    // Nested .image?.sources (for some items)
    if (item.image?.sources) return item.image.sources;
    // Single thumbnail
    if (item.url) return [item];
    // Fallback — try all iterable properties
    if (item.thumbnails) return getThumbnails(item.thumbnails);
    return [];
}

function getThumbnailUrl(thumbnails, minWidth = 0) {
    const list = getThumbnails(thumbnails);
    if (!list.length) return '';
    const sorted = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
    const match = sorted.find(t => (t.width || 0) >= minWidth);
    return (match || sorted[sorted.length - 1])?.url || '';
}

/**
 * Extract artist info from various item shapes.
 */
function extractArtists(item) {
    // Direct artists array
    if (Array.isArray(item.artists) && item.artists.length) {
        return item.artists.map(a => ({
            name: getText(a.name) || getText(a),
            id: a.channel_id || a.id || a.browse_id || '',
        }));
    }
    // From flex columns (MusicResponsiveListItem)
    if (item.flex_columns && item.flex_columns.length > 1) {
        const col1 = item.flex_columns[1];
        const runs = col1?.title?.runs || [];
        const artists = [];
        for (const run of runs) {
            if (run.endpoint?.payload?.browseId && !run.text?.includes('play')) {
                artists.push({
                    name: run.text || '',
                    id: run.endpoint.payload.browseId || '',
                });
            }
        }
        if (artists.length) return artists;
    }
    // author field
    if (item.author) {
        return [{
            name: getText(item.author.name) || getText(item.author),
            id: item.author.channel_id || item.author.id || '',
        }];
    }
    return [];
}

/**
 * Extract album info from various item shapes.
 */
function extractAlbum(item) {
    // Direct album object
    if (item.album && typeof item.album === 'object' && item.album.name) {
        return {
            id: item.album.id || item.album.browse_id || '',
            title: getText(item.album.name),
        };
    }
    // From flex columns (MusicResponsiveListItem) — col 2 is album
    if (item.flex_columns && item.flex_columns.length > 2) {
        const col2 = item.flex_columns[2];
        const runs = col2?.title?.runs || [];
        if (runs.length) {
            return {
                id: runs[0]?.endpoint?.payload?.browseId || '',
                title: runs[0]?.text || getText(col2?.title),
            };
        }
    }
    return { id: '', title: '' };
}

// ─────────────────────────── PUBLIC MAPPERS ───────────────────────────

export function mapTrack(item) {
    if (!item) return null;

    const type = item.type || '';

    // Get video ID from different possible locations
    const videoId = item.id || item.video_id
        || item.overlay?.content?.endpoint?.payload?.videoId
        || item.endpoint?.payload?.videoId
        || '';

    // Skip non-playable items (album browse IDs, playlists, etc.)
    if (!videoId || videoId.startsWith('MPRE') || videoId.startsWith('VL') || videoId.startsWith('UC')) {
        return null;
    }

    // Title
    let title = '';
    if (type === 'MusicResponsiveListItem' && item.flex_columns?.length) {
        title = getText(item.flex_columns[0]?.title);
    } else {
        title = getText(item.title) || getText(item.name);
    }

    if (!title) return null;

    // Artists
    const artists = extractArtists(item);
    const artistName = artists.map(a => a.name).filter(Boolean).join(', ');
    const artistId = artists[0]?.id || '';

    // Album
    const album = extractAlbum(item);

    // Thumbnails
    const thumbs = getThumbnails(item.thumbnail) || getThumbnails(item.thumbnails);

    // Duration
    const duration = item.duration?.seconds || item.duration_seconds || 0;

    // Item type (song, video, etc.)
    const itemType = item.item_type || '';

    return {
        id: videoId,
        title,
        title_short: title.length > 40 ? title.substring(0, 40) + '…' : title,
        duration,
        videoId,
        item_type: itemType,
        is_video: itemType === 'video',
        artist: {
            id: artistId,
            name: artistName,
            picture: getThumbnailUrl(thumbs, 56),
            picture_small: getThumbnailUrl(thumbs, 56),
            picture_medium: getThumbnailUrl(thumbs, 226),
        },
        album: {
            id: album.id,
            title: album.title,
            cover: getThumbnailUrl(thumbs, 120),
            cover_small: getThumbnailUrl(thumbs, 56),
            cover_medium: getThumbnailUrl(thumbs, 226),
            cover_big: getThumbnailUrl(thumbs, 500),
        },
    };
}

export function mapArtist(item) {
    if (!item) return null;

    const id = item.id || item.browse_id || item.channel_id || '';
    const name = getText(item.name) || getText(item.title) || '';
    const thumbs = getThumbnails(item.thumbnail) || getThumbnails(item.thumbnails);
    const subscribers = getText(item.subscribers) || getText(item.subscriber_count) || '';

    if (!name) return null;

    return {
        id,
        name,
        picture: getThumbnailUrl(thumbs, 120),
        picture_small: getThumbnailUrl(thumbs, 56),
        picture_medium: getThumbnailUrl(thumbs, 226),
        picture_big: getThumbnailUrl(thumbs, 500),
        nb_fan: parseSubscribers(subscribers),
    };
}

export function mapAlbum(item) {
    if (!item) return null;

    const id = item.id || item.browse_id || '';
    const title = getText(item.title) || getText(item.name) || '';

    if (!title) return null;

    const artists = extractArtists(item);
    const artistName = artists.map(a => a.name).filter(Boolean).join(', ');
    const artistId = artists[0]?.id || '';

    // For MusicTwoRowItem, subtitle often has artist info
    const subtitle = getText(item.subtitle);
    const finalArtistName = artistName || subtitle || '';

    const thumbs = getThumbnails(item.thumbnail) || getThumbnails(item.thumbnails);
    const year = getText(item.year) || '';

    return {
        id,
        title,
        cover: getThumbnailUrl(thumbs, 120),
        cover_small: getThumbnailUrl(thumbs, 56),
        cover_medium: getThumbnailUrl(thumbs, 226),
        cover_big: getThumbnailUrl(thumbs, 500),
        nb_tracks: item.track_count || item.nb_tracks || 0,
        year,
        artist: {
            id: artistId,
            name: finalArtistName,
            picture: getThumbnailUrl(thumbs, 56),
        },
    };
}

/**
 * Map a home feed section to a client-friendly format.
 */
export function mapSection(section) {
    if (!section) return null;

    const title = getText(section.header?.title) || getText(section.title) || '';
    const strapline = getText(section.header?.strapline) || getText(section.header?.subtitle) || '';
    const contents = section.contents || [];

    return {
        title,
        strapline,
        type: section.type || '',
        items: contents,
    };
}

// ─────────────────────────── HELPERS ───────────────────────────

function parseSubscribers(text) {
    if (!text) return 0;
    const str = text.toString().toLowerCase().replace(/\s/g, '');
    const match = str.match(/([\d.]+)\s*(m|k|mil|millones)?/);
    if (!match) return 0;
    let num = parseFloat(match[1]);
    const suffix = match[2];
    if (suffix === 'm' || suffix === 'millones') num *= 1_000_000;
    else if (suffix === 'k' || suffix === 'mil') num *= 1_000;
    return Math.round(num);
}
