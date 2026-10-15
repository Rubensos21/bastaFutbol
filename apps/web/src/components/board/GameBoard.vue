<script setup lang="ts">
import { computed, ref } from 'vue';
import { canonicalKey, startsWithLetter } from '@basta/shared';
import { useClock } from '../../composables/useClock';
import { useGameStore } from '../../stores/game';
const game = useGameStore(),
  clock = useClock(),
  room = computed(() => game.snapshot!),
  form = ref(window.matchMedia('(max-width: 700px)').matches);
const canEdit = computed(() => game.editable && clock.seconds.value > 0);
const answering = computed(() => room.value.phase === 'ANSWERING');
const complete = computed(
  () => room.value.categories.filter((c) => game.texts[c.id]?.trim()).length,
);
function entry(playerId: string, cat: string) {
  return (
    room.value.round?.scoredEntries.find(
      (e) => e.participantId === playerId && e.categoryId === cat,
    ) ?? room.value.round?.entries.find((e) => e.participantId === playerId && e.categoryId === cat)
  );
}
function hint(catId: string) {
  const cat = room.value.categories.find((c) => c.id === catId)!;
  const text = game.texts[catId] ?? '';
  if (!text.trim()) return '';
  if (!startsWithLetter(text, room.value.round?.letter ?? ''))
    return `Debe empezar con ${room.value.round?.letter}.`;
  const index = room.value.categories.findIndex((c) => c.id === catId);
  if (
    room.value.categories
      .slice(0, index)
      .some(
        (c) =>
          game.texts[c.id]?.trim() &&
          canonicalKey(game.texts[c.id]!, c.entityKind) === canonicalKey(text, cat.entityKind),
      )
  )
    return 'Repetido por ti: cuenta la primera columna.';
  return game.dirty[catId] ? 'Guardando…' : 'Guardado';
}
function points(playerId: string, cat: string) {
  const e = entry(playerId, cat);
  return e && 'points' in e ? e.points : null;
}
function cellStatus(playerId: string, categoryId: string) {
  const e = entry(playerId, categoryId);
  if (!e) return 'Pendiente';
  const reason = 'scoreReason' in e ? e.scoreReason : e.reason;
  if (reason === 'Repetido por ti') return 'Repetida';
  if (reason === 'Anulado') return 'Anulada';
  if (reason === 'Vacío') return 'Vacía';
  if ('points' in e && e.points === 10) return 'Duplicada';
  return verdictLabel[e.verdict];
}
const verdictLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  VALID: 'Válida',
  INVALID: 'Inválida',
  DISPUTED: 'Impugnada',
};
</script>
<template>
  <section class="board-section">
    <div class="section-heading board-heading">
      <div>
        <p class="eyebrow">{{ answering ? 'TU CONOCIMIENTO EN JUEGO' : 'RESPUESTAS REVELADAS' }}</p>
        <h1>{{ answering ? 'Que hable tu fútbol.' : 'Revisemos la jugada.' }}</h1>
      </div>
      <div class="board-meta">
        <span v-if="answering"
          ><b>{{ complete }}</b
          >/7 COMPLETADAS</span
        >
        <div class="segmented compact">
          <button :class="{ active: form }" @click="form = true">Mi tablero</button
          ><button :class="{ active: !form }" @click="form = false">Tabla completa</button>
        </div>
      </div>
    </div>
    <div v-if="answering && form" class="my-form">
      <label
        v-for="(cat, i) in room.categories"
        :key="cat.id"
        class="answer-field"
        :for="`answer-${cat.id}`"
        ><span class="field-number">{{ String(i + 1).padStart(2, '0') }}</span>
        <div>
          <strong>{{ cat.label }}</strong>
          <p>{{ cat.description }}</p>
          <input
            :id="`answer-${cat.id}`"
            :value="game.texts[cat.id] ?? ''"
            :disabled="!canEdit"
            :placeholder="`Empieza con ${room.round?.letter}…`"
            maxlength="80"
            autocomplete="off"
            @input="game.edit(cat.id, ($event.target as HTMLInputElement).value)"
          /><small
            :class="{
              'form-error': hint(cat.id).startsWith('Debe') || hint(cat.id).startsWith('Repetido'),
            }"
            >{{ hint(cat.id) || 'Una entidad diferente en cada categoría.' }}</small
          >
        </div></label
      >
    </div>
    <div
      v-else
      class="matrix-scroll"
      tabindex="0"
      aria-label="Tablero completo; desplázate horizontalmente para ver todas las categorías"
    >
      <table class="matrix">
        <thead>
          <tr>
            <th scope="col" class="player-column">JUGADOR</th>
            <th v-for="cat in room.categories" :key="cat.id" scope="col">
              <span>{{ cat.label }}</span>
              <details>
                <summary :aria-label="`Definición de ${cat.label}`">ⓘ</summary>
                <p>{{ cat.description }}</p>
              </details>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in room.members"
            :key="member.id"
            :class="{ own: member.id === room.meId }"
          >
            <th scope="row" class="player-column">
              <span class="player-cell-name">{{ member.nickname }}</span
              ><small
                >{{ member.id === room.meId ? 'TÚ · ' : ''
                }}{{
                  !member.connected
                    ? 'Desconectado'
                    : answering
                      ? `${room.progress[member.id] ?? 0}/7 completadas`
                      : member.id === room.hostId
                        ? 'ANFITRIÓN'
                        : 'EN REVISIÓN'
                }}</small
              >
            </th>
            <td v-for="cat in room.categories" :key="cat.id">
              <template v-if="answering"
                ><input
                  v-if="member.id === room.meId"
                  :aria-label="cat.label"
                  :value="game.texts[cat.id] ?? ''"
                  :disabled="!canEdit"
                  maxlength="80"
                  autocomplete="off"
                  :placeholder="`${room.round?.letter}…`"
                  @input="game.edit(cat.id, ($event.target as HTMLInputElement).value)"
                /><span v-else class="private-cell">—<small>Privado</small></span
                ><small v-if="member.id === room.meId" class="cell-hint">{{
                  hint(cat.id)
                }}</small></template
              ><template v-else
                ><strong class="answer-text">{{ entry(member.id, cat.id)?.text || '—' }}</strong
                ><span
                  class="verdict-label"
                  :class="entry(member.id, cat.id)?.verdict.toLowerCase()"
                  >{{ cellStatus(member.id, cat.id) }}</span
                ><small v-if="points(member.id, cat.id) !== null"
                  >+{{ points(member.id, cat.id) }}</small
                ></template
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-for="catId in game.conflicts" :key="catId" class="banner">
      <div>
        <strong>Conflicto en {{ room.categories.find((c) => c.id === catId)?.label }}</strong>
        <p>
          Tu texto local: {{ game.texts[catId] }}. El servidor conserva:
          {{ entry(room.meId, catId)?.text || 'vacío' }}.
        </p>
        <button class="secondary" :disabled="!canEdit" @click="game.resolveConflict(catId, true)">
          Enviar mi versión
        </button>
        <button class="secondary" @click="game.resolveConflict(catId, false)">
          Usar versión del servidor
        </button>
      </div>
    </div>
    <div v-if="answering" class="answering-footer">
      <p class="muted">
        <strong>Tus respuestas son privadas.</strong> No repitas personas, clubes o selecciones en
        tu propia fila.
      </p>
      <div class="answer-actions">
        <button
          class="secondary"
          :disabled="!canEdit || game.busy"
          @click="game.finish('answers:submit')"
        >
          Terminé</button
        ><button
          v-if="room.settings.bastaEnabled"
          class="primary basta-button"
          :disabled="!canEdit || !complete || !!room.round?.bastaBy || game.busy"
          @click="game.finish('round:call-basta')"
        >
          ¡BASTA! <span aria-hidden="true">■</span>
        </button>
      </div>
      <p v-if="room.round?.bastaBy" class="basta-notice" role="status">
        {{ room.members.find((m) => m.id === room.round?.bastaBy)?.nickname }} llamó BASTA. Quedan
        como máximo 10 segundos.
      </p>
      <p v-else class="small muted">
        Terminé bloquea tu fila. BASTA deja hasta 10 segundos a todos.
      </p>
    </div>
  </section>
</template>
