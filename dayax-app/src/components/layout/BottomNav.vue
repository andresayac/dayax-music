<template>
  <nav class="bottom-nav glass">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="bottom-nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <i :class="item.icon" class="bottom-nav-icon"></i>
      <span class="bottom-nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: 'Inicio', icon: 'pi pi-home' },
  { path: '/search', label: 'Buscar', icon: 'pi pi-search' },
  { path: '/queue', label: 'Cola', icon: 'pi pi-list' },
  { path: '/favorites', label: 'Me Gusta', icon: 'pi pi-heart' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: none;
  justify-content: space-around;
  align-items: center;
  padding: 6px 0 env(safe-area-inset-bottom, 8px);
  background: rgba(24, 24, 27, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 200;
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 16px;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: color var(--transition-fast);
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav-item.active {
  color: var(--p-primary-color);
}

.bottom-nav-item.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 2px;
  background: var(--accent-gradient);
  border-radius: 0 0 2px 2px;
}

.bottom-nav-icon {
  font-size: 1.2rem;
}

.bottom-nav-label {
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Show only on mobile/tablet */
@media (max-width: 1024px) {
  .bottom-nav {
    display: flex;
  }
}
</style>
