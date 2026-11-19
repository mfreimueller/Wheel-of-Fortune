<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog result" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('result.selected', { name: fullName })">
      <div class="avatar" :style="{ background: avatarColor, color: avatarText }">{{ initials }}</div>
      <h2 data-testid="result-name">{{ fullName }}</h2>
      <p class="count" data-testid="result-count">{{ t('result.count', { n: student.pickCount }) }}</p>

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
import { labelColor } from '../utils/wheelGeometry';

const props = defineProps<{
  student: PickedStudent;
  /** The color of the student's wheel segment, so the avatar matches what was just on the wheel. */
  color: string | null;
}>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const fullName = computed(() => `${props.student.firstName} ${props.student.lastName}`);
const initials = computed(() => `${props.student.firstName.charAt(0)}${props.student.lastName.charAt(0)}`.toUpperCase());

const hex = computed(() => props.color ?? props.student.color);
const avatarColor = computed(() => hex.value ?? 'var(--color-primary)');
const avatarText = computed(() => (hex.value ? labelColor(hex.value) : 'var(--color-primary-contrast)'));
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

.actions {
  align-self: stretch;
}
</style>
