<script setup lang="ts">
import { computed } from 'vue'
import { backMobile, mobileT } from '../platform/experience'
import { openUniPage } from '../platform/uni-runtime'

const props = withDefaults(defineProps<{
  page: string
  kicker?: string
  title?: string
  description?: string
  compact?: boolean
  /** Decorative 22×22 icon inside the 44×44 back control. Omitted pages keep the text chevron. */
  backIconSrc?: string
  /** Existing pages keep the settings control. Pass false for a 44×44 empty trail. */
  showSettings?: boolean
}>(), {
  showSettings: true,
})

const isTab = computed(() => ['home', 'learn', 'b2-practice', 'world', 'profile'].includes(props.page))
const isAuth = computed(() => ['login', 'register', 'reset-password'].includes(props.page))
const navTitleMode = computed(() => Boolean(props.compact && props.title && props.showSettings === false && !isTab.value && !isAuth.value))
</script>

<template>
  <view class="mobile-page-header" :class="{ 'mobile-page-header--nav-title': navTitleMode }">
    <view class="mobile-topbar" :class="{ 'mobile-topbar--nav': navTitleMode }">
      <view v-if="isTab || isAuth" class="mobile-wordmark"><view class="mobile-logo" aria-hidden="true">✦</view><text>{{ mobileT('brand') }}</text></view>
      <button tabindex="0" role="button" v-else class="mobile-back" :class="{ 'mobile-back--icon': Boolean(backIconSrc) || navTitleMode }" :aria-label="mobileT('back')" @click="backMobile"><image v-if="backIconSrc" class="mobile-back-icon" :src="backIconSrc" mode="aspectFit" aria-hidden="true" /><text v-else aria-hidden="true">‹</text><template v-if="!backIconSrc && !navTitleMode">{{ mobileT('back') }}</template></button>
      <text v-if="navTitleMode" class="mobile-nav-title" role="heading" aria-level="1">{{ title }}</text>
      <text v-if="isAuth" class="mobile-topbar-note">{{ mobileT('authTag') }}</text>
      <button tabindex="0" role="button" v-else-if="showSettings" class="mobile-settings" :aria-label="mobileT('settings')" @click="openUniPage('/pages/settings/settings')"><text aria-hidden="true">☷</text></button>
      <view v-else class="mobile-trail" :aria-hidden="$slots.trail ? false : true"><slot name="trail" /></view>
    </view>
    <view v-if="!navTitleMode" class="mobile-intro" :class="{ 'mobile-intro--hero': (page === 'home' || isAuth) && !compact, 'mobile-intro--world': page === 'world', 'mobile-intro--compact': compact }">
      <view class="mobile-intro-copy">
        <text class="mobile-kicker">{{ kicker ?? mobileT(`pages.${page}.kicker`) }}</text>
        <text class="mobile-page-title" role="heading" aria-level="1">{{ title ?? mobileT(`pages.${page}.title`) }}</text>
        <text class="mobile-page-description">{{ description ?? mobileT(`pages.${page}.description`) }}</text>
      </view>
      <view v-if="(page === 'home' || isAuth || page === 'world') && !compact" class="mobile-book-art" aria-hidden="true">
        <view class="mobile-art-orbit"></view><text class="mobile-art-spark">✦</text>
        <view class="mobile-art-book"><text>Aa</text><view></view><view></view></view>
        <view class="mobile-art-disc"></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mobile-intro--compact { padding:0; margin:0 0 var(--v2-space-3); background:none; box-shadow:none; border:0; }
.mobile-intro--compact .mobile-kicker, .mobile-intro--compact .mobile-page-description { display:none; }
.mobile-intro--compact .mobile-page-title { font-size: var(--v2-text-lg); font-weight:700; color: var(--v2-ink); }
.mobile-page-header .mobile-back--icon { width:44px; height:44px; min-width:44px; min-height:44px; padding:0; flex:0 0 44px; gap:0; box-sizing:border-box; }
.mobile-back-icon { width:22px; height:22px; }
.mobile-trail { width:44px; height:44px; min-width:44px; min-height:44px; flex:0 0 44px; }
.mobile-topbar--nav { gap:0; }
.mobile-nav-title { flex:1 1 auto; min-width:0; text-align:center; font-size:17px; line-height:22px; font-weight:600; color:var(--yx-text-primary); }
</style>
