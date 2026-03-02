<template>
  <div class="discover-page">
    <header class="page-header">
      <h1 class="page-title">{{ greeting }}</h1>
    </header>

    <!-- Mood Chips (YouTube Music style) -->
    <div class="mood-chips" v-if="moodChips.length">
      <button
        v-for="chip in moodChips"
        :key="chip.text"
        class="mood-chip"
        :class="{ active: activeChip === chip.text }"
        @click="toggleChip(chip)"
      >
        {{ chip.text }}
      </button>
    </div>

    <!-- Quick Picks (Selección rápida) -->
    <section class="section" v-if="quickPickTracks.length">
      <div class="section-header">
        <h2 class="section-title">Selección rápida</h2>
      </div>
      <div class="quick-picks-grid">
        <div
          v-for="track in quickPickTracks.slice(0, 12)"
          :key="track.id"
          class="quick-pick-item"
          @click="playTrack(track)"
        >
          <img :src="track.album.cover_small || track.album.cover" :alt="track.title" class="qp-img" loading="lazy" />
          <div class="qp-info">
            <span class="qp-title truncate">{{ track.title_short || track.title }}</span>
            <span class="qp-meta truncate">{{ track.artist.name }} · {{ track.album.title }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Dynamic Sections from Home Feed -->
    <section
      v-for="section in displaySections"
      :key="section.title"
      class="section"
    >
      <div class="section-header">
        <div>
          <span class="section-strapline" v-if="section.strapline">{{ section.strapline }}</span>
          <h2 class="section-title">{{ section.title }}</h2>
        </div>
      </div>

      <!-- Track list section -->
      <div v-if="section.tracks.length && !section.playlists.length && !section.albums.length" class="tracks-list">
        <TrackItem
          v-for="(track, i) in section.tracks.slice(0, 6)"
          :key="track.id"
          :track="track"
          :track-list="section.tracks"
          :index="i + 1"
        />
      </div>

      <!-- Carousel: Albums -->
      <div v-if="section.albums.length" class="carousel-wrap" :ref="el => setCarouselRef(section.title + '-albums', el)">
        <button class="carousel-arrow left" @click="scrollCarousel(section.title + '-albums', -1)" aria-label="Anterior">
          <i class="pi pi-chevron-left"></i>
        </button>
        <div class="carousel-track" :data-carousel="section.title + '-albums'">
          <AlbumCard v-for="album in section.albums" :key="album.id" :album="album" />
        </div>
        <button class="carousel-arrow right" @click="scrollCarousel(section.title + '-albums', 1)" aria-label="Siguiente">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>

      <!-- Carousel: Playlists -->
      <div v-if="section.playlists.length" class="carousel-wrap" :ref="el => setCarouselRef(section.title + '-playlists', el)">
        <button class="carousel-arrow left" @click="scrollCarousel(section.title + '-playlists', -1)" aria-label="Anterior">
          <i class="pi pi-chevron-left"></i>
        </button>
        <div class="carousel-track" :data-carousel="section.title + '-playlists'">
          <div
            v-for="pl in section.playlists"
            :key="pl.id"
            class="playlist-card"
            @click="openPlaylist(pl)"
          >
            <div class="playlist-img-wrap">
              <img :src="pl.cover_medium || pl.cover" :alt="pl.title" class="playlist-img" loading="lazy" />
              <span class="playlist-play-btn">
                <i class="pi pi-play"></i>
              </span>
            </div>
            <span class="playlist-name truncate">{{ pl.title }}</span>
            <span class="playlist-desc truncate" v-if="pl.description">{{ pl.description }}</span>
          </div>
        </div>
        <button class="carousel-arrow right" @click="scrollCarousel(section.title + '-playlists', 1)" aria-label="Siguiente">
          <i class="pi pi-chevron-right"></i>
        </button>
      </div>
    </section>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="loading-sections">
      <div class="skeleton-chips">
        <Skeleton v-for="i in 6" :key="i" width="90px" height="32px" borderRadius="500px" />
      </div>
      <div v-for="s in 3" :key="s" class="skeleton-section">
        <Skeleton width="200px" height="24px" class="mb-3" />
        <div class="skeleton-row">
          <Skeleton v-for="i in 5" :key="i" width="180px" height="180px" borderRadius="var(--radius-md)" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="hasError && !isLoading" class="error-state">
      <i class="pi pi-wifi" style="font-size: 2rem; opacity: 0.3;"></i>
      <p>No se pudo cargar el contenido</p>
      <Button icon="pi pi-refresh" label="Reintentar" rounded size="small" @click="loadAll" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { youtubeApi, type DayaxTrack, type DayaxHomeSection } from '@/api/youtube'
import { usePlayerStore } from '@/stores/player'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'
import AlbumCard from '@/components/shared/AlbumCard.vue'

const router = useRouter()
const player = usePlayerStore()

interface MoodChip { text: string; params: string; selected?: boolean }

const moodChips = ref<MoodChip[]>([])
const activeChip = ref('')
const isFilterLoading = ref(false)
const allSections = ref<DayaxHomeSection[]>([])
const quickPickTracks = ref<DayaxTrack[]>([])
const isLoading = ref(true)
const hasError = ref(false)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
})

// Separate quick picks (first track section) from rest
const displaySections = computed(() => {
  return allSections.value.filter(s =>
    s.tracks.length > 0 || s.albums.length > 0 || s.playlists.length > 0
  )
})

