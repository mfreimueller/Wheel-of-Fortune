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
        <button type="button" data-testid="edit-specials" :disabled="picking" @click="editingSpecials = true">{{ t('wheel.specials') }}</button>
        <button type="button" data-testid="reset-counts" :disabled="picking" @click="confirmingReset = true">{{ t('wheel.reset') }}</button>
        <span class="hint">{{ t('wheel.hint') }}</span>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="layout">
        <StudentWheel ref="wheel" :items="items" :disabled="picking" @spin="spin" />

        <StudentTable
          :students="course.students"
          :absent-ids="absentIds"
          :picking="picking"
          @update="updateStudent"
          @toggle-absent="toggleAbsent"
          @pick="pickDirect"
        />
      </div>
    </template>

    <PickResultDialog
      v-if="result"
      :student="result"
      :color="resultColor"
      :course-id="course.id"
      :categories="course.categories"
      :default-category="course.defaultCategory"
      @close="result = null"
    />
    <SpecialsEditor
      v-if="editingSpecials"
      :course-id="course.id"
      :specials="course.specials"
      @close="editingSpecials = false"
      @saved="emit('changed')"
    />
    <SpecialDialog v-if="special" :special="special" @close="special = null" />

    <div v-if="confirmingReset" class="overlay" @click.self="confirmingReset = false">
      <div class="dialog" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('wheel.reset')">
        <p>{{ t('wheel.resetConfirm') }}</p>
        <div class="actions">
          <button @click="confirmingReset = false">{{ t('import.cancel') }}</button>
          <button class="primary" data-testid="reset-confirm" @click="resetCounts">{{ t('wheel.reset') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { activeSpecials, eligibleStudents, fairPool } from '../../core/draw';
import type { CourseFile } from '../../core/schemas';
import type { StudentPatch } from '../../core/studentPatch';
import type { Special } from '../../core/types';
import type { PickedStudent } from '../../shared/types';
import { computeSegments, layoutItems } from '../utils/wheelGeometry';
import SpecialsEditor from './SpecialsEditor.vue';
import StudentTable from './StudentTable.vue';
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
// The wheel color of the student in `result`, captured before the pick changes the wheel.
const resultColor = ref<string | null>(null);
const special = ref<Special | null>(null);
const wheel = ref<InstanceType<typeof StudentWheel> | null>(null);
const confirmingReset = ref(false);
const editingSpecials = ref(false);
// Session-only: who is absent today is not worth persisting.
const absentIds = ref<ReadonlySet<string>>(new Set());

const activeStudents = computed(() => props.course.students.filter((s) => s.active));

const items = computed(() => {
  const eligible = eligibleStudents(props.course.students, absentIds.value);
  const pool = fair.value ? fairPool(eligible) : eligible;
  return layoutItems(pool, activeSpecials(props.course.specials, fair.value));
});

function showResult(picked: PickedStudent | null): void {
  const colors = new Map(computeSegments(items.value).map((s) => [s.id, s.color]));
  resultColor.value = picked ? (colors.get(picked.studentId) ?? null) : null;
  result.value = picked;
}

async function spin(): Promise<void> {
  await run(async () => {
    const outcome = await window.wheel.pick.draw({ courseId: props.course.id, fair: fair.value, absentIds: [...absentIds.value] });
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
    // Look at the wheel as it was spun, before the pick is reloaded and the fair pool shrinks.
    if (last?.kind === 'special') special.value = last.special;
    else showResult(outcome.picked);
    emit('changed');
  });
}

async function pickDirect(studentId: string): Promise<void> {
  await run(async () => {
    const outcome = await window.wheel.pick.student({ courseId: props.course.id, studentId });
    if (!outcome.ok) {
      error.value = t(`wheel.errors.${outcome.error}`);
      return;
    }
    showResult(outcome.picked);
    emit('changed');
  });
}

async function updateStudent(studentId: string, patch: StudentPatch): Promise<void> {
  await run(async () => {
    const outcome = await window.wheel.courses.updateStudent({ courseId: props.course.id, studentId, patch });
    if (!outcome.ok) error.value = t(`wheel.errors.${outcome.error}`);
    emit('changed');
  });
}

function toggleAbsent(studentId: string): void {
  const next = new Set(absentIds.value);
  if (!next.delete(studentId)) next.add(studentId);
  absentIds.value = next;
}

async function resetCounts(): Promise<void> {
  confirmingReset.value = false;
  await run(async () => {
    const outcome = await window.wheel.courses.resetPickCounts(props.course.id);
    if (!outcome.ok) error.value = t(`wheel.errors.${outcome.error}`);
    emit('changed');
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
.course {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* The student table keeps its natural width on the right; the wheel takes all the remaining space. */
.layout {
  align-self: stretch;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: var(--space-6);
  align-items: start;
}
</style>
