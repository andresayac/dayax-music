import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DayaxTrack } from '@/api/youtube'

const STORAGE_KEY = 'dayax_favorites'

function loadFavorites(): DayaxTrack[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

function saveFavorites(tracks: DayaxTrack[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)) } catch { /* quota */ }
}

export const useFavoritesStore = defineStore('favorites', () => {
    const tracks = ref<DayaxTrack[]>(loadFavorites())

    const count = computed(() => tracks.value.length)

    function isFavorite(trackId: string): boolean {
        return tracks.value.some(t => t.id === trackId)
    }

    function toggle(track: DayaxTrack) {
        const idx = tracks.value.findIndex(t => t.id === track.id)
        if (idx >= 0) {
            tracks.value.splice(idx, 1)
        } else {
            tracks.value.unshift(track)
        }
        saveFavorites(tracks.value)
    }

    function remove(trackId: string) {
        tracks.value = tracks.value.filter(t => t.id !== trackId)
        saveFavorites(tracks.value)
    }

    function clear() {
        tracks.value = []
        saveFavorites(tracks.value)
    }

    return { tracks, count, isFavorite, toggle, remove, clear }
})
