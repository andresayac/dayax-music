import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
})

export interface DayaxTrack {
    id: string
    title: string
    title_short: string
    duration: number
    videoId: string
    item_type?: string
    is_video?: boolean
    artist: {
        id: string
        name: string
        picture: string
        picture_small: string
        picture_medium: string
    }
    album: {
        id: string
        title: string
        cover: string
        cover_small: string
        cover_medium: string
        cover_big: string
    }
}

export interface DayaxArtist {
    id: string
    name: string
    description?: string
    picture: string
    picture_small: string
    picture_medium: string
    picture_big: string
    nb_fan: number
}

export interface DayaxAlbum {
    id: string
    title: string
    description?: string
    cover: string
    cover_small: string
    cover_medium: string
    cover_big: string
    nb_tracks: number
    year?: string
    artist: {
        id: string
        name: string
        picture: string
    }
}

export interface DayaxPlaylist {
    id: string
    title: string
    description: string
    cover: string
    cover_small: string
    cover_medium: string
    cover_big: string
    nb_tracks: number
    track_count_text?: string
    tracks: DayaxResponse<DayaxTrack>
}

export interface DayaxResponse<T> {
    data: T[]
    total?: number
}

export interface StreamInfo {
    url: string
    mimeType: string
    bitrate: number
    duration: number
}

export interface DayaxLyrics {
    lyrics: string | null
    source: string | null
}

export interface DayaxHomeSection {
    title: string
    strapline: string
    tracks: DayaxTrack[]
    albums: DayaxAlbum[]
    playlists: { id: string; title: string; description: string; cover: string; cover_small: string; cover_medium: string; cover_big: string }[]
}

export interface DayaxExploreSection {
    title: string
    strapline: string
    tracks: DayaxTrack[]
    albums: DayaxAlbum[]
    playlists: { id: string; title: string; description: string; cover: string; cover_small: string; cover_medium: string; cover_big: string }[]
    moodButtons: { text: string; browseId: string; params: string; color: string | null }[]
}

export interface DayaxMoodItem {
    text: string
    browseId: string
    params: string
    bgColor: string | null
}

export interface DayaxMoodSection {
    title: string
    items: DayaxMoodItem[]
}

export interface DayaxGenreSection {
    title: string
    playlists: { id: string; title: string; description: string; cover: string; cover_small: string; cover_medium: string; cover_big: string }[]
}

export interface DayaxChartSection {
    title: string
    tracks: DayaxTrack[]
    playlists: { id: string; title: string; description: string; cover: string; cover_small: string; cover_medium: string; cover_big: string }[]
}

export interface DayaxTrackInfo {
    id: string
    title: string
    duration: number
    videoId: string
    channel: { id: string; name: string }
    thumbnail: string
    thumbnail_small: string
    thumbnail_medium: string
    thumbnail_big: string
    is_live: boolean
    is_private: boolean
    view_count: number
    short_description: string
    tabs: string[]
}

export interface DayaxSearchAllResult {
    tracks: DayaxTrack[]
    artists: DayaxArtist[]
    albums: DayaxAlbum[]
    playlists: { id: string; title: string; description: string; thumbnail: string }[]
}

export interface DayaxSearchPlaylist {
    id: string
    title: string
    description: string
    cover: string
    cover_small: string
    cover_medium: string
    cover_big: string
}

export interface DayaxRecapSection {
    title: string
    tracks: DayaxTrack[]
}

export interface DayaxNewReleasesSection {
    title: string
    strapline: string
    albums: DayaxAlbum[]
    playlists: { id: string; title: string; description: string; cover: string; cover_small: string; cover_medium: string; cover_big: string }[]
}

