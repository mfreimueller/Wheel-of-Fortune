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
        <option v-for="c in coursesInYear" :key="c.id" :value="c.id">{{ c.className }} · {{ c.subject }}</option>
      </select>
    </label>
    <span class="spacer" />
    <button data-testid="import-button" @click="importing = true">{{ t('header.importCsv') }}</button>
  </header>

  <section v-if="listing.problems.length" class="problems" role="alert">
    <p>{{ t('problems.title') }}</p>
    <ul>
      <li v-for="p in listing.problems" :key="p.file">{{ p.file }}: {{ p.message }}</li>
    </ul>
  </section>

  <main>
    <p v-if="loadError" class="error" role="alert">{{ loadError.file }}: {{ loadError.message }}</p>
    <template v-else-if="course">
      <h1 data-testid="course-title">{{ course.className }} · {{ course.subject }}</h1>
      <p data-testid="course-summary">{{ t('course.summary', { count: course.students.filter((s) => s.active).length }) }}</p>
    </template>
    <p v-else-if="years.length === 0" data-testid="empty">{{ t('empty.noCourse') }}</p>
    <p v-else>{{ t('empty.noCourseInYear') }}</p>
  </main>

  <ImportDialog v-if="importing" @close="importing = false" @imported="(id) => refresh({ courseId: id })" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ImportDialog from './components/ImportDialog.vue';
import { useCourses } from './composables/useCourses';

const { t } = useI18n();
const { listing, years, year, coursesInYear, courseId, course, loadError, refresh } = useCourses();
const importing = ref(false);

onMounted(() => refresh());
</script>
