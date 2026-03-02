<template>
  <div class="album-page" v-if="album">
    <div class="album-hero">
      <div class="album-cover-large">
        <img :src="album.cover_big || album.cover_medium" :alt="album.title" />
      </div>
      <div class="album-info">
        <span class="album-type">Álbum</span>
        <h1 class="album-title">{{ album.title }}</h1>
        <div class="album-meta-line">
          <router-link v-if="album.artist" :to="`/artist/${album.artist.id}`" class="album-artist-link">
            {{ album.artist.name }}
          </router-link>
          <span v-if="album.release_date" class="meta-dot">• {{ album.release_date?.split('-')[0] }}</span>
          <span v-if="album.nb_tracks" class="meta-dot">• {{ album.nb_tracks }} canciones</span>
        </div>
      </div>
    </div>

    <div class="album-actions">
      <Button icon="pi pi-play" rounded class="hero-play-btn" @click="playAll" />
      <Button icon="pi pi-shuffle" severity="secondary" text rounded size="small" />
    </div>

    <section class="album-tracks">
      <div class="tracks-table-header">
        <span class="col-index">#</span>
        <span class="col-title">Título</span>
        <span class="col-duration"><i class="pi pi-clock"></i></span>
      </div>
      <div class="tracks-list stagger">
        <TrackItem v-for="(track, i) in tracks" :key="track.id" :track="track" :track-list="tracks" :index="i + 1" />
      </div>
    </section>
  </div>

  <!-- Loading Skeleton -->
  <div v-else-if="isLoading" class="album-page">
    <div class="album-hero">
      <div class="album-cover-large">
        <Skeleton width="180px" height="180px" borderRadius="var(--radius-lg)" />
      </div>
      <div class="album-info" style="gap: 8px;">
        <Skeleton width="50px" height="12px" />
        <Skeleton width="200px" height="28px" />
        <Skeleton width="120px" height="14px" />
        <Skeleton width="80px" height="12px" />
      </div>
    </div>
    <div style="margin-top: 16px;">
      <div v-for="i in 6" :key="i" class="skeleton-track">
        <Skeleton width="24px" height="16px" />
        <Skeleton width="44px" height="44px" borderRadius="4px" />
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <Skeleton width="50%" height="14px" />
          <Skeleton width="30%" height="10px" />
        </div>
        <Skeleton width="40px" height="10px" />
      </div>
    </div>
  </div>

  <!-- Error State -->
  <div v-else class="error-state">
    <i class="pi pi-wifi" style="font-size: 2rem; opacity: 0.3;"></i>
    <p>No se pudo cargar el álbum</p>
    <Button icon="pi pi-refresh" label="Reintentar" rounded size="small" @click="loadAlbum(String(route.params.id))" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { youtubeApi, type DayaxAlbum, type DayaxTrack } from '@/api/youtube'
import { usePlayerStore } from '@/stores/player'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'

const route = useRoute()
const player = usePlayerStore()
const album = ref<(DayaxAlbum & { tracks?: { data: DayaxTrack[] }; release_date?: string }) | null>(null)
const tracks = ref<DayaxTrack[]>([])
const isLoading = ref(true)
const hasError = ref(false)

async function loadAlbum(id: string) {
  isLoading.value = true
  hasError.value = false
  album.value = null
  try {
    const res = await youtubeApi.getAlbum(id)
    album.value = res.data
    document.title = `${res.data.title} — Dayax`
    if (res.data.tracks?.data) {
      tracks.value = res.data.tracks.data.map((t: DayaxTrack) => ({
        ...t,
        album: {
          id: res.data.id, title: res.data.title,
          cover: res.data.cover, cover_small: res.data.cover_small,
          cover_medium: res.data.cover_medium, cover_big: res.data.cover_big,
        },
      }))
    }
  } catch (err) {
    console.error('Failed to load album:', err)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

function playAll() {
  if (tracks.value.length) player.playTrack(tracks.value[0]!, tracks.value)
}

onMounted(() => loadAlbum(String(route.params.id)))
watch(() => route.params.id, (id) => { if (id) loadAlbum(String(id)) })
</script>

<style scoped>
.album-page { max-width: 1100px; margin: 0 auto; }

.album-hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
  align-items: center;
  text-align: center;
}

.album-cover-large img {
  width: 180px;
  height: 180px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  background: var(--p-surface-800);
}

.album-info { display: flex; flex-direction: column; gap: 4px; align-items: center; }
.album-type { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--p-text-muted-color); }
.album-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }

.album-meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  flex-wrap: wrap;
  justify-content: center;
}
.album-artist-link { color: var(--p-text-color); font-weight: 600; transition: color var(--transition-fast); text-decoration: none; }
.album-artist-link:hover { color: var(--p-primary-color); text-decoration: underline; }
.meta-dot { color: var(--p-text-muted-color); }

/* Actions bar (Spotify-style: big green play + shuffle) */
.album-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.hero-play-btn {
  width: 56px !important;
  height: 56px !important;
  font-size: 1.4rem !important;
  background: var(--p-primary-color) !important;
  color: var(--p-surface-950) !important;
  border: none !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast) !important;
}
.hero-play-btn:hover { transform: scale(1.06) !important; }

/* Track table header (Spotify: #, Title, duration) */
.tracks-table-header {
  display: flex;
  align-items: center;
  padding: 0 16px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 4px;
  color: var(--p-text-muted-color);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.col-index { width: 32px; text-align: center; }
.col-title { flex: 1; }
.col-duration { width: 60px; text-align: right; }

.album-tracks { margin-top: 8px; }
.tracks-list { display: flex; flex-direction: column; }

.skeleton-track {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  margin-bottom: 4px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

/* Desktop */
@media (min-width: 1025px) {
  .album-hero {
    flex-direction: row;
    align-items: flex-end;
    text-align: left;
    gap: 28px;
  }
  .album-info { align-items: flex-start; }
  .album-meta-line { justify-content: flex-start; }
  .album-cover-large img { width: 232px; height: 232px; }
  .album-title { font-size: 2.2rem; }
}
</style>
