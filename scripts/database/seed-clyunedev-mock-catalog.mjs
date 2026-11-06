// clyunedev round-2 MOCK catalog (pre-release only, all rows tagged TEST/MOCK).
// Emits SQL on stdout; pipe it into the clyunedev MySQL container:
//   node scripts/database/seed-clyunedev-mock-catalog.mjs        | ssh root@host 'docker exec -i cloudstudy-clyunedev-mysql-1 sh -c "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\""'
//   node scripts/database/seed-clyunedev-mock-catalog.mjs --wipe | (same pipe)   # removes every MOCK row
// Namespace: content_code 'MOCK-R2-%', content_id 'mock-r2-content-%',
// content_version_id 279001..279999, unit_id 'mock-r2-unit-%', item_id 'mock-r2-item-%',
// titles prefixed "[TEST] ", rights_source_code 'CLYUNEDEV_MOCK'. Never run against production.
import { contentPayloadHash } from './local-real-10x-fixture.mjs';

const TENANT = 'platform';
const q = (v) => `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const j = (v) => q(JSON.stringify(v));
const NOW = 'UTC_TIMESTAMP(6)';

const wipe = [
  `DELETE FROM content_service.b25_content_item WHERE content_code LIKE 'MOCK-R2-%';`,
  `DELETE FROM content_service.b25_content_unit WHERE course_code LIKE 'MOCK-R2-%';`,
  `DELETE FROM content_service.b25_content_course WHERE content_code LIKE 'MOCK-R2-%';`,
  `DELETE FROM content_service.content_b3_item_binding WHERE b3_experience_id LIKE 'mock-r2-b3-%';`,
  `DELETE FROM content_service.b3_content_experience WHERE experience_id LIKE 'mock-r2-b3-%';`,
  `UPDATE content_service.content_definition SET current_published_version_id = NULL WHERE content_id LIKE 'mock-r2-content-%';`,
  `DELETE FROM content_service.content_version WHERE content_version_id BETWEEN 279001 AND 279999;`,
  `DELETE FROM content_service.content_definition WHERE content_id LIKE 'mock-r2-content-%';`,
];

const V = (term, def, ex) => ({ term, definition: def, example: ex, text: `${term} — ${def} · ${ex}` });
const S = (en, zh) => ({ text: `${en} / ${zh}`, translation: zh, sentence: en });

const C = [];
const add = (skill, kind, level, title, summary, items, extra = {}) =>
  C.push({ skill, kind, level, title: `[TEST] ${title}`, summary: `${summary}（测试数据）`, items, extra });

// Vocabulary (6)
add('VOCAB', 'VOCABULARY', 'A1', 'Daily routine words', 'Ten everyday verbs and nouns for describing a day.', [
  V('wake up', '醒来', 'I wake up at 6:30.'), V('brush', '刷', 'I brush my teeth after breakfast.'), V('commute', '通勤', 'My commute takes forty minutes.'),
  V('lunch break', '午休', 'We chat during the lunch break.'), V('tired', '累的', 'I feel tired after work.'), V('early', '早的', 'She goes to bed early.')]);
add('VOCAB', 'VOCABULARY', 'A1', 'Food and drinks', 'Order food and talk about what you like.', [
  V('noodles', '面条', 'I have noodles for lunch.'), V('spicy', '辣的', 'This soup is too spicy.'), V('menu', '菜单', 'Can I see the menu?'),
  V('bill', '账单', 'Could we have the bill, please?'), V('vegetable', '蔬菜', 'Eat more vegetables.')]);
add('VOCAB', 'VOCABULARY', 'A2', 'Travel and transport', 'Words for airports, trains and asking the way.', [
  V('boarding pass', '登机牌', 'Please show your boarding pass.'), V('delay', '延误', 'The flight has a two-hour delay.'), V('platform', '站台', 'The train leaves from platform 3.'),
  V('round trip', '往返', 'A round trip ticket is cheaper.'), V('luggage', '行李', 'My luggage is too heavy.'), V('transfer', '换乘', 'Transfer to Line 2 at People\'s Square.')]);
add('VOCAB', 'VOCABULARY', 'A2', 'At the office', 'Common workplace nouns and verbs.', [
  V('deadline', '截止日期', 'The deadline is Friday.'), V('colleague', '同事', 'My colleague helped me.'), V('schedule', '日程', 'Let me check my schedule.'),
  V('submit', '提交', 'Please submit the report today.'), V('meeting room', '会议室', 'The meeting room is booked.')]);
add('VOCAB', 'VOCABULARY', 'B1', 'Health and fitness', 'Talk about exercise, sleep and habits.', [
  V('stretch', '拉伸', 'Stretch before you run.'), V('balanced diet', '均衡饮食', 'A balanced diet keeps you healthy.'), V('injury', '受伤', 'He has a knee injury.'),
  V('routine', '惯例', 'Exercise is part of my routine.'), V('recover', '恢复', 'It takes a week to recover.')]);
add('VOCAB', 'VOCABULARY', 'B2', 'CET-6 high-frequency words', 'Academic words that appear often in exams.', [
  V('significant', '显著的', 'There was a significant increase.'), V('sustainable', '可持续的', 'We need sustainable growth.'), V('controversial', '有争议的', 'It is a controversial decision.'),
  V('allocate', '分配', 'Allocate time for review.'), V('perspective', '观点', 'Consider another perspective.'), V('inevitable', '不可避免的', 'Change is inevitable.')]);
// Grammar (5)
const G = (rule, exs) => [{ text: `规则：${rule}` }, ...exs.map((e) => ({ text: e }))];
add('GRAMMAR', 'GRAMMAR', 'A1', 'Present simple for habits', 'Subject + base verb; add -s for he/she/it.', G('主语 + 动词原形（第三人称单数加 -s）', ['He drinks coffee every morning.', 'They walk to work.', 'She doesn\'t eat meat.']), { rule: 'subject + base verb(s)' });
add('GRAMMAR', 'GRAMMAR', 'A1', 'There is / there are', 'Describe what exists in a place.', G('单数用 there is，复数用 there are', ['There is a bank near my home.', 'There are three chairs in the room.']), { rule: 'there is/are + noun' });
add('GRAMMAR', 'GRAMMAR', 'A2', 'Past simple: regular and irregular', 'Talk about finished actions in the past.', G('动词过去式；否定用 didn\'t + 原形', ['I visited my parents last weekend.', 'We went to Hangzhou in May.', 'She didn\'t call me yesterday.']), { rule: 'verb-ed / irregular past' });
add('GRAMMAR', 'GRAMMAR', 'B1', 'Present perfect vs past simple', 'Experience and unfinished time vs finished time.', G('have/has + 过去分词 表经历或持续', ['I have lived here for five years.', 'I lived in Beijing in 2019.', 'Have you ever tried hot pot?']), { rule: 'have/has + past participle' });
add('GRAMMAR', 'GRAMMAR', 'B2', 'Conditionals 1–3', 'Real, unreal present and unreal past conditions.', G('If + 现在/过去/过去完成，主句对应 will/would/would have', ['If it rains, we will stay in.', 'If I had more time, I would learn French.', 'If I had left earlier, I would have caught the train.']), { rule: 'if-clause + result' });
// Graded reading (5)
const R = (pairs) => pairs.map(([en, zh]) => S(en, zh));
add('READING', 'COURSE_UNIT', 'A1', 'Graded reading: My new neighbour', 'A 120-word story about meeting a neighbour.', R([['Anna moved into the flat next to mine last week.', '安娜上周搬进了我隔壁的公寓。'], ['She is a nurse and works at night.', '她是护士，上夜班。'], ['On Sunday she gave me a cake she made herself.', '周日她送了我一个她亲手做的蛋糕。'], ['Now we drink tea together on weekends.', '现在我们周末一起喝茶。']]));
add('READING', 'COURSE_UNIT', 'A2', 'Graded reading: A weekend in Suzhou', 'Travel diary with simple past tense.', R([['We took the high-speed train to Suzhou on Saturday.', '周六我们坐高铁去了苏州。'], ['The gardens were quiet in the early morning.', '清晨的园林很安静。'], ['In the afternoon it rained, so we visited a museum.', '下午下雨了，所以我们去了博物馆。'], ['I want to go back in autumn.', '我想秋天再去。']]));
add('READING', 'COURSE_UNIT', 'B1', 'Graded reading: Working from home', 'Pros and cons of remote work.', R([['More companies now let staff work from home two days a week.', '现在更多公司允许员工每周在家办公两天。'], ['Many people save time because they do not commute.', '许多人因为不用通勤而节省时间。'], ['However, some feel lonely and find it hard to switch off.', '然而有些人感到孤独，难以下班后放松。'], ['A clear routine helps separate work and rest.', '清晰的作息有助于区分工作和休息。']]));
add('READING', 'COURSE_UNIT', 'B1', 'Graded reading: The coffee shop owner', 'A short profile of a small business owner.', R([['Li Wei opened his coffee shop three years ago.', '李伟三年前开了一家咖啡店。'], ['At first he had only five customers a day.', '起初他每天只有五个顾客。'], ['He started teaching free latte-art classes on Fridays.', '他开始每周五开设免费拉花课。'], ['Now the shop is full every weekend.', '现在店里每个周末都满座。']]));
add('READING', 'COURSE_UNIT', 'B2', 'Graded reading: Sleep and memory', 'Popular-science article about sleep.', R([['Scientists have long suspected that sleep helps us remember.', '科学家们早就怀疑睡眠有助于记忆。'], ['During deep sleep, the brain replays what we learned during the day.', '深度睡眠时，大脑会重放白天学到的内容。'], ['Students who slept after studying recalled 20% more words.', '学习后睡觉的学生多记住了 20% 的单词。'], ['Reviewing before bed may therefore be a smart habit.', '因此睡前复习可能是个明智的习惯。']]));
// Listening (4)
add('LISTENING', 'COURSE_UNIT', 'A1', 'Listening: Ordering coffee', 'Short café dialogue (transcript provided).', R([['Hi, can I get a small latte, please?', '你好，我要一杯小杯拿铁。'], ['Sure. For here or to go?', '好的，堂食还是外带？'], ['To go, please.', '外带，谢谢。'], ['That\'s 28 yuan.', '一共 28 元。']]), { transcript: 'Hi, can I get a small latte, please? Sure. For here or to go? To go, please. That\'s 28 yuan.', durationSeconds: 25 });
add('LISTENING', 'COURSE_UNIT', 'A2', 'Listening: Train announcement', 'Station announcement with times and platforms.', R([['The 9:15 train to Nanjing is now boarding at platform 4.', '9:15 开往南京的列车正在 4 号站台检票。'], ['Passengers for Wuxi, please change at Suzhou.', '去无锡的旅客请在苏州换乘。'], ['Please keep your ticket ready.', '请准备好车票。']]), { transcript: 'The 9:15 train to Nanjing is now boarding at platform 4.', durationSeconds: 30 });
add('LISTENING', 'COURSE_UNIT', 'B1', 'Listening: Job interview', 'Interview questions and model answers.', R([['Tell me a little about yourself.', '简单介绍一下你自己。'], ['I have four years of experience in customer support.', '我有四年客服经验。'], ['Why do you want this job?', '你为什么想要这份工作？'], ['I enjoy solving problems and learning new tools.', '我喜欢解决问题和学习新工具。']]), { transcript: 'Tell me a little about yourself...', durationSeconds: 60 });
add('LISTENING', 'COURSE_UNIT', 'B2', 'Listening: Podcast on habits', 'Two hosts discuss building habits.', R([['The trick is to make the habit so small you cannot say no.', '诀窍是把习惯变得小到你无法拒绝。'], ['Two minutes of reading is better than none.', '读两分钟总比不读好。'], ['Over time, small wins add up.', '久而久之，小胜利会积累起来。']]), { transcript: 'The trick is to make the habit so small...', durationSeconds: 90 });
// Speaking (4)
add('SPEAKING', 'PHRASE', 'A1', 'Speaking: Introduce yourself', 'Say your name, job and one hobby.', R([['Hi, I\'m Chen. Nice to meet you.', '你好，我是陈。很高兴认识你。'], ['I work as a designer.', '我是一名设计师。'], ['In my free time I play badminton.', '空闲时我打羽毛球。']]));
add('SPEAKING', 'PHRASE', 'A2', 'Speaking: Asking for directions', 'Polite questions and landmarks.', R([['Excuse me, how do I get to the subway station?', '打扰一下，地铁站怎么走？'], ['Go straight and turn left at the second light.', '直走，在第二个红绿灯左转。'], ['Is it far from here?', '离这里远吗？']]));
add('SPEAKING', 'PHRASE', 'B1', 'Speaking: Making a complaint', 'Explain a problem and ask for a solution.', R([['I\'m afraid there\'s a problem with my order.', '恐怕我的订单有问题。'], ['The item arrived damaged.', '商品到货时已损坏。'], ['Could you send a replacement or give me a refund?', '能换一个或者退款吗？']]));
add('SPEAKING', 'PHRASE', 'B2', 'Speaking: Giving opinions in meetings', 'Agree, disagree and suggest politely.', R([['I see your point, but I think we should test it first.', '我明白你的意思，但我认为应该先测试。'], ['What if we split the project into two phases?', '如果我们把项目分成两个阶段呢？'], ['That sounds reasonable to me.', '这听起来很合理。']]));
// Writing (4)
add('WRITING', 'SENTENCE', 'A2', 'Writing: A short email to a colleague', 'Ask for help with a clear subject and closing.', R([['Subject: Quick question about the report', '主题：关于报告的一个小问题'], ['Hi Tom, could you check page 3 when you have time?', '汤姆你好，有空帮我看看第 3 页吗？'], ['Thanks a lot, Mei', '非常感谢，梅']]));
add('WRITING', 'SENTENCE', 'B1', 'Writing: Describe a chart', 'Use rise, fall and remain stable.', R([['Sales rose sharply in March.', '三月销售额急剧上升。'], ['They remained stable from April to June.', '四到六月保持稳定。'], ['Overall, the trend was positive.', '总体趋势是积极的。']]));
add('WRITING', 'SENTENCE', 'B1', 'Writing: Opinion paragraph', 'Thesis, reason, example, conclusion.', R([['In my opinion, cities should have more bike lanes.', '我认为城市应该有更多自行车道。'], ['First, cycling reduces traffic jams.', '首先，骑车能减少交通拥堵。'], ['For example, Copenhagen has very little congestion.', '例如，哥本哈根几乎不堵车。'], ['Therefore, bike lanes are a smart investment.', '因此，自行车道是明智的投资。']]));
add('WRITING', 'SENTENCE', 'B2', 'Writing: CET-6 essay template', 'Structure for an argumentative essay.', R([['Nowadays, there is a heated debate about...', '如今，关于……有激烈的争论。'], ['Those who support it argue that...', '支持者认为……'], ['From my perspective, a balanced approach is needed.', '在我看来，需要一种平衡的方式。']]));


// ---- B3 experiences (reading articles/questions/dictionary, grammar points, writing prompts) ----
const B3V = 279900;
const ARTICLES = [
  [27801, 'A1', 'My new neighbour', [['Anna moved into the flat next to mine last week.', '安娜上周搬进了我隔壁的公寓。'], ['She is a nurse and works at night.', '她是护士，上夜班。'], ['On Sunday she gave me a cake she made herself.', '周日她送了我一个她亲手做的蛋糕。']], ['What is Anna\'s job?', ['A nurse', 'A teacher', 'A cook'], 'A'], ['neighbour', '邻居', 'noun']],
  [27802, 'A2', 'A weekend in Suzhou', [['We took the high-speed train to Suzhou on Saturday.', '周六我们坐高铁去了苏州。'], ['The gardens were quiet in the early morning.', '清晨的园林很安静。'], ['In the afternoon it rained, so we visited a museum.', '下午下雨了，所以我们去了博物馆。']], ['Why did they visit a museum?', ['It rained', 'It was closed', 'They were tired'], 'A'], ['museum', '博物馆', 'noun']],
  [27803, 'B1', 'Working from home', [['More companies now let staff work from home two days a week.', '现在更多公司允许员工每周在家办公两天。'], ['Many people save time because they do not commute.', '许多人因为不用通勤而节省时间。'], ['However, some feel lonely and find it hard to switch off.', '然而有些人感到孤独，难以下班后放松。']], ['What problem do some remote workers have?', ['They feel lonely', 'They earn less', 'They commute more'], 'A'], ['commute', '通勤', 'verb']],
  [27804, 'B1', 'The coffee shop owner', [['Li Wei opened his coffee shop three years ago.', '李伟三年前开了一家咖啡店。'], ['He started teaching free latte-art classes on Fridays.', '他开始每周五开设免费拉花课。'], ['Now the shop is full every weekend.', '现在店里每个周末都满座。']], ['What did Li Wei start doing on Fridays?', ['Teaching latte art', 'Closing early', 'Selling cakes'], 'A'], ['owner', '店主', 'noun']],
  [27805, 'B2', 'Sleep and memory', [['Scientists have long suspected that sleep helps us remember.', '科学家们早就怀疑睡眠有助于记忆。'], ['During deep sleep, the brain replays what we learned during the day.', '深度睡眠时，大脑会重放白天学到的内容。'], ['Reviewing before bed may therefore be a smart habit.', '因此睡前复习可能是个明智的习惯。']], ['What happens during deep sleep?', ['The brain replays learning', 'We forget everything', 'The heart stops'], 'A'], ['replay', '重放', 'verb']],
];
const GPOINTS = [
  [27811, 'MOCK_PRESENT_SIMPLE', '一般现在时（测试）', 'A1', 'subject + base verb(s)', '表示习惯和事实'],
  [27812, 'MOCK_PAST_SIMPLE', '一般过去时（测试）', 'A2', 'subject + verb-ed', '表示过去完成的动作'],
  [27813, 'MOCK_PRESENT_PERFECT', '现在完成时（测试）', 'B1', 'have/has + past participle', '表示经历或持续到现在'],
];
const WPROMPTS = [
  [27821, 'TRANSLATION', '[TEST] 翻译：坚持每天学习', '把“每天学一点，比偶尔学很多更有效”翻译成英文。', ['a little every day', 'more effective']],
  [27822, 'EMAIL', '[TEST] 写一封请假邮件', 'Write a short email to your manager asking for one day off next Friday.', ['subject', 'reason', 'polite closing']],
  [27823, 'ESSAY', '[TEST] 观点段落：城市骑行', 'Write a paragraph: should cities build more bike lanes? Give one reason and one example.', ['thesis', 'reason', 'example']],
];
const b3 = [];
const b3row = (domain, type, key, payload) => b3.push({ domain, type, key: String(key), payload: { ...payload, contentVersionId: B3V, mock: true } });
for (const [id, level, title, blocks, [stem, opts, ans], [lemma, zh, pos]] of ARTICLES) {
  b3row('READING', 'READING_ARTICLE', id, { articleId: id, title: `[TEST] ${title}`, cefrLevel: level, rightsStatus: 'AUTHORIZED', estimatedMinutes: 3, wordCount: blocks.reduce((n, [en]) => n + en.split(' ').length, 0), blocks: blocks.map(([text, translation], i) => ({ blockId: `block-${i + 1}`, blockIndex: i, text, translation, tokens: [] })) });
  b3row('READING', 'READING_QUESTION', id + 100, { questionId: id + 100, articleId: id, stemText: stem, questionType: 'DETAIL', options: opts.map((label, i) => ({ optionCode: 'ABC'[i], label })) });
  b3row('READING', 'DICTIONARY_ENTRY', `${id}:${lemma}`, { articleId: id, tokenId: lemma, lemma, meaningCn: zh, partOfSpeech: pos, exampleText: blocks[0][0] });
}
for (const [id, code, title, level, rule, zh] of GPOINTS) b3row('GRAMMAR', 'GRAMMAR_POINT', id, { grammarPointId: id, code, title, cefrLevel: level, ruleFormula: rule, meaningCn: zh, trapTags: ['测试数据'] });
for (const [id, type, title, task, structure] of WPROMPTS) b3row('WRITING', 'WRITING_PROMPT', id, { promptId: id, promptType: type, title, taskText: task, targetStructure: structure });

export const COURSES = C;

const out = ['SET NAMES utf8mb4;', 'START TRANSACTION;', ...wipe];
if (!process.argv.includes('--wipe')) {
  C.forEach((c, i) => {
    const n = i + 1;
    const code = `MOCK-R2-${c.skill}-${String(n).padStart(2, '0')}`;
    const contentId = `mock-r2-content-${n}`;
    const versionId = 279000 + n;
    const payload = { title: c.title, summary: c.summary, locale: 'en-US', targetLevel: c.level, skill: c.skill, mock: true, ...c.extra, items: c.items };
    out.push(`INSERT INTO content_service.content_definition (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code, created_by, created_at, current_published_version_id, content_epoch, projection_version) VALUES (${q(contentId)}, '${TENANT}', ${q(code)}, ${q(c.kind)}, ${q(c.title)}, 'en-US', ${q(c.level)}, 'DAILY_ENGLISH', 'clyunedev-mock-r2', ${NOW}, ${versionId}, 1, 1);`);
    out.push(`INSERT INTO content_service.content_version (content_version_id, content_id, version_no, status, copyright_status, payload_hash, published_at, created_at, kind, payload_json, rights_source_code, rights_license_code, rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher, archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version) VALUES (${versionId}, ${q(contentId)}, 1, 'PUBLISHED', 'ACTIVE', ${q(contentPayloadHash(payload))}, ${NOW}, ${NOW}, ${q(c.kind)}, ${j(payload)}, 'CLYUNEDEV_MOCK', 'CLYUNEDEV_MOCK', TRUE, ${q(JSON.stringify(['LEARNER', 'PUBLIC']))}, ${NOW}, NULL, 'clyunedev-mock-r2', 'mock-editor', 'TEST MOCK round-2', 'mock-reviewer-1', 'mock-reviewer-2', 'mock-publisher', NULL, NULL, 1, 1, 1);`);
    out.push(`INSERT INTO content_service.b25_content_course (content_code, tenant_id, content_type, title, summary, content_locale, target_level, content_version_id, availability, rights_status, definition_json, published_at, updated_at) VALUES (${q(code)}, '${TENANT}', 'COURSE', ${q(c.title)}, ${q(c.summary)}, 'en-US', ${q(c.level)}, ${versionId}, 'PUBLISHED', 'VALID', ${j({ fixtureId: 'clyunedev-mock-r2', skill: c.skill, mock: true })}, ${NOW}, ${NOW});`);
    out.push(`INSERT INTO content_service.b25_content_unit (unit_id, course_code, unit_code, unit_order, title_key, content_version, availability, rights_status, published_at) VALUES (${q(`mock-r2-unit-${n}`)}, ${q(code)}, ${q(`mock-r2-u${n}`)}, 1, ${q(c.title)}, 1, 'PUBLISHED', 'VALID', ${NOW});`);
    c.items.forEach((it, k) => out.push(`INSERT INTO content_service.b25_content_item (item_id, content_code, tenant_id, item_type, display_order, prompt, options_json, answer_rule_json, media_ref) VALUES (${q(`mock-r2-item-${n}-${k + 1}`)}, ${q(code)}, '${TENANT}', 'LESSON', ${k + 1}, ${q(it.text)}, '[]', '{}', '');`));
  });
  const b3Payload = { title: '[TEST] clyunedev mock B3 experiences', summary: 'TEST MOCK round-2 B3 rows', locale: 'en-US', targetLevel: 'A1', mock: true, rows: b3.length };
  out.push(`INSERT INTO content_service.content_definition (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code, created_by, created_at, current_published_version_id, content_epoch, projection_version) VALUES ('mock-r2-content-b3', '${TENANT}', 'MOCK-R2-B3', 'COURSE', ${q(b3Payload.title)}, 'en-US', 'A1', 'DAILY_ENGLISH', 'clyunedev-mock-r2', ${NOW}, ${B3V}, 1, 1);`);
  out.push(`INSERT INTO content_service.content_version (content_version_id, content_id, version_no, status, copyright_status, payload_hash, published_at, created_at, kind, payload_json, rights_source_code, rights_license_code, rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher, archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version) VALUES (${B3V}, 'mock-r2-content-b3', 1, 'PUBLISHED', 'ACTIVE', ${q(contentPayloadHash(b3Payload))}, ${NOW}, ${NOW}, 'COURSE', ${j(b3Payload)}, 'CLYUNEDEV_MOCK', 'CLYUNEDEV_MOCK', TRUE, ${q(JSON.stringify(['SEALED']))}, ${NOW}, NULL, 'clyunedev-mock-r2', 'mock-editor', 'TEST MOCK round-2 B3', 'mock-reviewer-1', 'mock-reviewer-2', 'mock-publisher', NULL, NULL, 1, 1, 1);`);
  for (const r of b3) {
    const eid = `mock-r2-b3-${r.type.toLowerCase().replaceAll('_', '-')}-${r.key}`.slice(0, 96);
    out.push(`INSERT INTO content_service.b3_content_experience (experience_id, tenant_id, domain_code, resource_type, resource_key, content_version_id, availability, payload_json) VALUES (${q(eid)}, '${TENANT}', ${q(r.domain)}, ${q(r.type)}, ${q(r.key)}, ${B3V}, 'PUBLISHED', ${j(r.payload)});`);
    out.push(`INSERT INTO content_service.content_b3_item_binding (tenant_id, b3_domain, b3_resource_type, b3_resource_key, b3_experience_id, content_code, content_version_id, question_item_id, status) VALUES ('${TENANT}', ${q(r.domain)}, ${q(r.type)}, ${q(r.key)}, ${q(eid)}, 'MOCK-R2-B3', ${B3V}, ${q(r.key)}, 'ACTIVE');`);
  }
}
out.push('COMMIT;');
out.push(`SELECT CONCAT('mock-r2 courses=', (SELECT COUNT(*) FROM content_service.b25_content_course WHERE content_code LIKE 'MOCK-R2-%'), ' items=', (SELECT COUNT(*) FROM content_service.b25_content_item WHERE content_code LIKE 'MOCK-R2-%'), ' b3=', (SELECT COUNT(*) FROM content_service.b3_content_experience WHERE experience_id LIKE 'mock-r2-b3-%'));`);
process.stdout.write(out.join('\n') + '\n');
