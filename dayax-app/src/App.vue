<template>
  <div class="app-layout dark-mode">
    <div class="app-top">
      <AppSidebar />
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
    <PlayerBar />
    <BottomNav />
    <audio ref="audioRef" style="display: none;"></audio>
    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import PlayerBar from '@/components/layout/PlayerBar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import Toast from 'primevue/toast'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'

const audioRef = ref<HTMLAudioElement | null>(null)
const player = usePlayerStore()
useSettingsStore() // initialize accent colors on startup

function handleKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  if (e.code === 'Space') { e.preventDefault(); player.togglePlay() }
  else if (e.code === 'ArrowRight') { e.preventDefault(); player.playNext() }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); player.playPrev() }
  else if (e.code === 'KeyM') { player.setVolume(player.volume > 0 ? 0 : 80) }
}

onMounted(() => {
  if (audioRef.value) player.setAudioElement(audioRef.value)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--p-surface-950);
  color: var(--p-text-color);
}

.app-top {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--content-padding);
  background: var(--p-surface-950);
  -webkit-overflow-scrolling: touch;
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-8px); }

/* Desktop: rounded content area */
@media (min-width: 1025px) {
  .app-top {
    padding: 8px 8px 0 0;
    gap: 0;
  }
  .main-content {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, var(--p-surface-950) 300px);
  }
}

/* Mobile */
@media (max-width: 1024px) {
  .main-content {
    padding-bottom: calc(var(--bottom-nav-height) + var(--mini-player-height) + 12px);
  }
}
</style>
