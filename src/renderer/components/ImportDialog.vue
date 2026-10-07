<template>
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('import.title')">
      <h2>{{ t('import.title') }}</h2>

      <p v-if="state.kind === 'working'">{{ t('import.working') }}</p>

      <form v-else-if="state.kind === 'school-year'" @submit.prevent="submitYear">
        <p>{{ t('import.schoolYearPrompt') }}</p>
        <label>
          {{ t('import.schoolYearLabel') }}
          <input v-model="yearInput" data-testid="school-year-input" :placeholder="t('import.schoolYearHint')" autofocus />
        </label>
        <div class="actions">
          <button type="button" @click="emit('close')">{{ t('import.cancel') }}</button>
          <button type="submit" class="primary" data-testid="school-year-confirm">{{ t('import.confirm') }}</button>
        </div>
      </form>

      <div v-else-if="state.kind === 'done'" data-testid="import-report">
        <p>{{ state.report.courseCreated ? t('import.courseCreated') : t('import.courseUpdated') }}</p>
        <ul>
          <li>{{ t('import.added', { n: state.report.added }) }}</li>
          <li>{{ t('import.updated', { n: state.report.updated }) }}</li>
          <li>{{ t('import.reactivated', { n: state.report.reactivated }) }}</li>
          <li>{{ t('import.deactivated', { n: state.report.deactivated }) }}</li>
        </ul>
        <template v-if="state.report.warnings.length">
          <h3>{{ t('import.warnings') }}</h3>
          <ul>
            <li v-for="(w, i) in state.report.warnings" :key="i">
              {{ t(`import.warning.${w.code}`, { row: w.row ?? '', detail: w.detail ?? '' }) }}
            </li>
          </ul>
        </template>
        <div class="actions">
          <button class="primary" @click="emit('close')">{{ t('import.close') }}</button>
        </div>
      </div>

      <div v-else>
        <p class="error" role="alert">{{ state.message }}</p>
        <div class="actions">
          <button class="primary" @click="emit('close')">{{ t('import.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MergeReport } from '../../core/rosterMerge';
import type { ImportOutcome } from '../../shared/types';

const emit = defineEmits<{ close: []; imported: [courseId: string] }>();
const { t } = useI18n();

type State =
  | { kind: 'working' }
  | { kind: 'school-year' }
  | { kind: 'done'; report: MergeReport }
  | { kind: 'error'; message: string };

const state = ref<State>({ kind: 'working' });
const yearInput = ref('');
let text = '';

onMounted(async () => {
  const picked = await window.wheel.roster.pick();
  if (!picked) {
    emit('close');
    return;
  }
  if (!picked.ok) {
    state.value = { kind: 'error', message: t('import.tooLarge') };
    return;
  }
  text = picked.text;
  await run();
});

async function run(schoolYear?: string): Promise<void> {
  state.value = { kind: 'working' };
  show(await window.wheel.roster.import(schoolYear ? { text, schoolYear } : { text }));
}

function show(outcome: ImportOutcome): void {
  if (outcome.status === 'needs-school-year') {
    yearInput.value = outcome.suggested;
    state.value = { kind: 'school-year' };
  } else if (outcome.status === 'imported') {
    state.value = { kind: 'done', report: outcome.report };
    emit('imported', outcome.courseId);
  } else {
    state.value = { kind: 'error', message: t(`import.errors.${outcome.error.code}`, { detail: outcome.error.detail ?? '' }) };
  }
}

function submitYear(): void {
  void run(yearInput.value);
}
</script>
