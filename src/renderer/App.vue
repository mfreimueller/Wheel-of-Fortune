<template>
  <header class="bar">
    <label>
      {{ t('header.schoolYear') }}
      <select v-model="year" data-testid="year-select" :disabled="years.length === 0">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
    </label>
    <label>
      {{ t('header.course') }}
      <select v-model="courseId" data-testid="course-select" :disabled="coursesInYear.length === 0">
        <option v-for="c in coursesInYear" :key="c.id" :value="c.id">
          {{ c.className }} · {{ c.subject }}{{ c.archived ? ` (${t('header.archived')})` : '' }}
        </option>
      </select>
    </label>
    <details v-if="course" ref="menu" class="menu" data-testid="course-menu">
      <summary>{{ t('header.courseMenu') }}</summary>
      <div class="menu-items">
        <button type="button" data-testid="archive-course" @click="toggleArchive">
          {{ courseSummary?.archived ? t('header.unarchive') : t('header.archive') }}
        </button>
        <button type="button" data-testid="delete-course" @click="askDelete">{{ t('header.delete') }}</button>
      </div>
    </details>
    <label class="check">
      <input v-model="showArchived" type="checkbox" data-testid="show-archived">
      {{ t('header.showArchived') }}
    </label>
    <span class="spacer" />
    <button data-testid="export-button" :disabled="!course" @click="exporting = true">{{ t('header.exportCsv') }}</button>
    <button data-testid="import-button" @click="importing = true">{{ t('header.importCsv') }}</button>
    <button data-testid="settings-button" @click="settings = true">{{ t('header.settings') }}</button>
  </header>

  <section v-if="listing.problems.length" class="problems" role="alert">
    <p>{{ t('problems.title') }}</p>
    <ul>
      <li v-for="p in listing.problems" :key="p.file">{{ p.file }}: {{ p.message }}</li>
    </ul>
  </section>

  <main>
    <p v-if="loadError" class="error" role="alert">{{ loadError.file }}: {{ loadError.message }}</p>
    <CourseView v-else-if="course" :key="course.id" :course="course" @changed="reload" />
    <p v-else-if="years.length === 0" data-testid="empty">{{ t('empty.noCourse') }}</p>
    <p v-else>{{ t('empty.noCourseInYear') }}</p>
  </main>

  <div v-if="deleting && course" class="overlay" @click.self="deleting = false">
    <div class="dialog" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('header.delete')">
      <p>{{ t('header.deleteConfirm', { name: `${course.className} · ${course.subject}` }) }}</p>
      <div class="actions">
        <button @click="deleting = false">{{ t('import.cancel') }}</button>
        <button class="primary" data-testid="delete-confirm" @click="confirmDelete">{{ t('header.delete') }}</button>
      </div>
    </div>
  </div>

  <ExportDialog
    v-if="exporting && course"
    :course-id="course.id"
    :course-name="`${course.className} · ${course.subject}`"
    @close="exporting = false"
  />
  <ImportDialog v-if="importing" @close="importing = false" @imported="(id) => refresh({ courseId: id })" />
  <SettingsDialog v-if="settings" @close="settings = false" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CourseView from './components/CourseView.vue';
import ExportDialog from './components/ExportDialog.vue';
import ImportDialog from './components/ImportDialog.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import { useCourses } from './composables/useCourses';

const { t } = useI18n();
const { listing, years, year, coursesInYear, courseId, course, loadError, showArchived, refresh, reload } = useCourses();
const importing = ref(false);
const exporting = ref(false);
const settings = ref(false);
const deleting = ref(false);
const menu = ref<HTMLDetailsElement | null>(null);

const courseSummary = computed(() => listing.value.courses.find((c) => c.id === courseId.value));

async function toggleArchive(): Promise<void> {
  if (menu.value) menu.value.open = false;
  const summary = courseSummary.value;
  if (!summary) return;
  await window.wheel.courses.setArchived({ courseId: summary.id, archived: !summary.archived });
  await refresh();
}

function askDelete(): void {
  if (menu.value) menu.value.open = false;
  deleting.value = true;
}

async function confirmDelete(): Promise<void> {
  deleting.value = false;
  if (!courseId.value) return;
  await window.wheel.courses.delete(courseId.value);
  await refresh();
}

onMounted(() => refresh());
</script>

<style scoped>
.menu {
  position: relative;
}

.menu summary {
  list-style: none;
  cursor: pointer;
}

.menu summary::-webkit-details-marker {
  display: none;
}

.menu-items {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
  margin-top: 4px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-dialog);
}
</style>
