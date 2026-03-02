<template>
  <div class="search-page">
    <!-- Search Input with Suggestions -->
    <div class="search-field-wrap">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="inputValue"
          placeholder="¿Qué quieres escuchar?"
          class="search-input"
          @input="onInput"
          @focus="showSuggestions = true"
          @keydown.down.prevent="moveSuggestion(1)"
          @keydown.up.prevent="moveSuggestion(-1)"
          @keydown.enter.prevent="selectSuggestion"
          @keydown.escape="showSuggestions = false"
          fluid
        />
      </IconField>

      <!-- Suggestions Dropdown -->
      <Transition name="dropdown">
        <div
          v-if="showSuggestions && suggestions.length && inputValue.trim()"
          class="suggestions-dropdown"
        >
          <div
            v-for="(sug, i) in suggestions"
            :key="sug"
            class="suggestion-item"
            :class="{ active: i === activeSuggestionIndex }"
            @mousedown.prevent="applySuggestion(sug)"
          >
            <i class="pi pi-search suggestion-icon"></i>
            <span>{{ sug }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Tabs -->
    <div class="tabs" v-if="inputValue.trim()">
      <Button
        v-for="tab in tabs"
        :key="tab.key"
        :label="tab.label"
        :severity="searchStore.activeTab === tab.key ? undefined : 'secondary'"
        :outlined="searchStore.activeTab !== tab.key"
        size="small"
        rounded
        @click="searchStore.setTab(tab.key)"
      />
    </div>

    <!-- Empty: Recent + Browse Categories -->
    <div v-if="!inputValue.trim()" class="browse-section">
      <!-- Recent Searches -->
      <div v-if="recentSearches.length" class="recent-section">
        <div class="recent-header">
          <h2 class="section-title">Búsquedas recientes</h2>
          <Button label="Borrar" severity="secondary" text size="small" @click="clearHistory" />
        </div>
        <div class="recent-chips">
          <span
            v-for="term in recentSearches"
            :key="term"
            class="recent-chip"
            @click="searchFromHistory(term)"
          >
            {{ term }}
            <i class="pi pi-times recent-chip-x" @click.stop="removeFromHistory(term)"></i>
          </span>
        </div>
      </div>

      <h2 class="section-title">Explorar todo</h2>
      <div class="genre-grid">
        <div
          v-for="genre in genres"
          :key="genre.name"
          class="genre-card"
          :style="{ background: genre.color }"
          @click="searchGenre(genre.name)"
        >
          <span class="genre-name">{{ genre.name }}</span>
          <span class="genre-icon">{{ genre.emoji }}</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="searchStore.isLoading" class="loading-state">
      <Skeleton height="56px" class="mb-2" v-for="i in 5" :key="i" />
    </div>

    <!-- Results -->
    <div v-else class="search-results">
      <!-- Top Result + Tracks side by side -->
      <div class="results-grid" v-if="showTracks && searchStore.tracks.length">
        <section v-if="searchStore.artists.length && showArtists" class="top-result">
          <h3 class="section-title">Resultado principal</h3>
          <div class="top-result-card" @click="$router.push(`/artist/${searchStore.artists[0].id}`)">
            <img :src="searchStore.artists[0].picture_medium || searchStore.artists[0].picture" class="top-result-img" />
            <h2 class="top-result-name">{{ searchStore.artists[0].name }}</h2>
            <span class="top-result-type">Artista</span>
          </div>
        </section>

        <section class="songs-result">
          <h3 class="section-title">Canciones</h3>
          <div class="tracks-list">
            <TrackItem
              v-for="(track, i) in searchStore.tracks.slice(0, 4)"
              :key="track.id"
              :track="track"
              :track-list="searchStore.tracks"
              :index="i + 1"
            />
          </div>
        </section>
      </div>

      <section v-if="showArtists && searchStore.artists.length" class="result-section">
        <h3 class="section-title">Artistas</h3>
        <div class="h-scroll-row">
          <ArtistCard v-for="artist in searchStore.artists" :key="artist.id" :artist="artist" />
        </div>
      </section>

      <section v-if="showAlbums && searchStore.albums.length" class="result-section">
        <h3 class="section-title">Álbumes</h3>
        <div class="h-scroll-row">
          <AlbumCard v-for="album in searchStore.albums" :key="album.id" :album="album" />
        </div>
      </section>

      <!-- Playlists -->
      <section v-if="showPlaylists && searchStore.playlists.length" class="result-section">
        <h3 class="section-title">Playlists</h3>
        <div class="h-scroll-row">
          <div
            v-for="pl in searchStore.playlists"
            :key="pl.id"
            class="playlist-card"
            @click="$router.push(`/playlist/${pl.id}`)"
          >
            <div class="playlist-img-wrap">
              <img :src="pl.cover_medium || pl.cover" :alt="pl.title" class="playlist-img" loading="lazy" />
              <span class="playlist-play-icon">
                <i class="pi pi-play"></i>
              </span>
            </div>
            <span class="playlist-name truncate">{{ pl.title }}</span>
            <span class="playlist-desc truncate" v-if="pl.description">{{ pl.description }}</span>
          </div>
        </div>
      </section>

      <div v-if="noResults" class="empty-state">
        <p>No se encontraron resultados para "{{ inputValue }}"</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSearchStore } from '@/stores/search'
