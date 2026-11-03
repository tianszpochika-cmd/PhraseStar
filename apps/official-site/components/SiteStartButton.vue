<script setup lang="ts">
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
const { registerLink } = useOfficialSiteLinks();
</script>
<template>
  <NuxtLink
    :to="registerLink()"
    external
    data-register-entry
    class="btn"
    :class="secondary ? 'btn-white' : 'btn-primary'"
    >{{ label || t("official.c03e46770e") }}<template v-if="showIcon">
      <img v-if="iconSrc" :src="iconSrc" width="19" height="19" alt="" />
      <SiteIcon v-else name="arrow" />
    </template></NuxtLink>
</template>
