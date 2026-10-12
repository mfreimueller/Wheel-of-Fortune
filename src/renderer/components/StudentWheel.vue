<template>
  <div ref="outer" class="machine">
    <div ref="wrap" class="machine-wrap" :style="{ width: `${STAGE_W * scale}px`, height: `${STAGE_H * scale}px` }">
      <div
        class="stage"
        :class="{ spinning, won }"
        :style="{ transform: `scale(${scale})` }"
        role="group"
        :aria-label="t('wheel.label')"
        data-testid="wheel-machine"
        :data-item-count="items.length"
      >
        <div class="cabinet">
          <div class="top-bar">
            <span class="brand">{{ t('wheel.brand') }}</span>
            <span class="lights" aria-hidden="true">
              <i v-for="n in 7" :key="n" class="light" />
            </span>
          </div>

          <div class="window">
            <div v-for="(reel, r) in reels" :key="r" class="reel" :data-reel="r">
              <div
                class="strip"
                :class="{ blurred: reel.blurred, moving: reel.moving }"
                :style="{
                  transform: `translateY(${(1 - reel.pos) * ROW}px)`,
                  transition: reel.ms ? `transform ${reel.ms}ms cubic-bezier(0.12, 0.7, 0.1, 1)` : 'none',
                }"
              >
                <div v-for="(label, i) in reel.cells" :key="i" class="cell" :class="{ center: i === reel.pos && !reel.moving }">
                  {{ label }}
                </div>
              </div>
              <div class="band" />
              <div class="fade top" />
              <div class="fade bottom" />
            </div>
            <span class="marker left" aria-hidden="true" />
            <span class="marker right" aria-hidden="true" />
          </div>
          <div class="tray" />
        </div>

        <div class="arm" :class="{ pulled }">
          <div class="mount" />
          <div class="slot" />
          <div class="rod" />
          <button
            type="button"
            class="knob"
            data-testid="wheel"
            :aria-label="t('wheel.spin')"
            :aria-disabled="disabled"
            @click="request"
          />
        </div>

        <p class="status" aria-live="polite">{{ spinning ? t('wheel.statusSpinning') : t('wheel.statusIdle') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { WheelItem } from '../utils/wheelGeometry';

const props = defineProps<{ items: WheelItem[]; disabled?: boolean }>();
const emit = defineEmits<{ spin: [] }>();
const { t } = useI18n();

// The machine is laid out in design pixels (Figma "Slot machine") and scaled to the available space.
const STAGE_W = 700;
const STAGE_H = 440;
const ROW = 72;
const REELS = 3;
// Reel 0 stops first, reel 2 last, so the three names settle one after another.
const STOP_SHARE = [0.7, 0.85, 1];
const BLUR_FADE_MS = 600;

interface Reel {
  cells: string[];
  /** Index of the cell in the middle row. */
  pos: number;
  /** Transition length; 0 means jump without animating. */
  ms: number;
  moving: boolean;
  blurred: boolean;
}

const outer = ref<HTMLElement | null>(null);
const wrap = ref<HTMLElement | null>(null);
const scale = ref(1);
const reels = reactive<Reel[]>(Array.from({ length: REELS }, () => ({ cells: ['', '', ''], pos: 1, ms: 0, moving: false, blurred: false })));
const spinning = ref(false);
const won = ref(false);
const pulled = ref(false);

const labels = computed(() => props.items.map((i) => i.label));
const timers = new Set<ReturnType<typeof setTimeout>>();

function randomLabel(avoid: readonly (string | undefined)[] = []): string {
  const pool = labels.value.filter((l) => !avoid.includes(l));
  const from = pool.length ? pool : labels.value;
  return from.length ? from[Math.floor(Math.random() * from.length)]! : '';
}

/** Three different names where possible, so the resting machine already looks like a machine. */
function showIdle(): void {
  for (const reel of reels) {
    const top = randomLabel();
    const middle = randomLabel([top]);
    Object.assign(reel, { cells: [top, middle, randomLabel([middle])], pos: 1, ms: 0, moving: false, blurred: false });
  }
  won.value = false;
}

// A different set of items: forget the old names and drop back to rest without animating. The pick itself
// shrinks the fair pool, so after a spin the reels keep showing the winner until the next one.
watch(
  () => props.items.map((i) => i.id).join('|'),
  () => {
    if (!won.value) showIdle();
  },
  { immediate: true },
);

// The lever springs back as soon as the parent is done with the pick.
watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) pulled.value = false;
  },
);

