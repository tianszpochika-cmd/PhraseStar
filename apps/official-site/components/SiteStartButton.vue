<script setup lang="ts">
import { preserveCampaignParams } from "~/utils/public-links.mjs";
import { resolvePublicThemeMode, resolvePublicUiLocale } from "~/utils/public-projection";

withDefaults(defineProps<{
  label?: string;
  secondary?: boolean;
  iconSrc?: string;
  showIcon?: boolean;
}>(), {
  label: "",
  iconSrc: "",
  showIcon: true,
});
const { t } = useSiteText();
const route = useRoute();
const startTarget = computed(() => ({
  path: "/start",
  query: {
    ...preserveCampaignParams(route.query),
    ...(route.query.locale !== undefined ? { locale: resolvePublicUiLocale(route.query.locale) } : {}),
    ...(route.query.theme !== undefined ? { theme: resolvePublicThemeMode(route.query.theme) } : {}),
  },
}));
</script>
<template>
  <NuxtLink
    :to="startTarget"
    data-start-entry
    class="btn"
    :class="secondary ? 'btn-white' : 'btn-primary'"
    >{{ label || t("official.v1.common.nav.start") }}<template v-if="showIcon">
      <img v-if="iconSrc" :src="iconSrc" width="19" height="19" alt="" />
      <SiteIcon v-else name="arrow" />
    </template></NuxtLink>
</template>
