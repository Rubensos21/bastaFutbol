<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { DEFAULT_SETTINGS, nicknameSchema, codeSchema, type Settings } from '@basta/shared';
import { useGameStore } from '../stores/game';
import SettingsForm from '../components/lobby/SettingsForm.vue';
const game = useGameStore(),
  router = useRouter(),
  route = useRoute();
const nickname = ref(''),
  code = ref(''),
  joining = ref(false),
  settings = ref<Settings>(structuredClone(DEFAULT_SETTINGS));
const localError = ref('');
const slots = computed(() => Array.from({ length: 7 }, (_, i) => i + 1));
onMounted(() => {
  const invite = route.query.room;
  if (typeof invite === 'string') {
    void router.replace(`/sala/${invite.toUpperCase()}`);
  }
});
async function enter() {
  localError.value = '';
  const n = nicknameSchema.safeParse(nickname.value);
  if (!n.success) {
    localError.value = n.error.issues[0]?.message ?? 'Nombre inválido';
    return;
  }
  if (joining.value) {
    const c = codeSchema.safeParse(code.value);
    if (!c.success) {
      localError.value = 'Escribe un código de sala válido.';
      return;
    }
  }
  if (
    await game.enter(joining.value ? 'room:join' : 'room:create', {
      nickname: n.data,
      ...(joining.value ? { code: code.value } : { settings: settings.value }),
    })
  )
    await router.push(`/sala/${game.snapshot!.code}`);
}
</script>
<template>
  <main class="home">
    <section class="hero">
      <p class="eyebrow">
        <span class="live-dot"></span> EL JUEGO DE PALABRAS PARA LOS QUE VIVEN EL FÚTBOL
      </p>
      <h1>EL FÚTBOL<br />SE SABE.<br /><span>DEMÚESTRALO.</span></h1>
      <p class="hero-copy">
        Una letra. Siete categorías. Tus amigos.<br />¿Quién tiene más fútbol en la cabeza?
      </p>
      <div class="hero-stats">
        <div><b>02—07</b><span>JUGADORES REALES</span></div>
        <div><b>7</b><span>CATEGORÍAS</span></div>
        <div>
          <b>90<span>s</span></b
          ><span>PARA HACER HISTORIA</span>
        </div>
      </div>
      <div class="pitch" aria-hidden="true">
        <div class="pitch-center"></div>
        <span class="pitch-label">LA CANCHA DE LAS PALABRAS</span><span class="pitch-ball">B</span>
      </div>
    </section>
    <section class="entry-panel">
      <div class="panel-number">01 / ENTRA AL JUEGO</div>
      <h2>BASTA <span>FUTBOLERO</span></h2>
      <div class="segmented">
        <button :class="{ active: !joining }" @click="joining = false">Crear sala</button
        ><button :class="{ active: joining }" @click="joining = true">Unirme a una sala</button>
      </div>
      <form @submit.prevent="enter">
        <label for="nickname">TU NOMBRE EN LA CANCHA</label
        ><input
          id="nickname"
          v-model="nickname"
          placeholder="Escribe tu apodo"
          autocomplete="nickname"
          minlength="2"
          maxlength="96"
          required
        /><label v-if="joining" for="code"
          >CÓDIGO DE INVITACIÓN<input
            id="code"
            v-model="code"
            placeholder="ABC234"
            class="code-input"
            maxlength="6"
            autocapitalize="characters"
            required /></label
        ><SettingsForm v-else v-model="settings" />
        <div
          v-if="!joining"
          class="initial-slots"
          aria-label="Siete plazas visuales; todavía no hay jugadores conectados"
        >
          <div
            v-for="slot in slots"
            :key="slot"
            :class="{ preview: slot === 1 && nickname.trim() }"
          >
            <span>{{ String(slot).padStart(2, '0') }}</span
            ><b>{{ slot === 1 && nickname.trim() ? nickname : 'Vacío' }}</b
            ><small>{{
              slot === 1 && nickname.trim() ? 'Se conectará al crear' : 'Esperando jugador'
            }}</small>
          </div>
        </div>
        <p v-if="localError" class="form-error" role="alert">{{ localError }}</p>
        <button class="primary wide" :disabled="!game.connected || game.busy">
          {{
            game.busy ? 'Preparando sala…' : joining ? 'Unirme a una sala' : 'Crear sala privada'
          }}
          <span aria-hidden="true">↗</span>
        </button>
        <p class="entry-foot">
          {{
            game.connected
              ? 'Sin cuentas. Sin descargas. Solo fútbol.'
              : 'Esperando conexión con el servidor para crear o unirte.'
          }}
        </p>
      </form>
      <RouterLink v-if="game.snapshot" :to="`/sala/${game.snapshot.code}`" class="text-link"
        >Volver a mi sala {{ game.snapshot.code }} →</RouterLink
      ><button
        v-if="!game.connected && !game.connecting"
        class="secondary wide"
        @click="game.init()"
      >
        Reintentar conexión
      </button>
    </section>
  </main>
</template>
