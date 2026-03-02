<template>
  <div class="genre-page">
    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="skeleton-grid">
        <div v-for="n in 8" :key="n" class="skeleton-card" />
      </div>
    </div>

    <template v-else>
      <!-- Back button + title -->
      <div class="page-header">
        <button class="back-btn" @click="$router.back()"><i class="pi pi-arrow-left" /></button>
        <h1 class="page-title">{{ pageTitle || 'Género' }}</h1>
      </div>

      <!-- Sections with playlists -->
      <section v-for="section in sections" :key="section.title" class="section">
        <h2 class="section-title">{{ section.title }}</h2>
        <div class="carousel-wrap" :ref="(el) => setCarouselRef(`genre-${section.title}`, el)">
          <button class="carousel-arrow left" @click="scrollCarousel(`genre-${section.title}`, -1)">
            <i class="pi pi-chevron-left" />
          </button>
          <div class="carousel-track">
            <div
              v-for="pl in section.playlists"
              :key="pl.id"
              class="carousel-card"
              @click="openPlaylist(pl)"
            >
              <div class="card-img-wrap">
                <img :src="pl.cover_medium || pl.cover" :alt="pl.title" loading="lazy" class="card-img" />
                <div class="card-play-overlay"><i class="pi pi-play-circle" /></div>
              </div>
              <p class="card-title">{{ pl.title }}</p>
              <p class="card-sub">{{ pl.description }}</p>
            </div>
          </div>
          <button class="carousel-arrow right" @click="scrollCarousel(`genre-${section.title}`, 1)">
            <i class="pi pi-chevron-right" />
          </button>
        </div>
      </section>

      <div v-if="!sections.length && !isLoading" class="empty-state">
        <p>No se encontraron playlists para este género</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { youtubeApi, type DayaxGenreSection } from '@/api/youtube'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const pageTitle = ref('')
const sections = ref<DayaxGenreSection[]>([])

async function loadGenre() {
  isLoading.value = true
  try {
    const params = route.params.params as string
    const res = await youtubeApi.getGenre(params)
    pageTitle.value = res.data.title || 'Género'
    sections.value = res.data.sections || []
  } catch (err) {
    console.error('Failed to load genre:', err)
  } finally {
    isLoading.value = false
  }
}

function openPlaylist(pl: { id: string }) {
  const id = pl.id.startsWith('VL') ? pl.id : `VL${pl.id}`
  router.push(`/playlist/${id}`)
}

const carouselRefs: Record<string, HTMLElement | null> = {}
function setCarouselRef(key: string, el: unknown) {
  carouselRefs[key] = el as HTMLElement | null
}
function scrollCarousel(key: string, direction: number) {
  const wrap = carouselRefs[key]
  if (!wrap) return
  const track = wrap.querySelector('.carousel-track') as HTMLElement | null
  if (!track) return
  track.scrollBy({ left: direction * track.clientWidth * 0.75, behavior: 'smooth' })
}

onMounted(() => loadGenre())
watch(() => route.params.params, () => loadGenre())
</script>

<style scoped>
.genre-page { width: 100%; }

.page-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.back-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.08);
  color: var(--p-text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.back-btn:hover { background: rgba(255,255,255,0.14); }

.page-title {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--p-text-color);
}

.section { margin-bottom: 24px; }
.section-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 10px;
}

.carousel-wrap { position: relative; overflow: hidden; }
.carousel-wrap:hover .carousel-arrow { opacity: 1; }
.carousel-track {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  padding-bottom: 4px;
}
.carousel-track::-webkit-scrollbar { display: none; }

.carousel-card {
  flex: 0 0 180px;
  scroll-snap-align: start;
  cursor: pointer;
  transition: transform 0.15s;
}
.carousel-card:hover { transform: translateY(-3px); }
.card-img-wrap {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  width: 180px;
  height: 180px;
  background: var(--p-surface-800);
}
.card-img { width: 100%; height: 100%; object-fit: cover; }
.card-play-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45);
  opacity: 0; transition: opacity 0.2s;
  font-size: 2rem; color: white;
}
.carousel-card:hover .card-play-overlay { opacity: 1; }
.card-title {
  font-size: 0.82rem; font-weight: 600;
  color: var(--p-text-color);
  margin-top: 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-sub {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.carousel-arrow {
  position: absolute; top: 50%; transform: translateY(-80%);
  z-index: 2;
  width: 42px; height: 42px;
  border-radius: 50%; border: none;
  background: rgba(0,0,0,0.7);
  color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
}
.carousel-arrow.left { left: 4px; }
.carousel-arrow.right { right: 4px; }
.carousel-arrow:hover { background: rgba(0,0,0,0.9); }

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}
.skeleton-card {
  aspect-ratio: 1; border-radius: 8px;
  background: linear-gradient(110deg, var(--p-surface-800) 8%, var(--p-surface-700) 18%, var(--p-surface-800) 33%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { to { background-position-x: -200%; } }

.empty-state { text-align: center; padding: 60px 20px; color: var(--p-text-muted-color); }
</style>
