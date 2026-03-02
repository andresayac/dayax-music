<template>
  <div class="explore-page">
    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="skeleton-grid">
        <div v-for="n in 12" :key="n" class="skeleton-card" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="hasError" class="error-state">
      <p>Error al cargar Explorar</p>
      <button class="retry-btn" @click="loadExplore">Reintentar</button>
    </div>

    <template v-else>
      <!-- Page Header with nav buttons -->
      <div class="page-header">
        <h1 class="page-title">Explorar</h1>
        <div class="nav-buttons">
          <button class="nav-btn" :class="{ active: activeView === 'all' }" @click="activeView = 'all'">Todo</button>
          <button
            v-for="btn in topButtons"
            :key="btn.browseId"
            class="nav-btn"
            :class="{ active: activeView === btn.browseId }"
            @click="navigateButton(btn)"
          >{{ btn.text }}</button>
        </div>
      </div>

      <!-- Moods & Genres Grid -->
      <section v-if="moodButtons.length && (activeView === 'all' || activeView === 'FEmusic_moods_and_genres')" class="section">
        <h2 class="section-title">Moods y géneros</h2>
        <div class="mood-grid">
          <button
            v-for="mood in moodButtons.slice(0, 24)"
            :key="mood.text"
            class="mood-card"
            :style="{ '--mood-color': mood.color || getRandomColor(mood.text) }"
            @click="goToGenre(mood)"
          >
            <span class="mood-text">{{ mood.text }}</span>
          </button>
        </div>
      </section>

      <!-- Dynamic sections (albums, tracks, playlists) -->
      <template v-if="activeView === 'all' || activeView === 'FEmusic_new_releases'">
      <section v-for="section in contentSections" :key="section.title" class="section">
        <div class="section-header">
          <h2 class="section-title">{{ section.title }}</h2>
          <span v-if="section.strapline" class="section-strapline">{{ section.strapline }}</span>
        </div>

        <!-- Albums carousel -->
        <div v-if="section.albums.length" class="carousel-wrap" :ref="(el) => setCarouselRef(`explore-${section.title}`, el)">
          <button class="carousel-arrow left" @click="scrollCarousel(`explore-${section.title}`, -1)">
            <i class="pi pi-chevron-left" />
          </button>
          <div class="carousel-track">
            <div
              v-for="album in section.albums"
              :key="album.id"
              class="carousel-card"
              @click="$router.push(`/album/${album.id}`)"
            >
              <div class="card-img-wrap">
                <img :src="album.cover_medium || album.cover" :alt="album.title" loading="lazy" class="card-img" />
                <div class="card-play-overlay"><i class="pi pi-play-circle" /></div>
              </div>
              <p class="card-title">{{ album.title }}</p>
              <p class="card-sub">{{ album.artist?.name || '' }}</p>
            </div>
          </div>
          <button class="carousel-arrow right" @click="scrollCarousel(`explore-${section.title}`, 1)">
            <i class="pi pi-chevron-right" />
          </button>
        </div>

        <!-- Tracks list -->
        <div v-if="section.tracks.length" class="quick-picks-grid">
          <div
            v-for="track in section.tracks.slice(0, 12)"
            :key="track.videoId"
            class="quick-pick-item"
            @click="playTrack(track, section.tracks)"
          >
            <img :src="track.album.cover_small || track.album.cover" :alt="track.title" loading="lazy" class="qp-img" />
            <div class="qp-info">
              <span class="qp-title">
                {{ track.title }}
                <!-- <span v-if="track.is_video" class="video-badge" title="Video musical"><i class="pi pi-video" /></span> -->
              </span>
              <span class="qp-meta">{{ track.artist.name }}</span>
            </div>
          </div>
        </div>

        <!-- Playlists carousel -->
        <div v-if="section.playlists.length" class="carousel-wrap" :ref="(el) => setCarouselRef(`explore-pl-${section.title}`, el)">
          <button class="carousel-arrow left" @click="scrollCarousel(`explore-pl-${section.title}`, -1)">
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
          <button class="carousel-arrow right" @click="scrollCarousel(`explore-pl-${section.title}`, 1)">
            <i class="pi pi-chevron-right" />
          </button>
        </div>
      </section>
      </template>

      <!-- Charts Section -->
      <section v-if="chartSections.length && (activeView === 'all' || activeView === 'FEmusic_charts')" class="section">
        <div class="section-header">
          <h2 class="section-title">Charts</h2>
          <div class="country-chips" v-if="countries.length">
            <button
              v-for="c in countries.slice(0, 12)"
              :key="c.text"
              class="country-chip"
              :class="{ active: c.selected }"
              @click="loadCharts(c.params)"
            >{{ c.text }}</button>
          </div>
        </div>

        <div v-for="cs in chartSections" :key="cs.title" class="chart-section">
          <h3 class="subsection-title">{{ cs.title }}</h3>

          <!-- Chart tracks -->
          <div v-if="cs.tracks.length" class="chart-tracks">
            <div
              v-for="(track, idx) in cs.tracks.slice(0, 10)"
              :key="track.videoId"
              class="chart-track"
              @click="playTrack(track, cs.tracks)"
            >
              <span class="chart-rank">{{ idx + 1 }}</span>
              <img :src="track.album.cover_small || track.album.cover" :alt="track.title" loading="lazy" class="chart-img" />
              <div class="chart-info">
                <span class="chart-title">
                  {{ track.title }}
                  <!-- <span v-if="track.is_video" class="video-badge" title="Video musical"><i class="pi pi-video" /></span> -->
                </span>
                <span class="chart-artist">{{ track.artist.name }}</span>
              </div>
            </div>
          </div>

          <!-- Chart playlists -->
          <div v-if="cs.playlists.length" class="carousel-wrap" :ref="(el) => setCarouselRef(`chart-${cs.title}`, el)">
            <button class="carousel-arrow left" @click="scrollCarousel(`chart-${cs.title}`, -1)">
              <i class="pi pi-chevron-left" />
            </button>
            <div class="carousel-track">
              <div v-for="pl in cs.playlists" :key="pl.id" class="carousel-card" @click="openPlaylist(pl)">
                <div class="card-img-wrap">
                  <img :src="pl.cover_medium || pl.cover" :alt="pl.title" loading="lazy" class="card-img" />
                  <div class="card-play-overlay"><i class="pi pi-play-circle" /></div>
                </div>
                <p class="card-title">{{ pl.title }}</p>
                <p class="card-sub">{{ pl.description }}</p>
              </div>
            </div>
            <button class="carousel-arrow right" @click="scrollCarousel(`chart-${cs.title}`, 1)">
              <i class="pi pi-chevron-right" />
            </button>
          </div>
        </div>
      </section>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { youtubeApi, type DayaxTrack, type DayaxExploreSection, type DayaxChartSection } from '@/api/youtube'
