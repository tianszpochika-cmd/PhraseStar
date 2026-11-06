/** Legacy practice page copy. mobileT('legacyPracticePage.…') adds the mobile. prefix. */
export function legacyPracticePageCopy(en: boolean) {
  return en ? {
    retiredTitle: 'The old combined practice is retired',
    retiredBody: 'You can practise the items below. Updated content will appear here.',
    unavailableTitle: 'Practice cannot be opened right now',
    unavailableBody: 'Check the network connection. Confirm any unsent answers after you reconnect.',
    backHome: 'Back to home',
  } : {
    retiredTitle: '旧的综合练习已经下线',
    retiredBody: '可以先练下面这些，内容更新后会出现在这里。',
    unavailableTitle: '练习暂时打不开',
    unavailableBody: '请检查网络连接。未确认的答案请联网后核对。',
    backHome: '返回学习首页',
  }
}
