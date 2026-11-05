<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { openUniPage } from '../../platform/uni-runtime'

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const hub = '/static/figma-practice-core/practice-hub-167-4008'
const glowIcon = `${hub}/aec7d4b8-83b2-40af-ae6b-5f21e1a51dd5.svg`
const chevronIcon = `${hub}/e95a8a4c-d6d2-4e79-a269-7bccb93b11c5.svg`

const skills = [
  { page: 'b2-vocabulary', icon: `${hub}/84c069ed-a1ee-471b-be7a-65178d10e515.svg`, tone: 'brand', closed: false },
  { page: 'b3-grammar', icon: `${hub}/03dd37eb-95fb-47a0-80b3-4aa1394e0f2d.svg`, tone: 'soft', closed: false },
  { page: 'b11-reading', icon: `${hub}/add2c580-5ceb-485a-8f65-77873f3651b9.svg`, tone: 'success', closed: false },
  { page: 'b3-listening', icon: `${hub}/6ced3a16-0487-445c-a872-4b76848a705f.svg`, tone: 'warning', closed: true },
  { page: 'b3-speaking', icon: `${hub}/f3b4e192-cee4-4253-8f13-8fa8c92b6992.svg`, tone: 'danger', closed: true },
]
const entries = [
  { page: 'assessment', icon: `${hub}/1b033e60-bd08-475b-8d93-c5aaec006bc4.svg`, tone: 'brand', closed: false },
  { page: 'b10-report', icon: `${hub}/e03b706c-0677-415d-81f2-6d4ef9441f0d.svg`, tone: 'danger', closed: false },
  { page: 'b3-reading', icon: `${hub}/33ee40cc-5218-47f7-a47a-dce6d42d6b11.svg`, tone: 'warning', closed: false },
  { page: 'b3-listening', icon: `${hub}/077ccc78-a51f-428d-b0c4-200338e1619d.svg`, tone: 'brand', closed: true },
  { page: 'b3-speaking', icon: `${hub}/28489a76-1d1c-45ac-9249-14590fa12965.svg`, tone: 'brand', closed: true },
]
const entryCountLabel = computed(() => interpolate(mobileT('practicePage.entryCount'), { count: entries.length }))

function openHubTarget(page: string, kind: 'skill' | 'entry'): void {
  const target = (kind === 'skill' ? skills : entries).find((item) => item.page === page)
  if (!target || target.closed) return
  openUniPage(`/pages/${page}/${page}`)
}

onShow(async () => { await ensureMobilePageAccess('/pages/practice/practice') })
</script>

<template>
  <view class="yx-page practice-hub" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="theme">
    <view class="practice-glow" aria-hidden="true"><image class="practice-glow__img" :src="glowIcon" mode="aspectFit" /></view>
    <view class="practice-shell">
      <MobilePageHeader page="practice" kicker="" :title="mobileT('pages.practice.short')" />
      <view class="practice-skills">
        <button
          v-for="skill in skills"
          :key="skill.page"
          type="button"
          class="practice-skill"
          tabindex="0"
          :data-closed="skill.closed ? 'true' : 'false'"
          :aria-disabled="skill.closed ? 'true' : undefined"
          @click="openHubTarget(skill.page, 'skill')"
        >
          <view class="practice-skill__icon" :class="`practice-skill__icon--${skill.tone}`" aria-hidden="true"><image :src="skill.icon" mode="aspectFit" /></view>
          <text class="practice-skill__label">{{ mobileT(`pages.${skill.page}.short`) }}</text>
          <text v-if="skill.closed" class="practice-skill__meta">{{ mobileT('closed.comingSoon') }}</text>
        </button>
      </view>
      <view class="practice-glass practice-entries">
        <text class="practice-entries__count">{{ entryCountLabel }}</text>
        <view class="practice-divider" aria-hidden="true" />
        <template v-for="(entry, index) in entries" :key="entry.page">
          <button
            type="button"
            class="practice-row"
            tabindex="0"
            :data-closed="entry.closed ? 'true' : 'false'"
            :aria-disabled="entry.closed ? 'true' : undefined"
            @click="openHubTarget(entry.page, 'entry')"
          >
            <view class="practice-row__icon" :class="`practice-row__icon--${entry.tone}`" aria-hidden="true"><image :src="entry.icon" mode="aspectFit" /></view>
            <view class="practice-row__copy">
              <text class="practice-row__title">{{ mobileT(`pages.${entry.page}.short`) }}</text>
              <text class="practice-row__desc">{{ entry.closed ? mobileT('closed.comingSoon') : mobileT(`pages.${entry.page}.description`) }}</text>
            </view>
            <image v-if="!entry.closed" class="practice-chevron" :src="chevronIcon" mode="aspectFit" aria-hidden="true" />
          </button>
          <view v-if="index < entries.length - 1" class="practice-divider" aria-hidden="true" />
        </template>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.practice-hub.yx-page { position: relative; overflow-x: clip; padding-inline: 24px; background-color: var(--yx-r4-page-color, var(--yx-surface-page)); background-image: var(--yx-profile-page-image); }
