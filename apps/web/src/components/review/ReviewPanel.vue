<script setup lang="ts">
import { computed, ref } from 'vue';
import { scoreRound, type Entry } from '@basta/shared';
import { useGameStore } from '../../stores/game';
const game = useGameStore(),
  room = computed(() => game.snapshot!),
  selected = ref(room.value.categories[0]!.id),
  awards = ref<Record<string, 0 | 10 | 20>>({}),
  reasons = ref<Record<string, string>>({}),
  aliases = ref<Record<string, string>>({}),
  evidence = ref<Record<string, string>>({});
const category = computed(() => room.value.categories.find((c) => c.id === selected.value)!);
const entries = computed(() =>
  room.value.round!.entries.filter((e) => e.categoryId === selected.value),
);
const preview = computed(() =>
  scoreRound(
    room.value.round!.entries,
    room.value.categories,
    room.value.round!.letter!,
    room.value.round!.annulled,
  ),
);
function moderator(e: Entry) {
  const host = room.value.members.find((m) => m.id === room.value.hostId && m.connected);
  if (host && host.id !== e.participantId) return host.id;
  return room.value.members
    .filter((m) => m.connected && m.id !== e.participantId)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0]?.id;
}
function structural(e: Entry) {
  return ['Vacío', 'No comienza con la letra', 'Repetido por ti', 'Anulado'].includes(
    preview.value.find((v) => v.id === e.id)?.scoreReason ?? '',
  );
}
function score(e: Entry) {
  return preview.value.find((v) => v.id === e.id);
}
const unresolved = computed(
  () => preview.value.filter((e) => e.scoreReason === 'Pendiente de dictamen').length,
);
function eventLabel(type: string) {
  const labels: Record<string, string> = {
    'review:vote': 'Voto registrado',
    'review:resolve': 'Dictamen del moderador',
    'review:award': 'Adjudicación de puntos',
    'review:appeal': 'Impugnación',
    'review:finish': 'Votación cerrada',
    'review:annul-propose': 'Propuesta de anulación',
    'review:annul-vote': 'Voto de anulación',
    'review:deadline': 'Tiempo de revisión terminado',
  };
  return labels[type] ?? 'Decisión de revisión';
}
function eventReason(payload: Record<string, unknown>) {
  return (
    payload['reason'] ??
    (payload['valid'] === true ? 'Válida' : payload['valid'] === false ? 'Inválida' : '')
  );
}
</script>
<template>
  <section class="review-panel">
    <div class="section-heading">
      <div>
        <p class="eyebrow">EL VAR DE LAS PALABRAS</p>
        <h2>Validez antes que puntos.</h2>
      </div>
      <span class="muted small"
        >{{ unresolved }} pendientes · Máximo
        {{ (7 - room.round!.annulled.length) * 20 }} puntos</span
      >
    </div>
    <p class="muted">
      Vota las respuestas de los demás. Las opiniones también requieren revisión. Un empate o una
      impugnación necesita motivo y resolución del moderador.
    </p>
    <label class="category-select"
      >CATEGORÍA EN REVISIÓN<select v-model="selected">
        <option v-for="(c, i) in room.categories" :key="c.id" :value="c.id">
          {{ i + 1 }}. {{ c.label }}
        </option>
      </select></label
    >
    <p class="category-definition">
      {{ category.description }}
      <span class="eyebrow">{{
        category.validationMode === 'SUBJECTIVE'
          ? 'SUBJETIVA · CRITERIO DEL GRUPO'
          : 'OBJETIVA · REVISIÓN HUMANA'
      }}</span>
    </p>
    <div class="review-entries">
      <article v-for="e in entries" :key="e.id" class="review-entry">
        <div class="review-answer">
          <span class="muted small">{{
            room.members.find((m) => m.id === e.participantId)?.nickname
          }}</span>
          <h3>{{ e.text || 'Respuesta vacía' }}</h3>
          <p>
            {{ score(e)?.scoreReason }} <strong>+{{ score(e)?.points ?? 0 }}</strong>
            <span v-if="e.verdict === 'PENDING' || e.verdict === 'DISPUTED'">provisional</span>
          </p>
          <p class="muted small">
            {{ e.reason }} · {{ e.votes.filter((v) => v.valid).length }} a favor /
            {{ e.votes.filter((v) => !v.valid).length }} en contra
          </p>
          <p class="muted small">
            Entidad: {{ score(e)?.canonicalKey.split(':').slice(1).join(':') }} ·
            {{ score(e)?.duplicates ?? 0 }} coincidencias válidas
          </p>
          <a
            v-if="e.evidence"
            :href="e.evidence"
            target="_blank"
            rel="noopener noreferrer"
            class="text-link"
            >Consultar prueba ↗</a
          ><small v-if="e.resolvedBy" class="muted"
            >Resolvió {{ room.members.find((m) => m.id === e.resolvedBy)?.nickname }}</small
          >
        </div>
        <div v-if="!structural(e)" class="review-actions">
          <div
            v-if="e.participantId !== room.meId && room.endsAt && !e.appealed && !e.resolvedBy"
            class="vote-buttons"
          >
            <button
              class="small-button"
              :class="{ chosen: e.votes.some((v) => v.voterId === room.meId && v.valid) }"
              :disabled="!room.writable || game.busy"
              @click="game.action('review:vote', { answerId: e.id, valid: true })"
            >
              ✓ Válida</button
            ><button
              class="small-button"
              :class="{ chosen: e.votes.some((v) => v.voterId === room.meId && !v.valid) }"
              :disabled="!room.writable || game.busy"
              @click="game.action('review:vote', { answerId: e.id, valid: false })"
            >
              × Inválida
            </button>
          </div>
          <span v-else-if="e.participantId === room.meId" class="muted small"
            >Los demás evalúan tu respuesta.</span
          >
          <details>
            <summary>
              {{
                moderator(e) === room.meId
                  ? 'Resolver o corregir alias'
                  : 'Impugnar y aportar prueba'
              }}
            </summary>
            <label
              >Motivo<input
                v-model="reasons[e.id]"
                maxlength="240"
                placeholder="Explica la decisión" /></label
            ><label
              >Prueba opcional (https)<input
                v-model="evidence[e.id]"
                type="url"
                placeholder="https://…" /></label
            ><button
              class="small-button"
              :disabled="(reasons[e.id]?.trim().length ?? 0) < 3 || game.busy || !room.writable"
              @click="
                game.action('review:appeal', {
                  answerId: e.id,
                  reason: reasons[e.id],
                  ...(evidence[e.id] ? { evidence: evidence[e.id] } : {}),
                })
              "
            >
              Impugnar</button
            ><template v-if="moderator(e) === room.meId"
              ><label
                >Entidad canónica opcional<input
                  v-model="aliases[e.id]"
                  maxlength="80"
                  placeholder="Nombre compartido para aliases" /></label
              ><label
                >Adjudicación explícita<select
                  :value="awards[e.id] ?? 20"
                  @change="
                    awards[e.id] = Number(($event.target as HTMLSelectElement).value) as 0 | 10 | 20
                  "
                >
                  <option :value="0">0 · Inválida</option>
                  <option :value="10">10 · Válida y duplicada</option>
                  <option :value="20">20 · Válida y única</option>
                </select></label
              ><button
                class="small-button"
                :disabled="(reasons[e.id]?.trim().length ?? 0) < 3 || game.busy || !room.writable"
                @click="
                  game.action('review:award', {
                    answerId: e.id,
                    points: awards[e.id] ?? 20,
                    reason: reasons[e.id],
                  })
                "
              >
                Adjudicar puntos
              </button>
              <p class="muted small">
                El servidor comprueba validez, inicial y coincidencias antes de aceptar 0/10/20.
              </p>
              <div class="vote-buttons">
                <button
                  class="small-button"
                  :disabled="(reasons[e.id]?.trim().length ?? 0) < 3 || game.busy || !room.writable"
                  @click="
                    game.action('review:resolve', {
                      answerId: e.id,
                      valid: true,
                      reason: reasons[e.id],
                      ...(aliases[e.id] ? { canonical: aliases[e.id] } : {}),
                    })
                  "
                >
                  Resolver válida</button
                ><button
                  class="small-button"
                  :disabled="(reasons[e.id]?.trim().length ?? 0) < 3 || game.busy || !room.writable"
                  @click="
                    game.action('review:resolve', {
                      answerId: e.id,
                      valid: false,
                      reason: reasons[e.id],
                      ...(aliases[e.id] ? { canonical: aliases[e.id] } : {}),
                    })
                  "
                >
                  Resolver inválida
                </button>
              </div></template
            >
          </details>
        </div>
      </article>
    </div>
    <div class="annul-panel">
      <button
        v-if="
          game.isHost &&
          !room.round!.annulVotes[selected] &&
          !room.round!.annulled.includes(selected)
        "
        class="text-link"
        @click="
          game.action('review:annul-propose', { roundId: room.round!.id, categoryId: selected })
        "
      >
        Proponer anulación de esta categoría en esta ronda</button
      ><template v-if="room.round!.annulVotes[selected] && !room.round!.annulled.includes(selected)"
        ><p>
          ¿Categoría impracticable? Se anula solo si todos aprueban:
          {{ room.round!.annulVotes[selected]!.length }}/{{ room.members.length }}
        </p>
        <button
          class="secondary"
          @click="
            game.action('review:annul-vote', {
              roundId: room.round!.id,
              categoryId: selected,
              approve: true,
            })
          "
        >
          Aprobar anulación</button
        ><button
          class="secondary"
          @click="
            game.action('review:annul-vote', {
              roundId: room.round!.id,
              categoryId: selected,
              approve: false,
            })
          "
        >
          No aprobar
        </button></template
      >
      <p v-if="room.round!.annulled.includes(selected)">
        Categoría anulada por unanimidad. Todos reciben 0.
      </p>
    </div>
    <div class="review-footer">
      <p class="muted small">
        {{
          unresolved
            ? 'Resuelve pendientes, empates e impugnaciones. Los resultados no se publican sin dictamen.'
            : 'Todos los dictámenes están listos para publicar.'
        }}
      </p>
      <button
        v-if="game.isHost"
        class="primary"
        :disabled="game.busy || !room.writable"
        @click="game.action('review:finish')"
      >
        {{ unresolved ? 'Cerrar votación y revisar pendientes' : 'Publicar puntos →' }}
      </button>
      <p v-else class="muted">El anfitrión publicará el marcador.</p>
    </div>
    <details class="audit">
      <summary>Historial de decisiones</summary>
      <ol>
        <li
          v-for="event in room.events.filter((e) => e.type.startsWith('review:'))"
          :key="event.revision"
        >
          {{ room.members.find((m) => m.id === event.actorId)?.nickname ?? 'Servidor' }} ·
          {{ eventLabel(event.type) }} · {{ eventReason(event.payload) }}
        </li>
      </ol>
    </details>
  </section>
</template>
