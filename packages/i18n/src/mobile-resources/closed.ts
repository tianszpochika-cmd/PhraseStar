/** Closed-practice copy requested by DSH. Callers use mobileT('closed.…'); mobileT adds the mobile. prefix. */
export function closedCopy(en: boolean) {
  return en ? {
    comingSoon: 'Coming soon',
    backToAvailableLearning: 'Back to available learning',
    alternatives: {
      title: 'Try these first',
      vocab: 'Review a word set',
      vocabMeta: 'About 5 min',
      reading: 'Read a short passage',
      readingMeta: 'About 4 min',
    },
    offline: {
      navTitle: 'Offline packs',
      title: 'Take learning with you',
      subtitle: 'Download packs and learn without a network',
      cardTitle: 'Offline downloads are coming soon',
      reason: "Learning content currently needs a network connection. Once available, you'll be able to save packs on your phone.",
      queue: {
        title: 'Pending sync',
        count: '{count} items',
        reason: 'Offline records are stored on this device and can be synced again when the network returns.',
        item: 'Study-room interaction',
        syncNow: 'Sync now',
        status: { pending: 'Pending', syncing: 'Syncing', failed: 'Sync failed', unknown: 'Unknown' },
      },
    },
    writing: {
      navTitle: 'Writing practice',
      title: 'Writing practice is not open yet',
      reason: 'Translation, imitation writing and reference answers are planned; AI feedback is not available now.',
    },
    b3Listening: { navTitle: 'Listening practice', title: 'Listening practice is not open yet' },
    listening: { reason: 'Listening materials are still being prepared. Once available, you can listen in segments, loop them and write down what you hear.' },
    b11Listening: { navTitle: 'Listening & clips', title: 'Listening & clips are coming soon' },
    b3Speaking: {
      navTitle: 'Speaking & phonetics',
      title: 'Shadowing and recording are not open yet',
      reason: 'Shadowing and recording are being prepared. Once open, you can record and listen back; this does not represent AI scoring.',
    },
    b11Speaking: {
      navTitle: 'Shadowing',
      title: 'Shadowing is coming soon',
      reason: 'Recording feedback is still being prepared. Once available, you can shadow the demo, record your voice and compare it.',
    },
  } : {
    comingSoon: '即将开放',
    backToAvailableLearning: '回到可用学习',
    alternatives: {
      title: '可以先练这些',
      vocab: '先做一组单词复习',
      vocabMeta: '约 5 分钟',
      reading: '读一篇短文',
      readingMeta: '约 4 分钟',
    },
    offline: {
      navTitle: '离线包',
      title: '把学习，带在身边',
      subtitle: '下载内容包，没网也能学',
      cardTitle: '离线下载即将开放',
      reason: '目前学习内容需联网读取，上线后可以把内容包存到手机上。',
      queue: {
        title: '待同步',
        count: '{count} 条',
        reason: '离线记录保存在本机，网络恢复后可重试同步。',
        item: '自习室互动',
        syncNow: '立即同步',
        status: { pending: '待同步', syncing: '同步中', failed: '同步失败', unknown: '待确认' },
      },
    },
    writing: {
      navTitle: '写作练习',
      title: '写作自练暂未开放',
      reason: '将提供翻译、仿写与参考答案对照；当前不提供 AI 批改。',
    },
    b3Listening: { navTitle: '听力精练', title: '听力练习暂未开放' },
    listening: { reason: '听力素材还在准备中，上线后可以分段听、循环听，再写下听到的内容。' },
    b11Listening: { navTitle: '听力与片段', title: '听力与片段即将开放' },
    b3Speaking: {
      navTitle: '口语与音标',
      title: '跟读与录音暂未开放',
      reason: '跟读与录音功能正在准备；开放后可录音回听，不代表 AI 评分。',
    },
    b11Speaking: {
      navTitle: '影子跟读',
      title: '影子跟读即将开放',
      reason: '录音评分还在准备中，上线后可以跟读示范、录下自己的声音并回听对比。',
    },
  }
}
