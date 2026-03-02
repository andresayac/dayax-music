<template>
  <!-- Desktop Full Player Bar -->
  <footer class="player-bar" v-show="player.currentTrack">
    <div class="player-track-info">
      <img class="player-cover" :src="player.currentTrack?.album.cover_small" :alt="player.currentTrack?.title" />
      <div class="player-meta">
        <router-link :to="`/album/${player.currentTrack?.album.id}`" class="player-title truncate">
          {{ player.currentTrack?.title_short }}
        </router-link>
        <router-link :to="`/artist/${player.currentTrack?.artist.id}`" class="player-artist truncate">
          {{ player.currentTrack?.artist.name }}
        </router-link>
      </div>
      <Button
        :icon="isLiked ? 'pi pi-heart-fill' : 'pi pi-heart'"
        :severity="isLiked ? undefined : 'secondary'"
        :class="{ 'liked': isLiked }"
        text rounded size="small" class="like-btn"
        @click="toggleLike"
      />
    </div>

    <div class="player-controls-center">
      <div class="player-buttons">
        <Button
          icon="pi pi-replay"
          :severity="player.shuffleMode ? undefined : 'secondary'"
          :class="{ 'active-mode': player.shuffleMode }"
          text rounded size="small"
          v-tooltip.top="'Aleatorio'"
          @click="player.toggleShuffle()"
        />
        <Button icon="pi pi-step-backward" severity="secondary" text rounded size="small" :disabled="!player.hasPrev" @click="player.playPrev()" />
        <button class="play-btn-circle" @click="player.togglePlay()">
          <i :class="player.isLoading ? 'pi pi-spin pi-spinner' : player.isPlaying ? 'pi pi-pause' : 'pi pi-play'" style="font-size: 1rem;"></i>
        </button>
        <Button icon="pi pi-step-forward" severity="secondary" text rounded size="small" :disabled="!player.hasNext" @click="player.playNext()" />
        <Button
          icon="pi pi-sync"
          :severity="player.repeatMode !== 'off' ? undefined : 'secondary'"
          :class="{ 'active-mode': player.repeatMode !== 'off' }"
          text rounded size="small"
          v-tooltip.top="repeatLabel"
          @click="player.toggleRepeat()"
        />
      </div>
      <div class="player-progress">
        <span class="time-label">{{ player.formatTime(player.currentTime) }}</span>
        <Slider v-model="progressValue" :max="100" class="progress-slider" @change="onSeek" />
        <span class="time-label">{{ player.formatTime(player.totalTime) }}</span>
      </div>
    </div>

    <div class="player-controls-right">
      <Button icon="pi pi-list" severity="secondary" text rounded size="small" @click="$router.push('/queue')" v-tooltip.top="'Cola'" />
      <div class="volume-control">
        <Button
          :icon="player.volume > 50 ? 'pi pi-volume-up' : player.volume > 0 ? 'pi pi-volume-down' : 'pi pi-volume-off'"
          severity="secondary" text rounded size="small" @click="toggleMute"
        />
        <Slider v-model="volumeValue" :max="100" class="volume-slider" @change="onVolumeChange" />
      </div>
      <Button icon="pi pi-window-maximize" severity="secondary" text rounded size="small" @click="$router.push('/now-playing')" v-tooltip.top="'Pantalla completa'" />
    </div>
  </footer>

  <!-- Mobile Mini Player -->
  <div class="mini-player" v-if="player.currentTrack" @click="goToNowPlaying">
    <div class="mini-progress" :style="{ width: player.progress + '%' }"></div>
    <img class="mini-cover" :src="player.currentTrack.album.cover_small" :alt="player.currentTrack.title" />
    <div class="mini-info">
      <span class="mini-title truncate">{{ player.currentTrack.title_short }}</span>
      <span class="mini-artist truncate">{{ player.currentTrack.artist.name }}</span>
    </div>
    <Button
      :icon="player.isPlaying ? 'pi pi-pause' : 'pi pi-play'"
      severity="secondary" text rounded size="small"
      @click.stop="player.togglePlay()" class="mini-play-btn"
    />
    <Button icon="pi pi-step-forward" severity="secondary" text rounded size="small"
      :disabled="!player.hasNext" @click.stop="player.playNext()" class="mini-next-btn"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useFavoritesStore } from '@/stores/favorites'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Slider from 'primevue/slider'

const player = usePlayerStore()
const favorites = useFavoritesStore()
const router = useRouter()
const toast = useToast()
let prevVolume = 80

