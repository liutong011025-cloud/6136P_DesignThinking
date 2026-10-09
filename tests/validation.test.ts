import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { draftPatchSchema, observationSchema, fullDraft, empathizeIssues, definitionIssues, seminarPlanIssues, localizedZodIssues } from "../src/lib/validation";
import { findingsIssues, focusIssues, stepAccess, optionalInterpretationIssues } from "../src/lib/learning-path";
import { GROUP_NAMES, GROUP_MEMBER_LIMIT, OFFICIAL_GROUP_COUNT, PRACTICE_GROUP_ID } from "../src/lib/course";
const notes = [
  { id: "article", source: "Article", memberId: "alice" },
  { id: "journal", source: "Journal", memberId: "bob" },
  { id: "case", source: "Case", memberId: "bob" },
  { id: "material", source: "Material", memberId: "bob" },
  { id: "experience", source: "Experience", memberId: "bob" },
  { id: "assumption", source: "Assumption", memberId: "bob" }
];
const reading = { user: "课堂讨论研究", context: "人工智能支持高等教育讨论", body: "这条自动化测试记录用于检查阅读摘要的格式。", source: "Article", sourceDetail: "自动化测试引用格式，不作为课程文献或教学推荐。", publicationYear: 2024, referenceUrl: "https://example.com/research" };
function validDraft() {
  return fullDraft({
    researchArea: "人工智能与课堂讨论", courseConnection: "比较教育科技的机会与局限", emergingFocus: "关注学习者参与讨论时的判断与表达",
    selectedEvidenceIds: ["article", "journal"], unknowns: [{ id: "unknown", question: "不同研究的参与情境是否可比较？", method: "核对原文的样本、方法与情境" }],
    patterns: [{ id: "pattern", title: "参与方式与研究情境有关", evidenceIds: ["article"] }],
    candidates: [{ id: "topic", title: "人工智能支持课堂讨论的机会与局限", evidenceIds: ["journal"] }], selectedCandidateId: "topic",
    learningGoal: "帮助听众比较不同依据并提出批判性问题", researchQuestion: "人工智能如何改变课堂讨论？", scope: "高等教育课堂讨论",
    rationale: "课堂讨论关系到学习者参与和表达", keyConcepts: "学习者能动性与参与",
    seminarSections: [{ id: "part1", title: "问题与概念", minutes: 7, content: "说明研究问题、范围和核心概念", lead: "", evidenceIds: [] }, { id: "part2", title: "研究比较与研讨", minutes: 10, content: "比较研究发现并讨论其局限", lead: "", evidenceIds: ["article"] }],
    synthesis: "综合不同研究的情境与发现，比较人工智能对课堂讨论带来的机会与局限。",
    criticalReflection: "现有研究的样本和情境各不相同，尚不能将某一研究的发现推广到全部课堂。",
    discussionQuestions: "我们如何判断讨论支持是否促进了学习？"
  });
}
test("26 个正式组及独立测试组，新增组不改变测试组编号，没有自行设定成员人数上限", () => {
  assert.equal(GROUP_NAMES.length, 27); assert.equal(OFFICIAL_GROUP_COUNT, 26); assert.equal(PRACTICE_GROUP_ID, 26); assert.equal(GROUP_MEMBER_LIMIT, 0); assert.equal(GROUP_NAMES[25], "测试组"); assert.equal(GROUP_NAMES[26], "恋上AI");
});
test("研究文章必须有引用与有效发表年份", () => {
  assert.equal(observationSchema.parse(reading).publicationYear, 2024);
  assert.equal(observationSchema.safeParse({ ...reading, sourceDetail: "" }).success, false);
  assert.equal(observationSchema.safeParse({ ...reading, publicationYear: null }).success, false);
  assert.equal(observationSchema.safeParse({ ...reading, publicationYear: new Date().getFullYear() + 1 }).success, false);
});
test("无日期案例与其他资料可不填年份，但仍须真实引用信息", () => {
  for (const source of ["Case", "Material"]) {
    assert.equal(observationSchema.safeParse({ ...reading, source, publicationYear: null, sourceDetail: "测试机构（无日期）。测试用资料引用。" }).success, true);
    assert.equal(observationSchema.safeParse({ ...reading, source, sourceDetail: "" }).success, false);
  }
});
test("个人经验和待验证想法可以缺少出版信息", () => {
  for (const source of ["Experience", "Assumption"]) assert.equal(observationSchema.safeParse({ ...reading, source, publicationYear: null, sourceDetail: "", referenceUrl: "" }).success, true);
});
test("来源链接只接受完整 HTTP(S)，链接本身可选填", () => {
  assert.equal(observationSchema.safeParse({ ...reading, referenceUrl: "" }).success, true);
  for (const referenceUrl of ["javascript:alert(1)", "file:///private", "not-a-url"]) assert.equal(observationSchema.safeParse({ ...reading, referenceUrl }).success, false);
});
test("只接收新课程草稿字段，不能混入 INT6066 数据", () => {
  assert.equal(draftPatchSchema.safeParse({ targetUsers: "旧课程字段" }).success, false);
  assert.equal(fullDraft({}).researchArea, "");
});
test("共情与研究要求两条不同资料，至少一条文章或期刊", () => {
  const d = validDraft(); assert.deepEqual(empathizeIssues(d, notes), []);
  assert.ok(empathizeIssues({ ...d, selectedEvidenceIds: ["article", "article"] }, notes).length);
  assert.ok(empathizeIssues({ ...d, selectedEvidenceIds: ["case", "material"] }, notes).some(v => v.includes("研究文章或期刊")));
  assert.ok(empathizeIssues({ ...d, selectedEvidenceIds: ["experience", "assumption"] }, notes).some(v => v.includes("至少两条")));
});
test("空白可选行不阻拦，已开始的问题和解释需要补全", () => {
  const d = validDraft();
  assert.deepEqual(empathizeIssues({ ...d, unknowns: [...d.unknowns, { id: "empty", question: "", method: "" }] }, notes), []);
  assert.ok(empathizeIssues({ ...d, unknowns: [{ id: "started", question: "还需查证什么？", method: "" }] }, notes).length);
  assert.deepEqual(optionalInterpretationIssues({ ...d, interpretations: [{ id: "empty", text: "", alternative: "", evidenceIds: [] }] }), []);
  assert.ok(optionalInterpretationIssues({ ...d, interpretations: [{ id: "started", text: "", alternative: "可能有其他原因", evidenceIds: [] }] }).length);
});
test("主题观点和选题必须关联已发表研究，学习目标必填", () => {
  const d = validDraft(); assert.deepEqual(findingsIssues(d, notes), []); assert.deepEqual(focusIssues(d, notes), []);
  assert.ok(findingsIssues({ ...d, patterns: [{ id: "p", title: "缺乏研究依据", evidenceIds: ["experience"] }] }, notes).length);
  assert.ok(focusIssues({ ...d, candidates: [{ id: "topic", title: "待验证选题", evidenceIds: ["assumption"] }] }, notes).length);
  assert.ok(focusIssues({ ...d, learningGoal: "" }, notes).length);
});
test("报告至少两完整环节，负责人和关联资料可选，20 分钟为建议", () => {
  const d = validDraft(); assert.deepEqual(seminarPlanIssues(d), []); // 17 min is permitted.
  assert.deepEqual(seminarPlanIssues({ ...d, seminarSections: [...d.seminarSections, { id: "empty", title: "", minutes: 0, content: "", lead: "", evidenceIds: [] }] }), []);
  assert.ok(seminarPlanIssues({ ...d, seminarSections: d.seminarSections.slice(0, 1) }).length);
  assert.ok(seminarPlanIssues({ ...d, seminarSections: [{ ...d.seminarSections[0], minutes: -2 }, d.seminarSections[1]] }).length);
  assert.equal(draftPatchSchema.safeParse({ seminarSections: [{ ...d.seminarSections[0], minutes: Infinity }] }).success, false);
});
test("最终提交要求综合、批判反思与讨论问题，反馈请求和下一步可留空", () => {
  const d = validDraft(); assert.deepEqual(definitionIssues(d), []);
  assert.ok(definitionIssues({ ...d, synthesis: "太短", criticalReflection: "", discussionQuestions: "" }).length >= 3);
  assert.deepEqual(definitionIssues({ ...d, feedbackRequest: "", nextInquiry: "", divisionOfWork: "" }), []);
});
test("步骤不能跳过个人记录与研究小结，个人记录不要求所有组员齐备", () => {
  const r = { draft: validDraft(), observations: notes, memberId: "unrecorded", empathizeCompleted: false, submissionCount: 0 };
  assert.equal(stepAccess("review", r)?.step, "observation");
  assert.equal(stepAccess("findings", { ...r, memberId: "alice" })?.step, "summary");
  assert.equal(stepAccess("review", { ...r, memberId: "alice", empathizeCompleted: true }), null);
});
test("当前草稿未完成也可读取已保存历史", () => {
  assert.equal(stepAccess("submitted", { draft: fullDraft({}), observations: [], memberId: "alice", empathizeCompleted: false, submissionCount: 1 }), null);
});
test("包括 Zod 默认类型错误在内，反馈均使用中文", () => {
  try { draftPatchSchema.parse({ seminarSections: "wrong" }); assert.fail("应拒绝错误类型"); }
  catch (e) { assert.ok(e instanceof z.ZodError); assert.ok(localizedZodIssues(e).every(v => /[\u3400-\u9fff]/u.test(v))); }
});
