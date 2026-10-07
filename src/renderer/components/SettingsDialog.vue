<template>
  <div class="overlay">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
      <h2>{{ t('settings.title') }}</h2>
      <p v-if="!info">{{ t('import.working') }}</p>
      <template v-else>
        <h3>{{ t('settings.dataDir') }}</h3>
        <p class="path" data-testid="data-dir">{{ info.dataDir }}</p>
        <p v-if="info.source === 'env'" class="hint" data-testid="data-dir-locked">{{ t('settings.locked') }}</p>
        <p v-else class="hint">{{ t('settings.moveHint') }}</p>
        <div class="row">
          <button type="button" data-testid="reveal-data-dir" @click="reveal">{{ t('settings.reveal') }}</button>
          <button type="button" data-testid="choose-data-dir" :disabled="info.source === 'env'" @click="choose">
            {{ t('settings.change') }}
          </button>
        </div>
      </template>
      <div class="actions">
        <button class="primary" @click="emit('close')">{{ t('import.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataDirInfo } from '../../shared/types';

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const info = ref<DataDirInfo | null>(null);

onMounted(async () => {
  info.value = await window.wheel.settings.get();
});

async function choose(): Promise<void> {
  // On success the app restarts, so there is nothing more to do here.
  await window.wheel.settings.chooseDataDir();
}

async function reveal(): Promise<void> {
  await window.wheel.settings.revealDataDir();
}
</script>

<style scoped>
.path {
  padding: var(--space-2);
  background: var(--color-surface-subtle);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 18px;
  word-break: break-all;
}

.row {
  display: flex;
  gap: 8px;
}
</style>
