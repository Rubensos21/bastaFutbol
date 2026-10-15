import { defineStore } from 'pinia';
import { ref, watch, type UnwrapRef } from 'vue';
function createUiStore() {
  const reduced = ref(
    localStorage.getItem('basta:reduced') === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const help = ref(false);
  watch(reduced, (v) => localStorage.setItem('basta:reduced', String(v)));
  return { reduced, help };
}
const uiDefinition = defineStore('ui', createUiStore);
export const useUiStore: () => UnwrapRef<ReturnType<typeof createUiStore>> = uiDefinition;
