<template>
  <div class="not-found">
    <i class="pi pi-map" style="font-size: 3rem; opacity: 0.2;"></i>
    <h1>404</h1>
    <p>Esta página no existe</p>
    <router-link to="/" class="no-decoration">
      <Button icon="pi pi-home" label="Volver al inicio" rounded />
    </router-link>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
</script>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  gap: 12px;
  min-height: 60vh;
}

.not-found h1 {
  font-size: 4rem;
  font-weight: 800;
  letter-spacing: -0.05em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.not-found p {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.no-decoration { text-decoration: none; }
</style>
