<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useUiStore } from '../../stores/ui';
const emit = defineEmits<{ close: [] }>(),
  ui = useUiStore(),
  dialog = ref<HTMLDialogElement>();
const previous = document.activeElement as HTMLElement | null;
onMounted(() => dialog.value?.showModal());
onUnmounted(() => previous?.focus());
</script>
<template>
  <dialog ref="dialog" class="help-dialog" @cancel.prevent="emit('close')">
    <div class="section-heading">
      <p class="eyebrow">EL REGLAMENTO</p>
      <button class="icon-button" aria-label="Cerrar ayuda" @click="emit('close')">×</button>
    </div>
    <h2>Siete categorías.<br />Una sola letra.</h2>
    <p>
      Escribe una respuesta por categoría que empiece con la letra sorteada. Tus rivales no ven tus
      respuestas hasta el cierre.
    </p>
    <div class="points-guide">
      <div><b>20</b>Válida y única</div>
      <div><b>10</b>Válida y repetida por otro</div>
      <div><b>0</b>Vacía, inválida o repetida por ti</div>
    </div>
    <p>
      No repitas la misma persona, club o selección en tu fila: prevalece la primera columna. Los
      aliases conocidos agrupan entidades, pero no cambian la inicial de lo que escribiste.
      Ignoramos El, La, Los, Las y The iniciales; Real y FC se mantienen.
    </p>
    <p>
      <strong>BASTA</strong> deja como máximo 10 segundos sin extender el tiempo original.
      <strong>Terminé</strong> bloquea solo tu fila, sin acortar el tiempo de los demás.
    </p>
    <p>
      En la revisión tienes 45 segundos para votar respuestas ajenas. Mayoría de votos emitidos;
      empate, falta de votos o impugnación requiere decisión explícita con motivo. Si el anfitrión
      es el autor, decide el siguiente participante conectado.
    </p>
    <p>
      «O» admite cualquiera de los clubes; «y» requiere ambos países. Campeón: plantilla inscrita
      ganadora. Mundial: fase final masculina absoluta. Las categorías subjetivas se deciden con el
      criterio acordado por el grupo.
    </p>
    <label class="check"
      ><input v-model="ui.reduced" type="checkbox" /> Reducir movimiento y animaciones</label
    ><button class="primary" @click="emit('close')">Entendido, a la cancha</button>
  </dialog>
</template>
