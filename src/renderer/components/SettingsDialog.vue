<template>
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
      <h2>{{ t('settings.title') }}</h2>
      <h3>{{ t('settings.backup') }}</h3>
      <p class="hint">{{ t('settings.backupHint') }}</p>
      <p class="hint" data-testid="last-backup">
        {{ lastBackup ? t('settings.lastBackup', { date: formatted }) : t('settings.noBackup') }}
      </p>
      <div class="row">
        <button type="button" data-testid="backup-export" @click="exportBackup">{{ t('settings.export') }}</button>
        <button type="button" data-testid="backup-import" :disabled="confirming" @click="confirming = true">{{ t('settings.import') }}</button>
      </div>
      <div v-if="confirming" class="stack" role="alertdialog" data-testid="import-confirm-box">
        <p>{{ t('settings.importConfirm') }}</p>
        <div class="row">
          <button type="button" @click="confirming = false">{{ t('import.cancel') }}</button>
          <button type="button" class="primary" data-testid="backup-import-confirm" @click="importBackup">{{ t('settings.importConfirmButton') }}</button>
        </div>
      </div>
      <p v-if="message" :class="isError ? 'error' : 'success'" role="status" data-testid="backup-message">{{ message }}</p>
      <div class="actions">
        <button class="primary" @click="emit('close')">{{ t('import.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ close: []; restored: [] }>();
const { t } = useI18n();

const lastBackup = ref(window.wheel.backup.lastBackupAt());
const confirming = ref(false);
const message = ref('');
const isError = ref(false);

const formatted = computed(() => (lastBackup.value ? new Date(lastBackup.value).toLocaleString('de-AT') : ''));

async function exportBackup(): Promise<void> {
  const outcome = await window.wheel.backup.export();
  lastBackup.value = window.wheel.backup.lastBackupAt();
  isError.value = !outcome.ok;
  message.value = outcome.ok ? t('settings.exported') : t('settings.errors.corrupt');
}

async function importBackup(): Promise<void> {
  confirming.value = false;
  const outcome = await window.wheel.backup.import();
  if (!outcome) return;
  isError.value = !outcome.ok;
  message.value = outcome.ok ? t('settings.imported', { n: outcome.courseCount }) : t(`settings.errors.${outcome.error}`);
  if (outcome.ok) emit('restored');
}
</script>

<style scoped>
.row {
  display: flex;
  gap: 8px;
}
</style>
