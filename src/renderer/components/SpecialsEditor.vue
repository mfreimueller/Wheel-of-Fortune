<template>
  <div class="overlay">
    <div class="dialog editor" role="dialog" aria-modal="true" :aria-label="t('specials.title')">
      <h2>{{ t('specials.title') }}</h2>
      <p class="hint">{{ t('specials.intro') }}</p>

      <p v-if="draft.length === 0" data-testid="specials-empty">{{ t('specials.empty') }}</p>
      <ul class="rows">
        <li v-for="(s, i) in draft" :key="s.id" class="row" :data-testid="`special-row-${i}`">
          <input v-model="s.color" type="color" :aria-label="t('specials.color')">
          <input v-model="s.label" class="label" :placeholder="t('specials.label')" :aria-label="t('specials.label')" :data-testid="`special-label-${i}`">
          <select v-model="s.kind" :aria-label="t('specials.kind')" :data-testid="`special-kind-${i}`">
            <option value="spin-again">{{ t('specials.kinds.spin-again') }}</option>
            <option value="message">{{ t('specials.kinds.message') }}</option>
          </select>
          <label class="prob">
            <input v-model.number="s.probability" type="number" min="0" max="99.9" step="0.5" :aria-label="t('specials.probability')" :data-testid="`special-prob-${i}`">
            %
          </label>
          <select v-model="s.showIn" :aria-label="t('specials.showIn')" :data-testid="`special-showin-${i}`">
            <option value="always">{{ t('specials.always') }}</option>
            <option value="free-only">{{ t('specials.freeOnly') }}</option>
          </select>
          <button type="button" :aria-label="t('specials.remove')" :data-testid="`special-remove-${i}`" @click="draft.splice(i, 1)">×</button>
          <textarea
            v-if="s.kind === 'message'"
            v-model="s.message"
            class="message"
            rows="2"
            :placeholder="t('specials.message')"
            :aria-label="t('specials.message')"
          />
        </li>
      </ul>

      <button type="button" data-testid="special-add" @click="add">{{ t('specials.add') }}</button>

      <p class="share" data-testid="specials-share">{{ t('specials.share', { n: Math.max(0, 100 - total).toFixed(1) }) }}</p>
      <p v-if="problem" class="error" role="alert" data-testid="specials-error">{{ problem }}</p>

      <div class="actions">
        <button type="button" @click="emit('close')">{{ t('import.cancel') }}</button>
        <button type="button" class="primary" data-testid="specials-save" :disabled="!!problem || saving" @click="save">
          {{ t('specials.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { validateSpecials } from '../../core/draw';
import type { Special } from '../../core/types';

const props = defineProps<{ courseId: string; specials: Special[] }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const { t } = useI18n();

const draft = ref<Special[]>(props.specials.map((s) => ({ ...s })));
const saving = ref(false);
const serverError = ref('');

const total = computed(() => draft.value.reduce((sum, s) => sum + (Number.isFinite(s.probability) ? s.probability : 0), 0));

const problem = computed(() => {
  if (serverError.value) return serverError.value;
  if (draft.value.some((s) => !s.label.trim())) return t('specials.errors.label');
  const valid = validateSpecials(draft.value);
  return valid.ok ? '' : t(`specials.errors.${valid.error}`);
});

function add(): void {
  draft.value.push({
    id: `sp_${crypto.randomUUID()}`,
    label: '',
    color: '#6d28d9',
    kind: 'spin-again',
    probability: 5,
    showIn: 'always',
  });
}

async function save(): Promise<void> {
  saving.value = true;
  serverError.value = '';
  try {
    const specials = draft.value.map((s) => {
      const { message, ...rest } = s;
      const text = message?.trim();
      return { ...rest, label: s.label.trim(), ...(s.kind === 'message' && text ? { message: text } : {}) };
    });
    const outcome = await window.wheel.courses.setSpecials({ courseId: props.courseId, specials });
    if (!outcome.ok) {
      serverError.value = t(`specials.errors.${outcome.error}`);
      return;
    }
    emit('saved');
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.editor {
  width: 720px;
  max-width: 92vw;
}

.rows {
  margin: 12px 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.label {
  flex: 1;
  min-width: 160px;
}

.prob input {
  width: 64px;
}

.message {
  flex-basis: 100%;
}

.hint {
  font-size: 13px;
  color: #6b7280;
}

.share {
  font-size: 13px;
}
</style>
