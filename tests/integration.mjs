import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SignJWT } from 'jose';
if (process.env.ISOLATED_INTEGRATION !== '1') throw new Error('请通过 npm run test:integration 使用独立临时数据库，不能针对课程预览直接运行。');
const base = process.env.TEST_BASE_URL;
if (base !== 'http://127.0.0.1:3011') throw new Error('API 测试仅允许使用 INT6136P 独立测试端口 3011。');
const clients = new Map();
async function request(who, method, payload, query = '', expected = 200) {
  const r = await fetch(base + '/api/studio' + query, { method, headers: { 'Content-Type': 'application/json', Origin: base, Cookie: clients.get(who) || '' }, body: method === 'POST' ? JSON.stringify(payload) : undefined });
  const cookie = r.headers.get('set-cookie'); if (cookie) { assert.ok(cookie.startsWith('int6136p-session=')); clients.set(who, cookie.split(';')[0]); }
  const body = await r.json(); assert.equal(r.status, expected, `操作 ${payload?.action || query} 返回异常：${JSON.stringify(body)}`);
  if (body.error) assert.ok(/[\u3400-\u9fff]/u.test(body.error), '错误提示须为中文');
  if (body.details) assert.ok(body.details.every(message => /[\u3400-\u9fff]/u.test(message)), '校验详情须为中文');
  return body;
}
async function checkStep(who, step, blocked) {
  const r = await request(who, 'POST', { action: 'checkStep', step }, '', blocked ? 422 : 200);
  if (blocked) { assert.equal(r.blockedStep, blocked); assert.ok(r.details.length); } else assert.equal(r.ok, true);
}
async function patch(patch) {
  const current = await request('alice', 'GET');
  await request('alice', 'POST', { action: 'draft', revision: current.group.revision, patch });
  return request('alice', 'GET');
}
await request('anon', 'GET', null, '', 401);
await request('anon', 'POST', { action: 'checkStep', step: 'review' }, '', 401);
await request('teacher', 'POST', { action: 'login', group: 'Nicole', password: 'wrong' }, '', 401);
await request('teacher', 'POST', { action: 'login', group: 'Nicole', password: process.env.TEST_TEACHER_PASSWORD });
await request('teacher', 'POST', { action: 'checkStep', step: 'review' }, '', 403);
let classroom = await request('teacher', 'GET');
assert.deepEqual(classroom.groups.map(g => g.id), Array.from({ length: 27 }, (_, i) => i + 1)); assert.equal(classroom.groups[0].name, '獅子山上的青春'); assert.equal(classroom.groups[24].name, '缘聚大埔山，科技赴新程'); assert.equal(classroom.groups[25].name, '测试组'); assert.equal(classroom.groups[26].name, '恋上AI');
for (let i = 1; i <= 8; i++) await request('trial' + i, 'POST', { action: 'login', group: 26, name: '试用成员 ' + i });
classroom = await request('teacher', 'GET');
const formal = classroom.groups.filter(g => g.id !== 26); assert.equal(formal.length, 26); assert.equal(formal.reduce((n, g) => n + g.members.length, 0), 0); assert.equal(classroom.groups[25].members.length, 8);
await request('new-group', 'POST', { action: 'login', group: 27, name: '新增组测试成员' });
const newGroup = await request('new-group', 'GET'); assert.equal(newGroup.group.id, 27); assert.equal(newGroup.group.name, '恋上AI'); assert.equal(newGroup.group.members.length, 1);
for (let i = 1; i <= 8; i++) await request(i === 1 ? 'alice' : i === 2 ? 'bob' : 'member' + i, 'POST', { action: 'login', group: 1, name: i === 1 ? 'QA Alice' : i === 2 ? 'QA Bob' : '成员 ' + i });
await request('repeat', 'POST', { action: 'login', group: 1, name: '  qa   alice  ' });
let project = await request('alice', 'GET'); assert.equal(project.group.members.length, 8); const aliceId = project.session.memberId;
const foreignToken = await new SignJWT({ role: 'teacher', name: 'Nicole' }).setProtectedHeader({ alg: 'HS256' }).setAudience('INT6066').setIssuer('other-course').setExpirationTime('5m').sign(new TextEncoder().encode(process.env.TEST_SESSION_SECRET));
clients.set('foreign', 'int6136p-session=' + foreignToken); await request('foreign', 'GET', null, '', 401);
await request('alice', 'POST', { action: 'checkStep', step: 'invalid' }, '', 400);
for (const step of ['discussion', 'evidence', 'summary', 'findings', 'focus', 'definition', 'review', 'submitted']) await checkStep('alice', step, 'observation');
await request('alice', 'POST', { action: 'feedback', groupId: 1, body: '学生不能添加教师反馈' }, '', 403);
await request('alice', 'POST', { action: 'completeEmpathize', revision: project.group.revision }, '', 422);
await request('alice', 'POST', { action: 'submit', revision: project.group.revision }, '', 422);
// Synthetic records are test fixtures, never course recommendations or seeded readings.
const reading = { user: '测试阅读资料', context: '人工智能支持课堂讨论的研究情境', body: '这段阅读摘要仅用于自动化校验，不作为教学内容。', source: 'Article', sourceDetail: '自动化测试引用格式，不作为课程文献推荐。', publicationYear: 2024, referenceUrl: 'https://example.com/research' };
await request('alice', 'POST', { action: 'observation', values: { ...reading, sourceDetail: '' } }, '', 400);
await request('alice', 'POST', { action: 'observation', values: { ...reading, publicationYear: null } }, '', 400);
await request('alice', 'POST', { action: 'observation', values: { ...reading, publicationYear: 9999 } }, '', 400);
await request('alice', 'POST', { action: 'observation', values: { ...reading, referenceUrl: 'javascript:alert(1)' } }, '', 400);
const article = await request('alice', 'POST', { action: 'observation', values: reading });
const journal = await request('bob', 'POST', { action: 'observation', values: { ...reading, user: '第二条测试研究资料', source: 'Journal', referenceUrl: '', publicationYear: 2023 } });
const material = await request('bob', 'POST', { action: 'observation', values: { ...reading, source: 'Material', sourceDetail: '测试机构（无日期）。自动化测试材料。', referenceUrl: '', publicationYear: null } });
const experience = await request('bob', 'POST', { action: 'observation', values: { ...reading, source: 'Experience', sourceDetail: '', referenceUrl: '', publicationYear: null } });
const assumption = await request('bob', 'POST', { action: 'observation', values: { ...reading, source: 'Assumption', sourceDetail: '', referenceUrl: '', publicationYear: null } });
await checkStep('alice', 'discussion'); await checkStep('member3', 'discussion', 'observation'); await checkStep('alice', 'evidence', 'discussion');
const savedReading = (await request('alice', 'GET')).group.observations.find(n => n.id === article.id); assert.equal(savedReading.publicationYear, 2024); assert.equal(savedReading.referenceUrl, reading.referenceUrl);
await request('bob', 'POST', { action: 'observation', id: article.id, values: reading }, '', 403);
await request('bob', 'POST', { action: 'comment', observationId: article.id, body: '需要核对研究方法与适用情境。' });
const bytes = await readFile('public/design-thinking.png');
const upload = new FormData(); upload.set('observationId', article.id); upload.set('file', new Blob([bytes], { type: 'image/png' }), 'reading-test.png');
const uploaded = await fetch(base + '/api/attachment', { method: 'POST', headers: { Origin: base, Cookie: clients.get('alice') }, body: upload }); assert.equal(uploaded.status, 200);
const attachmentId = (await request('alice', 'GET')).group.observations.find(n => n.id === article.id).attachment.id;
const download = await fetch(base + '/api/attachment?id=' + attachmentId, { headers: { Cookie: clients.get('alice') } }); assert.equal(download.status, 200); assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
assert.equal((await fetch(base + '/api/attachment?id=' + attachmentId)).status, 401);
await request('outside', 'POST', { action: 'login', group: 2, name: '组外测试身份' });
const outsideNote = await request('outside', 'POST', { action: 'observation', values: reading });
await request('outside', 'POST', { action: 'comment', observationId: article.id, body: '组外写入应被拒绝。' }, '', 403);
assert.equal((await fetch(base + '/api/attachment?id=' + attachmentId, { headers: { Cookie: clients.get('outside') } })).status, 404);
assert.equal((await request('alice', 'GET', null, '?group=2')).group.id, 1);
project = await request('alice', 'GET');
for (const id of [experience.id, assumption.id]) await request('alice', 'POST', { action: 'draft', revision: project.group.revision, patch: { selectedEvidenceIds: [id] } }, '', 400);
await request('alice', 'POST', { action: 'draft', revision: project.group.revision, patch: { seminarSections: [{ id: 'cross', title: '组外关联', minutes: 2, content: '该环节不应关联其他组的资料', lead: '', evidenceIds: [outsideNote.id] }] } }, '', 400);
const oldRevision = project.group.revision;
await request('alice', 'POST', { action: 'draft', revision: oldRevision, patch: { researchArea: '人工智能与课堂讨论', courseConnection: '教育科技课程的研究与批判性理解', emergingFocus: '比较研究情境下讨论参与的机会与局限', selectedEvidenceIds: [article.id], unknowns: [{ id: 'u', question: '研究情境是否可比较？', method: '核对原文样本与方法' }] } });
await request('bob', 'POST', { action: 'draft', revision: oldRevision, patch: { emergingFocus: '旧版本不能覆盖组员的更新' } }, '', 409);
await checkStep('alice', 'summary', 'evidence'); project = await request('alice', 'GET');
await request('alice', 'POST', { action: 'completeEmpathize', revision: project.group.revision }, '', 422);
project = await patch({ selectedEvidenceIds: [article.id, journal.id], interpretations: [{ id: 'i', text: '', alternative: '可能有其他解释', evidenceIds: [] }] });
await request('alice', 'POST', { action: 'completeEmpathize', revision: project.group.revision }, '', 422);
project = await patch({ interpretations: [{ id: 'i', text: '', alternative: '', evidenceIds: [] }] });
await checkStep('alice', 'summary'); await checkStep('alice', 'findings', 'summary');
await request('alice', 'POST', { action: 'completeEmpathize', revision: project.group.revision }); await checkStep('alice', 'findings'); await checkStep('alice', 'focus', 'findings');
project = await patch({ patterns: [{ id: 'p', title: '讨论参与需要看研究情境', evidenceIds: [experience.id] }] }); await checkStep('alice', 'focus', 'findings');
project = await patch({ patterns: [{ id: 'p', title: '讨论参与需要看研究情境', evidenceIds: [article.id] }], candidates: [{ id: 'topic', title: '人工智能支持课堂讨论的机会与局限', evidenceIds: [assumption.id] }], selectedCandidateId: 'topic' }); await checkStep('alice', 'definition', 'focus');
project = await patch({ candidates: [{ id: 'topic', title: '人工智能支持课堂讨论的机会与局限', evidenceIds: [journal.id] }], learningGoal: '帮助听众比较证据、解释情境并提出批判性问题' }); await checkStep('alice', 'definition'); await checkStep('alice', 'review', 'definition');
const section = { id: 'section1', title: '研究问题与概念', minutes: 7, content: '说明选题的研究问题、范围、理由与核心概念', lead: '', evidenceIds: [] };
project = await patch({ researchQuestion: '人工智能如何改变课堂讨论？', scope: '高等教育课堂讨论', rationale: '课堂讨论影响学习者参与和表达', keyConcepts: '学习者能动性与批判思考', seminarSections: [section] }); await checkStep('alice', 'review', 'definition');
project = await patch({ seminarSections: [section, { id: 'section2', title: '比较研究与讨论', minutes: 10, content: '比较研究资料并邀请听众讨论局限', lead: '', evidenceIds: [article.id] }, { id: 'empty', title: '', minutes: 0, content: '', lead: '', evidenceIds: [] }] });
await checkStep('alice', 'review'); await request('alice', 'POST', { action: 'submit', revision: project.group.revision }, '', 422);
project = await patch({ synthesis: '综合不同研究的情境与发现，比较人工智能对课堂讨论带来的机会与局限。', criticalReflection: '现有研究的样本和情境各不相同，尚不能将某一研究的发现推广到全部课堂。', discussionQuestions: '我们如何判断讨论支持是否促进了学习？', feedbackRequest: '', nextInquiry: '', divisionOfWork: '' });
await checkStep('alice', 'submitted', 'review'); const sub = await request('alice', 'POST', { action: 'submit', revision: project.group.revision }); await checkStep('alice', 'submitted');
const after = await request('bob', 'GET'); assert.equal(after.group.submissions[0].version, sub.version); assert.equal(after.group.submissions[0].snapshot.draft.feedbackRequest, ''); assert.equal(after.group.submissions[0].snapshot.draft.seminarSections.slice(0, 2).reduce((n, s) => n + s.minutes, 0), 17);
const beforeStatement = after.group.submissions[0].snapshot.draft.synthesis;
project = await patch({ synthesis: '', researchQuestion: '' }); await checkStep('alice', 'submitted'); await checkStep('member3', 'submitted');
const revised = await request('alice', 'GET'); assert.equal(revised.group.submissions[0].snapshot.draft.synthesis, beforeStatement); await request('alice', 'POST', { action: 'submit', revision: revised.group.revision }, '', 422);
await request('alice', 'POST', { action: 'deleteObservation', id: article.id }); const deleted = await request('alice', 'GET'); assert.equal(deleted.group.draft.seminarSections[1].evidenceIds.length, 0); assert.ok(deleted.group.submissions[0].snapshot.observations.some(n => n.id === article.id));
await request('teacher', 'POST', { action: 'feedback', groupId: 1, body: '请区分资料依据与解释，并比较不同研究情境的局限。' }); assert.ok((await request('bob', 'GET')).group.feedback[0].body.includes('研究情境'));
await request('alice', 'POST', { action: 'reflection', body: '阅读资料改变了我们原先以技术为先的理解。' }); assert.ok((await request('alice', 'GET', null, '?reflection=1')).body.includes('阅读资料'));
// Independent work submission is intentionally available without the nine-step
// record being complete. All accounts and bytes are confined to this test DB.
async function works(who, payload, query = '', expected = 200, origin = base) {
  const method = payload ? 'POST' : 'GET';
  const r = await fetch(base + '/api/works' + query, { method, headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: clients.get(who) || '' }, body: payload ? JSON.stringify(payload) : undefined });
  const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body));
  if (body.error) assert.ok(/[\u3400-\u9fff]/u.test(body.error));
  return body;
}
async function workChunk(who, workId, fileId, index, bytes, expected = 200) {
  const form = new FormData(); form.set('action', 'chunk'); form.set('workId', workId); form.set('fileId', fileId); form.set('index', String(index)); form.set('file', new Blob([bytes], { type: 'text/html' }), 'untrusted-name.html');
  const r = await fetch(base + '/api/works', { method: 'POST', headers: { Origin: base, Cookie: clients.get(who) || '' }, body: form });
  const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body;
}
await works('anon', null, '', 401);
const linkWork = { action: 'create', requestId: 'integration-independent-link', title: '无需完成学习记录即可提交的工具分析', kind: 'tool', description: '', links: [{ url: 'https://example.org/tool', label: '分析对象' }], files: [] };
await works('teacher', linkWork, '', 403); await works('member3', linkWork, '', 403, 'https://invalid.example');
await works('member3', { ...linkWork, links: [{ url: 'javascript:alert(1)', label: '' }] }, '', 400);
await works('member3', { ...linkWork, links: [], files: [] }, '', 400);
await works('member3', { ...linkWork, files: [{ filename: 'over-limit.pdf', size: 20_000_001 }] }, '', 400);
const independent = await works('member3', linkWork);
assert.equal((await works('member3', linkWork)).id, independent.id);
await works('member3', { ...linkWork, title: '同幂等键不应替换已有草稿' }, '', 409);
assert.equal((await works('teacher', null)).works.length, 0, '草稿不能出现在教师已提交列表');
const publishedIndependent = await works('member3', { action: 'publish', id: independent.id }); assert.equal(publishedIndependent.work.version, 1);
assert.equal((await works('member3', { action: 'publish', id: independent.id })).work.version, 1);
const pdf = Buffer.alloc(2_000_127, 32); Buffer.from('%PDF-1.7\n').copy(pdf);
const smallPdf = Buffer.from('%PDF-1.7\nsmall test fixture');
const metadata = { action: 'create', requestId: 'integration-multi-file-upload', title: '分块展示文件', kind: 'ppt', description: '独立 API 测试数据', links: [], files: [{ filename: '同名.pdf', size: pdf.length, mime: 'text/html' }, { filename: '同名.pdf', size: smallPdf.length, mime: 'text/plain' }] };
const uploadWork = await works('alice', metadata); assert.equal(uploadWork.files[0].size, pdf.length); assert.equal(uploadWork.files[1].size, smallPdf.length); assert.notEqual(uploadWork.files[0].id, uploadWork.files[1].id); assert.equal(uploadWork.files[0].mime, 'application/pdf'); assert.equal(uploadWork.files[0].chunkCount, 2);
const repeatedUpload = await works('alice', metadata); assert.deepEqual(repeatedUpload, uploadWork);
await works('alice', { action: 'publish', id: uploadWork.id }, '', 422);
await workChunk('bob', uploadWork.id, uploadWork.files[0].id, 0, pdf.subarray(0, 2_000_000), 404);
await workChunk('alice', uploadWork.id, uploadWork.files[0].id, 0, pdf.subarray(0, 100), 400);
await workChunk('alice', uploadWork.id, uploadWork.files[0].id, 0, pdf.subarray(0, 2_000_000));
await workChunk('alice', uploadWork.id, uploadWork.files[0].id, 0, pdf.subarray(0, 2_000_000));
const draftRead = await fetch(base + '/api/works?fileId=' + uploadWork.files[0].id + '&chunk=0', { headers: { Cookie: clients.get('alice') } }); assert.equal(draftRead.status, 200); assert.deepEqual(Buffer.from(await draftRead.arrayBuffer()), pdf.subarray(0, 2_000_000));
for (const who of ['bob', 'teacher', 'outside']) assert.equal((await fetch(base + '/api/works?fileId=' + uploadWork.files[0].id + '&chunk=0', { headers: { Cookie: clients.get(who) } })).status, 404);
await works('alice', { action: 'publish', id: uploadWork.id }, '', 422);
await workChunk('alice', uploadWork.id, uploadWork.files[0].id, 1, pdf.subarray(2_000_000));
await workChunk('alice', uploadWork.id, uploadWork.files[1].id, 0, smallPdf);
const publishedFile = await works('alice', { action: 'publish', id: uploadWork.id }); assert.equal(publishedFile.work.version, 2);
assert.equal((await works('alice', { action: 'publish', id: uploadWork.id })).work.version, 2);
for (const who of ['bob', 'teacher']) {
  const pieces = [];
  for (let chunk = 0; chunk < 2; chunk++) { const r = await fetch(base + '/api/works?fileId=' + uploadWork.files[0].id + '&chunk=' + chunk, { headers: { Cookie: clients.get(who) } }); assert.equal(r.status, 200); pieces.push(Buffer.from(await r.arrayBuffer())); }
  assert.deepEqual(Buffer.concat(pieces), pdf);
}
assert.equal((await fetch(base + '/api/works?fileId=' + uploadWork.files[0].id + '&chunk=0', { headers: { Cookie: clients.get('outside') } })).status, 404);
assert.equal((await fetch(base + '/api/works?fileId=' + uploadWork.files[0].id + '&chunk=0')).status, 401);
await workChunk('alice', uploadWork.id, uploadWork.files[0].id, 0, Buffer.alloc(2_000_000), 409);
await works('alice', { action: 'discard', id: uploadWork.id }, '', 409);
assert.ok((await works('alice', null, '?group=2')).works.every(work => work.groupId === 1));
assert.equal((await works('outside', null)).works.length, 0);
const badFile = await works('alice', { action: 'create', title: '伪装 PDF', kind: 'other', links: [], files: [{ filename: 'fake.pdf', size: 7 }] });
await workChunk('alice', badFile.id, badFile.files[0].id, 0, Buffer.from('INVALID'));
await works('alice', { action: 'publish', id: badFile.id }, '', 422);
await works('bob', { action: 'discard', id: badFile.id }, '', 404);
await works('alice', { action: 'discard', id: badFile.id });
assert.equal((await fetch(base + '/api/works?fileId=' + badFile.files[0].id + '&chunk=0', { headers: { Cookie: clients.get('alice') } })).status, 404);
const concurrentA = await works('alice', { ...linkWork, requestId: 'integration-concurrent-alice', title: '并发版本 A' });
const concurrentB = await works('member3', { ...linkWork, requestId: 'integration-concurrent-other', title: '并发版本 B' });
const concurrentPublished = await Promise.all([works('alice', { action: 'publish', id: concurrentA.id }), works('member3', { action: 'publish', id: concurrentB.id })]);
assert.deepEqual(concurrentPublished.map(result => result.work.version).sort(), [3, 4]);
const otherWork = await works('outside', { ...linkWork, requestId: 'integration-other-group', title: '其他组作品' }); await works('outside', { action: 'publish', id: otherWork.id });
assert.equal((await works('teacher', null, '?group=1')).works.length, 4); assert.equal((await works('teacher', null, '?groupId=2')).works.length, 1); assert.equal((await works('teacher', null)).works.length, 5);
const member3 = await request('member3', 'GET'); await request('teacher', 'POST', { action: 'removeMember', memberId: member3.session.memberId }, '', 409);
await works('member8', { ...linkWork, requestId: 'integration-unused-member-draft', title: '未发布草稿应随误注册成员清理' });
await request('teacher', 'POST', { action: 'removeMember', memberId: aliceId }, '', 409);
const unused = await request('member8', 'GET'); await request('teacher', 'POST', { action: 'removeMember', memberId: unused.session.memberId }); await request('member8', 'GET', null, '', 401);
await request('alice', 'POST', { action: 'logout' }); await request('alice', 'GET', null, '', 401);
console.log('PASS：独立课程与会话、26 个正式组及原编号测试组、恋上AI 登录、不假设人数上限、中文错误、真实引用字段与链接校验、研究依据与阶段必填、个人贡献、附件权限、组间隔离、环节资料归属、并发冲突、17 分钟建议不阻挡、可选留空、历史版本、教师反馈、独立作品提交、幂等创建/分块/发布、完整性与文件签名、作品权限、并发版本、已提交作品成员保护。');
