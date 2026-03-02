<template>
  <div class="queue-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">Cola de Reproducción</h1>
        <p class="page-subtitle" v-if="player.queue.length">{{ player.queue.length }} canciones</p>
      </div>
      <Button v-if="player.queue.length" icon="pi pi-trash" label="Limpiar" severity="secondary" text rounded size="small" @click="player.clearQueue()" />
    </header>

    <!-- Currently Playing -->
    <section v-if="player.currentTrack" class="now-playing-section">
      <h2 class="section-label">Reproduciendo ahora</h2>
      <div class="now-playing-card">
        <img :src="player.currentTrack.album.cover_small" :alt="player.currentTrack.title" class="np-cover" loading="lazy" />
        <div class="np-meta">
          <span class="np-title truncate">{{ player.currentTrack.title_short || player.currentTrack.title }}</span>
          <span class="np-artist truncate">{{ player.currentTrack.artist.name }}</span>
        </div>
        <div class="np-equalizer">
          <span class="bar" :class="{ paused: !player.isPlaying }"></span>
          <span class="bar" :class="{ paused: !player.isPlaying }"></span>
          <span class="bar" :class="{ paused: !player.isPlaying }"></span>
        </div>
      </div>
    </section>

    <!-- Queue List -->
    <section v-if="player.queue.length">
      <h2 class="section-label" v-if="player.currentTrack">Siguiente</h2>
      <div class="tracks-list stagger">
        <TrackItem v-for="(track, index) in player.queue" :key="track.id + '-' + index" :track="track" :track-list="player.queue" :index="index + 1" :show-remove="true" :queue-index="index" />
      </div>
    </section>

    <!-- Up Next Suggestions (when queue is empty but track is playing) -->
    <section v-if="!player.queue.length && player.currentTrack && suggestedTracks.length" class="suggested-section">
      <div class="suggested-header">
        <h2 class="section-label">
          <i class="pi pi-sparkles" style="color: var(--p-primary-color);"></i>
          Sugeridos para ti
        </h2>
        <Button label="Añadir todo" severity="secondary" text size="small" @click="addAllSuggested" />
      </div>
      <div class="tracks-list stagger">
        <TrackItem
          v-for="(track, index) in suggestedTracks"
          :key="'sug-' + track.id"
          :track="track"
          :track-list="suggestedTracks"
          :index="index + 1"
        />
      </div>
    </section>

    <!-- Loading suggestions -->
    <div v-if="!player.queue.length && player.currentTrack && suggestedLoading" class="loading-state">
      <h2 class="section-label">Cargando sugerencias...</h2>
      <Skeleton height="48px" v-for="i in 4" :key="i" class="mb-2" />
    </div>

    <div v-if="!player.queue.length && !player.currentTrack" class="empty-state">
      <i class="pi pi-list" style="font-size: 2.5rem; opacity: 0.2;"></i>
      <h2>La cola está vacía</h2>
      <p>Busca canciones y agrégalas a tu cola</p>
      <router-link to="/search" class="no-decoration">
        <Button icon="pi pi-search" label="Buscar Música" rounded />
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { youtubeApi, type DayaxTrack } from '@/api/youtube'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'

const player = usePlayerStore()

const suggestedTracks = ref<DayaxTrack[]>([])
const suggestedLoading = ref(false)
let lastSuggestedId = ''

async function loadSuggestions(videoId: string) {
  if (videoId === lastSuggestedId) return
  lastSuggestedId = videoId
  suggestedLoading.value = true
  try {
    const res = await youtubeApi.getUpNext(videoId)
    suggestedTracks.value = (res.data.data || []).slice(0, 10)
  } catch (err) {
    console.error('Failed to load suggestions:', err)
    suggestedTracks.value = []
  } finally {
    suggestedLoading.value = false
  }
}

function addAllSuggested() {
  for (const track of suggestedTracks.value) {
    player.addToQueue(track)
  }
  suggestedTracks.value = []
}

// Auto-load suggestions when queue is empty and a track is playing
watch(
  [() => player.currentTrack?.videoId, () => player.queue.length],
  ([videoId, queueLen]) => {
    if (videoId && queueLen === 0) {
      loadSuggestions(videoId)
    } else {
      suggestedTracks.value = []
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.queue-page { max-width: 900px; margin: 0 auto; }

.page-header { margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}
.page-subtitle { color: var(--p-text-muted-color); font-size: 0.8rem; }
.tracks-list { display: flex; flex-direction: column; }

/* Now Playing Section */
.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.now-playing-section { margin-bottom: 24px; }

.now-playing-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  border-left: 3px solid;
  border-image: var(--accent-gradient) 1;
}

.now-playing-card .np-cover {
  width: 48px; height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
  background: var(--p-surface-800);
}
.np-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.np-title { font-size: 0.9rem; font-weight: 600; }
.np-artist { font-size: 0.75rem; color: var(--p-text-muted-color); }

/* Equalizer bars animation */
.np-equalizer {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
}
.np-equalizer .bar {
  width: 3px;
  background: var(--p-primary-color);
  border-radius: 2px;
  animation: eqBounce 0.8s ease-in-out infinite alternate;
}
.np-equalizer .bar:nth-child(1) { height: 8px; animation-delay: 0s; }
.np-equalizer .bar:nth-child(2) { height: 16px; animation-delay: 0.2s; }
.np-equalizer .bar:nth-child(3) { height: 10px; animation-delay: 0.4s; }
.np-equalizer .bar.paused { animation-play-state: paused; }

@keyframes eqBounce {
  from { height: 4px; }
  to { height: 18px; }
}

/* Suggested Section */
.suggested-section { margin-top: 24px; }
.suggested-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.loading-state { padding: 20px 0; }
.mb-2 { margin-bottom: 8px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 10px;
}
.empty-state h2 { font-size: 1.2rem; font-weight: 700; }
.empty-state p { color: var(--p-text-muted-color); font-size: 0.8rem; }
.no-decoration { text-decoration: none; }

@media (min-width: 1025px) {
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 2rem; }
  .empty-state { padding: 80px 20px; }
}
</style>
