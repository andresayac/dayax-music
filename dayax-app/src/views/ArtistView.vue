<template>
  <div class="artist-page" v-if="artist">
    <div class="artist-hero">
      <img class="artist-hero-img" :src="artist.picture_big || artist.picture_medium" :alt="artist.name" />
      <div class="artist-hero-overlay">
        <h1 class="artist-name">{{ artist.name }}</h1>
        <p class="artist-fans" v-if="artist.nb_fan">{{ formatFans(artist.nb_fan) }} oyentes</p>
      </div>
    </div>

    <div class="artist-actions">
      <Button icon="pi pi-play" rounded class="hero-play-btn" @click="playTopTracks" />
      <Button icon="pi pi-shuffle" severity="secondary" text rounded size="small" v-tooltip.top="'Aleatorio'" />
    </div>

    <section class="section" v-if="topTracks.length">
      <h2 class="section-title">Popular</h2>
      <div class="tracks-list stagger">
        <TrackItem v-for="(track, i) in visibleTracks" :key="track.id" :track="track" :track-list="topTracks" :index="i + 1" />
      </div>
      <router-link v-if="songsPlaylistId && totalSongs > 5" :to="`/playlist/${songsPlaylistId}`" class="show-all-btn">
        Mostrar todo
      </router-link>
    </section>

    <section class="section" v-if="albums.length">
      <h2 class="section-title">Discografía</h2>
      <div class="h-scroll-row stagger">
        <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
      </div>
    </section>
  </div>

  <!-- Loading Skeleton -->
  <div v-else-if="isLoading" class="artist-page">
    <div class="skeleton-hero">
      <Skeleton width="100%" height="100%" />
    </div>
    <div class="section">
      <Skeleton width="180px" height="24px" class="mb-3" />
      <div v-for="i in 5" :key="i" class="skeleton-track">
        <Skeleton width="24px" height="16px" />
        <Skeleton width="44px" height="44px" borderRadius="4px" />
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <Skeleton width="60%" height="14px" />
          <Skeleton width="40%" height="10px" />
        </div>
        <Skeleton width="50px" height="10px" />
      </div>
    </div>
  </div>

  <!-- Error State -->
  <div v-else class="error-state">
    <i class="pi pi-wifi" style="font-size: 2rem; opacity: 0.3;"></i>
    <p>No se pudo cargar el artista</p>
    <Button icon="pi pi-refresh" label="Reintentar" rounded size="small" @click="loadArtist(String(route.params.id))" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { youtubeApi, type DayaxArtist, type DayaxTrack, type DayaxAlbum } from '@/api/youtube'
import { usePlayerStore } from '@/stores/player'
import Skeleton from 'primevue/skeleton'
import Button from 'primevue/button'
import TrackItem from '@/components/shared/TrackItem.vue'
import AlbumCard from '@/components/shared/AlbumCard.vue'

const route = useRoute()
const player = usePlayerStore()
const artist = ref<DayaxArtist | null>(null)
const topTracks = ref<DayaxTrack[]>([])
const albums = ref<DayaxAlbum[]>([])
const isLoading = ref(true)
const hasError = ref(false)
const songsPlaylistId = ref('')
const totalSongs = ref(0)

const visibleTracks = computed(() => topTracks.value.slice(0, 5))

async function loadArtist(id: string) {
  isLoading.value = true
  hasError.value = false
  artist.value = null
  try {
    const [artistRes, tracksRes, albumsRes] = await Promise.all([
      youtubeApi.getArtist(id),
      youtubeApi.getArtistTopTracks(id, 10),
      youtubeApi.getArtistAlbums(id, 12),
    ])
    artist.value = artistRes.data
    document.title = `${artistRes.data.name} — Dayax`
    topTracks.value = tracksRes.data.data
    songsPlaylistId.value = tracksRes.data.playlistId || ''
    totalSongs.value = tracksRes.data.total || tracksRes.data.data.length
    albums.value = albumsRes.data.data.map((a) => ({
      ...a,
      artist: { id: artistRes.data.id, name: artistRes.data.name, picture: artistRes.data.picture },
    }))
  } catch (err) {
    console.error('Failed to load artist:', err)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

function formatFans(n: number): string {
  return n.toLocaleString('es-CO')
}

function playTopTracks() {
  if (topTracks.value.length) {
    player.playTrack(topTracks.value[0]!, topTracks.value)
  }
}

onMounted(() => loadArtist(String(route.params.id)))
watch(() => route.params.id, (id) => { if (id) loadArtist(String(id)) })
</script>

<style scoped>
.artist-page { max-width: 1100px; margin: 0 auto; }

.artist-hero {
  position: relative;
  height: 200px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 24px;
}
.artist-hero-img { width: 100%; height: 100%; object-fit: cover; background: var(--p-surface-800); }
.artist-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 30%, rgba(10, 10, 15, 0.95));
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px;
}
.artist-name { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }
.artist-fans { font-size: 0.8rem; color: var(--p-text-muted-color); margin-top: 4px; }

/* Spotify-style actions bar */
.artist-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
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

.follow-btn {
  border-color: rgba(255,255,255,0.3) !important;
  color: var(--p-text-color) !important;
  font-weight: 600;
}

.section { margin-bottom: 28px; }
.tracks-list { display: flex; flex-direction: column; }

.show-all-btn {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 24px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 100px;
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.show-all-btn:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.4);
}
.mb-3 { margin-bottom: 12px; }

/* Skeleton */
.skeleton-hero {
  height: 200px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 24px;
}

.skeleton-track {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  margin-bottom: 4px;
}

/* Error */
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
  .artist-hero { height: 280px; border-radius: var(--radius-xl); margin-bottom: 32px; }
  .artist-hero-overlay { padding: 28px; }
  .artist-name { font-size: 2.5rem; }
  .section { margin-bottom: 36px; }
  .skeleton-hero { height: 280px; border-radius: var(--radius-xl); }
}
</style>