import { youtubeApi } from '@/api/youtube'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TrackItem from '@/components/shared/TrackItem.vue'
import ArtistCard from '@/components/shared/ArtistCard.vue'
import AlbumCard from '@/components/shared/AlbumCard.vue'

const searchStore = useSearchStore()
const inputValue = ref(searchStore.query)

const tabs = [
  { key: 'all' as const, label: 'Todo' },
  { key: 'tracks' as const, label: 'Canciones' },
  { key: 'artists' as const, label: 'Artistas' },
  { key: 'albums' as const, label: 'Álbumes' },
  { key: 'playlists' as const, label: 'Playlists' },
]

const genres = [
  { name: 'Pop', color: '#e13300', emoji: '🎤' },
  { name: 'Reggaetón', color: '#8400e7', emoji: '🔥' },
  { name: 'Hip Hop', color: '#ba5d07', emoji: '🎧' },
  { name: 'Rock', color: '#1e3264', emoji: '🎸' },
  { name: 'Lo-Fi', color: '#503750', emoji: '🌙' },
  { name: 'Electrónica', color: '#0d73ec', emoji: '⚡' },
  { name: 'Instrumental', color: '#27856a', emoji: '🎹' },
  { name: 'Clásica', color: '#a56853', emoji: '🎻' },
  { name: 'Jazz', color: '#477d95', emoji: '🎷' },
  { name: 'Salsa', color: '#e61e32', emoji: '💃' },
  { name: 'R&B', color: '#dc148c', emoji: '🎶' },
  { name: 'Metal', color: '#2d3a3a', emoji: '🤘' },
]

const showTracks = computed(() => searchStore.activeTab === 'all' || searchStore.activeTab === 'tracks')
const showArtists = computed(() => searchStore.activeTab === 'all' || searchStore.activeTab === 'artists')
const showAlbums = computed(() => searchStore.activeTab === 'all' || searchStore.activeTab === 'albums')
const showPlaylists = computed(() => searchStore.activeTab === 'all' || searchStore.activeTab === 'playlists')

const noResults = computed(() => {
  return !searchStore.isLoading
    && searchStore.tracks.length === 0
    && searchStore.artists.length === 0
    && searchStore.albums.length === 0
    && searchStore.playlists.length === 0
    && inputValue.value.trim() !== ''
})

// ─── Suggestions ───
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)
const activeSuggestionIndex = ref(-1)
let suggestTimer: ReturnType<typeof setTimeout> | null = null

async function fetchSuggestions(q: string) {
  if (!q.trim()) { suggestions.value = []; return }
  try {
    const res = await youtubeApi.getSearchSuggestions(q)
    suggestions.value = res.data.suggestions.slice(0, 7)
  } catch { suggestions.value = [] }
}

function onInput() {
  showSuggestions.value = true
  activeSuggestionIndex.value = -1
  searchStore.debouncedSearch(inputValue.value)

  // Debounce suggestions separately (faster)
  if (suggestTimer) clearTimeout(suggestTimer)
  suggestTimer = setTimeout(() => fetchSuggestions(inputValue.value), 200)
}

function moveSuggestion(dir: number) {
  if (!suggestions.value.length) return
  activeSuggestionIndex.value = Math.max(-1, Math.min(suggestions.value.length - 1, activeSuggestionIndex.value + dir))
}

function selectSuggestion() {
  if (activeSuggestionIndex.value >= 0 && suggestions.value[activeSuggestionIndex.value]) {
    applySuggestion(suggestions.value[activeSuggestionIndex.value]!)
  } else {
    showSuggestions.value = false
  }
}

