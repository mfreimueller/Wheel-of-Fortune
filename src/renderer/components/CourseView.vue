<template>
  <div class="course">
    <h1 data-testid="course-title">{{ course.className }} · {{ course.subject }}</h1>

    <p v-if="activeStudents.length === 0" data-testid="no-students">{{ t('wheel.noStudents') }}</p>
    <template v-else>
      <div class="controls">
        <label class="toggle">
          <input v-model="fair" type="checkbox" data-testid="fair-toggle" :disabled="picking" />
          {{ t('wheel.fair') }}
        </label>
        <span class="hint">{{ t('wheel.hint') }}</span>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="layout">
        <StudentWheel ref="wheel" :items="items" :disabled="picking" @spin="spin" />

        <table class="counts" data-testid="students">
          <thead>
            <tr>
              <th>{{ t('table.name') }}</th>
              <th>{{ t('table.count') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in activeStudents" :key="s.id" :data-student="s.id">
              <td>
                <span class="dot" :style="{ background: s.color ?? '#9ca3af' }" />
                {{ s.lastName }} {{ s.firstName }}
              </td>
              <td data-testid="count">{{ s.pickCount }}</td>
              <td>
                <button :disabled="picking" :data-testid="`pick-${s.id}`" @click="pickDirect(s.id)">{{ t('table.pick') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <PickResultDialog
      v-if="result"
      :student="result"
      :course-id="course.id"
      :categories="course.categories"
      :default-category="course.defaultCategory"
      @close="result = null"
    />
    <SpecialDialog v-if="special" :special="special" @close="special = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { activeSpecials, eligibleStudents, fairPool } from '../../core/draw';
import type { CourseFile } from '../../core/schemas';
import type { Special } from '../../core/types';
import type { PickedStudent } from '../../shared/types';
import { layoutItems } from '../utils/wheelGeometry';
import PickResultDialog from './PickResultDialog.vue';
import SpecialDialog from './SpecialDialog.vue';
import StudentWheel from './StudentWheel.vue';

const props = defineProps<{ course: CourseFile }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();

const FIRST_SPIN_MS = 6000;
const AGAIN_SPIN_MS = 3000;

// Session-only on purpose: resets to "fair" whenever the app is started again.
const fair = ref(true);
const picking = ref(false);
const error = ref('');
const result = ref<PickedStudent | null>(null);
const special = ref<Special | null>(null);
const wheel = ref<InstanceType<typeof StudentWheel> | null>(null);

const activeStudents = computed(() =>
  props.course.students
    .filter((s) => s.active)
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de')),
);

const items = computed(() => {
  const eligible = eligibleStudents(props.course.students, new Set());
  const pool = fair.value ? fairPool(eligible) : eligible;
  return layoutItems(pool, activeSpecials(props.course.specials, fair.value));
});

async function spin(): Promise<void> {
  await run(async () => {
    const outcome = await window.wheel.pick.draw({ courseId: props.course.id, fair: fair.value, absentIds: [] });
    if (!outcome.ok) {
      error.value = t(`wheel.errors.${outcome.error}`);
      return;
    }
    // The winner is decided and persisted up front; the wheel only plays the result back.
    for (const [index, step] of outcome.spins.entries()) {
      const target = step.kind === 'student' ? step.studentId : step.special.id;
      await wheel.value?.spinTo(target, index === 0 ? FIRST_SPIN_MS : AGAIN_SPIN_MS);
    }
    const last = outcome.spins.at(-1);
    emit('changed');
    if (last?.kind === 'special') special.value = last.special;
    else result.value = outcome.picked;
  });
}

async function pickDirect(studentId: string): Promise<void> {
  await run(async () => {
    const outcome = await window.wheel.pick.student({ courseId: props.course.id, studentId });
    if (!outcome.ok) {
      error.value = t(`wheel.errors.${outcome.error}`);
      return;
    }
    emit('changed');
    result.value = outcome.picked;
  });
}

async function run(action: () => Promise<void>): Promise<void> {
  error.value = '';
  picking.value = true;
  try {
    await action();
  } finally {
    picking.value = false;
  }
}
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.hint {
  color: #6b7280;
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.counts {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.counts th,
.counts td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
}
</style>
