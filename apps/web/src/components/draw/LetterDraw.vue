<script setup lang="ts">
import { computed, onScopeDispose, ref, watch, nextTick } from 'vue';
import { gsap } from 'gsap';
import { useGameStore } from '../../stores/game';
import { useUiStore } from '../../stores/ui';
import { useClock } from '../../composables/useClock';
const game = useGameStore(),
  ui = useUiStore(),
  clock = useClock(),
  visualLetter = ref('A'),
  letterEl = ref<HTMLElement>(),
  label = ref('');
let interval: ReturnType<typeof setInterval> | undefined, timeline: gsap.core.Timeline | undefined;
const room = computed(() => game.snapshot!),
  picker = computed(() => room.value.members.find((m) => m.id === room.value.round?.pickerId)),
  selecting = computed(() => room.value.phase === 'SELECTING_SPINNER'),
  canStop = computed(
    () =>
      selecting.value &&
      picker.value?.id === room.value.meId &&
      room.value.writable &&
      !room.value.pausedAt &&
      game.connected,
  ),
  count = computed(() =>
    Math.max(
      1,
      Math.min(
        3,
        Math.ceil(
          ((room.value.round?.answeringStartsAt ?? 0) -
            (room.value.pausedAt ?? clock.serverNow.value)) /
            1000,
        ),
      ),
    ),
  );
watch(
  () => [room.value.phase, ui.reduced, room.value.pausedAt],
  async () => {
    if (interval) clearInterval(interval);
    timeline?.kill();
    if (selecting.value) {
      label.value = 'RULETA DE LETRAS';
      if (!ui.reduced && !room.value.pausedAt)
        interval = setInterval(() => {
          const letters = room.value.settings.letters;
          visualLetter.value = letters[Math.floor(Math.random() * letters.length)]!;
        }, 75);
      else visualLetter.value = '?';
    } else {
      visualLetter.value = room.value.round?.letter ?? '?';
      await nextTick();
      label.value = 'LA LETRA ES:';
      if (!ui.reduced && letterEl.value) {
        const typed = { progress: 0 };
        label.value = '';
        timeline = gsap
          .timeline()
          .to(typed, {
            progress: 12,
            duration: 0.55,
            ease: 'none',
            onUpdate: () => {
              label.value = 'LA LETRA ES:'.slice(0, Math.ceil(typed.progress));
            },
          })
          .fromTo(
            letterEl.value,
            { scale: 0.78, opacity: 0.25 },
            { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' },
            0,
          );
      }
    }
  },
  { immediate: true },
);
onScopeDispose(() => {
  if (interval) clearInterval(interval);
  timeline?.kill();
});
</script>
<template>
  <section class="draw-stage" aria-label="Sorteo sincronizado de letra">
    <p class="eyebrow">RONDA {{ room.round?.number }} · TODOS MIRAMOS EL MISMO SORTEO</p>
    <h1>{{ label }}</h1>
    <div class="roulette-frame">
      <span class="roulette-side" aria-hidden="true">{{ selecting ? 'A' : '•' }}</span>
      <div ref="letterEl" class="roulette-letter" aria-hidden="true">{{ visualLetter }}</div>
      <span class="roulette-side" aria-hidden="true">{{ selecting ? 'Z' : '•' }}</span>
    </div>
    <template v-if="selecting"
      ><p class="picker-name">
        LE TOCA A <strong>{{ picker?.nickname ?? 'EL SERVIDOR' }}</strong> PARAR LA RULETA
      </p>
      <button
        class="primary stop-button"
        :disabled="!canStop || game.busy"
        @click="game.action('draw:stop', { roundId: room.round?.id })"
      >
        PARAR <span aria-hidden="true">■</span>
      </button>
      <p class="muted" role="status">
        {{
          canStop
            ? 'La letra final la decide el servidor al parar.'
            : `Esperando a ${picker?.nickname ?? 'un jugador'}…`
        }}
        · Parada automática en {{ clock.seconds.value }}s.
      </p></template
    ><template v-else
      ><p class="picker-name" role="status">
        La letra es {{ room.round?.letter }}.
        {{
          room.phase === 'COUNTDOWN'
            ? 'Prepárate para escribir.'
            : 'Siete categorías. Empieza por esta letra.'
        }}
      </p>
      <div v-if="room.phase === 'COUNTDOWN'" class="countdown" aria-live="polite">{{ count }}</div>
      <p v-else class="muted">Todos comenzamos juntos.</p></template
    >
  </section>
</template>