.practice-shell { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 720px; margin: 0 auto; }
.practice-glow { position: absolute; left: 150px; top: -140px; width: 360px; height: 300px; pointer-events: none; }
.practice-glow__img { position: absolute; inset: -30% -25%; width: 150%; height: 160%; }
.practice-hub[data-motion="reduced"] .practice-glow,
.practice-hub[data-motion="off"] .practice-glow,
.practice-hub[data-resolved-theme="high-contrast"] .practice-glow { display: none; }
.practice-skills { display: flex; justify-content: space-between; gap: 8px; width: 100%; overflow-x: clip; }
.practice-hub.yx-page button.practice-skill { display: flex; flex: 1 1 44px; flex-direction: column; align-items: center; gap: 8px; width: auto; min-width: 44px; max-width: 72px; min-height: 44px; margin: 0; padding: 0; border: 0; background: transparent; color: var(--yx-text-primary); font: inherit; line-height: 1.3; white-space: normal; }
.practice-hub.yx-page button.practice-skill[aria-disabled="true"] { opacity: 0.65; }
.practice-skill__icon { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border: 1px solid var(--yx-profile-glass-border); border-radius: 18px; background: var(--yx-brand-soft); box-shadow: var(--yx-profile-card-shadow), var(--yx-settings-card-inset, none); }
.practice-skill__icon image { width: 28px; height: 28px; }
.practice-skill__icon--soft { background: var(--yx-surface-soft); }
.practice-skill__icon--success { background: var(--yx-success-soft); }
.practice-skill__icon--warning { background: var(--yx-warning-soft); }
.practice-skill__icon--danger { background: var(--yx-danger-soft); }
.practice-skill__label { color: var(--yx-text-primary); font-size: 12px; line-height: 16px; text-align: center; overflow-wrap: anywhere; }
.practice-skill__meta { color: var(--yx-text-secondary); font-size: 11px; line-height: 14px; text-align: center; }
.practice-glass { position: relative; overflow: hidden; border: 1px solid var(--yx-profile-glass-border); border-radius: 24px; background: var(--yx-profile-glass); box-shadow: var(--yx-profile-card-shadow), var(--yx-settings-card-inset, none); backdrop-filter: blur(var(--yx-profile-blur)); }
.practice-entries { display: flex; flex-direction: column; padding: 6px 20px; }
.practice-entries__count { display: block; padding: 8px 0; color: var(--yx-text-primary); font-size: 18px; font-weight: 700; line-height: 26px; }
.practice-divider { height: 1px; background: var(--yx-border); }
.practice-hub.yx-page button.practice-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; margin: 0; padding: 10px 0; border: 0; border-radius: 12px; background: transparent; color: var(--yx-text-primary); font: inherit; line-height: 1.4; text-align: left; white-space: normal; }
.practice-hub.yx-page button.practice-row[aria-disabled="true"] { opacity: 0.65; }
.practice-row__icon { display: flex; flex: 0 0 44px; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; background: var(--yx-brand-soft); }
.practice-row__icon image { width: 22px; height: 22px; }
.practice-row__icon--danger { background: var(--yx-danger-soft); }
.practice-row__icon--warning { background: var(--yx-warning-soft); }
.practice-row__copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
.practice-row__title { color: var(--yx-text-primary); font-size: 15px; font-weight: 700; line-height: 22px; }
.practice-row__desc { color: var(--yx-text-tertiary); font-size: 13px; line-height: 18px; }
.practice-chevron { flex: 0 0 20px; width: 20px; height: 20px; }
@media (max-width: 359px) {
  .practice-hub.yx-page { padding-inline: 16px; }
  .practice-skill__icon { width: 44px; height: 44px; }
}
@media (min-width: 768px) {
  .practice-hub.yx-page { padding-inline: 24px; }
}
</style>
