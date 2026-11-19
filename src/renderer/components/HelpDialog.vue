<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog help" style="--dialog-width: 720px" role="dialog" aria-modal="true" :aria-label="t('help.title')" data-testid="help-dialog">
      <h2>{{ t('help.title') }}</h2>

      <div class="body" data-testid="help-body">
        <section>
          <h3>{{ t('help.overview.title') }}</h3>
          <p>{{ t('help.overview.p1') }}</p>
          <p>{{ t('help.overview.p2') }}</p>
        </section>

        <section>
          <h3 data-testid="help-import-title">{{ t('help.import.title') }}</h3>
          <p>{{ t('help.import.intro', { button: t('header.importCsv') }) }}</p>
          <p class="sub">{{ t('help.import.columns') }}</p>
          <ul>
            <li>{{ t('help.import.required') }}</li>
            <li>{{ t('help.import.optional') }}</li>
            <li>{{ t('help.import.otherColumns') }}</li>
          </ul>
          <p class="sub">{{ t('help.import.example') }}</p>
          <pre class="csv">Klasse,Fach,Schuljahr,Id,Vorname,Nachname,Color
3EHIF,"DBIx - Modellierung",2026/27,g1,Anna,Bob,#ffaabb
3EHIF,"DBIx - Modellierung",2026/27,g2,Maxi,Muster,
3EHIF,"DBIx - Modellierung",2026/27,g3,Rubi,"Dubi, Jr.",#f1b2c3</pre>
          <p class="sub">{{ t('help.import.rules') }}</p>
          <ul>
            <li>{{ t('help.import.fileFormat') }}</li>
            <li>{{ t('help.import.oneCourse') }}</li>
            <li>{{ t('help.import.schoolYear') }}</li>
            <li>{{ t('help.import.color') }}</li>
            <li>{{ t('help.import.skipped') }}</li>
          </ul>
          <p class="sub">{{ t('help.import.reimport') }}</p>
          <ul>
            <li>{{ t('help.import.match') }}</li>
            <li>{{ t('help.import.added') }}</li>
            <li>{{ t('help.import.missing', { inactive: t('table.inactiveTitle') }) }}</li>
            <li>{{ t('help.import.kept') }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('help.spin.title') }}</h3>
          <ul>
            <li>{{ t('help.spin.lever', { spin: t('wheel.spin') }) }}</li>
            <li>{{ t('help.spin.fair', { fair: t('wheel.fair') }) }}</li>
            <li>{{ t('help.spin.free', { fair: t('wheel.fair') }) }}</li>
            <li>{{ t('help.spin.absent', { absent: t('table.absent') }) }}</li>
            <li>{{ t('help.spin.direct', { pick: t('table.pick') }) }}</li>
            <li>{{ t('help.spin.count', { count: t('table.count') }) }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('help.students.title') }}</h3>
          <ul>
            <li>{{ t('help.students.color', { color: t('table.color'), clear: t('table.clearColor') }) }}</li>
            <li>{{ t('help.students.count', { count: t('table.count') }) }}</li>
            <li>{{ t('help.students.reset', { reset: t('wheel.reset') }) }}</li>
            <li>{{ t('help.students.inactive', { inactive: t('table.inactiveTitle'), reactivate: t('table.reactivate') }) }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('help.specials.title') }}</h3>
          <p>{{ t('help.specials.intro', { button: t('wheel.specials') }) }}</p>
          <ul>
            <li>{{ t('help.specials.kinds', { again: t('specials.kinds.spin-again'), message: t('specials.kinds.message') }) }}</li>
            <li>{{ t('help.specials.probability', { probability: t('specials.probability') }) }}</li>
            <li>{{ t('help.specials.showIn', { showIn: t('specials.showIn'), always: t('specials.always'), freeOnly: t('specials.freeOnly'), fair: t('wheel.fair') }) }}</li>
            <li>{{ t('help.specials.save', { save: t('specials.save') }) }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('help.courses.title') }}</h3>
          <ul>
            <li>{{ t('help.courses.select', { year: t('header.schoolYear'), course: t('header.course') }) }}</li>
            <li>{{ t('help.courses.archive', { menu: t('header.courseMenu'), archive: t('header.archive'), show: t('header.showArchived'), archived: t('header.archived'), unarchive: t('header.unarchive') }) }}</li>
            <li>{{ t('help.courses.delete', { menu: t('header.courseMenu'), delete: t('header.delete') }) }}</li>
          </ul>
        </section>

        <section>
          <h3>{{ t('help.data.title') }}</h3>
          <ul>
            <li>{{ t('help.data.local') }}</li>
            <li>{{ t('help.data.clearing') }}</li>
            <li>{{ t('help.data.backup', { settings: t('header.settings'), export: t('settings.export') }) }}</li>
            <li>{{ t('help.data.restore', { import: t('settings.import'), replace: t('settings.importConfirmButton') }) }}</li>
            <li>{{ t('help.data.tabs') }}</li>
          </ul>
        </section>
      </div>

      <div class="actions">
        <button class="primary" data-testid="help-close" @click="emit('close')">{{ t('import.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.help {
  overflow: hidden;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  overflow-y: auto;
  padding-right: var(--space-2);
}

section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

h3,
p,
ul {
  margin: 0;
}

ul {
  padding-left: 20px;
}

li + li {
  margin-top: var(--space-1);
}

.sub {
  margin-top: var(--space-1);
  font-weight: 600;
}

.csv {
  margin: 0;
  padding: var(--space-2);
  overflow-x: auto;
  background: var(--color-surface-subtle);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 18px;
}
</style>
