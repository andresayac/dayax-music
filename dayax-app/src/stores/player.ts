import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { youtubeApi, type DayaxTrack } from '@/api/youtube'

const STORAGE_KEY = 'dayax_player'

interface PersistedState {
    queue?: DayaxTrack[]
    currentTrack?: DayaxTrack
    volume: number
    shuffleMode: boolean
    repeatMode: 'off' | 'all' | 'one'
}

function loadState(): Partial<PersistedState> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch { return {} }
}

function saveState(state: PersistedState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota */ }
}

export const usePlayerStore = defineStore('player', () => {
    const saved = loadState()

    // State
    const currentTrack = ref<DayaxTrack | null>(saved.currentTrack || null)
    const queue = ref<DayaxTrack[]>(saved.queue || [])
    const originalQueue = ref<DayaxTrack[]>([]) // pre-shuffle order
    const isPlaying = ref(false)
    const isLoading = ref(false)
    const currentTime = ref(0)
    const totalTime = ref(0)
    const volume = ref(saved.volume ?? 80)
    const shuffleMode = ref(saved.shuffleMode ?? false)
    const repeatMode = ref<'off' | 'all' | 'one'>(saved.repeatMode ?? 'off')
    const audioElement = ref<HTMLAudioElement | null>(null)

    // Abort controller for cleaning up listeners
    let listenerAbort: AbortController | null = null

    // Getters
    const currentIndex = computed(() => {
        if (!currentTrack.value) return -1
        return queue.value.findIndex((t) => t.id === currentTrack.value!.id)
    })

    const hasNext = computed(() => {
        if (currentIndex.value < 0) return false
        if (repeatMode.value !== 'off') return true
        return currentIndex.value < queue.value.length - 1
    })

    const hasPrev = computed(() => {
        if (currentIndex.value < 0) return false
        if (repeatMode.value !== 'off') return true
        return currentIndex.value > 0
    })

    const progress = computed(() => {
        if (totalTime.value === 0) return 0
        return (currentTime.value / totalTime.value) * 100
    })

    // Persist state on changes
    watch([queue, currentTrack, volume, shuffleMode, repeatMode], () => {
        saveState({
            queue: queue.value,
            currentTrack: currentTrack.value || undefined,
            volume: volume.value,
            shuffleMode: shuffleMode.value,
            repeatMode: repeatMode.value,
        })
    }, { deep: true })

    // Actions
    function setAudioElement(el: HTMLAudioElement) {
        // Clean up previous listeners (fix memory leak)
        if (listenerAbort) listenerAbort.abort()
        listenerAbort = new AbortController()
        const signal = listenerAbort.signal

        audioElement.value = el
        el.volume = volume.value / 100

        el.addEventListener('timeupdate', () => {
            currentTime.value = el.currentTime
        }, { signal })

        el.addEventListener('loadedmetadata', () => {
            totalTime.value = el.duration
        }, { signal })

        el.addEventListener('ended', () => {
            onTrackEnded()
        }, { signal })

        el.addEventListener('error', () => {
            isLoading.value = false
            isPlaying.value = false
        }, { signal })
    }

    function onTrackEnded() {
        if (repeatMode.value === 'one') {
            // Repeat same track
            if (audioElement.value) {
                audioElement.value.currentTime = 0
                audioElement.value.play().catch(() => { })
            }
            return
        }

        const idx = currentIndex.value
        if (idx < queue.value.length - 1) {
            playTrack(queue.value[idx + 1]!)
        } else if (repeatMode.value === 'all' && queue.value.length > 0) {
            playTrack(queue.value[0]!)
        } else {
            isPlaying.value = false
        }
    }

    async function playTrack(track: DayaxTrack, trackList?: DayaxTrack[]) {
        if (trackList) {
            originalQueue.value = [...trackList]
            if (shuffleMode.value) {
                queue.value = shuffleArray([...trackList], track)
            } else {
                queue.value = [...trackList]
            }
        }

        currentTrack.value = track
        totalTime.value = track.duration
        currentTime.value = 0
        isLoading.value = true

        try {
            // Audio proxy — server deciphers URL and pipes bytes directly
            const streamUrl = `/api/stream/${track.videoId}`

            if (audioElement.value) {
                audioElement.value.src = streamUrl
                audioElement.value.load()
                audioElement.value
                    .play()
                    .then(() => {
                        isPlaying.value = true
                        isLoading.value = false
                        updateMediaSession()
                    })
                    .catch((err) => {
                        console.warn('Playback failed:', err.message)
                        isPlaying.value = false
                        isLoading.value = false
                    })
            }
        } catch (err) {
            console.error('Failed to play track:', err)
            isLoading.value = false
            isPlaying.value = false
        }
    }

    function togglePlay() {
        if (!audioElement.value || !currentTrack.value) return

        if (isPlaying.value) {
            audioElement.value.pause()
            isPlaying.value = false
        } else {
            audioElement.value
                .play()
                .then(() => { isPlaying.value = true })
                .catch(() => { isPlaying.value = false })
        }
    }

    function playNext() {
        if (!hasNext.value || currentIndex.value < 0) return
        const nextIdx = currentIndex.value + 1
        if (nextIdx < queue.value.length) {
            playTrack(queue.value[nextIdx]!)
        } else if (repeatMode.value === 'all') {
            playTrack(queue.value[0]!)
        }
    }

    function playPrev() {
        // If more than 3s into song, restart it
        if (audioElement.value && audioElement.value.currentTime > 3) {
            audioElement.value.currentTime = 0
            return
        }
        if (!hasPrev.value || currentIndex.value <= 0) return
        playTrack(queue.value[currentIndex.value - 1]!)
    }

    function seekTo(percent: number) {
        if (audioElement.value && totalTime.value > 0) {
            audioElement.value.currentTime = (percent / 100) * totalTime.value
        }
    }

    function setVolume(val: number) {
        volume.value = val
        if (audioElement.value) {
            audioElement.value.volume = val / 100
        }
    }

    function addToQueue(track: DayaxTrack) {
        queue.value.push(track)
    }

    function addToQueueNext(track: DayaxTrack) {
        const idx = currentIndex.value
        if (idx >= 0) {
            queue.value.splice(idx + 1, 0, track)
        } else {
            queue.value.push(track)
        }
    }

    function removeFromQueue(index: number) {
        queue.value.splice(index, 1)
    }

    function clearQueue() {
        queue.value = []
        originalQueue.value = []
    }

    // Shuffle
    function toggleShuffle() {
        shuffleMode.value = !shuffleMode.value
        if (shuffleMode.value) {
            originalQueue.value = [...queue.value]
            queue.value = shuffleArray([...queue.value], currentTrack.value)
        } else {
            // Restore original order
            queue.value = [...originalQueue.value]
        }
    }

    function shuffleArray(arr: DayaxTrack[], keepFirst?: DayaxTrack | null): DayaxTrack[] {
        // Fisher-Yates shuffle, keeping current track at index 0
        const current = keepFirst ? arr.find(t => t.id === keepFirst.id) : null
        const rest = current ? arr.filter(t => t.id !== current.id) : arr
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i]!, rest[j]!] = [rest[j]!, rest[i]!]
        }
        return current ? [current, ...rest] : rest
    }

    // Repeat
    function toggleRepeat() {
        const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one']
        const idx = modes.indexOf(repeatMode.value)
        repeatMode.value = modes[(idx + 1) % 3]!
    }

    // MediaSession API
    function updateMediaSession() {
        if (!('mediaSession' in navigator) || !currentTrack.value) return
        const track = currentTrack.value

        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title_short || track.title,
            artist: track.artist.name,
            album: track.album.title,
            artwork: [
                { src: track.album.cover_small, sizes: '56x56', type: 'image/jpeg' },
                { src: track.album.cover_medium, sizes: '250x250', type: 'image/jpeg' },
                { src: track.album.cover_big, sizes: '500x500', type: 'image/jpeg' },
            ],
        })

        navigator.mediaSession.setActionHandler('play', () => togglePlay())
        navigator.mediaSession.setActionHandler('pause', () => togglePlay())
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrev())
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
    }

    function formatTime(secs: number): string {
        if (!secs || isNaN(secs)) return '0:00'
        const m = Math.floor(secs / 60)
        const s = Math.floor(secs % 60)
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return {
        currentTrack,
        queue,
        isPlaying,
        isLoading,
        currentTime,
        totalTime,
        volume,
        shuffleMode,
        repeatMode,
        audioElement,
        currentIndex,
        hasNext,
        hasPrev,
        progress,
        setAudioElement,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seekTo,
        setVolume,
        addToQueue,
        addToQueueNext,
        removeFromQueue,
        clearQueue,
        toggleShuffle,
        toggleRepeat,
        formatTime,
    }
})
