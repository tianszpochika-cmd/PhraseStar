<script setup lang="ts">
const emit = defineEmits<{ openPractice: [] }>();
const { t } = useSiteText();
const desktop = "/figma-v1/assets/home-desktop-hero-168-90/";
const mobile = "/figma-v1/assets/home-mobile-hero-168-419/";
</script>

<template>
  <section class="v1-home-hero" aria-labelledby="home-hero-title">
    <div class="hero-inner">
      <div class="hero-copy">
        <div class="hero-eyebrow"><img :src="mobile + 'imgFrame.svg'" alt="" />{{ t('official.v1.home.hero.eyebrow') }}</div>
        <h1 id="home-hero-title"><span>{{ t('official.v1.home.hero.titleFirst') }}</span><span>{{ t('official.v1.home.hero.titleSecond') }}</span></h1>
        <p class="hero-intro">{{ t('official.v1.home.hero.introFirst') }}<br />{{ t('official.v1.home.hero.introSecond') }}</p>
        <div class="hero-actions">
          <NuxtLink class="hero-primary" to="/start" data-primary>{{ t('official.v1.home.hero.start') }}<img class="desktop-action-icon" :src="desktop + 'imgFrame.svg'" alt="" /><img class="mobile-action-icon" :src="mobile + 'imgFrame1.svg'" alt="" /></NuxtLink>
          <button class="hero-secondary" type="button" @click="emit('openPractice')">{{ t('official.v1.home.hero.try') }}<img class="desktop-action-icon" :src="desktop + 'imgFrame1.svg'" alt="" /><img class="mobile-action-icon" :src="mobile + 'imgFrame5.svg'" alt="" /></button>
        </div>
        <p class="hero-note"><img :src="desktop + 'imgFrame2.svg'" alt="" />{{ t('official.v1.home.hero.note') }}</p>
        <p class="hero-motto" lang="en" aria-hidden="true">little by little</p>
      </div>

      <div class="hero-illustration desktop-illustration" role="img" :aria-label="t('official.v1.home.hero.demoDescription')">
        <img class="d-ellipse d-e1" :src="desktop + 'imgEllipse.svg'" alt="" />
        <img class="d-ellipse d-e2" :src="desktop + 'imgEllipse1.svg'" alt="" />
        <img class="d-ellipse d-e3" :src="desktop + 'imgEllipse2.svg'" alt="" />
        <img class="d-ellipse d-e4" :src="desktop + 'imgEllipse3.svg'" alt="" />
        <img class="d-ellipse d-e5" :src="desktop + 'imgEllipse4.svg'" alt="" />
        <img class="d-ellipse d-e6" :src="desktop + 'imgEllipse5.svg'" alt="" />
        <img class="d-decor d-route" :src="desktop + 'imgPsStudio.svg'" alt="" />
        <img class="d-decor d-ring" :src="desktop + 'imgEllipse6.svg'" alt="" />
        <img class="d-decor d-star1" :src="desktop + 'imgFrame3.svg'" alt="" />
        <img class="d-decor d-star2" :src="desktop + 'imgFrame4.svg'" alt="" />
        <img class="d-decor d-star3" :src="desktop + 'imgFrame9.svg'" alt="" />
        <img class="d-decor d-star4" :src="desktop + 'imgFrame10.svg'" alt="" />
        <img class="d-decor d-star5" :src="desktop + 'imgFrame11.svg'" alt="" />
        <div class="d-phone">
          <div class="d-phone-screen">
            <div class="d-phone-head"><div class="d-phone-status"><span>9:41</span><span>● ● ●</span></div><p>{{ t('official.v1.home.hero.greeting') }}</p><div class="d-streak-number"><strong>12</strong><span>{{ t('official.v1.home.hero.streak') }}</span></div></div>
            <div class="d-goal"><small>{{ t('official.v1.home.hero.target') }}</small><strong>{{ t('official.v1.home.hero.targetDone') }}</strong><div class="progress"><i /></div></div>
            <strong class="d-tasks-title">{{ t('official.v1.home.hero.tasks') }}</strong>
            <div class="d-task"><span class="task-icon"><img :src="desktop + 'imgFrame5.svg'" alt="" /></span><span><strong>{{ t('official.v1.home.hero.words') }}</strong><small>{{ t('official.v1.home.hero.wordsDetail') }}</small></span></div>
            <div class="d-task"><span class="task-icon"><img :src="desktop + 'imgFrame6.svg'" alt="" /></span><span><strong>{{ t('official.v1.home.hero.reading') }}</strong><small>{{ t('official.v1.home.hero.readingDetail') }}</small></span></div>
          </div>
        </div>
        <div class="d-word"><span class="word-label">WORD OF TODAY</span><strong lang="en">latte</strong><small>/ˈlɑːteɪ/ · {{ t('official.v1.home.hero.latte') }}</small><div class="word-listen"><img :src="desktop + 'imgFrame7.svg'" alt="" />{{ t('official.v1.home.hero.pronunciation') }}</div><img class="d-latte" :src="desktop + 'imgPsLatte.svg'" alt="" /></div>
        <div class="d-streak"><span class="streak-icon"><img :src="desktop + 'imgFrame8.svg'" alt="" /></span><span><strong>{{ t('official.v1.home.hero.streakCard') }}</strong><small>{{ t('official.v1.home.hero.encouragement') }}</small></span></div>
        <img class="d-stamp" :src="desktop + 'imgPsStudioCafe01.svg'" alt="" />
      </div>

      <div class="hero-illustration mobile-illustration" role="img" :aria-label="t('official.v1.home.hero.demoDescription')">
        <img class="m-decor m-e1" :src="mobile + 'imgEllipse.svg'" alt="" />
        <img class="m-decor m-e2" :src="mobile + 'imgEllipse1.svg'" alt="" />
        <div class="m-phone"><div class="m-screen"><div class="m-head"><div class="m-status"><span>9:41</span><span>•••</span></div><p>{{ t('official.v1.home.hero.greetingMobile') }}</p><small>{{ t('official.v1.home.hero.streakMobile') }}</small></div><div class="m-today"><strong>{{ t('official.v1.home.hero.today') }}</strong><small>{{ t('official.v1.home.hero.todayDetail') }}</small><div class="progress"><i /></div></div><div class="m-task"><span class="task-icon"><img :src="mobile + 'imgFrame2.svg'" alt="" /></span><span><strong>{{ t('official.v1.home.hero.words') }}</strong><small>{{ t('official.v1.home.hero.wordsDetailMobile') }}</small></span></div><div class="m-task"><span class="task-icon"><img :src="mobile + 'imgFrame3.svg'" alt="" /></span><span><strong>{{ t('official.v1.home.hero.reading') }}</strong><small>{{ t('official.v1.home.hero.readingDetailMobile') }}</small></span></div></div></div>
        <div class="m-word"><span>NEW WORD</span><strong lang="en">latte</strong><small>{{ t('official.v1.home.hero.latteMobile') }}</small><img :src="mobile + 'imgPsLatte.svg'" alt="" /></div>
        <div class="m-streak"><img :src="mobile + 'imgFrame4.svg'" alt="" /><span><strong>{{ t('official.v1.home.hero.streakCardMobile') }}</strong><small>{{ t('official.v1.home.hero.encouragementMobile') }}</small></span></div>
        <img class="m-decor m-ring" :src="mobile + 'imgMotionPathOrbitalRing.svg'" alt="" />
        <img class="m-decor m-star1" :src="mobile + 'imgStarlightMotionTwinkle.svg'" alt="" />
        <img class="m-decor m-star2" :src="mobile + 'imgStarlightMotionTwinkle1.svg'" alt="" />
        <img class="m-decor m-glimmer1" :src="mobile + 'imgMotionGlimmer.svg'" alt="" />
        <img class="m-decor m-glimmer2" :src="mobile + 'imgMotionGlimmer1.svg'" alt="" />
        <img class="m-stamp" :src="mobile + 'imgPsStudioCafe01.svg'" alt="" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.v1-home-hero { background: linear-gradient(105deg, var(--v1-bg), var(--v1-brand-soft)); overflow: hidden; font-family: var(--v1-font-sans); }
