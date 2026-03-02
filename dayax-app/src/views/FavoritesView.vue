<template>
  <div class="favorites-page">
    <header class="page-header">
      <div class="fav-hero">
        <div class="fav-icon-wrap">
          <i class="pi pi-heart-fill"></i>
        </div>
        <div>
          <h1 class="page-title">Tus Me Gusta</h1>
          <p class="page-subtitle" v-if="favorites.count">{{ favorites.count }} canciones</p>
        </div>
      </div>
      <Button v-if="favorites.count" icon="pi pi-play" rounded class="play-all-btn" @click="playAll" />
    </header>

    <div v-if="favorites.count" class="tracks-list stagger">
      <TrackItem
        v-for="(track, i) in favorites.tracks"
        :key="track.id"
        :track="track"
        :track-list="favorites.tracks"
        :index="i + 1"
      />
    </div>

    <div v-else class="empty-state">
      <i class="pi pi-heart" style="font-size: 2.5rem; opacity: 0.2;"></i>
      <h2>No tienes favoritos</h2>
      <p>Dale ❤️ a las canciones que te gusten</p>
      <router-link to="/search" class="no-decoration">
        <Button icon="pi pi-search" label="Buscar Música" rounded />
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFavoritesStore } from '@/stores/favorites'
import { usePlayerStore } from '@/stores/player'
import Button from 'primevue/button'
import TrackItem from '@/components/shared/TrackItem.vue'

const favorites = useFavoritesStore()
const player = usePlayerStore()

function playAll() {
  if (favorites.tracks.length) {
    player.playTrack(favorites.tracks[0], favorites.tracks)
  }
}
</script>

<style scoped>
.favorites-page { max-width: 900px; margin: 0 auto; }

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.fav-hero { display: flex; align-items: center; gap: 16px; }

.fav-icon-wrap {
  width: 56px; height: 56px;
  background: linear-gradient(135deg, #7c3aed, #db2777);
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; color: white;
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.page-subtitle { color: var(--p-text-muted-color); font-size: 0.8rem; margin-top: 2px; }
.tracks-list { display: flex; flex-direction: column; }

.play-all-btn {
  background: var(--accent-gradient) !important;
  border: none !important;
  box-shadow: var(--shadow-glow);
}
.play-all-btn:hover { transform: scale(1.04); }

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
  .page-title { font-size: 2rem; }
  .fav-icon-wrap { width: 64px; height: 64px; font-size: 1.6rem; }
}
</style>
