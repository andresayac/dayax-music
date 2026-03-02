<template>
  <router-link :to="`/album/${album.id}`" class="album-card">
    <div class="album-cover-wrap">
      <img class="album-cover" :src="album.cover_medium || album.cover" :alt="album.title" loading="lazy" />
      <button class="album-play-btn" @click.prevent.stop="playAlbum">
        <i class="pi pi-play" style="font-size: 1rem; margin-left: 2px;"></i>
      </button>
    </div>
    <h4 class="album-title truncate">{{ album.title }}</h4>
    <p class="album-artist truncate">{{ album.artist?.name }}</p>
  </router-link>
</template>

<script setup lang="ts">
import type { DayaxAlbum } from '@/api/youtube'

const props = defineProps<{ album: DayaxAlbum }>()

// Placeholder — could load album tracks and play
function playAlbum() {
  // For now just navigate
}
</script>

<style scoped>
.album-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  padding: 12px;
  border-radius: var(--radius-md);
  transition: background var(--transition-base);
}

.album-card:hover { background: rgba(255, 255, 255, 0.04); }
.album-card:hover .album-play-btn { opacity: 1; transform: translateY(0); }

.album-cover-wrap {
  position: relative;
  margin-bottom: 10px;
}

.album-cover {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  background: var(--p-surface-800);
}

.album-play-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 44px;
  height: 44px;
  background: var(--accent-gradient);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transform: translateY(8px);
  transition: all var(--transition-base);
  cursor: pointer;
  border: none;
}

.album-play-btn:hover { transform: translateY(0) scale(1.06) !important; }

.album-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}

.album-artist {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}
</style>
