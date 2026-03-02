<template>
  <aside class="sidebar">
    <div class="sidebar-panel nav-panel">
      <router-link
        v-for="item in mainNav"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <i :class="item.icon" class="nav-icon"></i>
        <span class="nav-text">{{ item.label }}</span>
      </router-link>
    </div>

    <div class="sidebar-panel library-panel">
      <div class="library-header">
        <div class="library-title-row">
          <i class="pi pi-objects-column library-icon"></i>
          <span class="library-label">Tu Biblioteca</span>
        </div>
      </div>

      <div class="library-items">
        <div class="lib-item" @click="$router.push('/queue')">
          <div class="lib-icon-wrap queue-icon">
            <i class="pi pi-list"></i>
          </div>
          <div class="lib-info">
            <span class="lib-name">Cola de Reproducción</span>
            <span class="lib-meta">Lista · Automática</span>
          </div>
        </div>
        <div class="lib-item" @click="$router.push('/favorites')">
          <div class="lib-icon-wrap fav-icon">
            <i class="pi pi-heart-fill"></i>
          </div>
          <div class="lib-info">
            <span class="lib-name">Tus Me Gusta</span>
            <span class="lib-meta">Lista · {{ favorites.count }} canciones</span>
          </div>
        </div>
      </div>

      <!-- <div class="accent-picker">
        <button
          v-for="(def, key) in ACCENT_COLORS"
          :key="key"
          class="accent-dot"
          :class="{ active: settings.accent === key }"
          :style="{ background: def.gradient }"
          :title="def.label"
          @click="settings.setAccent(key)"
        />
      </div> -->
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { useSettingsStore, ACCENT_COLORS } from '@/stores/settings'

const route = useRoute()
const favorites = useFavoritesStore()
const settings = useSettingsStore()

const mainNav = [
  { path: '/', label: 'Inicio', icon: 'pi pi-home' },
  { path: '/search', label: 'Buscar', icon: 'pi pi-search' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
  z-index: 100;
}

/* Panels (Spotify-style rounded sections) */
.sidebar-panel {
  background: var(--p-surface-900);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.nav-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.library-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Nav Items */
.nav-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.nav-item:hover { color: var(--p-text-color); }

.nav-item.active {
  color: var(--p-text-color);
}

.nav-icon {
  font-size: 1.3rem;
  width: 24px;
  text-align: center;
}

/* Library Header */
.library-header {
  padding: 14px 16px 8px;
}

.library-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  font-weight: 600;
  transition: color var(--transition-fast);
  cursor: pointer;
}

.library-title-row:hover { color: var(--p-text-color); }

.library-icon { font-size: 1.3rem; }

/* Library Items */
.library-items {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.lib-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.lib-item:hover { background: rgba(255, 255, 255, 0.04); }

.lib-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.queue-icon { background: linear-gradient(135deg, #10b981, #14b8a6); color: white; }
.fav-icon { background: linear-gradient(135deg, #7c3aed, #db2777); color: white; }

.lib-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.lib-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.lib-meta {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}

/* Accent Picker */
.accent-picker {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.accent-dot {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}

.accent-dot:hover { transform: scale(1.2); }
.accent-dot.active { border-color: white; transform: scale(1.15); }

/* Hide on mobile/tablet */
@media (max-width: 1024px) {
  .sidebar { display: none; }
}
</style>
