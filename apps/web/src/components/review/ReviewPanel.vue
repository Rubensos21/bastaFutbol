<script setup lang="ts">
import { useGameStore } from '../../stores/game';
const game = useGameStore();
</script>
<template>
  <section class="review-panel">
    <div class="review-footer">
      <button
        v-if="game.isHost"
        class="primary"
        :disabled="game.busy || !game.snapshot?.writable"
        @click="game.action('review:finish')"
      >
        Publicar puntos →
      </button>
      <p v-else class="muted">El anfitrión publicará el marcador.</p>
    </div>
  </section>
</template>
