import { defineStore } from 'pinia'
import { ref } from 'vue'
import { youtubeApi, type DayaxTrack, type DayaxArtist, type DayaxAlbum, type DayaxSearchPlaylist } from '@/api/youtube'

export type SearchTab = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists'

export const useSearchStore = defineStore('search', () => {
    const query = ref('')
    const activeTab = ref<SearchTab>('all')
    const isLoading = ref(false)
    const tracks = ref<DayaxTrack[]>([])
    const artists = ref<DayaxArtist[]>([])
    const albums = ref<DayaxAlbum[]>([])
    const playlists = ref<DayaxSearchPlaylist[]>([])

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    async function search(q: string) {
        query.value = q
        if (!q.trim()) {
            tracks.value = []
            artists.value = []
            albums.value = []
            playlists.value = []
            return
        }

        isLoading.value = true

        try {
            const [tracksRes, artistsRes, albumsRes, playlistsRes] = await Promise.all([
                youtubeApi.searchTracks(q, 8),
                youtubeApi.searchArtists(q, 6),
                youtubeApi.searchAlbums(q, 6),
                youtubeApi.searchPlaylists(q, 6),
            ])

            tracks.value = tracksRes.data.data
            artists.value = artistsRes.data.data
            albums.value = albumsRes.data.data
            playlists.value = playlistsRes.data.data
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            isLoading.value = false
        }
    }

    function debouncedSearch(q: string) {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => search(q), 400)
    }

    function setTab(tab: SearchTab) {
        activeTab.value = tab
    }

    function cancelPending() {
        if (debounceTimer) {
            clearTimeout(debounceTimer)
            debounceTimer = null
        }
    }

    return {
        query,
        activeTab,
        isLoading,
        tracks,
        artists,
        albums,
        playlists,
        search,
        debouncedSearch,
        setTab,
        cancelPending,
    }
})
