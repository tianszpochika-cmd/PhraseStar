<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  lead: string;
  label: string;
  artwork?: string;
  artworkAlt?: string;
  showBreadcrumb?: boolean;
  showLabel?: boolean;
}>(), {
  artwork: "",
  artworkAlt: "",
  showBreadcrumb: true,
  showLabel: true,
});
const { t } = useSiteText();
</script>
<template>
  <section class="page-heading v1-page-heading">
    <div class="container">
      <nav v-if="showBreadcrumb" class="breadcrumb" :aria-label="t('official.cb458ea40b')">
        <NuxtLink to="/">{{ t("official.cff93ad0e4") }}</NuxtLink
        ><SiteIcon name="right" /><span>{{ label }}</span>
      </nav>
      <div class="v1-page-heading__body">
        <div class="v1-page-heading__copy">
          <span v-if="showLabel" class="eyebrow">{{ label }}</span>
          <h1>{{ title }}</h1>
          <p>{{ lead }}</p>
          <slot name="actions" />
        </div>
        <div v-if="artwork || $slots.artwork" class="v1-page-heading__artwork">
          <slot name="artwork"><img :src="artwork" :alt="artworkAlt" /></slot>
        </div>
      </div>
    </div>
  </section>
</template>
