<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameStore } from '../../stores/game';
import { useClock } from '../../composables/useClock';
const game = useGameStore(),
  clock = useClock(),
  reason = ref('');
const room = computed(() => game.snapshot!);
const labels: Record<string, string> = {
  LOBBY: 'VESTÍBULO',
  STARTING: 'PREPARANDO',
  ANSWERS_LOCKED: 'TIEMPO TERMINADO',
  SCORING: 'CALCULANDO PUNTOS',
  SELECTING_SPINNER: 'SORTEO',
  LETTER_REVEAL: 'LA LETRA ES',
  COUNTDOWN: 'PREPÁRATE',
  ANSWERING: 'EN JUEGO',
  REVIEW: 'REVISIÓN',
  ROUND_RESULTS: 'MARCADOR',
  FINAL_RESULTS: 'RESULTADO FINAL',
  FINISHED: 'PARTIDA CERRADA',
};
</script>
<template>
  <div class="game-bar">
    <div>
      <span class="eyebrow">SALA {{ room.code }} · {{ room.members.length }}/7</span
      ><strong class="round-label"
        >RONDA {{ room.round?.number ?? 1 }} <span>/ {{ room.settings.rounds }}</span></strong
      >
    </div>
    <div class="game-letter">
      <span>LETRA</span><b>{{ room.round?.letter ?? '?' }}</b>
    </div>
    <div
      class="game-clock"
      :class="{ urgent: clock.seconds.value <= 10 && room.phase === 'ANSWERING' }"
    >
      <span>{{ labels[room.phase] ?? room.phase }}</span
      ><b>{{ room.endsAt ? clock.display.value : '—' }}</b>
    </div>
    <details v-if="game.isHost" class="host-controls">
      <summary>Control del anfitrión</summary>
      <button
        v-if="
          ['SELECTING_SPINNER', 'LETTER_REVEAL', 'COUNTDOWN', 'ANSWERING', 'REVIEW'].includes(
            room.phase,
          )
        "
        class="secondary"
        @click="game.action('game:pause', { paused: !room.pausedAt })"
      >
        {{ room.pausedAt ? 'Reanudar' : 'Pausar' }}</button
      ><label>Motivo de cierre<input v-model="reason" minlength="3" maxlength="240" /></label
      ><button
        class="danger-button"
        :disabled="reason.trim().length < 3"
        @click="game.action('game:end', { reason })"
      >
        Finalizar por error
      </button>
    </details>
  </div>
  <div v-if="room.members.some((m) => m.id === room.hostId && !m.connected)" class="banner">
    El anfitrión está desconectado. Se transferirá el control tras 30 segundos; el reloj continúa.
  </div>
</template>
