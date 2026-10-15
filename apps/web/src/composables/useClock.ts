import { computed, onScopeDispose, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { remainingSeconds } from '@basta/shared';
export function useClock() {
  const game = useGameStore();
  const now = ref(Date.now());
  const timer = setInterval(() => {
    now.value = Date.now();
  }, 100);
  const ping = setInterval(() => game.syncClock(), 15000);
  onScopeDispose(() => {
    clearInterval(timer);
    clearInterval(ping);
  });
  const serverNow = computed(() => now.value + game.clockOffset);
  const seconds = computed(() =>
    remainingSeconds(game.snapshot?.endsAt ?? null, game.snapshot?.pausedAt ?? serverNow.value),
  );
  const display = computed(
    () =>
      `${String(Math.floor(seconds.value / 60)).padStart(2, '0')}:${String(seconds.value % 60).padStart(2, '0')}`,
  );
  return { serverNow, seconds, display };
}
