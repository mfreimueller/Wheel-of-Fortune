<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog result" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('result.selected', { name: fullName })">
      <div class="avatar" :style="{ background: avatarColor, color: avatarText }">{{ initials }}</div>
      <h2 data-testid="result-name">{{ fullName }}</h2>
      <p class="count" data-testid="result-count">{{ t('result.count', { n: student.pickCount }) }}</p>

      <label class="caption" for="grade-category">{{ t('result.gradeOptional') }}</label>
      <select v-if="categories.length" id="grade-category" v-model="category" data-testid="grade-category" :disabled="saving" @change="changeCategory">
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
      <input v-else id="grade-category" v-model="category" data-testid="grade-category" :disabled="saving" @change="changeCategory">

      <div class="symbols" role="group">
        <button
          v-for="s in SYMBOLS"
          :key="s.value"
          type="button"
          :class="['symbol', { primary: selected === s.value }]"
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
      <p class="caption">{{ t('result.undoHint') }}</p>
      <p v-if="saved" class="success" data-testid="grade-saved">{{ t('result.saved') }}</p>
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
import { labelColor } from '../utils/wheelGeometry';

const props = defineProps<{
  student: PickedStudent;
  /** The color of the student's wheel segment, so the avatar matches what was just on the wheel. */
  color: string | null;
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

const hex = computed(() => props.color ?? props.student.color);
const avatarColor = computed(() => hex.value ?? 'var(--color-primary)');
const avatarText = computed(() => (hex.value ? labelColor(hex.value) : 'var(--color-primary-contrast)'));

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
  align-items: center;
  text-align: center;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 26px;
}

.count {
  color: var(--color-text-secondary);
}

.symbols {
  display: flex;
  gap: 10px;
}

.symbol {
  width: 56px;
  height: 48px;
  padding: 0;
}

.actions {
  align-self: stretch;
}
</style>
