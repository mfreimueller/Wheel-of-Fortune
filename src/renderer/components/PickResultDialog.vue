<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog result" role="dialog" aria-modal="true" :aria-label="t('result.selected', { name: fullName })">
      <div class="avatar" :style="{ background: student.color ?? 'var(--primary)' }">{{ initials }}</div>
      <h2 data-testid="result-name">{{ fullName }}</h2>
      <p data-testid="result-count">{{ t('result.count', { n: student.pickCount }) }}</p>

      <label class="label" for="grade-category">{{ t('result.gradeOptional') }}</label>
      <select v-if="categories.length" id="grade-category" v-model="category" data-testid="grade-category" :disabled="saving" @change="changeCategory">
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <input v-else id="grade-category" v-model="category" data-testid="grade-category" :disabled="saving" @change="changeCategory">

      <div class="symbols" role="group">
        <button
          v-for="s in SYMBOLS"
          :key="s.value"
          type="button"
          :class="['symbol', { active: selected === s.value }]"
          :disabled="saving"
          :aria-pressed="selected === s.value"
          :aria-label="t(`result.symbol.${s.value}`)"
          :title="t(`result.symbol.${s.value}`)"
          :data-testid="`grade-${s.value}`"
          @click="choose(s.value)"
        >
          {{ s.glyph }}
        </button>
      </div>
      <p class="hint">{{ t('result.undoHint') }}</p>
      <p v-if="saved" class="status" data-testid="grade-saved">{{ t('result.saved') }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button class="primary" data-testid="result-close" @click="emit('close')">{{ t('import.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { GradeSymbol } from '../../core/assessments';
import type { PickedStudent } from '../../shared/types';

const props = defineProps<{
  student: PickedStudent;
  courseId: string;
  categories: string[];
  defaultCategory: string;
}>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const SYMBOLS: { value: GradeSymbol; glyph: string }[] = [
  { value: 'PLUS', glyph: '+' },
  { value: 'WELLE', glyph: '~' },
  { value: 'MINUS', glyph: '−' },
];

const category = ref(props.categories.includes(props.defaultCategory) ? props.defaultCategory : (props.categories[0] ?? props.defaultCategory));
const selected = ref<GradeSymbol | null>(null);
// The entry created by this dialog; replacing or removing it is how a grade is changed or undone.
const entryId = ref<string | null>(null);
const saving = ref(false);
const saved = ref(false);
const error = ref('');

const fullName = computed(() => `${props.student.firstName} ${props.student.lastName}`);
const initials = computed(() => `${props.student.firstName.charAt(0)}${props.student.lastName.charAt(0)}`.toUpperCase());

async function choose(symbol: GradeSymbol): Promise<void> {
  // Clicking the active symbol again undoes the grade.
  await save(selected.value === symbol ? null : symbol);
}

async function changeCategory(): Promise<void> {
  if (selected.value) await save(selected.value);
}

async function save(symbol: GradeSymbol | null): Promise<void> {
  if (saving.value) return;
  const name = category.value.trim();
  if (symbol && !name) return;
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    const outcome = await window.wheel.grade.set({
      courseId: props.courseId,
      studentId: props.student.studentId,
      category: name || props.defaultCategory,
      symbol,
      replaces: entryId.value,
    });
    if (!outcome.ok) {
      error.value = t(`result.errors.${outcome.error}`);
      return;
    }
    selected.value = symbol;
    entryId.value = outcome.entryId;
    saved.value = symbol !== null;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.result {
  text-align: center;
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  font-weight: 600;
}

.label {
  display: block;
  margin: 12px 0 4px;
  font-size: 13px;
  color: #6b7280;
}

.symbols {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
}

.symbol {
  width: 56px;
  height: 48px;
  font-size: 24px;
  font-weight: 600;
}

.symbol.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.status {
  margin: 6px 0 0;
  color: #059669;
}
</style>
