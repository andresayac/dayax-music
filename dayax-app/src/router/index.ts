import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'discover',
      meta: { title: 'Inicio' },
      component: () => import('@/views/DiscoverView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      meta: { title: 'Buscar' },
      component: () => import('@/views/SearchView.vue'),
    },
    {
      path: '/queue',
      name: 'queue',
      meta: { title: 'Cola' },
      component: () => import('@/views/QueueView.vue'),
    },
    {
      path: '/album/:id',
      name: 'album',
      component: () => import('@/views/AlbumView.vue'),
    },
    {
      path: '/artist/:id',
      name: 'artist',
      component: () => import('@/views/ArtistView.vue'),
    },
    {
      path: '/playlist/:id',
      name: 'playlist',
      component: () => import('@/views/PlaylistView.vue'),
    },
    {
      path: '/explore',
      name: 'explore',
      meta: { title: 'Explorar' },
      component: () => import('@/views/ExploreView.vue'),
    },
    {
      path: '/genre/:params',
      name: 'genre',
      component: () => import('@/views/GenreView.vue'),
    },
    {
      path: '/now-playing',
      name: 'now-playing',
      meta: { title: 'Reproduciendo' },
      component: () => import('@/views/NowPlayingView.vue'),
    },
    {
      path: '/favorites',
      name: 'favorites',
      meta: { title: 'Tus Me Gusta' },
      component: () => import('@/views/FavoritesView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { title: '404' },
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

// Dynamic page titles
router.afterEach((to) => {
  const base = 'Dayax'
  const title = to.meta?.title as string | undefined
  document.title = title ? `${title} — ${base}` : base
})

export default router
