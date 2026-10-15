<script setup lang="ts">
import { computed, ref, watch, toRaw, onScopeDispose } from 'vue';
import { type Settings } from '@basta/shared';
import { useGameStore } from '../../stores/game';
import SettingsForm from './SettingsForm.vue';
defineEmits<{ leave: [] }>();
const game = useGameStore();
const room = computed(() => game.snapshot!);
const settings = ref<Settings>(structuredClone(toRaw(room.value.settings)));
const copied = ref(false),
  fallback = ref(false),
  reservedNames = ref<Record<number, string>>({});
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onScopeDispose(() => {
  if (copyTimer) clearTimeout(copyTimer);
});
watch(
  () => JSON.stringify(room.value.settings),
  () => (settings.value = structuredClone(toRaw(room.value.settings))),
);
const invite = computed(() => `${window.location.origin}/sala/${room.value.code}`);
const canStart = computed(
  () =>
    room.value.members.length >= 2 &&
    room.value.members.every((m) => m.connected && m.ready) &&
    (room.value.settings.capacity === null ||
      room.value.members.length === room.value.settings.capacity),
);
const blocked = computed(() =>
  room.value.members.length < 2
    ? 'Invita al menos a otro jugador.'
    : room.value.settings.capacity && room.value.members.length < room.value.settings.capacity
      ? `Faltan ${room.value.settings.capacity - room.value.members.length} jugadores para la cantidad fija.`
      : room.value.members.some((m) => !m.connected)
        ? 'Espera a que todos los jugadores estén conectados.'
        : room.value.members.some((m) => !m.ready)
          ? 'Todos deben pulsar Listo, incluido el anfitrión.'
          : 'La cancha está lista.',
);
async function copy() {
  try {
    await navigator.clipboard.writeText(invite.value);
    copied.value = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied.value = false), 2500);
  } catch {
    fallback.value = true;
  }
}
const memberAt = (slot: number) => room.value.members.find((m) => m.slot === slot),
  reserveAt = (slot: number) => room.value.reservations.find((r) => r.slot === slot);
