<script setup lang="ts">
import { CATEGORIES, type Settings } from '@basta/shared';
const model = defineModel<Settings>({ required: true });
defineProps<{ disabled?: boolean }>();
</script>
<template>
  <fieldset class="settings" :disabled="disabled">
    <legend class="eyebrow">REGLAS DE LA PARTIDA</legend>
    <div class="settings-grid">
      <label
        >Jugadores<select v-model="model.capacity" aria-label="Jugadores">
          <option :value="null">Automático · 2 a 7</option>
          <option v-for="n in [2, 3, 4, 5, 6, 7]" :key="n" :value="n">{{ n }} jugadores</option>
        </select></label
      ><label
        >Rondas<select v-model="model.rounds" aria-label="Rondas">
          <option v-for="n in [3, 5, 7, 10]" :key="n" :value="n">{{ n }} rondas</option>
        </select></label
      ><label
        >Tiempo por ronda<select v-model="model.roundSeconds" aria-label="Tiempo por ronda">
          <option v-for="n in [60, 90, 120, 180]" :key="n" :value="n">{{ n }} segundos</option>
        </select></label
      >
    </div>
    <label class="check"
      ><input v-model="model.bastaEnabled" type="checkbox" /> BASTA: últimos 10 segundos</label
    >
    <details>
      <summary>Personalizar letras y categorías</summary>
      <label
        >Letras jugables<input
          :value="model.letters.join('')"
          maxlength="26"
          @change="
            model.letters = ($event.target as HTMLInputElement).value
              .toUpperCase()
              .replace(/[^A-Z]/g, '')
              .split('')
          "
      /></label>
      <p class="muted small">
        Recomendadas: A B C D E F G H I J L M N O P R S T U V Z. Sin diccionario exhaustivo, alguna
        combinación puede ser difícil.
      </p>
      <div class="category-options">
        <label v-for="c in CATEGORIES" :key="c.id" class="check"
          ><input v-model="model.disabledCategories" type="checkbox" :value="c.id" /> Desactivar
          {{ c.label }}</label
        >
      </div>
    </details>
  </fieldset>
</template>
