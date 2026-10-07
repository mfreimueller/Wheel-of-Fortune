<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog result" role="dialog" aria-modal="true" :aria-label="t('result.selected', { name: fullName })">
      <div class="avatar" :style="{ background: student.color ?? 'var(--primary)' }">{{ initials }}</div>
      <h2 data-testid="result-name">{{ fullName }}</h2>
      <p data-testid="result-count">{{ t('result.count', { n: student.pickCount }) }}</p>
      <div class="actions">
        <button class="primary" data-testid="result-close" @click="emit('close')">{{ t('import.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PickedStudent } from '../../shared/types';

const props = defineProps<{ student: PickedStudent }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const fullName = computed(() => `${props.student.firstName} ${props.student.lastName}`);
const initials = computed(() => `${props.student.firstName.charAt(0)}${props.student.lastName.charAt(0)}`.toUpperCase());
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
</style>
