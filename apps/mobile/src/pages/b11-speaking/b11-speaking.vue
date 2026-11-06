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
    iconSrc: '/static/figma-closed-168-6160/237c0686-acee-476b-97dd-0743926e7055.svg',
    chevronSrc: '/static/figma-closed-168-6160/a24dc873-e7f9-49c5-b94e-e6f758ccf2ba.svg',
    titleKey: 'closed.alternatives.vocab',
    metaKey: 'closed.alternatives.vocabMeta',
    tone: 'brand' as const,
  },
  {
    id: 'reading',
    target: '/pages/b3-reading/b3-reading',
    iconSrc: '/static/figma-closed-168-6160/76a0b677-f745-483d-801f-87719e42e7f9.svg',
    chevronSrc: '/static/figma-closed-168-6160/a24dc873-e7f9-49c5-b94e-e6f758ccf2ba.svg',
    titleKey: 'closed.alternatives.reading',
    metaKey: 'closed.alternatives.readingMeta',
    tone: 'ok' as const,
  },
]
</script>

<template>
  <view class="yx-page b11-page v2-b11speak-page v2-closed-page" :class="themeClass" :style="experienceStyle" :data-motion="store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion">
    <MobilePageHeader page="b11-speaking" compact :title="mobileT('closed.b11Speaking.navTitle')" back-icon-src="/static/figma-closed-168-6160/571548d9-e968-4aee-9c47-f0d8151ae53e.svg" :show-settings="false" />
    <view class="v2-b11speak-body">
    <MobileClosedPracticeNotice
      variant="speaking"
      title-key="closed.b11Speaking.title"
      description-key="closed.b11Speaking.reason"
      aria-label-key="closed.b11Speaking.title"
      glow-src="/static/figma-closed-168-6160/88a1fd7a-bbb3-4189-a4b9-e4faf5e11822.svg"
      icon-src="/static/figma-closed-168-6160/3d832733-5146-41f7-b495-52259359d487.svg"
      :alternatives="alternatives"
      @back="backToLearning"
      @select="openRelated"
    />
    </view>
  </view>
</template>

<style scoped lang="scss">
.b11-page{padding-bottom:64rpx}
.v2-b11speak-page{min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-b11speak-body{display:flex;flex-direction:column;gap:var(--v2-space-4);font-family:var(--v2-font);min-width:0;max-width:100%}
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
