<template>
  <div class="track-row" :class="{ playing: isCurrent }" @click="handlePlay" @contextmenu.prevent="onContextMenu">
    <span class="track-index" :class="{ 'accent-text': isCurrent }">
      <template v-if="isCurrent && player.isPlaying">
        <div class="eq-mini"><span></span><span></span><span></span></div>
      </template>
      <template v-else>{{ index }}</template>
    </span>

    <div class="track-cover-wrap">
      <img class="track-cover" :src="track.album.cover_small" :alt="track.title" loading="lazy" />
      <div class="track-play-overlay">
        <i :class="isCurrent && player.isPlaying ? 'pi pi-pause' : 'pi pi-play'" style="font-size: 0.75rem;"></i>
      </div>
    </div>

    <div class="track-info">
      <span class="track-title truncate" :class="{ 'accent-text': isCurrent }">
        {{ track.title_short || track.title }}
      </span>
      <span class="track-artist truncate">
        <router-link :to="`/artist/${track.artist.id}`" @click.stop>{{ track.artist.name }}</router-link>
      </span>
    </div>

    <span class="track-album truncate" v-if="track.album">
      <router-link :to="`/album/${track.album.id}`" @click.stop>{{ track.album.title }}</router-link>
    </span>

    <div class="track-actions">
      <Button icon="pi pi-ellipsis-v" severity="secondary" text rounded size="small" @click.stop="onContextMenu($event)" v-tooltip.top="'Más opciones'" />
    </div>

    <span class="track-duration">{{ formatDuration(track.duration) }}</span>

    <ContextMenu ref="ctxMenu" :model="menuItems" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useFavoritesStore } from '@/stores/favorites'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import type { DayaxTrack } from '@/api/youtube'

const props = defineProps<{
  track: DayaxTrack
  trackList?: DayaxTrack[]
  index?: number
  showRemove?: boolean
  queueIndex?: number
}>()

const emit = defineEmits<{ remove: [index: number] }>()

const player = usePlayerStore()
const favorites = useFavoritesStore()
const router = useRouter()
const toast = useToast()
const ctxMenu = ref()
const isCurrent = computed(() => player.currentTrack?.id === props.track.id)

const menuItems = computed(() => [
  {
    label: favorites.isFavorite(props.track.id) ? 'Quitar Me gusta' : 'Me gusta',
    icon: favorites.isFavorite(props.track.id) ? 'pi pi-heart-fill' : 'pi pi-heart',
    command: () => {
      favorites.toggle(props.track)
      toast.add({ severity: 'success', summary: favorites.isFavorite(props.track.id) ? 'Añadido a favoritos' : 'Quitado de favoritos', life: 2000 })
    },
  },
  { separator: true },
  {
    label: 'Reproducir siguiente',
    icon: 'pi pi-forward',
    command: () => {
      player.addToQueueNext(props.track)
      toast.add({ severity: 'info', summary: 'Se reproducirá después', life: 2000 })
    },
  },
  {
    label: 'Añadir a cola',
    icon: 'pi pi-plus',
    command: () => {
      player.addToQueue(props.track)
      toast.add({ severity: 'info', summary: 'Añadido a la cola', life: 2000 })
    },
  },
  {
    label: 'Ir a artista',
    icon: 'pi pi-user',
    command: () => router.push(`/artist/${props.track.artist.id}`),
  },
  {
    label: 'Ir a álbum',
    icon: 'pi pi-disc',
    command: () => router.push(`/album/${props.track.album.id}`),
  },
  { separator: true },
  {
    label: 'Compartir',
    icon: 'pi pi-share-alt',
    command: () => {
      const text = `${props.track.title} — ${props.track.artist.name}`
      if (navigator.share) {
        navigator.share({ title: text, text, url: `https://music.youtube.com/watch?v=${props.track.videoId}` }).catch(() => {})
      } else {
        navigator.clipboard.writeText(text)
        toast.add({ severity: 'success', summary: 'Copiado al portapapeles', life: 2000 })
      }
    },
  },
  ...(props.showRemove ? [
    { separator: true },
    {
      label: 'Quitar de cola',
      icon: 'pi pi-trash',
      command: () => {
        if (props.queueIndex !== undefined) player.removeFromQueue(props.queueIndex)
        toast.add({ severity: 'warn', summary: 'Quitado de la cola', life: 2000 })
      },
    },
  ] : []),
])

function handlePlay() {
  if (isCurrent.value) { player.togglePlay() }
  else { player.playTrack(props.track, props.trackList) }
}

function onContextMenu(event: Event) {
  ctxMenu.value?.show(event)
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.track-row {
  display: grid;
  grid-template-columns: 24px 44px 1fr auto auto 48px;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  max-width: 100%;
  overflow: hidden;
}

.track-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.track-row:hover .track-play-overlay { opacity: 1; }
.track-row:hover .track-cover { filter: brightness(0.6); }
.track-row:hover .track-actions { opacity: 1; }
.track-row:hover .track-index { visibility: hidden; }

/* Index */
.track-index {
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Mini EQ for playing track */
.eq-mini {
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 14px;
  justify-content: center;
}

.eq-mini span {
  width: 2.5px;
  background: var(--p-primary-color);
  border-radius: 1px;
  animation: eqMini 0.6s ease-in-out infinite alternate;
}
.eq-mini span:nth-child(1) { height: 6px; animation-delay: 0ms; }
.eq-mini span:nth-child(2) { height: 12px; animation-delay: 150ms; }
.eq-mini span:nth-child(3) { height: 4px; animation-delay: 300ms; }

@keyframes eqMini {
  0% { height: 3px; }
  100% { height: 14px; }
}

/* Cover */
.track-cover-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.track-cover {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--p-surface-800);
  transition: filter var(--transition-fast);
}

.track-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.playing .track-play-overlay { opacity: 1; }
.playing .track-cover { filter: brightness(0.6); }

/* Info */
.track-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  overflow: hidden;
}

.track-title {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--p-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accent-text { color: var(--p-primary-color) !important; }

.track-artist {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track-artist a { transition: color var(--transition-fast); text-decoration: none; }
.track-artist a:hover { color: var(--p-text-color); text-decoration: underline; }

/* Album column */
.track-album {
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  max-width: 200px;
}
.track-album a { transition: color var(--transition-fast); text-decoration: none; }
.track-album a:hover { color: var(--p-text-color); text-decoration: underline; }

.track-actions {
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.track-duration {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Mobile: hide index and album columns */
@media (max-width: 768px) {
  .track-row {
    grid-template-columns: 44px 1fr auto 40px;
  }
  .track-index { display: none; }
  .track-album { display: none; }
}
</style>