export const youtubeApi = {
    // ─── Search ───
    searchAll(query: string, limit = 10) {
        return api.get<DayaxSearchAllResult>(`/search/all`, {
            params: { q: query, limit },
        })
    },

    searchTracks(query: string, limit = 10) {
        return api.get<DayaxResponse<DayaxTrack>>(`/search/tracks`, {
            params: { q: query, limit },
        })
    },

    searchVideos(query: string, limit = 10) {
        return api.get<DayaxResponse<DayaxTrack>>(`/search/videos`, {
            params: { q: query, limit },
        })
    },

    searchArtists(query: string, limit = 10) {
        return api.get<DayaxResponse<DayaxArtist>>(`/search/artists`, {
            params: { q: query, limit },
        })
    },

    searchAlbums(query: string, limit = 10) {
        return api.get<DayaxResponse<DayaxAlbum>>(`/search/albums`, {
            params: { q: query, limit },
        })
    },

    searchPlaylists(query: string, limit = 10) {
        return api.get<DayaxResponse<DayaxSearchPlaylist>>(`/search/playlists`, {
            params: { q: query, limit },
        })
    },

    getSearchSuggestions(query: string) {
        return api.get<{ suggestions: string[] }>(`/suggestions`, {
            params: { q: query },
        })
    },

    // ─── Browse ───
    getChart() {
        return api.get<{ tracks: DayaxResponse<DayaxTrack>; artists: DayaxResponse<DayaxArtist>; albums: DayaxResponse<DayaxAlbum> }>(`/chart`)
    },

    getHomeFeed(params?: string) {
        return api.get<{ chips: { text: string; params: string; selected?: boolean }[]; sections: DayaxHomeSection[] }>(`/home`, {
            params: params ? { params } : undefined,
        })
    },

    getExplore() {
        return api.get<{ topButtons: { text: string; browseId: string; icon: string }[]; sections: DayaxExploreSection[] }>(`/explore`)
    },

    getMoods() {
        return api.get<{ sections: DayaxMoodSection[] }>(`/moods`)
    },

    getGenre(params: string) {
        return api.get<{ title: string; sections: DayaxGenreSection[] }>(`/genre/${params}`)
    },

    getChartsBrowse(params?: string) {
        return api.get<{ countries: { text: string; params: string; selected: boolean }[]; sections: DayaxChartSection[] }>(`/charts-browse`, {
            params: params ? { params } : undefined,
        })
    },

    getRecap() {
        return api.get<{ sections: DayaxRecapSection[] }>(`/recap`)
    },

    getNewReleases() {
        return api.get<{ title: string; sections: DayaxNewReleasesSection[] }>(`/new-releases`)
    },

    getQueue(videoIds?: string[], playlistId?: string) {
        const params: Record<string, string> = {}
        if (videoIds?.length) params.videoIds = videoIds.join(',')
        if (playlistId) params.playlistId = playlistId
        return api.get<DayaxResponse<DayaxTrack>>(`/queue`, { params })
    },

    // ─── Artist ───
    getArtist(id: string) {
        return api.get<DayaxArtist>(`/artist/${id}`)
    },

    getArtistTopTracks(id: string, limit = 10) {
        return api.get<DayaxResponse<DayaxTrack>>(`/artist/${id}/top`, {
            params: { limit },
        })
    },

    getArtistAlbums(id: string, limit = 10) {
        return api.get<DayaxResponse<DayaxAlbum>>(`/artist/${id}/albums`, {
            params: { limit },
        })
    },

    // ─── Album & Playlist ───
    getAlbum(id: string) {
        return api.get<DayaxAlbum & { tracks: DayaxResponse<DayaxTrack>; release_date?: string }>(`/album/${id}`)
    },

    getPlaylist(id: string) {
        return api.get<DayaxPlaylist>(`/playlist/${id}`)
    },

    // ─── Playback & Info ───
    getStreamUrl(videoId: string) {
        return api.get<StreamInfo>(`/stream/${videoId}`)
    },

    /** Returns the direct download URL — use with window.open() or <a download> */
    getDownloadUrl(videoId: string) {
        return `${API_BASE}/stream/download/${videoId}`
    },

    getTrackInfo(videoId: string) {
        return api.get<DayaxTrackInfo>(`/track/${videoId}`)
    },

    getLyrics(videoId: string) {
        return api.get<DayaxLyrics>(`/lyrics/${videoId}`)
    },

    getUpNext(videoId: string) {
        return api.get<DayaxResponse<DayaxTrack> & { playlist_id?: string }>(`/up-next/${videoId}`)
    },

    getRelated(videoId: string) {
        return api.get<{ sections: { title: string; tracks: DayaxTrack[]; albums: DayaxAlbum[]; artists: DayaxArtist[] }[] }>(`/related/${videoId}`)
    },
}


