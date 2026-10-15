<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import { useGameStore } from '../../stores/game';
import { useUiStore } from '../../stores/ui';
import GameBoard from '../board/GameBoard.vue';
defineEmits<{ leave: [] }>();
const game = useGameStore(),
  ui = useUiStore(),
  room = computed(() => game.snapshot!),
  table = ref<HTMLElement>();
let animation: gsap.core.Tween | undefined;
const final = computed(() => ['FINAL_RESULTS', 'FINISHED'].includes(room.value.phase));
const top = computed(() => room.value.ranking.filter((p) => p.rank === 1));
const names = computed(() =>
  top.value
    .map((p) => room.value.members.find((m) => m.id === p.participantId)?.nickname)
    .join(' y '),
);
const history = computed(() => [
  ...room.value.history,
  ...(room.value.round ? [room.value.round] : []),
]);
onMounted(() => {
  if (table.value && !ui.reduced)
    animation = gsap.from(table.value.querySelectorAll('.leaderboard-row'), {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
    });
});
onUnmounted(() => animation?.kill());
</script>
<template>
  <section class="results-stage">
    <p class="eyebrow">{{ final ? 'EL SILBATAZO FINAL' : 'LA RONDA TIENE MARCADOR' }}</p>
    <h1>
      {{
        room.phase === 'FINISHED'
          ? 'Partida cerrada.'
          : final
            ? top.length > 1
              ? 'La gloria se comparte.'
              : 'Tenemos campeón.'
            : 'Cada palabra cuenta.'
      }}
    </h1>
    <p v-if="final && room.phase !== 'FINISHED'" class="winner-name">{{ names }}</p>
    <p v-if="room.round?.cancelled" class="banner">
      La última ronda fue cancelada y no suma puntos.
    </p>
    <div ref="table" class="leaderboard">
      <div class="leaderboard-head">
        <span>POS.</span><span>JUGADOR</span><span>ESTA RONDA</span><span>TOTAL</span>
      </div>
      <div
        v-for="p in room.ranking"
        :key="p.participantId"
        class="leaderboard-row"
        :class="{ winner: p.rank === 1, mine: p.participantId === room.meId }"
      >
        <b class="rank">{{ String(p.rank).padStart(2, '0') }}</b>
        <div>
          <strong>{{ room.members.find((m) => m.id === p.participantId)?.nickname }}</strong
          ><small
            >{{ p.uniqueCount }} únicas · {{ p.validCount }} categorías válidas{{
              p.participantId === room.meId ? ' · TÚ' : ''
            }}</small
          >
        </div>
        <span
          >+{{
            room.round?.scores.find((s) => s.participantId === p.participantId)?.total ?? 0
          }}</span
        ><b class="total">{{ p.total }}<small>PTS</small></b>
      </div>
    </div>
    <p class="muted small">
      Desempate: puntos, respuestas únicas y categorías válidas. Si todo coincide, comparten
      posición.
    </p>
    <div class="result-actions">
      <button
        v-if="game.isHost"
        class="primary"
        :disabled="game.busy || !room.writable || !game.connected"
        @click="game.action(final ? 'game:rematch' : 'game:next-round')"
      >
        {{ final ? 'Revancha con el mismo grupo' : 'Siguiente ronda' }} →
      </button>
      <p v-else class="muted">
        {{
          final
            ? 'El anfitrión puede preparar una revancha.'
            : 'Esperando al anfitrión para la siguiente ronda.'
        }}
      </p>
      <button v-if="final" class="secondary" @click="$emit('leave')">Salir</button>
    </div>
  </section>
  <GameBoard v-if="room.round && !room.round.cancelled" />
  <section class="round-history">
    <p class="eyebrow">TODO QUEDA EN LA CANCHA</p>
    <h2>Historial de la partida.</h2>
    <details v-for="r in history" :key="r.id">
      <summary>
        Ronda {{ r.number }} · Letra {{ r.letter ?? '—' }} {{ r.cancelled ? '· Cancelada' : '' }}
      </summary>
      <div class="matrix-scroll">
        <table class="history-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th v-for="c in room.categories" :key="c.id">{{ c.label }}</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in room.members" :key="m.id">
              <th>{{ m.nickname }}</th>
              <td v-for="c in room.categories" :key="c.id">
                <span>{{
                  r.entries.find((e) => e.participantId === m.id && e.categoryId === c.id)?.text ||
                  '—'
                }}</span
                ><small
                  >{{
                    r.scoredEntries.find((e) => e.participantId === m.id && e.categoryId === c.id)
                      ?.scoreReason ?? 'Sin puntuación'
                  }}
                  · +{{
                    r.scoredEntries.find((e) => e.participantId === m.id && e.categoryId === c.id)
                      ?.points ?? 0
                  }}</small
                >
              </td>
              <td>{{ r.scores.find((s) => s.participantId === m.id)?.total ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </section>
</template>
