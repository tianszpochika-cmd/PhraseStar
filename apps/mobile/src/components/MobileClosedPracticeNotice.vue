<script setup lang="ts">
import { computed } from 'vue'
import { mobileT } from '../platform/experience'

type ClosedPracticeVariant = 'offline' | 'writing' | 'listening' | 'speaking'
type ClosedPracticeTone = 'brand' | 'ok'

interface ClosedPracticeAlternative {
  id: string
  target: string
  iconSrc: string
  chevronSrc: string
  titleKey: string
  metaKey: string
  tone?: ClosedPracticeTone
}

const props = withDefaults(defineProps<{
  variant: ClosedPracticeVariant
  titleKey: string
  descriptionKey: string
  glowSrc: string
  iconSrc: string
  alternatives?: ClosedPracticeAlternative[]
  pageTitleKey?: string
  pageSubtitleKey?: string
  badgeKey?: string
  ctaKey?: string
  ariaLabelKey?: string
}>(), {
  alternatives: () => [],
})

const emit = defineEmits<{
  back: []
  select: [target: string]
}>()

const items = computed(() => props.alternatives ?? [])
const pageTitle = computed(() => props.pageTitleKey ? mobileT(props.pageTitleKey) : '')
const pageSubtitle = computed(() => props.pageSubtitleKey ? mobileT(props.pageSubtitleKey) : '')
const badge = computed(() => mobileT(props.badgeKey ?? 'closed.comingSoon'))
const alternativesTitle = computed(() => mobileT('closed.alternatives.title'))
const cta = computed(() => mobileT(props.ctaKey ?? 'closed.backToAvailableLearning'))
const ariaLabel = computed(() => mobileT(props.ariaLabelKey ?? props.titleKey))
const rootClass = computed(() => ['v2-closed-notice', `v2-closed-notice--${props.variant}`])
</script>

