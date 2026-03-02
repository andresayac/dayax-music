<template>
  <div class="playlist-page" v-if="playlist">
    <!-- Hero Header -->
    <header class="playlist-header">
      <div class="playlist-cover-wrap">
        <img
          :src="playlist.cover_big || playlist.cover_medium || playlist.cover"
          :alt="playlist.title"
          class="playlist-cover"
        />
      </div>
      <div class="playlist-meta">
        <span class="playlist-type">Playlist</span>
        <h1 class="playlist-title">{{ playlist.title }}</h1>
        <p class="playlist-desc" v-if="playlist.description">{{ playlist.description }}</p>
        <p class="playlist-stats">
          {{ playlist.nb_tracks }} canciones
          <span v-if="playlist.track_count_text"> · {{ playlist.track_count_text }}</span>
        </p>
      </div>
    </header>

    <!-- Actions -->
    <div class="playlist-actions">
      <Button
        icon="pi pi-play" label="Reproducir" rounded class="play-btn"
        @click="playAll"
        :disabled="!tracks.length"
      />
      <Button icon="pi pi-random" label="Aleatorio" severity="secondary" rounded outlined @click="shuffleAll" :disabled="!tracks.length" />
    </div>

    <!-- Track List -->
    <div class="tracks-list" v-if="tracks.length">
      <TrackItem
        v-for="(track, i) in tracks"
        :key="track.id + '-' + i"
        :track="track"
        :track-list="tracks"
        :index="i + 1"
      />
    </div>

    <div v-if="!isLoading && !tracks.length" class="empty-state">
      <i class="pi pi-list" style="font-size: 2rem; opacity: 0.3;"></i>
      <p>Esta playlist no tiene canciones</p>
    </div>
  </div>

  <!-- Loading State -->
  <div v-else-if="isLoading" class="loading-state">
    <div class="playlist-header">
      <Skeleton width="160px" height="160px" borderRadius="var(--radius-md)" />
      <div class="playlist-meta">
        <Skeleton width="80px" height="14px" />
        <Skeleton width="200px" height="28px" class="mt-2" />
        <Skeleton width="120px" height="14px" class="mt-2" />
      </div>
    </div>
    <Skeleton height="48px" v-for="i in 8" :key="i" class="mb-2" />
  </div>

  <!-- Error State -->
  <div v-else class="error-state">
    <i class="pi pi-exclamation-circle" style="font-size: 2rem; opacity: 0.3;"></i>
    <p>No se pudo cargar la playlist</p>
    <Button icon="pi pi-refresh" label="Reintentar" rounded size="small" @click="loadPlaylist" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { youtubeApi, type DayaxTrack, type DayaxPlaylist } from '@/api/youtube'
import { usePlayerStore } from '@/stores/player'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'

const route = useRoute()
const player = usePlayerStore()

const playlist = ref<DayaxPlaylist | null>(null)
const tracks = ref<DayaxTrack[]>([])
const isLoading = ref(true)

async function loadPlaylist() {
  isLoading.value = true
  playlist.value = null
  tracks.value = []
  try {
    const id = route.params.id as string
    const res = await youtubeApi.getPlaylist(id)
    playlist.value = res.data
    tracks.value = res.data.tracks?.data || []
  } catch (err) {
    console.error('Failed to load playlist:', err)
  } finally {
    isLoading.value = false
  }
}

function playAll() {
  if (tracks.value.length) {
    player.playTrack(tracks.value[0]!, tracks.value)
  }
}

function shuffleAll() {
  if (tracks.value.length) {
    const shuffled = [...tracks.value].sort(() => Math.random() - 0.5)
    player.playTrack(shuffled[0]!, shuffled)
  }
}

// Reload when route changes (e.g. navigating between playlists)
watch(() => route.params.id, () => { if (route.name === 'playlist') loadPlaylist() })

onMounted(() => loadPlaylist())
</script>

<style scoped>
.playlist-page { max-width: 900px; margin: 0 auto; }

.playlist-header {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 24px;
}

.playlist-cover {
  width: 160px;
  height: 160px;
  object-fit: cover;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-elevated);
  flex-shrink: 0;
}

.playlist-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-type {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--p-text-muted-color);
}

.playlist-title {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.playlist-desc {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.playlist-stats {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

.playlist-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.play-btn {
  background: var(--accent-gradient) !important;
  border: none !important;
  box-shadow: var(--shadow-glow);
}
.play-btn:hover { transform: scale(1.04); }

.tracks-list { display: flex; flex-direction: column; }

.loading-state, .error-state { max-width: 900px; margin: 0 auto; }
.loading-state { padding: 0; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 12px;
  color: var(--p-text-muted-color);
}
.error-state p { font-size: 0.85rem; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 8px;
  color: var(--p-text-muted-color);
}
.empty-state p { font-size: 0.82rem; }

/* Mobile: stack header */
@media (max-width: 600px) {
  .playlist-header { flex-direction: column; align-items: center; text-align: center; }
  .playlist-cover { width: 200px; height: 200px; }
  .playlist-title { font-size: 1.4rem; }
  .playlist-actions { justify-content: center; }
}

@media (min-width: 1025px) {
  .playlist-cover { width: 200px; height: 200px; }
  .playlist-title { font-size: 2.2rem; }
}
</style>