import { usePlayerStore } from '@/stores/player'

const router = useRouter()
const player = usePlayerStore()

const isLoading = ref(true)
const hasError = ref(false)
const topButtons = ref<{ text: string; browseId: string; icon: string }[]>([])
const exploreSections = ref<DayaxExploreSection[]>([])
const chartSections = ref<DayaxChartSection[]>([])
const countries = ref<{ text: string; params: string; selected: boolean }[]>([])
const activeView = ref('all')

// Separate mood buttons from content sections
const moodButtons = computed(() => {
  for (const s of exploreSections.value) {
    if (s.moodButtons?.length) return s.moodButtons
  }
  return []
})

const contentSections = computed(() =>
  exploreSections.value.filter(s => !s.moodButtons?.length)
)

async function loadExplore() {
  isLoading.value = true
  hasError.value = false
  try {
    const [exploreRes, chartsRes] = await Promise.all([
      youtubeApi.getExplore(),
      youtubeApi.getChartsBrowse(),
    ])
    topButtons.value = exploreRes.data.topButtons || []
    exploreSections.value = exploreRes.data.sections || []
    chartSections.value = chartsRes.data.sections || []
    countries.value = chartsRes.data.countries || []
  } catch (err) {
    console.error('Failed to load explore:', err)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

async function loadCharts(params: string) {
  try {
    const res = await youtubeApi.getChartsBrowse(params)
    chartSections.value = res.data.sections || []
    countries.value = res.data.countries || []
  } catch (err) {
    console.error('Failed to load charts:', err)
  }
}

function navigateButton(btn: { text: string; browseId: string }) {
  activeView.value = btn.browseId
}

function goToGenre(mood: { params: string }) {
  router.push(`/genre/${encodeURIComponent(mood.params)}`)
}

function playTrack(track: DayaxTrack, list: DayaxTrack[]) {
  player.playTrack(track, list)
}

function openPlaylist(pl: { id: string }) {
  const id = pl.id.startsWith('VL') ? pl.id : `VL${pl.id}`
  router.push(`/playlist/${id}`)
}

// Carousel scroll
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

// Generate consistent colors for moods
function getRandomColor(text: string): string {
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722',
    '#795548', '#607d8b', '#f44336', '#1db954', '#e040fb',
  ]
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length] ?? '#673ab7'
}

onMounted(() => loadExplore())
</script>

<style scoped>
.explore-page { width: 100%; }

.page-header { margin-bottom: 16px; }
.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #ff6b6b, #ffa500, #ff6b6b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12px;
}

