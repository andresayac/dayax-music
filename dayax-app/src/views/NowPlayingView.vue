<template>
  <div class="now-playing-page" v-if="player.currentTrack">
    <div class="ambient-bg" :style="ambientStyle"></div>

    <div class="np-content">
      <div class="np-cover-wrap">
        <img class="np-cover" :src="player.currentTrack.album.cover_big || player.currentTrack.album.cover_medium" :alt="player.currentTrack.title" />
      </div>

      <div class="np-info">
        <h1 class="np-title">{{ player.currentTrack.title_short || player.currentTrack.title }}</h1>
        <router-link :to="`/artist/${player.currentTrack.artist.id}`" class="np-artist">
          {{ player.currentTrack.artist.name }}
        </router-link>
        <router-link :to="`/album/${player.currentTrack.album.id}`" class="np-album">
          {{ player.currentTrack.album.title }}
        </router-link>
        <Button
          :icon="isLiked ? 'pi pi-heart-fill' : 'pi pi-heart'"
          :class="{ 'np-liked': isLiked }"
          severity="secondary" text rounded size="small"
          @click="toggleLike" class="np-like-btn"
        />
      </div>

      <div class="np-progress">
        <Slider v-model="progressValue" :max="100" class="np-slider" @change="onSeek" />
        <div class="np-times">
          <span>{{ player.formatTime(player.currentTime) }}</span>
          <span>{{ player.formatTime(player.totalTime) }}</span>
        </div>
      </div>

      <div class="np-controls">
        <Button
          icon="pi pi-replay"
          :severity="player.shuffleMode ? undefined : 'secondary'"
          :class="{ 'np-active-mode': player.shuffleMode }"
          text rounded size="small"
          @click="player.toggleShuffle()"
        />
        <Button icon="pi pi-step-backward" severity="secondary" text rounded :disabled="!player.hasPrev" @click="player.playPrev()" />
        <Button
          :icon="player.isLoading ? 'pi pi-spin pi-spinner' : player.isPlaying ? 'pi pi-pause' : 'pi pi-play'"
          rounded class="np-play-btn" @click="player.togglePlay()"
        />
        <Button icon="pi pi-step-forward" severity="secondary" text rounded :disabled="!player.hasNext" @click="player.playNext()" />
        <Button
          icon="pi pi-sync"
          :severity="player.repeatMode !== 'off' ? undefined : 'secondary'"
          :class="{ 'np-active-mode': player.repeatMode !== 'off' }"
          text rounded size="small"
          @click="player.toggleRepeat()"
        />
      </div>

      <div class="np-volume">
        <Button
          :icon="player.volume > 50 ? 'pi pi-volume-up' : player.volume > 0 ? 'pi pi-volume-down' : 'pi pi-volume-off'"
          severity="secondary" text rounded size="small" @click="toggleMute"
        />
        <Slider v-model="volumeValue" :max="100" class="np-vol-slider" @change="onVolumeChange" />
      </div>
    </div>

    <!-- TABS: Siguiente | Letras | Relacionados -->
    <div class="np-tabs-section">
      <div class="np-tab-bar">
        <button
          v-for="tab in tabs" :key="tab.key"
          class="np-tab" :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon"></i>
          {{ tab.label }}
        </button>
      </div>

      <!-- Up Next Tab -->
      <div v-if="activeTab === 'upnext'" class="np-tab-content">
        <div v-if="upNextLoading" class="tab-loading">
          <Skeleton height="48px" v-for="i in 5" :key="i" class="mb-2" />
        </div>
        <div v-else-if="upNextTracks.length" class="tracks-list">
          <TrackItem
            v-for="(track, i) in upNextTracks"
            :key="track.id + '-' + i"
            :track="track"
            :track-list="upNextTracks"
            :index="i + 1"
          />
        </div>
        <div v-else class="tab-empty">
          <i class="pi pi-list"></i>
          <p>No hay canciones sugeridas</p>
        </div>
      </div>

      <!-- Lyrics Tab -->
      <div v-if="activeTab === 'lyrics'" class="np-tab-content">
        <div v-if="lyricsLoading" class="tab-loading">
          <Skeleton height="16px" width="80%" v-for="i in 10" :key="i" class="mb-2" />
        </div>
        <div v-else-if="lyricsText" class="lyrics-container">
          <pre class="lyrics-text">{{ lyricsText }}</pre>
          <p v-if="lyricsSource" class="lyrics-source">{{ lyricsSource }}</p>
        </div>
        <div v-else class="tab-empty">
          <i class="pi pi-file"></i>
          <p>No hay letras disponibles para esta canción</p>
        </div>
      </div>

      <!-- Related Tab -->
      <div v-if="activeTab === 'related'" class="np-tab-content">
        <div v-if="relatedLoading" class="tab-loading">
          <Skeleton height="48px" v-for="i in 5" :key="i" class="mb-2" />
        </div>
        <template v-else-if="relatedSections.length">
          <section v-for="section in relatedSections" :key="section.title" class="related-section">
            <h3 class="related-title">{{ section.title }}</h3>
            <div v-if="section.tracks.length" class="tracks-list">
              <TrackItem
                v-for="(track, i) in section.tracks.slice(0, 6)"
                :key="track.id"
                :track="track"
                :track-list="section.tracks"
                :index="i + 1"
              />
            </div>
            <div v-if="section.artists.length" class="h-scroll-row">
              <ArtistCard v-for="a in section.artists.slice(0, 6)" :key="a.id" :artist="a" />
            </div>
          </section>
        </template>
        <div v-else class="tab-empty">
          <i class="pi pi-th-large"></i>
          <p>No hay contenido relacionado</p>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="empty-state">
    <i class="pi pi-headphones" style="font-size: 2.5rem; opacity: 0.2;"></i>
    <h2>Nada reproduciéndose</h2>
    <p>Busca y reproduce una canción para verla aquí</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useFavoritesStore } from '@/stores/favorites'
