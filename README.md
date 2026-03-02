<p align="center">
  <img src="dayax-app/public/vite.svg" width="80" alt="Dayax Logo">
</p>

<h1 align="center">Dayax</h1>

<p align="center">
  <strong>🎵 Tu reproductor de música streaming personal</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/PrimeVue-4-06b6d4?logo=primevue&logoColor=white" alt="PrimeVue">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white" alt="pnpm">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.19-339933?logo=node.js&logoColor=white" alt="Node.js">
</p>

---

## ¿Qué es Dayax?

Dayax es un reproductor de música streaming que conecta con YouTube Music a través de una API propia. Diseñado con una interfaz moderna estilo Spotify, permite explorar música, buscar canciones, reproducir audio en streaming y gestionar colas de reproducción — todo desde el navegador.

## Tech Stack

| Capa       | Tecnología                                                                |
| ---------- | ------------------------------------------------------------------------- |
| Frontend   | [Vue 3](https://vuejs.org) · [Vite 7](https://vite.dev) · TypeScript     |
| UI         | [PrimeVue 4](https://primevue.org) · [PrimeIcons](https://primeicons.org) · Inter font |
| State      | [Pinia 3](https://pinia.vuejs.org)                                        |
| HTTP       | [Axios](https://axios-http.com)                                           |
| Backend    | [Express 5](https://expressjs.com) · Node.js                             |
| YouTube    | [youtubei.js](https://github.com/LuanRT/YouTube.js) (Innertube API)      |
| Monorepo   | [pnpm workspaces](https://pnpm.io/workspaces)                            |

## Estructura del Proyecto

```
dayax/
├── dayax-api/              → @dayax/api  (Backend)
│   └── src/
│       ├── server.js           Servidor Express
│       ├── innertube.js        Cliente Innertube (YouTube Music)
│       ├── mappers.js          Mapeo de datos YouTube → Dayax
│       └── routes/
│           ├── browse.js       Explorar, artistas, álbumes, playlists
│           ├── search.js       Búsqueda de música
│           └── stream.js       Streaming y descarga de audio
│
├── dayax-app/              → @dayax/app  (Frontend)
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts             Entrada de la app
│       ├── App.vue             Layout principal
│       ├── api/                Capa de comunicación con el API
│       ├── components/         Componentes reutilizables
│       │   ├── layout/         Sidebar, PlayerBar, Header
│       │   └── shared/         TrackItem, MediaCard, etc.
│       ├── stores/             Pinia stores
│       │   ├── player.ts       Reproductor de audio
│       │   ├── search.ts       Estado de búsqueda
│       │   ├── favorites.ts    Favoritos locales
│       │   └── settings.ts     Configuración del usuario
│       ├── views/              Páginas de la app
│       │   ├── ExploreView     Inicio / Explora
│       │   ├── SearchView      Búsqueda
│       │   ├── NowPlayingView  Reproducción actual
│       │   ├── QueueView       Cola de reproducción
│       │   ├── ArtistView      Perfil de artista
│       │   ├── AlbumView       Detalle de álbum
│       │   ├── PlaylistView    Detalle de playlist
│       │   ├── GenreView       Género musical
│       │   ├── DiscoverView    Descubrir
│       │   └── FavoritesView   Favoritos
│       ├── router/             Vue Router
│       └── assets/             Estilos globales
│
├── package.json            Workspace root
├── pnpm-workspace.yaml     Configuración de workspaces
├── pnpm-lock.yaml          Lock file unificado
├── .npmrc                  Configuración de pnpm
└── .gitignore
```

## Requisitos

- **Node.js** `^20.19.0` o `>=22.12.0`
- **pnpm** `>=9` — instálalo con `npm install -g pnpm`

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/dayax.git
cd dayax

# Instalar todas las dependencias
pnpm install
```

## Desarrollo

```bash
# Iniciar AMBOS servidores en paralelo (API + App)
pnpm dev

# Solo el backend (API en http://localhost:3001)
pnpm dev:api

# Solo el frontend (App en http://localhost:3333)
pnpm dev:app
```

El frontend tiene un proxy configurado en `vite.config.ts` que redirige las peticiones `/api/*` al backend automáticamente, así que en desarrollo no necesitas preocuparte por CORS.

## Build de Producción

```bash
# Compilar el frontend para producción
pnpm build

# Los archivos se generan en dayax-app/dist/
```

## API Endpoints

El backend expone los siguientes endpoints:

| Método | Ruta                            | Descripción                          |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/health`                   | Health check del servidor            |
| GET    | `/api/search?q=...`             | Buscar canciones, artistas, álbumes  |
| GET    | `/api/explore`                  | Página de exploración (home)         |
| GET    | `/api/artist/:id`               | Perfil de artista                    |
| GET    | `/api/album/:id`                | Detalle de álbum                     |
| GET    | `/api/playlist/:id`             | Detalle de playlist                  |
| GET    | `/api/track/:id`                | Info de un track                     |
| GET    | `/api/stream/:videoId`          | Stream de audio (soporta `Range`)    |
| GET    | `/api/stream/download/:videoId` | Descargar audio                      |
| GET    | `/api/img?url=...`              | Proxy de imágenes (CDN YouTube)      |

## Scripts Disponibles

| Script         | Comando             | Descripción                              |
| -------------- | ------------------- | ---------------------------------------- |
| `dev`          | `pnpm dev`          | Inicia API y App en paralelo             |
| `dev:api`      | `pnpm dev:api`      | Solo el backend (Express + Innertube)    |
| `dev:app`      | `pnpm dev:app`      | Solo el frontend (Vite + Vue)            |
| `build`        | `pnpm build`        | Build de producción del frontend         |

## Licencia

Este proyecto es privado y de uso personal.