<template>
  <view :class="rootClass" data-closed-practice role="region" :aria-label="ariaLabel">
    <view class="v2-closed-notice__glow" aria-hidden="true"><image class="v2-closed-notice__glow-img" :src="glowSrc" mode="scaleToFill" aria-hidden="true" /></view>
    <view v-if="pageTitle" class="v2-closed-notice__titleblock">
      <text class="v2-closed-notice__page-title">{{ pageTitle }}</text>
      <text class="v2-closed-notice__page-subtitle">{{ pageSubtitle }}</text>
    </view>

    <view class="v2-closed-notice__scroll">
      <view class="v2-closed-notice__card" role="status" :aria-label="ariaLabel">
        <view class="v2-closed-notice__art">
          <image class="v2-closed-notice__art-img" :src="iconSrc" mode="aspectFit" aria-hidden="true" />
        </view>
        <text class="v2-closed-notice__tag" data-coming-soon>{{ badge }}</text>
        <text class="v2-closed-notice__title">{{ mobileT(titleKey) }}</text>
        <text class="v2-closed-notice__desc" data-closed-reason>{{ mobileT(descriptionKey) }}</text>
      </view>

      <view v-if="items.length" class="v2-closed-notice__alt">
        <text class="v2-closed-notice__alt-title">{{ alternativesTitle }}</text>
        <view class="v2-closed-notice__divider" aria-hidden="true"></view>
        <template v-for="(item, index) in items" :key="item.id">
          <button tabindex="0" role="button" class="v2-closed-notice__row" type="button" @click="emit('select', item.target)">
            <view class="v2-closed-notice__tile" :class="`v2-closed-notice__tile--${item.tone ?? 'brand'}`">
              <image class="v2-closed-notice__tile-img" :src="item.iconSrc" mode="aspectFit" aria-hidden="true" />
            </view>
            <view class="v2-closed-notice__copy">
              <text class="v2-closed-notice__name">{{ mobileT(item.titleKey) }}</text>
              <text class="v2-closed-notice__meta">{{ mobileT(item.metaKey) }}</text>
            </view>
            <image class="v2-closed-notice__chev" :src="item.chevronSrc" mode="aspectFit" aria-hidden="true" />
          </button>
          <view v-if="index < items.length - 1" class="v2-closed-notice__divider" aria-hidden="true"></view>
        </template>
      </view>

      <slot name="queue" />
    </view>

    <view class="v2-closed-notice__bottom">
      <button tabindex="0" role="button" class="v2-closed-notice__cta" data-closed-back type="button" @click="emit('back')">{{ cta }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-closed-notice{--closed-art-from:var(--closed-art-listening-from,var(--v2-info));--closed-art-to:var(--closed-art-listening-to,var(--v2-brand2));position:relative;display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;width:100%;min-width:0;max-width:100%;min-height:calc(100vh - 190px);padding-bottom:calc(var(--v2-space-2) + env(safe-area-inset-bottom));font-family:var(--v2-font)}
.v2-closed-notice--offline{--closed-art-from:var(--closed-art-offline-from,var(--v2-info));--closed-art-to:var(--closed-art-offline-to,var(--v2-brand))}
.v2-closed-notice--writing{--closed-art-from:var(--closed-art-writing-from,var(--v2-ok));--closed-art-to:var(--closed-art-writing-to,var(--v2-info))}
.v2-closed-notice--speaking{--closed-art-from:var(--closed-art-speaking-from,var(--v2-brand2));--closed-art-to:var(--closed-art-speaking-to,var(--v2-brand))}
.v2-closed-notice__glow{position:absolute;top:-140px;right:-120px;z-index:0;display:block;width:360px;height:300px;overflow:visible;pointer-events:none;opacity:.9}
.v2-closed-notice__glow-img{position:absolute;top:-90px;left:-90px;display:block;width:540px;height:480px;max-width:none;pointer-events:none}
.v2-closed-notice__titleblock{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--v2-space-1);box-sizing:border-box;min-width:0;max-width:100%;padding-top:var(--v2-space-2)}
.v2-closed-notice__page-title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-closed-notice__page-subtitle{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:22px;overflow-wrap:anywhere}
.v2-closed-notice__scroll{position:relative;z-index:1;display:flex;flex:1 1 auto;flex-direction:column;justify-content:center;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-2) 0}
.v2-closed-notice__card{display:flex;flex-direction:column;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;max-width:520px;margin:0 auto;padding:28px 20px;border:1px solid var(--closed-card-border);border-radius:24px;background:var(--closed-card-bg);backdrop-filter:blur(10px);box-shadow:var(--closed-card-shadow);font-family:var(--v2-font);text-align:center}
.v2-closed-notice__art{display:flex;flex:none;align-items:center;justify-content:center;width:88px;height:88px;border-radius:28px;background:linear-gradient(128.66deg,var(--closed-art-from) 7.4%,var(--closed-art-to) 81.5%);box-shadow:var(--v2-shadow);overflow:hidden}
.v2-closed-notice__art-img{display:block;width:40px;height:40px}
.v2-closed-notice__tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:18px;white-space:nowrap}
.v2-closed-notice__title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:22px;font-weight:700;line-height:30px;text-align:center;overflow-wrap:anywhere}
.v2-closed-notice__desc{display:block;max-width:320px;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:22px;text-align:center;overflow-wrap:anywhere}
.v2-closed-notice__alt{box-sizing:border-box;width:100%;min-width:0;max-width:520px;margin:0 auto;padding:6px 20px;border:1px solid var(--closed-card-border);border-radius:24px;background:var(--closed-card-bg);backdrop-filter:blur(10px);box-shadow:var(--closed-card-shadow);font-family:var(--v2-font)}
.v2-closed-notice__alt-title{display:block;padding:10px 0 8px;color:var(--v2-ink);font-family:var(--v2-font);font-size:18px;font-weight:700;line-height:26px}
.v2-closed-notice__divider{height:1px;background:var(--v2-line)}
.v2-closed-notice__alt .v2-closed-notice__row{display:flex;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;min-height:56px;margin:0;padding:10px 0;border:0;border-radius:0;background:transparent;color:var(--v2-mut);font-family:var(--v2-font);text-align:left}
.v2-closed-notice__alt .v2-closed-notice__row:hover{background:var(--v2-surface)}
.v2-closed-notice__alt .v2-closed-notice__row:active{transform:none}
.v2-closed-notice__alt .v2-closed-notice__row:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-closed-notice__tile{display:flex;flex:none;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:var(--v2-soft);overflow:hidden}
.v2-closed-notice__tile--ok{background:var(--v2-ok-soft)}
.v2-closed-notice__tile-img{display:block;width:22px;height:22px}
.v2-closed-notice__copy{display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0;max-width:100%}
.v2-closed-notice__name{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-closed-notice__meta{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:18px;overflow-wrap:anywhere}
.v2-closed-notice__chev{display:block;flex:none;width:20px;height:20px}
.v2-closed-notice__bottom{position:relative;z-index:1;display:flex;justify-content:center;margin-top:auto;padding:var(--v2-space-3) 0 var(--v2-space-2);border-top:1px solid var(--v2-line);background:var(--v2-card)}
.v2-closed-notice__bottom .v2-closed-notice__cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:0;padding:12px 20px;border:0;border-radius:14px;background:var(--closed-cta-background);color:var(--closed-cta-on);font-family:var(--v2-font);font-size:var(--v2-text-md);font-weight:700;line-height:1.5;box-shadow:var(--closed-cta-shadow)}
.v2-closed-notice__bottom .v2-closed-notice__cta:hover{border-color:var(--v2-brand)}
.v2-closed-notice__bottom .v2-closed-notice__cta:active{transform:scale(.99)}
.v2-closed-notice__bottom .v2-closed-notice__cta:focus-visible{box-shadow:var(--v2-focus);outline:none}
.b10-theme--dark .v2-closed-notice__tile-img,.b10-theme--dark .v2-closed-notice__chev{filter:brightness(1.35)}
.b10-theme--dark .v2-closed-notice__glow{opacity:.55}
@media(prefers-contrast:more){.v2-closed-notice__tag{outline:1px solid var(--v2-brand)}}
@media(max-width:360px){.v2-closed-notice__page-title{font-size:24px;line-height:32px}.v2-closed-notice__card{padding:24px 16px;border-radius:20px}.v2-closed-notice__art{width:76px;height:76px;border-radius:24px}.v2-closed-notice__title{font-size:20px}.v2-closed-notice__desc{max-width:100%}.v2-closed-notice__alt{padding:6px 16px;border-radius:20px}.v2-closed-notice__name{font-size:14px}}
@media(prefers-reduced-motion:reduce){.v2-closed-notice__bottom .v2-closed-notice__cta{transition:none}}
</style>
