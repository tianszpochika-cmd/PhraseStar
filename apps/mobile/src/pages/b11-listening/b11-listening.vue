<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import MobileClosedPracticeNotice from '../../components/MobileClosedPracticeNotice.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed } from 'vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { b11ThemeMode } from '../../platform/b11-foundation'
import { useB11LearningStore } from '../../stores/b11-learning'

const store = useB11LearningStore()
const themeClass = computed(() => `b10-theme--${b11ThemeMode.value}`)
function backToLearning(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }
function openRelated(url: string): void { getUniRuntime().navigateTo({ url }) }
const alternatives = [
  {
    id: 'vocab',
    target: '/pages/b2-vocabulary/b2-vocabulary',
    iconSrc: '/static/figma-closed-168-4327/d91329fd-0c05-46c3-9a5d-f300190c7d9b.svg',
    chevronSrc: '/static/figma-closed-168-4327/4e7c093b-c2f2-44c5-b33b-4f4877a79499.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-4327/050695e7-7f3d-4007-9760-3d89c94e6725.svg',
    chevronSrc: '/static/figma-closed-168-4327/4e7c093b-c2f2-44c5-b33b-4f4877a79499.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
</script>

<template>
  <view class="yx-page b11-page v2-b11listen-page v2-closed-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-listening" compact :title="mobileT('closed.b11Listening.navTitle')" back-icon-src="/static/figma-closed-168-4327/3a7b6e37-d5f6-4494-8b21-2e493d4581ab.svg" :show-settings="false" />
    <view class="v2-b11listen-body">
    <MobileClosedPracticeNotice
      variant="listening"
      title-key="closed.b11Listening.title"
      description-key="closed.listening.reason"
      aria-label-key="closed.b11Listening.title"
      glow-src="/static/figma-closed-168-4327/235a9127-86dc-4f14-b784-028d2b50ce74.svg"
      icon-src="/static/figma-closed-168-4327/39e8258c-9396-4ce3-8d3b-286415020f26.svg"
      :alternatives="alternatives"
      @back="backToLearning"
      @select="openRelated"
    />
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}
.v2-b11listen-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-b11listen-body>*{min-width:0;max-width:100%}
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
