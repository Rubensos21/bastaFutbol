import { createMutationId } from '../utils/mutation';
import { defineStore } from 'pinia';
import { computed, ref, onScopeDispose, type UnwrapRef } from 'vue';
import { commandSchema, type Snapshot, type Command } from '@basta/shared';
import { bootstrap, command, gameSocket } from '../services/socket';
import { draftKey, readDrafts, writeDrafts, type LocalDraft } from '../utils/drafts';
function createGameStore() {
  const snapshot = ref<Snapshot | null>(null),
    connected = ref(false),
    connecting = ref(false),
    error = ref(''),
    notice = ref(''),
    guestId = ref(''),
    busy = ref(false),
    clockOffset = ref(0),
    texts = ref<Record<string, string>>({}),
    dirty = ref<Record<string, LocalDraft>>({}),
    conflicts = ref<string[]>([]);
  const me = computed(() => snapshot.value?.members.find((m) => m.id === snapshot.value?.meId));
  const isHost = computed(() => snapshot.value?.hostId === snapshot.value?.meId);
  const editable = computed(
    () =>
      connected.value &&
      snapshot.value?.writable &&
      snapshot.value.phase === 'ANSWERING' &&
      !snapshot.value.pausedAt &&
      !snapshot.value.round?.submitted.includes(snapshot.value.meId),
  );
  const sendingVersions: Record<string, number> = {};
  let initialized = false,
    debounce: ReturnType<typeof setTimeout> | undefined,
    flushing: Promise<boolean> | null = null,
    currentDraftKey = '';
  onScopeDispose(() => {
    if (debounce) clearTimeout(debounce);
    gameSocket().removeAllListeners();
    gameSocket().disconnect();
  });
  let seenCycle = 0;
  function apply(s: Snapshot) {
    if (snapshot.value?.code === s.code && s.revision < snapshot.value.revision) return;
    const previous = snapshot.value;
    if (previous?.code !== s.code) seenCycle = 0;
    const newRound = previous?.round?.id !== s.round?.id || previous?.code !== s.code;
    if (previous?.code === s.code && previous.hostId !== s.hostId)
      notice.value = `${s.members.find((m) => m.id === s.hostId)?.nickname ?? 'Otro jugador'} es el nuevo anfitrión.`;
    if (previous?.round?.id === s.round?.id && previous?.round?.pickerId !== s.round?.pickerId)
      notice.value = `Se reasignó la ruleta a ${s.members.find((m) => m.id === s.round?.pickerId)?.nickname ?? 'otro jugador'} por desconexión.`;
    const cycle = [...s.events].reverse().find((event) => event.type === 'draw:letter-cycle-reset');
    if (cycle && cycle.revision > seenCycle) {
      seenCycle = cycle.revision;
      notice.value = 'Se agotaron las letras configuradas. Comienza un nuevo ciclo.';
    }
    snapshot.value = s;
    clockOffset.value = s.serverNow - Date.now();
    if (newRound) {
      currentDraftKey = s.round ? draftKey(guestId.value, s.code, s.round.id) : '';
      dirty.value = currentDraftKey ? readDrafts(currentDraftKey) : {};
      texts.value = {};
      conflicts.value = [];
    }
    for (const e of s.round?.entries.filter((e) => e.participantId === s.meId) ?? []) {
      const local = dirty.value[e.categoryId];
      if (local) {
        texts.value[e.categoryId] = local.text;
        if (local.text === e.text) {
          delete dirty.value[e.categoryId];
        } else if (
          sendingVersions[e.categoryId] !== undefined &&
          e.version === sendingVersions[e.categoryId]! + 1
        ) {
          local.previousVersion = e.version;
        } else if (local.previousVersion !== e.version && !conflicts.value.includes(e.categoryId)) {
          conflicts.value.push(e.categoryId);
        }
      } else texts.value[e.categoryId] = e.text;
    }
    if (newRound && s.phase === 'ANSWERING' && Object.keys(dirty.value).length)
      notice.value =
        'Recuperamos un borrador local. Confirma los cambios que no habían llegado al servidor.';
    persist();
  }
  function persist() {
    if (currentDraftKey) writeDrafts(currentDraftKey, dirty.value);
  }
  async function init() {
    if (initialized) {
      gameSocket().connect();
      return;
    }
    initialized = true;
    connecting.value = true;
    try {
      const guest = await bootstrap();
      guestId.value = guest.id;
      const s = gameSocket();
      s.on('room:snapshot', apply);
      s.on('room:error', (e: { code: string; message: string }) => {
        error.value = e.message;
        if (e.code === 'REMOVED') {
          snapshot.value = null;
          localStorage.removeItem('basta:room');
        }
      });
      s.on('disconnect', () => {
        connected.value = false;
        notice.value = 'Conexión interrumpida. Intentamos reconectar y conservamos tus respuestas.';
      });
      s.on('connect_error', (event: Error) => {
        connected.value = false;
        connecting.value = false;
        if (event.message === 'SESSION_EXPIRED') {
          initialized = false;
          s.removeAllListeners();
          s.disconnect();
        }
        error.value = 'No se pudo conectar al servidor. Comprueba la conexión y vuelve a intentar.';
      });
      s.on('connect', async () => {
        connected.value = true;
        connecting.value = false;
        error.value = '';
        notice.value = '';
        const code = snapshot.value?.code ?? localStorage.getItem('basta:room');
        if (code) await resume(code);
      });
      s.connect();
    } catch (e) {
      initialized = false;
      connecting.value = false;
      error.value = e instanceof Error ? e.message : 'No se pudo abrir la sesión.';
    }
  }
  async function send(input: unknown, silent = false): Promise<boolean> {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) {
      error.value = parsed.error.issues[0]?.message ?? 'Revisa los datos.';
      return false;
    }
    if (!silent) busy.value = true;
    const ack = await command(parsed.data);
    if (!silent) busy.value = false;
    if (!ack.ok) {
      if (ack.error.code === 'DRAFT_CONFLICT' && parsed.data.type === 'answers:save-draft') {
        conflicts.value.push(parsed.data.categoryId);
        await resume(snapshot.value!.code);
      }
      error.value = ack.error.message;
      return false;
    }
    error.value = '';
    apply(ack.data);
    return true;
  }
  async function action(type: Command['type'], payload: Record<string, unknown> = {}) {
    return send({ type, ...payload, clientMutationId: createMutationId() });
  }
  async function resume(code: string) {
    const ok = await send({ type: 'room:resume', code }, true);
    if (ok) localStorage.setItem('basta:room', code);
    return ok;
  }
  async function enter(type: 'room:create' | 'room:join', payload: Record<string, unknown>) {
    const ok = await action(type, payload);
    if (ok && snapshot.value) localStorage.setItem('basta:room', snapshot.value.code);
    return ok;
  }
  function edit(categoryId: string, text: string) {
    if (!editable.value || Date.now() + clockOffset.value >= (snapshot.value?.endsAt ?? 0)) return;
    texts.value[categoryId] = text;
    const e = snapshot.value!.round!.entries.find(
      (e) => e.participantId === snapshot.value!.meId && e.categoryId === categoryId,
    );
    dirty.value[categoryId] = {
      text,
      previousVersion: e?.version ?? 0,
      sequence: (dirty.value[categoryId]?.sequence ?? 0) + 1,
      updatedAt: Date.now() + clockOffset.value,
    };
    persist();
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void flush(), 300);
  }
  async function flush(): Promise<boolean> {
    if (flushing) return flushing;
    flushing = (async () => {
      if (!editable.value) return false;
      for (const categoryId of Object.keys(dirty.value)) {
        if (conflicts.value.includes(categoryId)) continue;
        const local = dirty.value[categoryId];
        if (!local) continue;
        const seq = local.sequence;
        const s = snapshot.value!;
        const current = s.round!.entries.find(
          (e) => e.categoryId === categoryId && e.participantId === s.meId,
        );
        sendingVersions[categoryId] = current?.version ?? local.previousVersion;
        const ok = await send(
          {
            type: 'answers:save-draft',
            roundId: s.round!.id,
            categoryId,
            text: local.text,
            previousVersion: current?.version ?? local.previousVersion,
            clientMutationId: createMutationId(),
          },
          true,
        );
        delete sendingVersions[categoryId];
        if (!ok) return false;
        if (dirty.value[categoryId]?.sequence === seq) {
          delete dirty.value[categoryId];
          persist();
        } else if (dirty.value[categoryId])
          dirty.value[categoryId]!.previousVersion = (current?.version ?? 0) + 1;
      }
      return true;
    })().finally(() => {
      flushing = null;
      if (editable.value && Object.keys(dirty.value).some((k) => !conflicts.value.includes(k)))
        debounce = setTimeout(() => void flush(), 300);
    });
    return flushing;
  }
  function resolveConflict(categoryId: string, keepLocal: boolean) {
    const s = snapshot.value!;
    const e = s.round!.entries.find(
      (e) => e.categoryId === categoryId && e.participantId === s.meId,
    );
    conflicts.value = conflicts.value.filter((k) => k !== categoryId);
    if (keepLocal && dirty.value[categoryId]) {
      dirty.value[categoryId]!.previousVersion = e?.version ?? 0;
      void flush();
    } else {
      delete dirty.value[categoryId];
      texts.value[categoryId] = e?.text ?? '';
      persist();
    }
  }
  async function finish(type: 'round:call-basta' | 'answers:submit') {
    await flush();
    if (Object.keys(dirty.value).length) {
      error.value = 'Confirma o sincroniza todos los cambios antes de terminar.';
      return;
    }
    await action(type, { roundId: snapshot.value?.round?.id });
  }
  async function leave() {
    if (await action('room:leave')) {
      snapshot.value = null;
      localStorage.removeItem('basta:room');
    }
  }
  function syncClock() {
    const before = Date.now();
    if (connected.value)
      gameSocket()
        .timeout(4000)
        .emit('clock:ping', (err: Error | null, payload: { serverNow: number }) => {
          if (!err) clockOffset.value = payload.serverNow - (before + Date.now()) / 2;
        });
  }
  return {
    snapshot,
    connected,
    connecting,
    error,
    notice,
    guestId,
    busy,
    clockOffset,
    texts,
    dirty,
    conflicts,
    me,
    isHost,
    editable,
    init,
    action,
    resume,
    enter,
    edit,
    flush,
    finish,
    leave,
    resolveConflict,
    syncClock,
  };
}
const gameDefinition = defineStore('game', createGameStore);
export const useGameStore: () => UnwrapRef<ReturnType<typeof createGameStore>> = gameDefinition;