import { useToast } from 'primevue/usetoast'
import { youtubeApi, type DayaxTrack, type DayaxArtist } from '@/api/youtube'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'
import ArtistCard from '@/components/shared/ArtistCard.vue'

const player = usePlayerStore()
const favorites = useFavoritesStore()
const toast = useToast()
const progressValue = ref(0)
const volumeValue = ref(player.volume)
let prevVolume = 80

const isLiked = computed(() => player.currentTrack ? favorites.isFavorite(player.currentTrack.id) : false)
function toggleLike() {
  if (!player.currentTrack) return
  favorites.toggle(player.currentTrack)
  toast.add({ severity: 'success', summary: favorites.isFavorite(player.currentTrack.id) ? 'Añadido a favoritos' : 'Quitado de favoritos', life: 2000 })
}

watch(() => player.progress, (val) => { progressValue.value = Math.round(val) }, { immediate: true })
watch(() => player.volume, (val) => { volumeValue.value = val })

const ambientStyle = computed(() => {
  if (!player.currentTrack) return {}
  return { backgroundImage: `url(${player.currentTrack.album.cover_big || player.currentTrack.album.cover_medium})` }
})

function onSeek(val: number | number[]) { player.seekTo(Array.isArray(val) ? val[0]! : val) }
function onVolumeChange(val: number | number[]) { player.setVolume(Array.isArray(val) ? val[0]! : val) }
function toggleMute() {
  if (player.volume > 0) { prevVolume = player.volume; player.setVolume(0); volumeValue.value = 0 }
  else { player.setVolume(prevVolume); volumeValue.value = prevVolume }
}

// ─── Tabs ───
const tabs = [
  { key: 'upnext', label: 'Siguiente', icon: 'pi pi-list' },
  { key: 'lyrics', label: 'Letras', icon: 'pi pi-file' },
  { key: 'related', label: 'Relacionados', icon: 'pi pi-th-large' },
]

const activeTab = ref('upnext')

// Up Next
const upNextTracks = ref<DayaxTrack[]>([])
const upNextLoading = ref(false)

async function loadUpNext(videoId: string) {
  upNextLoading.value = true
  try {
    const res = await youtubeApi.getUpNext(videoId)
    upNextTracks.value = res.data.data || []
  } catch (err) {
    console.error('Failed to load up next:', err)
    upNextTracks.value = []
  } finally {
    upNextLoading.value = false
  }
}

// Lyrics
const lyricsText = ref<string | null>(null)
const lyricsSource = ref<string | null>(null)
const lyricsLoading = ref(false)

async function loadLyrics(videoId: string) {
  lyricsLoading.value = true
  try {
    const res = await youtubeApi.getLyrics(videoId)
    lyricsText.value = res.data.lyrics
    lyricsSource.value = res.data.source
  } catch (err) {
    console.error('Failed to load lyrics:', err)
    lyricsText.value = null
    lyricsSource.value = null
  } finally {
    lyricsLoading.value = false
  }
}

// Related
const relatedSections = ref<{ title: string; tracks: DayaxTrack[]; artists: DayaxArtist[] }[]>([])
const relatedLoading = ref(false)

async function loadRelated(videoId: string) {
  relatedLoading.value = true
  try {
    const res = await youtubeApi.getRelated(videoId)
    relatedSections.value = res.data.sections || []
  } catch (err) {
    console.error('Failed to load related:', err)
    relatedSections.value = []
  } finally {
    relatedLoading.value = false
  }
}