.nav-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.nav-btn {
  padding: 8px 18px;
  border-radius: 500px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--p-text-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  text-decoration: none;
}
.nav-btn:hover { background: rgba(255, 255, 255, 0.14); }
.nav-btn.active {
  background: var(--p-text-color);
  color: var(--p-surface-950);
  font-weight: 600;
}

/* Mood Grid */
.mood-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.mood-card {
  position: relative;
  padding: 18px 14px;
  border-radius: 8px;
  border: none;
  background: var(--mood-color, #673ab7);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.15s ease, filter 0.15s ease;
  min-height: 80px;
  display: flex;
  align-items: flex-end;
}
.mood-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(0,0,0,0.3));
  border-radius: inherit;
}
.mood-card:hover { transform: scale(1.03); filter: brightness(1.1); }
.mood-card:active { transform: scale(0.97); }
.mood-text {
  position: relative;
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
  z-index: 1;
}

/* Sections */
.section { margin-bottom: 24px; }
.section-header { margin-bottom: 10px; }
.section-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.section-strapline {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  font-weight: 600;
}
.subsection-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 10px;
}

/* Quick picks (tracks grid) */
.quick-picks-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}
.quick-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  overflow: hidden;
}
.quick-pick-item:hover { background: rgba(255,255,255,0.06); }
.qp-img {
  width: 56px; height: 56px;
  object-fit: cover; border-radius: 4px;
  flex-shrink: 0; background: var(--p-surface-800);
}
.qp-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.qp-title { font-size: 0.8rem; font-weight: 600; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp-meta { font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Video badge */
.video-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  font-size: 0.6rem;
  color: var(--p-primary-color);
  vertical-align: middle;
  flex-shrink: 0;
}
.video-badge i { font-size: 0.6rem; }

/* Carousel */
.carousel-wrap {
  position: relative;
  overflow: hidden;
}
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
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 2rem;
  color: white;
}
.carousel-card:hover .card-play-overlay { opacity: 1; }
.card-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin-top: 6px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-sub {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-80%);
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.7);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.carousel-arrow.left { left: 4px; }
.carousel-arrow.right { right: 4px; }
.carousel-arrow:hover { background: rgba(0,0,0,0.9); }

/* Chart tracks */
.chart-section { margin-bottom: 18px; }
.chart-tracks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.chart-track {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  overflow: hidden;
}
.chart-track:hover { background: rgba(255,255,255,0.06); }
.chart-rank {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--p-text-muted-color);
  min-width: 28px;
  flex-shrink: 0;
  text-align: center;
}
.chart-img {
  width: 48px; height: 48px;
  object-fit: cover; border-radius: 4px;
  flex-shrink: 0; background: var(--p-surface-800);
}
.chart-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}
.chart-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chart-artist {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Country chips */
.country-chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.country-chips::-webkit-scrollbar { display: none; }

.country-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 500px;
  border: none;
  background: rgba(255,255,255,0.08);
  color: var(--p-text-color);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}
.country-chip:hover { background: rgba(255,255,255,0.14); }
.country-chip.active { background: var(--p-text-color); color: var(--p-surface-950); font-weight: 600; }

/* Loading */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.skeleton-card {
  aspect-ratio: 1;
  border-radius: 8px;
  background: linear-gradient(110deg, var(--p-surface-800) 8%, var(--p-surface-700) 18%, var(--p-surface-800) 33%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { to { background-position-x: -200%; } }

.error-state { text-align: center; padding: 60px 20px; color: var(--p-text-muted-color); }
.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  border-radius: 500px;
  border: none;
  background: var(--p-primary-color);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

/* ─── Mobile Responsive ─── */
@media (max-width: 600px) {
  .page-title { font-size: 1.5rem; }
  .nav-buttons { flex-wrap: wrap; }
  .mood-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .mood-card { min-height: 60px; padding: 12px 10px; }
  .quick-picks-grid { grid-template-columns: 1fr; }
  .carousel-card { flex: 0 0 140px; }
  .card-img-wrap { width: 140px; height: 140px; }
  .card-title, .card-sub { max-width: 140px; }
  .chart-tracks { grid-template-columns: 1fr; }
  .carousel-arrow { display: none; }
  .section-title { font-size: 1.1rem; }
}

@media (min-width: 601px) and (max-width: 900px) {
  .mood-grid { grid-template-columns: repeat(3, 1fr); }
  .quick-picks-grid { grid-template-columns: repeat(2, 1fr); }
  .carousel-card { flex: 0 0 160px; }
  .card-img-wrap { width: 160px; height: 160px; }
  .card-title, .card-sub { max-width: 160px; }
  .chart-tracks { grid-template-columns: 1fr; }
}

@media (min-width: 901px) and (max-width: 1200px) {
  .quick-picks-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