const progressValue = ref(0)
const volumeValue = ref(player.volume)

const repeatLabel = computed(() => {
  if (player.repeatMode === 'off') return 'Repetir'
  if (player.repeatMode === 'all') return 'Repetir cola'
  return 'Repetir canción'
})

watch(() => player.progress, (val) => { progressValue.value = Math.round(val) }, { immediate: true })
watch(() => player.volume, (val) => { volumeValue.value = val })

function onSeek(val: number) { player.seekTo(val) }
function onVolumeChange(val: number) { player.setVolume(val) }

function toggleMute() {
  if (player.volume > 0) { prevVolume = player.volume; player.setVolume(0); volumeValue.value = 0 }
  else { player.setVolume(prevVolume); volumeValue.value = prevVolume }
}

const isLiked = computed(() => player.currentTrack ? favorites.isFavorite(player.currentTrack.id) : false)
function toggleLike() {
  if (!player.currentTrack) return
  favorites.toggle(player.currentTrack)
  toast.add({ severity: 'success', summary: favorites.isFavorite(player.currentTrack.id) ? 'Añadido a favoritos' : 'Quitado de favoritos', life: 2000 })
}

function goToNowPlaying() { router.push('/now-playing') }
</script>

<style scoped>
/* ========== DESKTOP PLAYER BAR ========== */
.player-bar {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  padding: 0 16px;
  height: var(--player-height);
  background: var(--p-surface-950);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  z-index: 90;
}

.player-track-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
.player-cover { width: 64px; height: 64px; border-radius: var(--radius-sm); object-fit: cover; flex-shrink: 0; background: var(--p-surface-800); }
.player-meta { display: flex; flex-direction: column; min-width: 0; }
.player-title { font-size: 0.82rem; font-weight: 500; color: var(--p-text-color); transition: color var(--transition-fast); }
.player-title:hover { color: var(--p-primary-color); text-decoration: underline; }
.player-artist { font-size: 0.7rem; color: var(--p-text-muted-color); transition: color var(--transition-fast); }
.player-artist:hover { color: var(--p-text-color); text-decoration: underline; }
.like-btn { flex-shrink: 0; }

.player-controls-center { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.player-buttons { display: flex; align-items: center; gap: 8px; }

.active-mode { color: var(--p-primary-color) !important; }
.liked { color: var(--p-primary-color) !important; }

.play-btn-circle {
  width: 36px; height: 36px;
  background: white; border-radius: var(--radius-full);
  display: flex; align-items: center; justify-content: center;
  color: black; cursor: pointer;
  transition: transform var(--transition-fast); flex-shrink: 0;
}
.play-btn-circle:hover { transform: scale(1.06); }

.player-progress { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 600px; }
.time-label { font-size: 0.65rem; color: var(--p-text-muted-color); font-variant-numeric: tabular-nums; min-width: 35px; text-align: center; }
.progress-slider { flex: 1; }

.preview-badge {
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--p-primary-color);
  background: rgba(52, 211, 153, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.player-controls-right { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.volume-control { display: flex; align-items: center; gap: 2px; }
.volume-slider { width: 90px; }

/* ========== MOBILE MINI PLAYER ========== */
.mini-player {
  display: none;
  position: fixed;
  bottom: var(--bottom-nav-height);
  left: 8px; right: 8px;
  height: var(--mini-player-height);
  background: rgba(30, 30, 32, 0.92);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  align-items: center;
  padding: 0 8px 0 0; gap: 10px;
  z-index: 190; cursor: pointer; overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--transition-fast);
}
.mini-player:active { transform: scale(0.98); }

.mini-progress {
  position: absolute; bottom: 0; left: 0; height: 2px;
  background: var(--accent-gradient); border-radius: 0 1px 1px 0;
  transition: width 0.3s linear;
}

.mini-cover { width: var(--mini-player-height); height: var(--mini-player-height); object-fit: cover; border-radius: var(--radius-lg) 0 0 var(--radius-lg); flex-shrink: 0; background: var(--p-surface-800); }
.mini-info { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 1px; }
.mini-title { font-size: 0.8rem; font-weight: 600; color: var(--p-text-color); }
.mini-artist { font-size: 0.68rem; color: var(--p-text-muted-color); }
.mini-play-btn, .mini-next-btn { flex-shrink: 0; }

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .player-bar { display: none !important; }
  .mini-player { display: flex; }
}
@media (min-width: 1025px) {
  .mini-player { display: none !important; }
}
</style>
