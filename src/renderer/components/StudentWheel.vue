<template>
  <div class="wheel-wrap">
    <svg viewBox="-112 -112 224 224" class="wheel" role="group" :aria-label="t('wheel.label')">
      <defs>
        <pattern id="special-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-opacity="0.35" stroke-width="2" />
        </pattern>
      </defs>
      <g
        class="disc"
        :style="{ transform: `rotate(${rotation}deg)`, transition: `transform ${transitionMs}ms cubic-bezier(0.12, 0.7, 0.1, 1)` }"
      >
        <g v-for="segment in segments" :key="segment.id" :data-segment="segment.id">
          <path :d="segment.path" :fill="segment.color" stroke="#fff" stroke-width="1" />
          <path v-if="segment.special" :d="segment.path" fill="url(#special-hatch)" />
          <text
            :transform="`rotate(${segment.labelAngle}) translate(${labelX} 0)`"
            text-anchor="end"
            dominant-baseline="middle"
            :font-size="fontSize"
            :fill="segment.textColor"
          >
            {{ segment.label }}
          </text>
        </g>
      </g>
      <!-- The whole wheel is the spin button; the pointer stays put. -->
      <circle
        class="hit"
        r="100"
        role="button"
        data-testid="wheel"
        :tabindex="disabled ? -1 : 0"
        :aria-label="t('wheel.spin')"
        :aria-disabled="disabled"
        @click="request"
        @keydown.enter.prevent="request"
        @keydown.space.prevent="request"
      />
      <polygon points="98,0 112,-9 112,9" class="pointer" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { computeSegments, computeSpinRotation, wheelFontSize, type WheelItem } from '../utils/wheelGeometry';

const props = defineProps<{ items: WheelItem[]; disabled?: boolean }>();
const emit = defineEmits<{ spin: [] }>();
const { t } = useI18n();

const LABEL_INSET = 8;
const labelX = 100 - LABEL_INSET;

const rotation = ref(0);
const transitionMs = ref(0);

const segments = computed(() => (props.items.length ? computeSegments(props.items) : []));
const fontSize = computed(() => wheelFontSize(props.items.length));

// A different set of items means different segments: drop back to rest without animating.
watch(
  () => props.items.map((i) => i.id).join('|'),
  () => {
    transitionMs.value = 0;
    rotation.value = 0;
  },
);

function request(): void {
  if (!props.disabled && props.items.length > 0) emit('spin');
}

/** Spins the disc so the item ends up under the pointer; resolves when the spin is over. */
function spinTo(id: string, durationMs: number): Promise<void> {
  const index = props.items.findIndex((i) => i.id === id);
  if (index < 0) return Promise.resolve();

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  transitionMs.value = reducedMotion ? 0 : durationMs;
  rotation.value = computeSpinRotation({ count: props.items.length, index, current: rotation.value, jitter: Math.random() - 0.5 });
  return new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : durationMs));
}

defineExpose({ spinTo });
</script>

<style scoped>
.wheel-wrap {
  display: flex;
  justify-content: center;
}

.wheel {
  width: min(100%, 630px);
  height: auto;
}

.disc {
  transform-origin: 0 0;
}

.hit {
  fill: transparent;
  cursor: pointer;
  outline: none;
}

.hit[aria-disabled='true'] {
  cursor: default;
}

.hit:focus-visible {
  stroke: #111827;
  stroke-width: 2;
}

.pointer {
  fill: #111827;
}
</style>
