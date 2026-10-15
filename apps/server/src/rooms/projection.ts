import { ranking, scoreRound, REVEALED_PHASES, type RoomState, type Snapshot } from '@basta/shared';
export function project(s: RoomState, meId: string, writable: boolean, now = Date.now()): Snapshot {
  const current = s.rounds.at(-1);
  const playedIds = new Set(s.rounds.flatMap((r) => r.entries.map((e) => e.participantId)));
  const visibleMembers = s.members.filter(
    (m) => !m.left || (['FINAL_RESULTS', 'FINISHED'].includes(s.phase) && playedIds.has(m.id)),
  );
  const scoreIds = playedIds.size
    ? [...playedIds]
    : s.members.filter((m) => !m.left).map((m) => m.id);
  const visible = REVEALED_PHASES.includes(s.phase);
  const round = current ? structuredClone(current) : null;
  if (round && visible && round.letter && !round.cancelled && !round.scores.length)
    round.scoredEntries = scoreRound(round.entries, s.categories, round.letter, round.annulled);
  if (round && !visible) {
    round.entries = round.entries.filter((e) => e.participantId === meId);
    round.scoredEntries = [];
  }
  return {
    code: s.code,
    hostId: s.hostId,
    meId,
    writable,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    endsAt: s.endsAt,
    revision: s.revision,
    serverNow: now,
    settings: s.settings,
    members: visibleMembers.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      slot: m.slot,
      ready: m.ready,
      connected: m.connected,
      joinedAt: m.joinedAt,
      lastSeenAt: m.lastSeenAt,
      left: m.left,
    })),
    reservations: s.reservations,
    categories: s.categories,
    round,
    history: s.rounds.filter((r) => r !== current && (r.scores.length || r.cancelled)),
    ranking: ranking(s.rounds, scoreIds),
    progress: Object.fromEntries(
      s.members
        .filter((m) => !m.left)
        .map((m) => [
          m.id,
          current?.entries.filter((e) => e.participantId === m.id && e.text.trim()).length ?? 0,
        ]),
    ),
    events: s.events.slice(-80),
    pausedAt: s.pausedAt,
  };
}