function request(): void {
  if (props.disabled || props.items.length === 0) return;
  pulled.value = true;
  emit('spin');
}

function later(ms: number, action: () => void): void {
  const handle = setTimeout(() => {
    timers.delete(handle);
    action();
  }, ms);
  timers.add(handle);
}

/** Rolls the reels so that all three end on the given item; resolves when the last one has stopped. */
async function spinTo(id: string, durationMs: number): Promise<void> {
  const target = props.items.find((i) => i.id === id);
  if (!target) return;

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  won.value = false;

  if (reducedMotion) {
    for (const reel of reels) Object.assign(reel, { cells: [randomLabel(), target.label, randomLabel()], pos: 1, ms: 0, moving: false });
    won.value = true;
    return;
  }

  spinning.value = true;
  const perSecond = 6;
  const settled: Promise<void>[] = [];

  // Start every strip with what is visible now, followed by random names and, finally, the winner.
  reels.forEach((reel, r) => {
    const stopMs = durationMs * STOP_SHARE[r]!;
    const count = Math.max(10, Math.round((stopMs / 1000) * perSecond)) + r * 3;
    const visible = [reel.cells[reel.pos - 1] ?? randomLabel(), reel.cells[reel.pos] ?? randomLabel()];
    const fillers = Array.from({ length: count }, () => randomLabel());
    const after = randomLabel([target.label]);
    const cells = [...visible, ...fillers, target.label, after];
    Object.assign(reel, { cells, pos: 1, ms: 0, moving: true, blurred: false });
    settled.push(
      new Promise((resolve) => {
        later(stopMs + 50, () => {
          // Same names around the winner as in the strip, so swapping to a short strip is invisible.
          Object.assign(reel, { cells: [cells[cells.length - 3]!, target.label, after], pos: 1, ms: 0, moving: false, blurred: false });
          resolve();
        });
      }),
    );
  });

  await nextTick();
  void wrap.value?.offsetHeight; // commit the transition-less jump before animating
  reels.forEach((reel, r) => {
    const stopMs = durationMs * STOP_SHARE[r]!;
    reel.ms = stopMs;
    reel.blurred = true;
    reel.pos = reel.cells.length - 2;
    later(Math.max(0, stopMs - BLUR_FADE_MS), () => (reel.blurred = false));
  });

  await Promise.all(settled);
  spinning.value = false;
  won.value = true;
}

function fit(): void {
  const width = outer.value?.clientWidth ?? STAGE_W;
  // Keep the whole machine on screen, like the wheel before it.
  const height = Math.max(240, globalThis.innerHeight - 160);
  scale.value = Math.max(0.4, Math.min(width / STAGE_W, height / STAGE_H, 1.6));
}

let observer: ResizeObserver | null = null;
onMounted(() => {
  fit();
  if (outer.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(fit);
    observer.observe(outer.value);
  }
  globalThis.addEventListener('resize', fit);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  globalThis.removeEventListener('resize', fit);
  timers.forEach(clearTimeout);
});

defineExpose({ spinTo });
</script>

<style scoped>
/* Takes the width of its grid column; the scaled machine inside is measured against it. */
.machine {
  min-width: 0;
}

.machine-wrap {
  margin: 0 auto;
}

.stage {
  --cabinet-dark: #00335f;
  position: relative;
  width: 700px;
  height: 440px;
  transform-origin: top left;
}

.cabinet {
  position: absolute;
  left: 0;
  top: 40px;
  width: 640px;
  height: 360px;
  border-radius: 16px;
  background: var(--color-primary);
  box-shadow: var(--shadow-dialog);
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  border-radius: 16px 16px 0 0;
  background: var(--cabinet-dark);
  color: var(--color-primary-contrast);
}

.brand {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
}

.lights {
  display: flex;
  gap: 18px;
}

.light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #7aa6d1;
}

