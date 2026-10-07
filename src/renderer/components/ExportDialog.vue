<template>
  <div class="overlay">
    <div class="dialog" style="--dialog-width: 460px" role="dialog" aria-modal="true" :aria-label="t('export.title')">
      <h2>{{ t('export.title') }}</h2>
      <p v-if="loading">{{ t('import.working') }}</p>
      <p v-else-if="error" class="error" role="alert">{{ error }}</p>

      <form v-else-if="!done" class="stack" @submit.prevent="run">
        <p class="course">{{ courseName }}</p>
        <label class="option">
          <input v-model="scope" type="radio" value="new" :disabled="newCount === 0" data-testid="scope-new">
          {{ t('export.scopeNew', { n: newCount }) }}
        </label>
        <label class="option">
          <input v-model="scope" type="radio" value="all" :disabled="totalCount === 0" data-testid="scope-all">
          {{ t('export.scopeAll', { n: totalCount }) }}
        </label>
        <p class="hint">{{ t('export.hint', { course: courseName }) }}</p>
        <div class="actions">
          <button type="button" @click="emit('close')">{{ t('import.cancel') }}</button>
          <button type="submit" class="primary" data-testid="export-confirm" :disabled="busy || selectedCount === 0">
            {{ t('export.confirm') }}
          </button>
        </div>
      </form>

      <div v-else class="stack" data-testid="export-report">
        <p>{{ t('export.done', { n: done.count }) }}</p>
        <p class="path">{{ done.filePath }}</p>
        <template v-if="done.warnings.length">
          <h3>{{ t('import.warnings') }}</h3>
          <ul>
            <li v-for="(w, i) in done.warnings" :key="i">{{ t(`export.warning.${w.code}`, { detail: w.detail }) }}</li>
          </ul>
        </template>
        <div class="actions">
          <button class="primary" @click="emit('close')">{{ t('import.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ExportWarning } from '../../core/exportCsv';

const props = defineProps<{ courseId: string; courseName: string }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const loading = ref(true);
const busy = ref(false);
const error = ref('');
const newCount = ref(0);
const totalCount = ref(0);
const scope = ref<'new' | 'all'>('new');
const done = ref<{ filePath: string; count: number; warnings: ExportWarning[] } | null>(null);

const selectedCount = computed(() => (scope.value === 'new' ? newCount.value : totalCount.value));

onMounted(async () => {
  const summary = await window.wheel.export.summary(props.courseId);
  loading.value = false;
  if (!summary.ok) {
    error.value = t('export.errors.course-unreadable');
    return;
  }
  newCount.value = summary.newCount;
  totalCount.value = summary.totalCount;
  // Nothing new but something old: offer everything instead of a disabled dead end.
  if (summary.newCount === 0 && summary.totalCount > 0) scope.value = 'all';
});

async function run(): Promise<void> {
  busy.value = true;
  try {
    const outcome = await window.wheel.export.run({ courseId: props.courseId, scope: scope.value });
    if (!outcome.ok) error.value = t(`export.errors.${outcome.error}`);
    else if (outcome.filePath) done.value = { filePath: outcome.filePath, count: outcome.count, warnings: outcome.warnings };
    // A cancelled save dialog leaves the dialog open, nothing was exported.
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.course {
  font-weight: 500;
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.path {
  font-size: 13px;
  line-height: 18px;
  color: var(--color-text-secondary);
  word-break: break-all;
}
</style>
