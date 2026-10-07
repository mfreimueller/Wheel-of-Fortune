<template>
  <div class="table-wrap">
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
          <td class="name">{{ s.lastName }} {{ s.firstName }}</td>
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
.table-wrap {
  min-width: 560px;
}

.students {
  width: 100%;
  border-collapse: collapse;
}

/* Table header: Caption text style */
.students th {
  padding: 0 6px 6px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: left;
  white-space: nowrap;
}

/* Student row: 40 px, 6 px padding, 12 px between the cells */
.students td {
  height: 40px;
  padding: 0 6px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.name {
  min-width: 130px;
}

/* A block-level checkbox centers on the row instead of sitting on the text baseline. */
.students input[type='checkbox'] {
  display: block;
}

/* Only the name is struck through for a student who is absent today. */
tr.absent .name {
  color: var(--color-disabled);
  text-decoration: line-through;
}

.color {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.clear {
  padding: 0 6px;
  line-height: 22px;
}

.count {
  width: 56px;
  height: 26px;
  padding: 0 0 0 6px;
  border-color: var(--color-text);
  border-radius: 3px;
  font-size: 14px;
  line-height: 20px;
}

.count::-webkit-inner-spin-button,
.count::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.inactive {
  margin-top: var(--space-3);
  font-size: 13px;
  line-height: 18px;
}

.inactive li {
  margin-top: var(--space-1);
}
</style>