function applySuggestion(text: string) {
  inputValue.value = text
  showSuggestions.value = false
  activeSuggestionIndex.value = -1
  addToHistory(text)
  searchStore.debouncedSearch(text)
}

function searchGenre(name: string) {
  inputValue.value = name
  addToHistory(name)
  searchStore.debouncedSearch(name)
}

// ─── Search History ───
const HISTORY_KEY = 'dayax_search_history'
const MAX_HISTORY = 8

const recentSearches = ref<string[]>(loadHistory())

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(recentSearches.value)) } catch { /* */ }
}

function addToHistory(term: string) {
  const trimmed = term.trim()
  if (!trimmed) return
  recentSearches.value = [trimmed, ...recentSearches.value.filter(t => t !== trimmed)].slice(0, MAX_HISTORY)
  saveHistory()
}

function removeFromHistory(term: string) {
  recentSearches.value = recentSearches.value.filter(t => t !== term)
  saveHistory()
}

function clearHistory() {
  recentSearches.value = []
  saveHistory()
}

function searchFromHistory(term: string) {
  inputValue.value = term
  searchStore.debouncedSearch(term)
}

// Save to history when search completes
import { watch as vueWatch } from 'vue'
vueWatch(() => searchStore.query, (q) => {
  if (q.trim()) addToHistory(q)
})

// Close suggestions on click outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', () => { showSuggestions.value = false })
}
</script>

<style scoped>
.search-page { width: 100%; }

.search-field-wrap { position: relative; }

.search-input {
  font-size: 0.95rem !important;
  border-radius: 500px !important;
}

/* Suggestions Dropdown */
.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--p-surface-900);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--p-text-color);
  transition: background 0.1s ease;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: rgba(255, 255, 255, 0.06);
}

.suggestion-icon {
  font-size: 0.75rem;
  opacity: 0.4;
}

.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.tabs {
  display: flex;
  gap: 6px;
  margin: 12px 0 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }

/* Recent Searches */
.recent-section { margin-bottom: 24px; }
.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.recent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 500px;
  font-size: 0.8rem;
  color: var(--p-text-color);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.recent-chip:hover { background: rgba(255, 255, 255, 0.1); }
.recent-chip-x {
  font-size: 0.6rem;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}
.recent-chip-x:hover { opacity: 1; }

/* Genre Grid (Spotify browse) */
.browse-section { margin-top: 24px; }

.genre-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.genre-card {
  height: 100px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: flex-end;
  padding: 16px;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: transform var(--transition-fast);
}

.genre-card:hover { transform: scale(1.02); }
.genre-card:active { transform: scale(0.98); }

.genre-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
  position: relative;
  z-index: 1;
}

.genre-icon {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-size: 3.5rem;
  transform: rotate(25deg);
  opacity: 0.6;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
  pointer-events: none;
}

/* Results Grid (Spotify: top result + songs side-by-side) */
.results-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.top-result-card {
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-md);
  padding: 20px;
  cursor: pointer;
  transition: background var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-result-card:hover { background: rgba(255, 255, 255, 0.08); }

.top-result-img {
  width: 92px;
  height: 92px;
  border-radius: var(--radius-full);
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.top-result-name { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }
.top-result-type {
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 600;
  background: rgba(255,255,255,0.1);
  padding: 4px 12px;
  border-radius: 500px;
  width: fit-content;
  color: var(--p-text-color);
}

.songs-result .tracks-list { display: flex; flex-direction: column; }

.result-section { margin-bottom: 24px; }

/* Playlist Cards in Search */
.playlist-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 160px;
  flex-shrink: 0;
  cursor: pointer;
}

.playlist-img-wrap {
  position: relative;
  width: 160px;
  height: 160px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.playlist-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.playlist-card:hover .playlist-img { transform: scale(1.05); }

.playlist-play-icon {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 40px;
  height: 40px;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.playlist-card:hover .playlist-play-icon {
  opacity: 1;
  transform: translateY(0);
}

.playlist-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.playlist-desc {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 8px;
}
.empty-state p { color: var(--p-text-muted-color); font-size: 0.85rem; }

.loading-state { padding: 20px 0; }
.mb-2 { margin-bottom: 8px; }

@media (min-width: 768px) {
  .genre-grid { grid-template-columns: repeat(3, 1fr); }
  .results-grid { grid-template-columns: 380px 1fr; }
}

@media (min-width: 1025px) {
  .genre-grid { grid-template-columns: repeat(4, 1fr); }
  .genre-card { height: 120px; }
  .result-section { margin-bottom: 32px; }
}
</style>
