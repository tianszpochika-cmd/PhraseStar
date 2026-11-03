<script setup lang="ts">
defineProps<{ cards: readonly { title: string; description: string }[]; icon: string; action: string; target: string }>();
</script>
<template>
  <div class="v1-core-features">
    <article v-for="(card, index) in cards" :key="card.title" :data-tone="index">
      <div class="v1-core-features__heading"><h2>{{ card.title }}</h2><span aria-hidden="true"><img :src="icon" width="24" height="24" alt="" /></span></div>
      <p>{{ card.description }}</p>
      <NuxtLink :to="target">{{ action }}<span aria-hidden="true">→</span></NuxtLink>
    </article>
  </div>
</template>
<style scoped>
.v1-core-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.v1-core-features article { position: relative; min-width: 0; min-height: 177px; padding: 19px; border: 1px solid var(--v1-border); border-radius: 20px; background: var(--v1-card-lilac); }
.v1-core-features article[data-tone="1"] { background: var(--v1-card-mint); }
.v1-core-features article[data-tone="2"] { background: var(--v1-card-sand); }
.v1-core-features article::before { content: ""; position: absolute; left: -1px; top: 18px; width: 3px; height: 22px; border-radius: 2px; background: var(--v1-card-lilac-accent); }
.v1-core-features article[data-tone="1"]::before { background: var(--v1-card-mint-accent); }
.v1-core-features article[data-tone="2"]::before { background: var(--v1-card-sand-accent); }
.v1-core-features__heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.v1-core-features h2 { font-size: 21px; line-height: 29px; }
.v1-core-features__heading > span { display: grid; place-items: center; flex: 0 0 42px; width: 42px; height: 42px; margin: -7px -7px -5px 0; border-radius: 13px; background: var(--v1-surface); }
.v1-core-features p { min-height: 40px; margin-top: 13px; padding-bottom: 9px; border-bottom: 1px solid var(--v1-border); color: var(--v1-muted); font-size: 14px; line-height: 24px; }
.v1-core-features a { display: flex; align-items: center; justify-content: space-between; min-height: 44px; margin-top: 13px; padding: 0 15px 0 16px; border-radius: 12px; background: var(--v1-surface); color: var(--v1-brand); font-size: 13px; font-weight: 500; }
.v1-core-features a span { font: 600 19px var(--v1-font-display); }
.v1-core-features a:focus-visible { outline-color: var(--v1-focus); }
@media (max-width: 700px) {
  .v1-core-features { grid-template-columns: 1fr; gap: 12px; }
  .v1-core-features article { min-height: 130px; border-radius: 16px; }
  .v1-core-features__heading > span, .v1-core-features a { display: none; }
  .v1-core-features p { min-height: 0; margin-top: 11px; padding: 0; border: 0; }
}
</style>