</script>
<template>
  <div class="lobby-layout">
    <aside>
      <section class="invite-card">
        <p class="eyebrow">VESTÍBULO PRIVADO</p>
        <div class="room-code">{{ room.code }}</div>
        <p>
          Comparte el enlace. Cuando todos estén dentro, comienza el anfitrión. Hasta 7 jugadores.
        </p>
        <button class="secondary wide" @click="copy">
          {{ copied ? 'Enlace copiado ✓' : 'Copiar enlace de invitación' }}
          <span aria-hidden="true">↗</span></button
        ><label v-if="fallback"
          >Copia este enlace<input
            :value="invite"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
        /></label>
      </section>
      <section class="lobby-rules">
        <p class="eyebrow">TU PARTIDA, TUS REGLAS</p>
        <SettingsForm v-model="settings" :disabled="!game.isHost || !room.writable" /><button
          v-if="game.isHost"
          class="secondary wide"
          :disabled="game.busy || !room.writable"
          @click="game.action('room:update-settings', { settings })"
        >
          Guardar configuración
        </button>
        <p class="muted small">Al guardar, todos deben confirmar Listo nuevamente.</p>
      </section>
      <button class="text-link" @click="$emit('leave')">← Salir del vestíbulo</button>
    </aside>
    <section class="roster-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">LA ALINEACIÓN</p>
          <h1>Todos a la cancha.</h1>
        </div>
        <span class="count-badge">{{ room.members.length }}<small>/7</small></span>
      </div>
      <p class="muted roster-description">
        Cada jugador entra desde su dispositivo. Las plazas vacías y reservas no juegan.
      </p>
      <div class="roster">
        <div
          v-for="slot in 7"
          :key="slot"
          class="roster-slot"
          :class="{ mine: memberAt(slot)?.id === room.meId, empty: !memberAt(slot) }"
        >
          <span class="slot-number">{{ String(slot).padStart(2, '0') }}</span
          ><template v-if="memberAt(slot)"
            ><span class="avatar" :class="`avatar-${slot}`">{{
              memberAt(slot)!.nickname.slice(0, 1).toUpperCase()
            }}</span>
            <div class="player-name">
              <strong>{{ memberAt(slot)!.nickname }}</strong
              ><small>{{
                memberAt(slot)!.id === room.hostId
                  ? 'ANFITRIÓN'
                  : memberAt(slot)!.id === room.meId
                    ? 'TÚ'
                    : 'JUGADOR'
              }}</small>
            </div>
            <span class="player-state" :class="{ ready: memberAt(slot)!.ready }">{{
              !memberAt(slot)!.connected
                ? 'Desconectado'
                : reserveAt(slot)?.claimantId
                  ? 'Aprobación pendiente'
                  : memberAt(slot)!.ready
                    ? '✓ Listo'
                    : '● Conectado'
            }}</span
            ><button
              v-if="game.isHost && memberAt(slot)!.id !== room.meId"
              class="icon-button"
              :aria-label="`Expulsar a ${memberAt(slot)!.nickname}`"
              @click="game.action('room:kick', { participantId: memberAt(slot)!.id })"
            >
              ×</button
            ><template v-if="game.isHost && reserveAt(slot)?.claimantId"
              ><button
                class="small-button"
                @click="game.action('room:approve-claim', { slot, approve: true })"
              >
                Aprobar</button
              ><button
                class="small-button"
                @click="game.action('room:approve-claim', { slot, approve: false })"
              >
                Rechazar
              </button></template
            ></template
          ><template v-else-if="reserveAt(slot)"
            ><span class="avatar empty-avatar">R</span>
            <div class="player-name">
              <strong>{{ reserveAt(slot)!.nickname }}</strong
              ><small>RESERVADO · SIN CONEXIÓN</small>
            </div>
            <button
              v-if="game.isHost"
              class="icon-button"
              aria-label="Retirar reserva"
              @click="game.action('room:remove-reservation', { slot })"
            >
              ×
            </button></template
          ><template v-else
            ><span class="avatar empty-avatar">+</span>
            <div class="player-name">
              <strong>{{
                slot > (room.settings.capacity ?? 7)
                  ? 'Plaza fuera de capacidad'
                  : 'Esperando jugador…'
              }}</strong
              ><small>VACÍO</small>
            </div>
            <details
              v-if="game.isHost && slot <= (room.settings.capacity ?? 7)"
              class="reserve-control"
            >
              <summary>Reservar</summary>
              <label :for="`reserve-${slot}`"
                >Apodo reservado<input
                  :id="`reserve-${slot}`"
                  v-model="reservedNames[slot]"
                  maxlength="96" /></label
              ><button
                class="small-button"
                @click="game.action('room:reserve-slot', { slot, nickname: reservedNames[slot] })"
              >
                Guardar reserva
              </button>
            </details></template
          >
        </div>
      </div>
      <div class="lobby-actions">
        <button
          class="secondary"
          :disabled="game.busy || !room.writable || !game.connected"
          @click="game.action('room:ready', { ready: !game.me?.ready })"
        >
          {{ game.me?.ready ? 'Cancelar listo' : 'Estoy listo ✓' }}</button
        ><button
          v-if="game.isHost"
          class="primary"
          :disabled="!canStart || !room.writable || game.busy"
          @click="game.action('game:start')"
        >
          Comenzar partida <span aria-hidden="true">→</span>
        </button>
        <p class="small muted" role="status">
          {{ game.isHost ? blocked : 'Cuando todos estén listos, comenzará el anfitrión.' }}
        </p>
      </div>
      <section class="category-preview">
        <div class="section-heading">
          <p class="eyebrow">LAS 7 CATEGORÍAS DE ESTA PARTIDA</p>
          <button
            v-if="game.isHost"
            class="text-link"
            :disabled="!room.writable || game.busy"
            @click="game.action('room:reroll')"
          >
            Volver a sortear ↻
          </button>
        </div>
        <div class="category-chips">
          <span v-for="(c, i) in room.categories" :key="c.id" :title="c.description"
            ><small>{{ String(i + 1).padStart(2, '0') }}</small
            >{{ c.label }}</span
          >
        </div>
        <p class="muted small">
          Se mantienen durante todas las rondas. Letras: {{ room.settings.letters.join(' · ') }}
        </p>
      </section>
    </section>
  </div>
</template>
