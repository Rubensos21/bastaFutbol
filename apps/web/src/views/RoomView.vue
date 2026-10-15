<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { codeSchema, normalizeText, type RoomPreview } from '@basta/shared';
import { useGameStore } from '../stores/game';
import Lobby from '../components/lobby/Lobby.vue';
import GameBoard from '../components/board/GameBoard.vue';
import LetterDraw from '../components/draw/LetterDraw.vue';
import ReviewPanel from '../components/review/ReviewPanel.vue';
import Results from '../components/results/Results.vue';
import GameBar from '../components/common/GameBar.vue';
const route = useRoute(),
  router = useRouter(),
  game = useGameStore(),
  nickname = ref('');
const code = computed(() => String(route.params.code).toUpperCase()),
  room = computed(() => (game.snapshot?.code === code.value ? game.snapshot : null));
const preview = ref<RoomPreview | null>(null),
  desiredSlot = ref<number | undefined>();
let attempted = '';
watch(
  () => [game.connected, code.value],
  async () => {
    if (game.connected && attempted !== code.value && codeSchema.safeParse(code.value).success) {
      attempted = code.value;
      const resumed = await game.resume(code.value);
      if (!resumed) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL ?? ''}/api/rooms/${code.value}`,
            { credentials: 'include', signal: AbortSignal.timeout(10000) },
          );
          if (response.ok) {
            preview.value = await response.json();
          } else {
            const failed = (await response.json()) as { message: string };
            game.error = failed.message;
          }
        } catch {
          game.error = 'No se pudo consultar la disponibilidad de la sala.';
        }
      }
    }
  },
  { immediate: true },
);
async function join() {
  if (
    await game.enter('room:join', {
      code: code.value,
      nickname: nickname.value,
      ...(desiredSlot.value ? { desiredSlot: desiredSlot.value } : {}),
    })
  )
    attempted = code.value;
}
async function leave() {
  await game.leave();
  if (!game.snapshot) await router.push('/');
}
</script>
<template>
  <main v-if="!room" class="join-page">
    <section class="entry-panel">
      <p class="eyebrow">INVITACIÓN A UNA SALA PRIVADA</p>
      <h1 class="invite-code">{{ code }}</h1>
      <h2>Tu lugar en la cancha.</h2>
      <p class="muted">
        Escribe tu nombre para entrar. Una sesión existente se reanuda automáticamente.
      </p>
      <p v-if="preview && preview.phase !== 'LOBBY'" class="form-error">
        La partida ya comenzó o está finalizada. Solo pueden reconectar los participantes
        existentes.
      </p>
      <p v-else-if="preview && preview.memberCount >= preview.capacity" class="form-error">
        La sala está llena.
      </p>
      <form @submit.prevent="join">
        <label for="guest-name"
          >TU APODO<input
            id="guest-name"
            v-model="nickname"
            minlength="2"
            maxlength="96"
            autocomplete="nickname"
            placeholder="¿Cómo te llamas?"
            required
        /></label>
        <label v-if="preview?.slots.length" for="desired-slot"
          >PLAZA<select id="desired-slot" v-model="desiredSlot">
            <option :value="undefined">Asignar plaza libre o mi reserva</option>
            <option
              v-for="slot in preview.slots"
              :key="slot.slot"
              :value="slot.slot"
              :disabled="
                !!slot.reservedName && normalizeText(slot.reservedName) !== normalizeText(nickname)
              "
            >
              Plaza {{ slot.slot
              }}{{ slot.reservedName ? ` · Reservada para ${slot.reservedName}` : ' · Libre' }}
            </option>
          </select></label
        >
        <button
          class="primary wide"
          :disabled="
            !game.connected ||
            game.busy ||
            !!(preview && (preview.phase !== 'LOBBY' || preview.memberCount >= preview.capacity))
          "
        >
          Unirme a la sala →
        </button>
      </form>
      <RouterLink to="/" class="text-link">Volver al inicio</RouterLink>
    </section>
  </main>
  <main v-else class="room-page">
    <GameBar v-if="room.phase !== 'LOBBY'" /><Lobby
      v-if="room.phase === 'LOBBY'"
      @leave="leave"
    /><LetterDraw
      v-else-if="
        ['STARTING', 'SELECTING_SPINNER', 'LETTER_REVEAL', 'COUNTDOWN'].includes(room.phase)
      "
    /><template
      v-else-if="['ANSWERING', 'ANSWERS_LOCKED', 'REVIEW', 'SCORING'].includes(room.phase)"
      ><GameBoard /><ReviewPanel v-if="room.phase === 'REVIEW'" /></template
    ><Results v-else @leave="leave" />
    <div v-if="room.pausedAt" class="pause-banner" role="status">
      PARTIDA PAUSADA
      <button
        v-if="game.isHost"
        class="secondary"
        @click="game.action('game:pause', { paused: false })"
      >
        Reanudar
      </button>
    </div>
  </main>
</template>
