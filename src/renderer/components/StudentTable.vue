<template>
  <div>
    <table class="students" data-testid="students">
      <thead>
        <tr>
          <th>{{ t('table.color') }}</th>
          <th>{{ t('table.name') }}</th>
          <th>{{ t('table.count') }}</th>
          <th>{{ t('table.absent') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in active" :key="s.id" :data-student="s.id" :class="{ absent: absentIds.has(s.id) }">
          <td>
            <div class="color">
            <input
              type="color"
              :value="s.color ?? '#9ca3af'"
              :aria-label="t('table.colorFor', { name: fullName(s) })"
              :data-testid="`color-${s.id}`"
              @change="emit('update', s.id, { color: ($event.target as HTMLInputElement).value })"
            >
            <button
              v-if="s.color"
              type="button"
              class="clear"
              :title="t('table.clearColor')"
              :aria-label="t('table.clearColor')"
              @click="emit('update', s.id, { color: null })"
            >
              ×
            </button>
            </div>
          </td>
          <td>{{ s.lastName }} {{ s.firstName }}</td>
          <td>
            <input
              class="count"
              type="number"
              min="0"
              step="1"
              :value="s.pickCount"
              :aria-label="t('table.countFor', { name: fullName(s) })"
              :data-testid="`count-${s.id}`"
              @change="emit('update', s.id, { pickCount: Number(($event.target as HTMLInputElement).value) })"
            >
          </td>
          <td>
            <input
              type="checkbox"
              :checked="absentIds.has(s.id)"
              :aria-label="t('table.absentFor', { name: fullName(s) })"
              :data-testid="`absent-${s.id}`"
              @change="emit('toggleAbsent', s.id)"
            >
          </td>
          <td>
            <button :disabled="picking" :data-testid="`pick-${s.id}`" @click="emit('pick', s.id)">{{ t('table.pick') }}</button>
          </td>
        </tr>
      </tbody>
    </table>

    <details v-if="inactive.length" class="inactive" data-testid="inactive">
      <summary>{{ t('table.inactive', { n: inactive.length }) }}</summary>
      <p class="hint">{{ t('table.inactiveHint') }}</p>
      <ul>
        <li v-for="s in inactive" :key="s.id">
          {{ s.lastName }} {{ s.firstName }}
          <button type="button" :data-testid="`reactivate-${s.id}`" @click="emit('update', s.id, { active: true })">
            {{ t('table.reactivate') }}
          </button>
        </li>
      </ul>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { StudentPatch } from '../../core/studentPatch';
import type { Student } from '../../core/types';

const props = defineProps<{ students: Student[]; absentIds: ReadonlySet<string>; picking: boolean }>();
const emit = defineEmits<{
  update: [studentId: string, patch: StudentPatch];
  toggleAbsent: [studentId: string];
  pick: [studentId: string];
}>();
const { t } = useI18n();

const byName = (a: Student, b: Student): number =>
  a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de');
const active = computed(() => props.students.filter((s) => s.active).sort(byName));
const inactive = computed(() => props.students.filter((s) => !s.active).sort(byName));

const fullName = (s: Student): string => `${s.lastName} ${s.firstName}`;
</script>

<style scoped>
.students {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.students th,
.students td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

tr.absent td {
  color: #9ca3af;
  text-decoration: line-through;
}

tr.absent td:last-child,
tr.absent td:nth-child(4) {
  text-decoration: none;
}

.color {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color input {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  background: none;
}

.clear {
  padding: 0 6px;
}

.count {
  width: 56px;
}

.inactive {
  margin-top: 12px;
  font-size: 14px;
}

.hint {
  color: #6b7280;
  font-size: 13px;
}
</style>
