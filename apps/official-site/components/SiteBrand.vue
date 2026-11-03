<script setup lang="ts">
withDefaults(defineProps<{ variant?: "header" | "footer" }>(), {
  variant: "header",
});
const { t } = useSiteText();
</script>

<template>
  <NuxtLink
    to="/"
    class="v1-brand"
    :class="`v1-brand--${variant}`"
    :aria-label="t('official.ce2143a3f5')"
  >
    <span class="v1-brand__mark" aria-hidden="true">
      <template v-if="variant === 'header'">
        <img
          class="v1-brand__backdrop v1-brand__backdrop--desktop"
          src="/figma-v1/assets/header-desktop-168-75/imgV10.svg"
          width="59"
          height="59"
          alt=""
        />
        <img
          class="v1-brand__backdrop v1-brand__backdrop--mobile"
          src="/figma-v1/assets/header-mobile-168-410/imgV10.svg"
          width="48"
          height="48"
          alt=""
        />
      </template>
      <img
        class="v1-brand__logo"
        src="/figma-v1/assets/header-desktop-168-75/imgOfficialLogoImageOriginal.png"
        width="30"
        height="30"
        alt=""
      />
    </span>
    <span class="v1-brand__wordmark">
      <strong>{{ t("official.v1.common.brand") }}</strong>
      <span lang="en">{{ t("official.v1.common.brandEnglish") }}</span>
    </span>
  </NuxtLink>
</template>
