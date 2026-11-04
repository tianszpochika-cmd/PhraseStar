/** DSH_PROFILE report page copy. mobileT('reportPage.…') adds the mobile. prefix. Separate from reportSharePage. */
export function reportPageCopy(en: boolean) {
  return en ? {
  "title": "Mistakes & reports",
  "subtitle": "Review by error type; mistakes update after remediation.",
  "status": { "PENDING_RETRY": "To review", "DELAY_VERIFY_D1": "Verify next day", "DELAY_VERIFY_D7": "Verify day 7", "MASTERED": "Mastered", "REOPENED": "Reopened" },
  "mastery": { "NEW": "New", "LEARNING": "Learning", "MASTERED": "Mastered", "CONSOLIDATED": "Consolidated" },
  "tabs": {
    "mistakes": "Mistakes",
    "daily": "Daily",
    "weekly": "Weekly",
    "aria": "Report sections"
  },
  "mistakes": {
    "title": "Mistake book",
    "subtitle": "Review by error type; mistakes update after remediation.",
    "count": "{count} to review",
    "emptyTitle": "No mistakes yet",
    "emptyBody": "Questions answered completely wrong in a practice will appear here.",
    "loading": "Reading mistakes…",
    "retry": "Retry this question",
    "retrying": "Creating remediation…",
    "retryAccepted": "Remediation accepted. The mistake will update after you finish it.",
    "retryFailed": "Remediation did not start. Try again.",
    "detail": "View details",
    "detailTitle": "Mistake details",
    "detailLoading": "Reading details…",
    "detailFailed": "Mistake details are temporarily unavailable.",
    "close": "Close",
    "reason": "Reason",
    "retryBlocked": "This question has already been remediated."
  },
  "report": {
    "dailyTitle": "Today’s learning",
    "weeklyTitle": "This week’s learning",
    "loading": "Reading learning report…",
    "emptyTitle": "No learning records for this period",
    "emptyBody": "New items, reviews, and effective time will appear after you study.",
    "copyUnavailable": "This report has no public summary to show yet.",
    "ruleNote": "This is a rule-based suggestion, not an enabled AI score or suggestion."
  },
  "stats": {
    "new": "New",
    "review": "Review",
    "duration": "Effective study",
    "minutes": "{count} min",
    "notAvailable": "—"
  },
  "period": {
    "range": "{start} to {end}",
    "zone": " ({zone})",
    "zoneShanghai": " (Beijing time)"
  },
  "availability": {
    "ready": "Summary ready",
    "partial": "Partial summary",
    "generating": "Generating",
    "empty": "No records",
    "failed": "Generation failed",
    "unknown": "Status not verified"
  },
  "duration": {
    "missing": "Effective study time is not recorded",
    "notCounted": "Effective study time is not confirmed; it is not shown as zero."
  },
  "suggestion": {
    "prefix": "Suggestion: ",
    "basis": "Basis: ",
    "unknownBasis": "Rule-based suggestion"
  },
  "basis": {
    "MISTAKES": "Practice was answered incorrectly in this period.",
    "DUE_REVIEW": "There are due reviews.",
    "STARTER": "Practice records are limited; this is a starter suggestion.",
    "PARTIAL_FACTS": "Statistics are incomplete.",
    "NOT_READY": "Statistics are not ready.",
    "FAILED": "Report generation failed.",
    "GENERATING": "The report is still generating.",
    "EMPTY_WINDOW": "No new practice records in this period.",
    "START": "Complete one practice first.",
    "UNKNOWN": "The basis is not confirmed."
  },
  "share": {
    "title": "Share this report",
    "explainer": "Create a read-only link. No sign-in is needed to view the public summary.",
    "issue": "Create share link",
    "issueBusy": "Creating…",
    "issued": "Share link created.",
    "revoked": "Share revoked.",
    "revoke": "Revoke share",
    "revokeBusy": "Revoking…",
    "revokeFailed": "Revoke did not complete. Try again.",
    "copy": "Copy share link",
    "preview": "Preview public page",
    "copyUnavailable": "Copy is unavailable without an approved public site.",
    "copied": "Share link copied.",
    "copyFailed": "Copy did not complete. Select the link manually.",
    "failed": "The share was not created. Try again.",
    "invalid": "The share service returned an unexpected response. Nothing was displayed.",
    "masked": "Current link: {ref}",
    "copyHint": "The link contains an access token. Share it only with the intended person."
  },
  "actions": {
    "practice": "Go to practice",
    "login": "Sign in",
    "retry": "Try again",
    "retrying": "Trying again…"
  },
  "noAccess": {
    "title": "Sign in to view mistakes and reports",
    "body": "Your learning records are saved with your account.",
    "login": "Sign in"
  },
  "error": {
    "title": "The mistake book did not open",
    "body": "Check your connection, or try again shortly.",
    "offlineTitle": "Network unavailable",
    "offlineBody": "Try reading mistakes and reports again when the connection returns.",
    "permissionTitle": "Not available",
    "permissionBody": "This account does not have permission to read learning reports."
  },
  "loading": "Reading…"
} : {
  "status": { "PENDING_RETRY": "待巩固", "DELAY_VERIFY_D1": "待次日验证", "DELAY_VERIFY_D7": "待七日验证", "MASTERED": "已掌握", "REOPENED": "重新打开" },
  "mastery": { "NEW": "刚学", "LEARNING": "巩固中", "MASTERED": "已掌握", "CONSOLIDATED": "已巩固" },
  "title": "错题与报告",
  "subtitle": "按错误原因巩固；完成后会更新错题状态。",
  "tabs": {
    "mistakes": "错题本",
    "daily": "日报",
    "weekly": "周报",
    "aria": "学习报告分类"
  },
  "mistakes": {
    "title": "错题本",
    "subtitle": "按错误原因巩固；完成后会更新错题状态。",
    "count": "{count} 道待巩固",
    "emptyTitle": "暂时没有错题",
    "emptyBody": "完成练习后，整次答错的题会出现在这里。",
    "loading": "正在读取错题…",
    "retry": "重练这题",
    "retrying": "正在创建订正…",
    "retryAccepted": "订正已受理。完成订正后会更新错题状态。",
    "retryFailed": "订正没有完成，请稍后重试。",
    "detail": "查看详情",
    "detailTitle": "错题详情",
    "detailLoading": "正在读取详情…",
    "detailFailed": "错题详情暂时无法读取。",
    "close": "关闭",
    "reason": "错因",
    "retryBlocked": "这道题已完成补救。"
  },
  "report": {
    "dailyTitle": "今日学习",
    "weeklyTitle": "本周学习",
    "loading": "正在读取学习报告…",
    "emptyTitle": "这段时间还没有学习记录",
    "emptyBody": "完成一次学习后，这里会出现新学、复习和有效时长。",
    "copyUnavailable": "这份报告暂时没有可展示的公开摘要。",
    "ruleNote": "这是规则建议，不是已开放的 AI 评分或建议。"
  },
  "stats": {
    "new": "新学",
    "review": "复习",
    "duration": "有效学习",
    "minutes": "{count} 分钟",
    "notAvailable": "—"
  },
  "period": {
    "range": "{start} 至 {end}",
    "zone": "（{zone}）",
    "zoneShanghai": "（北京时间）"
  },
  "availability": {
    "ready": "已汇总",
    "partial": "部分汇总",
    "generating": "生成中",
    "empty": "暂无记录",
    "failed": "生成失败",
    "unknown": "状态未验证"
  },
  "duration": {
    "missing": "有效学习时长未记录",
    "notCounted": "有效学习时长尚未确认，未按 0 分钟显示。"
  },
  "suggestion": {
    "prefix": "建议：",
    "basis": "依据：",
    "unknownBasis": "规则建议"
  },
  "basis": {
    "MISTAKES": "这段时间有答错的练习。",
    "DUE_REVIEW": "有到期的复习。",
    "STARTER": "练习记录还少，这是起步建议。",
    "PARTIAL_FACTS": "统计尚不完整。",
    "NOT_READY": "统计尚未就绪。",
    "FAILED": "报告生成失败。",
    "GENERATING": "报告仍在生成。",
    "EMPTY_WINDOW": "这段时间没有新的练习记录。",
    "START": "先完成一次练习。",
    "UNKNOWN": "依据尚未确认。"
  },
  "share": {
    "title": "分享学习报告",
    "explainer": "生成只读链接，对方无需登录即可查看公开摘要。",
    "issue": "生成分享链接",
    "issueBusy": "正在生成…",
    "issued": "分享链接已生成。",
    "revoked": "分享已撤销。",
    "revoke": "撤销分享",
    "revokeBusy": "正在撤销…",
    "revokeFailed": "撤销没有完成，请稍后重试。",
    "copy": "复制分享链接",
    "preview": "预览公开页",
    "copyUnavailable": "当前环境没有可用的公开站点，无法复制链接。",
    "copied": "分享链接已复制。",
    "copyFailed": "复制没有完成，请手动选择链接。",
    "failed": "分享没有生成，请重试。",
    "invalid": "分享服务返回的内容不符合约定，已停止展示。",
    "masked": "当前链接：{ref}",
    "copyHint": "链接包含访问凭证，请只分享给需要的人。"
  },
  "actions": {
    "practice": "去练习",
    "login": "去登录",
    "retry": "重试",
    "retrying": "正在重试…"
  },
  "noAccess": {
    "title": "登录后查看错题与报告",
    "body": "你的学习记录跟着账号保存。",
    "login": "去登录"
  },
  "error": {
    "title": "错题本暂时没打开",
    "body": "请检查网络连接，或稍后重试。",
    "offlineTitle": "网络暂时不可用",
    "offlineBody": "连接恢复后可以重新读取错题与报告。",
    "permissionTitle": "暂时无法查看",
    "permissionBody": "当前账号没有读取学习报告的权限。"
  },
  "loading": "正在读取…"
}
}
