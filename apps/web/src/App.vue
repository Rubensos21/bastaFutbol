<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore } from './stores/game';
import { useUiStore } from './stores/ui';
import HelpDialog from './components/common/HelpDialog.vue';
const game = useGameStore(),
  ui = useUiStore();
onMounted(() => void game.init());
</script>
<template>
  <div class="app-shell" :class="{ 'reduced-motion': ui.reduced }">
    <header class="site-header">
      <RouterLink to="/" class="brand" aria-label="Basta Futbolero, inicio"
        ><span class="brand-mark" aria-hidden="true">B<span>F</span></span
        ><span>BASTA<span class="brand-word">FUTBOLERO</span></span></RouterLink
      >
      <div class="header-tools">
        <span class="connection"
          ><i :class="{ online: game.connected }"></i
          >{{ game.connected ? 'EN LÍNEA' : game.connecting ? 'CONECTANDO' : 'SIN CONEXIÓN' }}</span
        ><button class="icon-button" aria-label="Reglas del juego" @click="ui.help = true">
          ?
        </button>
      </div>
    </header>
    <div v-if="game.error" class="banner error" role="alert">
      {{ game.error }} <button aria-label="Cerrar error" @click="game.error = ''">×</button>
    </div>
    <div v-if="game.notice" class="banner" role="status">{{ game.notice }}</div>
    <div v-if="game.snapshot && !game.snapshot.writable" class="banner" role="status">
      Otra pestaña controla tu jugador. Recarga esta pestaña para recuperar el control.
    </div>
    <div v-if="game.connecting" class="connection-skeleton" role="status">
      <span aria-hidden="true"></span>Iniciando sesión y conexión…
    </div>
    <RouterView />
    <footer class="site-footer">
      <span>SI SABES DE FÚTBOL, DEMUÉSTRALO.</span
      ><span>2–7 JUGADORES <b>·</b> SIETE CATEGORÍAS <b>·</b> UNA LETRA</span>
    </footer>
    <HelpDialog v-if="ui.help" @close="ui.help = false" />
  </div>
</template>
