<template>
  <main>
    <h1 data-testid="title">{{ t('app.title') }}</h1>
    <p>{{ t('empty.noCourse') }}</p>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