.hero-inner { position: relative; max-width: 1440px; height: 760px; margin: auto; }
.hero-copy { position: relative; z-index: 2; padding-top: 112px; margin-left: max(24px, calc((100% - 1192px) / 2)); }
.hero-eyebrow { display: flex; align-items: center; gap: 6px; width: 246px; height: 32px; padding: 0 14px; border-radius: 16px; background: var(--v1-surface); color: var(--v1-brand); font-size: 12px; font-weight: 600; }
.hero-eyebrow::before { content: "✦"; }.hero-eyebrow img { display: none; }
h1 { margin: 39px 0 0; color: var(--v1-text); font-size: 74px; font-weight: 900; line-height: 1.27; letter-spacing: -.035em; }
h1 span { display: block; }
h1 span + span { position: relative; color: var(--v1-brand); font-size: 62px; line-height: 1.42; }
h1 span + span::after { position: absolute; bottom: -3px; left: 0; width: 328px; height: 6px; border-radius: 4px; background: color-mix(in srgb, var(--v1-brand) 25%, var(--v1-surface)); content: ''; }
.hero-intro { margin-top: 39px; color: var(--v1-muted); font-size: 18px; line-height: 34px; }
.hero-actions { display: flex; gap: 16px; margin-top: 46px; }
.hero-actions a, .hero-actions button { display: flex; height: 56px; align-items: center; justify-content: center; gap: 10px; border-radius: 15px; font-size: 16px; font-weight: 700; }
.mobile-action-icon { display: none; }.hero-primary { width: 199px; background: var(--v1-brand); color: var(--v1-on-brand); }
.hero-secondary { width: 187px; border: 1px solid var(--v1-border); background: var(--v1-surface); color: var(--v1-brand); }
.hero-note { display: flex; align-items: center; gap: 11px; margin-top: 34px; color: var(--v1-muted); font-size: 13px; }
.hero-motto { margin-top: 43px; color: var(--v1-brand); font: 600 41px/1 var(--v1-font-display); opacity: .5; }
.hero-illustration { position: absolute; inset: 0; pointer-events: none; }
.desktop-illustration img { max-width: none; }
.d-ellipse, .d-decor, .d-stamp { position: absolute; }
.d-e1 { left: 889px; top: -96px; }.d-e2 { left: 1080px; top: 460px; }.d-e3 { left: 660px; top: 450px; }.d-e4 { left: 835px; top: 104px; }.d-e5 { left: 820px; top: 78px; }.d-e6 { left: 869px; top: 122px; }
.d-route { left: 669px; top: 213px; }.d-ring { left: 694px; top: 188px; }.d-star1 { left: 1315px; top: 155px; }.d-star2 { left: 797px; top: 506px; }.d-star3 { left: 720px; top: 260px; }.d-star4 { left: 1370px; top: 334px; }.d-star5 { left: 1280px; top: 570px; }
.d-phone { position: absolute; left: 920px; top: 111px; width: 284px; height: 546px; padding: 10px; transform: rotate(4deg); border-radius: 31px; background: var(--v1-surface); box-shadow: 0 14px 44px color-mix(in srgb, var(--v1-text) 23%, transparent); }
.d-phone-screen { height: 526px; overflow: hidden; border-radius: 23px; background: var(--v1-bg); }
.d-phone-head { height: 183px; padding: 10px 16px; border-radius: 23px; background: linear-gradient(125deg, var(--v1-brand-strong), var(--v1-brand)); color: var(--v1-on-brand); }
.d-phone-status, .m-status { display: flex; justify-content: space-between; font: 600 11px/1 var(--v1-font-display); }
.d-phone-head p { margin-top: 37px; color: inherit; font-size: 15px; }.d-streak-number { display: flex; align-items: baseline; gap: 12px; margin-top: 13px; }.d-streak-number strong { font: 600 44px/1 var(--v1-font-display); }.d-streak-number span { font-size: 12px; }
.d-goal { height: 83px; margin: 27px 14px 0; padding: 10px 13px; border: 1px solid var(--v1-border); border-radius: 15px; background: var(--v1-surface); }.d-goal small, .d-goal strong { display: block; line-height: 1.45; }.d-goal small { color: var(--v1-muted); font-size: 12px; }.d-goal strong { color: var(--v1-text); font-size: 17px; }
.progress { height: 6px; margin-top: 6px; overflow: hidden; border-radius: 4px; background: var(--v1-brand-soft); }.progress i { display: block; width: 41%; height: 100%; border-radius: inherit; background: var(--v1-brand); }
.d-tasks-title { display: block; margin: 16px 15px 20px; color: var(--v1-text); font-size: 17px; }.d-task, .m-task { display: flex; align-items: center; gap: 10px; background: var(--v1-surface); }.d-task { height: 57px; margin: 0 14px 8px; padding: 9px; border: 1px solid var(--v1-border); border-radius: 12px; }.task-icon { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--v1-brand-soft); }.d-task strong, .d-task small, .m-task strong, .m-task small { display: block; line-height: 1.45; }.d-task strong { font-size: 13px; }.d-task small { color: var(--v1-muted); font-size: 11px; }
.d-word { position: absolute; left: 695px; top: 320px; width: 216px; height: 193px; padding: 20px; transform: rotate(-5deg); border-radius: 22px; background: var(--v1-surface); box-shadow: 0 14px 38px color-mix(in srgb, var(--v1-text) 14%, transparent); }.word-label { display: inline-block; padding: 5px 14px; border-radius: 16px; background: var(--v1-brand-soft); color: var(--v1-brand); font: 600 12px/22px var(--v1-font-display); }.d-word > strong { display: block; margin-top: 10px; color: var(--v1-text); font: 600 42px/1.15 var(--v1-font-display); }.d-word > small { color: var(--v1-muted); font-size: 12px; }.word-listen { display: flex; gap: 8px; align-items: center; margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--v1-border); color: var(--v1-brand); font-size: 13px; font-weight: 600; }.d-latte { position: absolute; left: 128px; top: 65px; }
.d-streak { position: absolute; left: 1133px; top: 492px; display: flex; align-items: flex-start; gap: 14px; width: 234px; height: 104px; padding: 21px 18px; border-radius: 19px; background: var(--v1-surface); box-shadow: 0 14px 35px color-mix(in srgb, var(--v1-text) 12%, transparent); }.streak-icon { display: grid; flex: none; place-items: center; width: 49px; height: 49px; border-radius: 14px; background: var(--v1-brand-soft); }.d-streak strong, .d-streak small { display: block; }.d-streak strong { font-size: 17px; }.d-streak small { color: var(--v1-muted); font-size: 12px; white-space: nowrap; }.d-stamp { left: 735px; top: 80px; transform: rotate(-7deg); }
.mobile-illustration { display: none; }
:global(html[data-theme="high-contrast"]) .hero-eyebrow, :global(html[data-theme="high-contrast"]) .d-phone, :global(html[data-theme="high-contrast"]) .d-word, :global(html[data-theme="high-contrast"]) .d-streak, :global(html[data-theme="high-contrast"]) .m-phone, :global(html[data-theme="high-contrast"]) .m-word, :global(html[data-theme="high-contrast"]) .m-streak { outline: 1px solid var(--v1-border); outline-offset: -1px; }
@media (max-width: 1100px) and (min-width: 901px) { .hero-inner { height: 700px; }.hero-copy { margin-left: 32px; padding-top: 110px; } h1 { font-size: 54px; } h1 span + span { font-size: 46px; }.hero-intro { font-size: 16px; }.desktop-illustration { left: auto; width: 1440px; transform: scale(.72); transform-origin: right top; } }
@media (max-width: 900px) {
  .hero-inner { width: min(100%, 390px); height: 867px; }.hero-copy { margin-left: 24px; padding-top: 36px; }.hero-eyebrow { width: 252px; height: 29px; padding: 0 12px; font-size: 11px; }.hero-eyebrow::before { display: none; }.hero-eyebrow img { display: block; }
  h1 { margin-top: 31px; font-size: 42px; line-height: 56px; letter-spacing: -.035em; }h1 span + span { font-size: 36px; line-height: 52px; }h1 span + span::after { display: none; }.hero-intro { margin-top: 19px; font-size: 14px; line-height: 26px; }.hero-actions { gap: 12px; margin-top: 29px; }.hero-actions a, .hero-actions button { height: 52px; font-size: 15px; }.hero-primary { width: 188px; }.hero-secondary { width: 142px; }.hero-note { margin: 17px 0 0 2px; font-size: 12px; }.hero-note img { display: none; }.hero-motto { margin-top: 23px; font-size: 22px; opacity: .72; }
  .desktop-action-icon { display: none; }.mobile-action-icon { display: block; }.desktop-illustration { display: none; }.mobile-illustration { display: block; }.mobile-illustration img { max-width: none; }.m-decor, .m-stamp { position: absolute; }.m-e1 { left: 60px; top: 380px; }.m-e2 { left: 250px; top: 615px; }.m-ring { left: 243px; top: 428px; }.m-star1 { left: 324px; top: 448px; }.m-star2 { left: 19px; top: 758px; }.m-glimmer1 { left: 316px; top: 699px; }.m-glimmer2 { left: 37px; top: 712px; }.m-stamp { left: 276px; top: 388px; transform: rotate(6deg); }
  .m-phone { position: absolute; left: 66px; top: 445px; width: 258px; height: 357px; padding: 9px; border-radius: 27px; background: var(--v1-surface); box-shadow: 0 12px 32px color-mix(in srgb, var(--v1-text) 18%, transparent); }.m-screen { height: 339px; overflow: hidden; border-radius: 20px; background: var(--v1-bg); }.m-head { height: 116px; padding: 9px 14px; border-radius: 20px; background: linear-gradient(125deg, var(--v1-brand-strong), var(--v1-brand)); color: var(--v1-on-brand); }.m-status { font-size: 10px; }.m-head p { margin-top: 22px; color: inherit; font-size: 15px; }.m-head small { display: block; margin-top: 12px; font-size: 12px; }.m-today { margin: 15px 12px 0; }.m-today > strong, .m-today > small { display: block; }.m-today > strong { font-size: 17px; line-height: 25px; }.m-today > small { color: var(--v1-muted); font-size: 11px; }.m-task { height: 48px; margin: 20px 10px 0; padding: 8px 9px; border-radius: 12px; }.m-task + .m-task { margin-top: 8px; }.m-task .task-icon { width: 31px; height: 31px; border-radius: 9px; }.m-task strong { font-size: 13px; }.m-task small { color: var(--v1-muted); font-size: 10px; }
  .m-word { position: absolute; left: 0; top: 650px; width: 122px; height: 126px; padding: 15px 16px; transform: rotate(5deg); border-radius: 17px; background: var(--v1-surface); box-shadow: 0 12px 18px color-mix(in srgb, var(--v1-text) 14%, transparent); }.m-word > span { color: var(--v1-brand); font: 600 11px/1 var(--v1-font-display); }.m-word strong { display: block; margin-top: 19px; color: var(--v1-text); font: 600 30px/1 var(--v1-font-display); }.m-word small { display: block; margin-top: 12px; color: var(--v1-muted); font-size: 11px; }.m-word img { position: absolute; left: 82px; top: 48px; }.m-streak { position: absolute; left: 224px; top: 793px; display: flex; align-items: center; gap: 10px; width: 152px; height: 64px; padding: 0 15px; border-radius: 16px; background: var(--v1-surface); box-shadow: 0 12px 20px color-mix(in srgb, var(--v1-text) 16%, transparent); }.m-streak strong, .m-streak small { display: block; line-height: 1.5; }.m-streak strong { font-size: 16px; }.m-streak small { color: var(--v1-muted); font-size: 10px; white-space: nowrap; }
}
@media (max-width: 360px) { .hero-actions { gap: 8px; }.hero-primary { width: 52%; }.hero-secondary { width: 40%; }.hero-inner { transform-origin: top center; }.m-phone { left: calc(50% - 129px); }.m-streak { left: auto; right: 14px; }.m-stamp { left: auto; right: 20px; } }
</style>
