import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'dayax_accent'
const DEFAULT_ACCENT = 'emerald'

export type AccentColor = 'emerald' | 'violet' | 'rose' | 'amber' | 'blue'

export interface AccentDefinition {
    name: string
    label: string
    primary: string
    gradient: string
    glow: string
}

export const ACCENT_COLORS: Record<AccentColor, AccentDefinition> = {
    emerald: {
        name: 'emerald',
        label: 'Esmeralda',
        primary: '#34d399',
        gradient: 'linear-gradient(135deg, #34d399, #10b981)',
        glow: 'rgba(52, 211, 153, 0.35)',
    },
    violet: {
        name: 'violet',
        label: 'Violeta',
        primary: '#a78bfa',
        gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
        glow: 'rgba(167, 139, 250, 0.35)',
    },
    rose: {
        name: 'rose',
        label: 'Rosa',
        primary: '#fb7185',
        gradient: 'linear-gradient(135deg, #fb7185, #f43f5e)',
        glow: 'rgba(251, 113, 133, 0.35)',
    },
    amber: {
        name: 'amber',
        label: 'Ámbar',
        primary: '#fbbf24',
        gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        glow: 'rgba(251, 191, 36, 0.35)',
    },
    blue: {
        name: 'blue',
        label: 'Azul',
        primary: '#60a5fa',
        gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
        glow: 'rgba(96, 165, 250, 0.35)',
    },
}

function loadAccent(): AccentColor {
    try {
        const val = localStorage.getItem(STORAGE_KEY)
        if (val && val in ACCENT_COLORS) return val as AccentColor
    } catch { /* */ }
    return DEFAULT_ACCENT
}

function applyAccent(color: AccentColor) {
    const def = ACCENT_COLORS[color]
    const root = document.documentElement
    root.style.setProperty('--accent-gradient', def.gradient)
    root.style.setProperty('--accent-glow', def.glow)
    root.style.setProperty('--p-primary-color', def.primary)
}

export const useSettingsStore = defineStore('settings', () => {
    const accent = ref<AccentColor>(loadAccent())

    function setAccent(color: AccentColor) {
        accent.value = color
        applyAccent(color)
        try { localStorage.setItem(STORAGE_KEY, color) } catch { /* */ }
    }

    // Apply initial accent on store creation
    applyAccent(accent.value)

    return { accent, setAccent }
})
