/** Practice page copy. mobileT('practicePage.…') adds the mobile. prefix. */
export function practicePageCopy(en: boolean): Record<string, string> {
  return en ? {
    entryCount: '{count} practice entries',
  } : {
    entryCount: '共 {count} 个练习入口',
  }
}