.spinning .light {
  background: #fff;
  animation: blink 0.5s steps(1) infinite;
}

.spinning .light:nth-child(even) {
  animation-delay: 0.25s;
}

.won .light {
  background: #34d399;
}

@keyframes blink {
  50% {
    background: #fbbf24;
  }
}

.window {
  position: absolute;
  left: 24px;
  top: 72px;
  display: flex;
  gap: 16px;
  box-sizing: border-box;
  width: 592px;
  height: 248px;
  padding: 16px;
  border-radius: 12px;
  background: var(--cabinet-dark);
}

.reel {
  position: relative;
  box-sizing: border-box;
  width: 176px;
  height: 216px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.won .reel {
  border: 2px solid var(--color-success);
}

.strip {
  will-change: transform;
  filter: blur(0);
  transition: filter 0.2s;
}

.strip.blurred {
  filter: blur(4px);
}

.cell {
  box-sizing: border-box;
  height: 72px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 18px;
  font-weight: 500;
  line-height: 72px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
  opacity: 0.55;
}

/* While rolling, every name is equally prominent; the blur does the rest. */
.moving .cell {
  font-size: 22px;
  color: var(--color-text);
  opacity: 1;
}

.cell.center {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  opacity: 1;
}

/* Highlights the middle row, which is the one that counts. */
.band {
  position: absolute;
  left: 0;
  right: 0;
  top: 72px;
  height: 72px;
  box-sizing: border-box;
  border-block: 1.5px solid var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  pointer-events: none;
}

.won .band {
  border-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
}

.fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 72px;
  pointer-events: none;
}

.fade.top {
  top: 0;
  background: linear-gradient(to bottom, rgb(255 255 255 / 95%), transparent);
}

.fade.bottom {
  bottom: 0;
  background: linear-gradient(to top, rgb(255 255 255 / 95%), transparent);
}

.marker {
  position: absolute;
  top: 108px;
  width: 0;
  height: 0;
  border-block: 7px solid transparent;
}

.marker.left {
  left: 4px;
  border-left: 12px solid var(--color-danger);
}

.marker.right {
  right: 4px;
  border-right: 12px solid var(--color-danger);
}

.won .marker.left {
  border-left-color: var(--color-success);
}

.won .marker.right {
  border-right-color: var(--color-success);
}

.tray {
  position: absolute;
  left: 180px;
  top: 332px;
  width: 280px;
  height: 14px;
  border-radius: 7px;
  background: var(--cabinet-dark);
}

/* The arm sits on the right-hand side of the cabinet; pulling it moves rod and knob down. */
.mount {
  position: absolute;
  left: 632px;
  top: 162px;
  width: 36px;
  height: 132px;
  border-radius: 10px;
  background: var(--cabinet-dark);
}

.slot {
  position: absolute;
  left: 644px;
  top: 184px;
  width: 12px;
  height: 88px;
  border-radius: 6px;
  background: #001f3d;
}

.rod {
  position: absolute;
  left: 644px;
  top: 86px;
  width: 12px;
  height: 142px;
  border-radius: 6px;
  background: var(--color-disabled);
  transition:
    top 0.5s cubic-bezier(0.34, 1.4, 0.64, 1),
    height 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.knob {
  position: absolute;
  left: 622px;
  top: 50px;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 28%, rgb(255 255 255 / 45%) 0 7%, transparent 14%), var(--color-danger);
  box-shadow: 0 4px 8px rgb(0 0 0 / 25%);
  cursor: pointer;
  transition: top 0.5s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.knob[aria-disabled='true'] {
  cursor: default;
}

.knob:focus-visible {
  outline: 3px solid var(--color-text);
  outline-offset: 3px;
}

.pulled .rod {
  top: 228px;
  height: 126px;
  transition-duration: 0.25s;
}

.pulled .knob {
  top: 340px;
  transition-duration: 0.25s;
}

.status {
  position: absolute;
  left: 0;
  top: 408px;
  width: 640px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  color: var(--color-text-secondary);
}

.spinning .status {
  color: var(--color-primary);
}

@media (prefers-reduced-motion: reduce) {
  .rod,
  .knob {
    transition: none;
  }

  .spinning .light {
    animation: none;
  }
}
</style>