// Watch for track changes — reload all tab data
let lastVideoId = ''
watch(
  () => player.currentTrack?.videoId,
  (videoId) => {
    if (!videoId || videoId === lastVideoId) return
    lastVideoId = videoId
    // Reset
    upNextTracks.value = []
    lyricsText.value = null
    lyricsSource.value = null
    relatedSections.value = []
    // Load active tab's data
    loadActiveTabData(videoId)
  },
  { immediate: true }
)

// Also load when tab changes
watch(activeTab, () => {
  const videoId = player.currentTrack?.videoId
  if (videoId) loadActiveTabData(videoId)
})

function loadActiveTabData(videoId: string) {
  if (activeTab.value === 'upnext' && !upNextTracks.value.length) loadUpNext(videoId)
  if (activeTab.value === 'lyrics' && lyricsText.value === null) loadLyrics(videoId)
  if (activeTab.value === 'related' && !relatedSections.value.length) loadRelated(videoId)
}
</script>

<style scoped>
.now-playing-page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: calc(100vh - var(--player-height) - 56px);
  min-height: calc(100dvh - var(--player-height) - 56px);
  overflow: hidden;
  padding: 20px 0;
}

.ambient-bg {
  position: fixed;
  inset: -60px;
  background-size: cover;
  background-position: center;
  filter: blur(80px) saturate(1.5) brightness(0.3);
  opacity: 0.6;
  z-index: 0;
  transition: background-image 0.8s ease;
  pointer-events: none;
}

.np-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 360px;
  padding: 0 16px;
}

.np-cover {
  width: 260px;
  height: 260px;
  object-fit: cover;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-elevated);
}

.np-info { text-align: center; display: flex; flex-direction: column; gap: 3px; width: 100%; }
.np-title { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.02em; }
.np-artist { font-size: 0.85rem; color: var(--p-text-muted-color); transition: color var(--transition-fast); }
.np-artist:hover { color: var(--p-primary-color); }
.np-album { font-size: 0.75rem; color: var(--p-text-muted-color); }
.np-album:hover { color: var(--p-text-color); }

.np-like-btn { margin-top: 4px; }
.np-liked { color: var(--p-primary-color) !important; }

.np-progress { width: 100%; }
.np-slider { width: 100%; }
.np-times {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}

.np-controls { display: flex; align-items: center; gap: 16px; }
.np-active-mode { color: var(--p-primary-color) !important; }

.np-play-btn {
  width: 52px !important; height: 52px !important;
  background: var(--accent-gradient) !important; border: none !important;
  box-shadow: var(--shadow-glow);
}
.np-play-btn:hover { transform: scale(1.08); box-shadow: 0 0 50px var(--accent-glow) !important; }

.np-volume {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 200px;
}
.np-vol-slider { flex: 1; }

/* ─── TABS ─── */
.np-tabs-section {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 600px;
  margin-top: 32px;
  padding: 0 16px;
}

.np-tab-bar {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 16px;
}

.np-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.np-tab i { font-size: 0.8rem; }

.np-tab:hover { color: var(--p-text-color); }

.np-tab.active {
  background: rgba(255, 255, 255, 0.08);
  color: var(--p-text-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.np-tab-content {
  min-height: 200px;
  padding-bottom: 40px;
}

.tab-loading { display: flex; flex-direction: column; gap: 8px; }
.mb-2 { margin-bottom: 8px; }

.tab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--p-text-muted-color);
  text-align: center;
}
.tab-empty i { font-size: 1.8rem; opacity: 0.3; }
.tab-empty p { font-size: 0.82rem; }

/* Lyrics */
.lyrics-container {
  padding: 8px 0;
}

.lyrics-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.9;
  color: var(--p-text-color);
  letter-spacing: 0.01em;
  background: none;
  margin: 0;
  padding: 0;
}

.lyrics-source {
  margin-top: 20px;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  font-style: italic;
  text-align: center;
}

/* Related */
.related-section { margin-bottom: 20px; }
.related-title {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--p-text-color);
}

.tracks-list { display: flex; flex-direction: column; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 8px;
}
.empty-state h2 { font-size: 1.2rem; font-weight: 700; }
.empty-state p { color: var(--p-text-muted-color); font-size: 0.8rem; }

/* Mobile adjustments */
@media (max-width: 1024px) {
  .now-playing-page {
    min-height: calc(100dvh - var(--bottom-nav-height) - var(--mini-player-height) - 40px);
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .np-cover { width: 300px; height: 300px; }
  .np-title { font-size: 1.4rem; }
  .np-content { gap: 20px; max-width: 400px; }
  .np-controls { gap: 28px; }
  .np-play-btn { width: 56px !important; height: 56px !important; }
  .np-tabs-section { max-width: 700px; }
}
</style>
