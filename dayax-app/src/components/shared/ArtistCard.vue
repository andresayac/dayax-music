<template>
  <router-link :to="`/artist/${artist.id}`" class="artist-card">
    <div class="artist-img-wrap">
      <img class="artist-img" :src="artist.picture_medium || artist.picture" :alt="artist.name" loading="lazy" />
    </div>
    <h4 class="artist-name truncate">{{ artist.name }}</h4>
    <p class="artist-type">Artista</p>
  </router-link>
</template>

<script setup lang="ts">
import type { DayaxArtist } from '@/api/youtube'

defineProps<{ artist: DayaxArtist }>()

function formatFans(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}
</script>

<style scoped>
.artist-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  padding: 12px;
  border-radius: var(--radius-lg);
  transition: background var(--transition-base);
}

.artist-card:hover { background: var(--p-surface-800); }
.artist-card:hover .artist-img { transform: scale(1.04); }

.artist-img-wrap {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 10px;
}

.artist-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--p-surface-800);
  transition: transform var(--transition-base);
}

.artist-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-text-color);
  text-align: center;
  margin-bottom: 2px;
}

.artist-type {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}
</style>