async function loadAll() {
  isLoading.value = true
  hasError.value = false
  try {
    const homeRes = await youtubeApi.getHomeFeed()

    // Extract mood chips
    moodChips.value = (homeRes.data.chips || []).slice(0, 10)

    const sections = homeRes.data.sections || []

    // First section with tracks becomes "Quick picks"
    const firstTrackSection = sections.find((s: DayaxHomeSection) => s.tracks.length > 0)
    if (firstTrackSection) {
      quickPickTracks.value = firstTrackSection.tracks
      // Remove from regular sections
      allSections.value = sections.filter((s: DayaxHomeSection) => s !== firstTrackSection)
    } else {
      allSections.value = sections
    }
  } catch (err) {
    console.error('Failed to load discover:', err)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

async function toggleChip(chip: MoodChip) {
  if (activeChip.value === chip.text) {
    // Deselect — reload default feed
    activeChip.value = ''
    await loadAll()
    return
  }

  activeChip.value = chip.text
  isFilterLoading.value = true
  try {
    const homeRes = await youtubeApi.getHomeFeed(chip.params)
    const sections = homeRes.data.sections || []

    // Update chips if returned
    if (homeRes.data.chips?.length) {
      moodChips.value = homeRes.data.chips.slice(0, 10)
    }

    // Filtered view: first track section as quick picks, rest as sections
    const firstTrackSection = sections.find((s: DayaxHomeSection) => s.tracks.length > 0)
    if (firstTrackSection) {
      quickPickTracks.value = firstTrackSection.tracks
      allSections.value = sections.filter((s: DayaxHomeSection) => s !== firstTrackSection)
    } else {
      quickPickTracks.value = []
      allSections.value = sections
    }
  } catch (err) {
    console.error('Failed to load mood filter:', err)
  } finally {
    isFilterLoading.value = false
  }
}

function playTrack(track: DayaxTrack) {
  player.playTrack(track, quickPickTracks.value)
}

function openPlaylist(pl: { id: string }) {
  const id = pl.id.startsWith('VL') ? pl.id : `VL${pl.id}`
  router.push(`/playlist/${id}`)
}

// ─── Carousel scroll ───
const carouselRefs: Record<string, HTMLElement | null> = {}

function setCarouselRef(key: string, el: unknown) {
  carouselRefs[key] = el as HTMLElement | null
}

function scrollCarousel(key: string, direction: number) {
  const wrap = carouselRefs[key]
  if (!wrap) return
  const track = wrap.querySelector('.carousel-track') as HTMLElement | null
  if (!track) return
  const scrollAmount = track.clientWidth * 0.75
  track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' })
}

onMounted(() => loadAll())
</script>

<style scoped>
.discover-page { width: 100%; }

.page-header { margin-bottom: 8px; }
.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Mood Chips ─── */
.mood-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
}
.mood-chips::-webkit-scrollbar { display: none; }

.mood-chip {
  flex-shrink: 0;
  padding: 8px 18px;
  border-radius: 500px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--p-text-color);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease;
  white-space: nowrap;
}

.mood-chip:hover { background: rgba(255, 255, 255, 0.14); }
.mood-chip:active { transform: scale(0.96); }
.mood-chip.active {
  background: var(--p-text-color);
  color: var(--p-surface-950);
  font-weight: 600;
}

/* ─── Quick Picks Grid ─── */
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
  transition: background 0.15s ease;
}

.quick-pick-item:hover { background: rgba(255, 255, 255, 0.06); }

.qp-img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--p-surface-800);
}

.qp-info { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.qp-title { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.qp-meta { font-size: 0.7rem; color: var(--p-text-muted-color); }

/* ─── Sections ─── */
.section { margin-bottom: 20px; }
.section-header { margin-bottom: 10px; }
.section-strapline {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--p-text-muted-color);
  font-weight: 600;
  margin-bottom: 2px;
  display: block;
}
.section-title {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.tracks-list { display: flex; flex-direction: column; }

/* ─── Carousel ─── */
.carousel-wrap {
  position: relative;
}

.carousel-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  padding: 4px 0;
}
.carousel-track::-webkit-scrollbar { display: none; }

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-80%);
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--p-surface-800);
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--p-text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.carousel-wrap:hover .carousel-arrow { opacity: 1; }
.carousel-arrow:hover { background: var(--p-surface-700); }
.carousel-arrow.left { left: -8px; }
.carousel-arrow.right { right: -8px; }

/* ─── Playlist Cards ─── */
.playlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 180px;
  flex-shrink: 0;
  cursor: pointer;
}

.playlist-img-wrap {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.playlist-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  background: var(--p-surface-800);
}

.playlist-card:hover .playlist-img { transform: scale(1.04); }

.playlist-play-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 42px;
  height: 42px;
  background: var(--p-primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-surface-950);
  font-size: 0.9rem;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.playlist-card:hover .playlist-play-btn {
  opacity: 1;
  transform: translateY(0);
}

.playlist-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
  padding: 0 2px;
}

.playlist-desc {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  padding: 0 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── Loading Skeleton ─── */
.skeleton-chips { display: flex; gap: 8px; margin-bottom: 28px; }
.skeleton-section { margin-bottom: 32px; }
.skeleton-row { display: flex; gap: 16px; overflow: hidden; }
.mb-3 { margin-bottom: 12px; }

.loading-sections { padding: 0; }

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

/* ─── Responsive ─── */
@media (max-width: 600px) {
  .quick-picks-grid { grid-template-columns: 1fr; }
  .playlist-card { width: 150px; }
  .playlist-img-wrap { width: 150px; height: 150px; }
  .page-title { font-size: 1.5rem; }
}

@media (min-width: 601px) and (max-width: 900px) {
  .quick-picks-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 901px) and (max-width: 1200px) {
  .quick-picks-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1201px) {
  .quick-picks-grid { grid-template-columns: repeat(4, 1fr); }
}
</style>
