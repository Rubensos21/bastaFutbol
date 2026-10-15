import { randomInt } from 'node:crypto';
import { CATEGORIES, type Category, type RoomState } from '@basta/shared';
import { requireRule } from '../game/errors.js';
export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
export class DrawService {
  categories(disabled: string[]): Category[] {
    const active = CATEGORIES.filter((c) => c.enabled && !disabled.includes(c.id));
    const general = shuffle(
      active.filter((c) => c.difficulty === 'GENERAL' && c.validationMode === 'OBJECTIVE'),
    );
    const specific = shuffle(active.filter((c) => c.difficulty === 'SPECIFIC'));
    requireRule(
      general.length >= 2 && specific.length >= 2 && active.length >= 7,
      'INVALID_CATEGORIES',
      'Activa al menos 2 categorías generales, 2 específicas y 7 en total.',
    );
    const picked = [...general.slice(0, 2), ...specific.slice(0, 2)];
    return shuffle([
      ...picked,
      ...shuffle(active.filter((c) => !picked.some((p) => p.id === c.id))).slice(0, 3),
    ]);
  }
  picker(state: RoomState): string {
    const ids = state.members.filter((m) => !m.left && m.connected).map((m) => m.id);
    state.pickerBag = state.pickerBag.filter((id) => ids.includes(id));
    if (!state.pickerBag.length) state.pickerBag = shuffle(ids);
    return state.pickerBag.shift() ?? state.members.find((m) => !m.left)!.id;
  }
  letter(state: RoomState): string {
    let options = state.settings.letters.filter((l) => !state.usedLetters.includes(l));
    if (!options.length) {
      state.usedLetters = [];
      options = state.settings.letters;
      state.revision++;
      state.events.push({
        type: 'draw:letter-cycle-reset',
        actorId: null,
        at: Date.now(),
        revision: state.revision,
        payload: { reason: 'Se agotaron las letras; comienza otro ciclo.' },
      });
    }
    const value = options[randomInt(options.length)]!;
    state.usedLetters.push(value);
    return value;
  }
}
