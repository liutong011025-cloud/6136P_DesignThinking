import { z } from "zod";
import { EMPTY_DRAFT, type Draft } from "./types";
import { RESEARCH_SOURCES } from "./course";
const short = z.string().trim().max(600, "请控制在 600 字以内。");
const long = z.string().trim().max(5000, "请控制在 5000 字以内。");
const ids = z.array(z.string().max(100)).max(100, "最多关联 100 条资料。");
const identifier = z.string().max(100);
export const draftPatchSchema = z.object({
  researchArea: short, courseConnection: short, emergingFocus: long, selectedEvidenceIds: ids,
  interpretations: z.array(z.object({ id: identifier, text: long, evidenceIds: ids, alternative: long })).max(30),
  unknowns: z.array(z.object({ id: identifier, question: long, method: long })).max(30),
  patterns: z.array(z.object({ id: identifier, title: short, evidenceIds: ids })).max(30),
  candidates: z.array(z.object({ id: identifier, title: short, evidenceIds: ids })).max(10),
  selectedCandidateId: identifier, researchQuestion: long, scope: long, rationale: long, keyConcepts: long,
  synthesis: long, criticalReflection: long, discussionQuestions: long,
  seminarSections: z.array(z.object({ id: identifier, title: short, minutes: z.number().finite("时间必须是有效数字。"), content: long, lead: short, evidenceIds: ids })).max(30),
  divisionOfWork: long, feedbackRequest: long, nextInquiry: long, learningGoal: long
}).partial().strict();
const referenceUrl = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "资料链接必须是完整的 HTTP 或 HTTPS 地址。").default("");
export const observationSchema = z.object({
  user: z.string().trim().min(2, "请填写资料标题或研究对象，至少 2 字。").max(600),
  context: z.string().trim().min(2, "请填写情境或资料与研究的关系，至少 2 字。").max(600),
  body: z.string().trim().min(10, "请记录具体阅读发现或体验，至少 10 字。").max(5000),
  source: z.enum(["Article", "Journal", "Case", "Material", "Experience", "Assumption"]),
  sourceDetail: z.string().trim().max(1500).default(""), referenceUrl,
  publicationYear: z.number().int("发表年份须为整数。").min(1000, "请填写有效发表年份。").max(new Date().getFullYear(), "发表年份不能晚于当前年份。").nullable().default(null)
}).superRefine((value, ctx) => {
  if (!isResearchSource(value.source)) return;
  if (!value.sourceDetail.trim()) ctx.addIssue({ code: "custom", path: ["sourceDetail"], message: "研究资料必须填写真实的引用信息，例如作者、年份、标题与出版来源。" });
  if ((value.source === "Article" || value.source === "Journal") && value.publicationYear === null) ctx.addIssue({ code: "custom", path: ["publicationYear"], message: "研究文章与期刊论文必须填写有效发表年份；无日期的其他资料可在引用信息中注明。" });
});
export function isResearchSource(source: string) { return (RESEARCH_SOURCES as readonly string[]).includes(source); }
export function fullDraft(value: unknown): Draft { return { ...EMPTY_DRAFT, ...draftPatchSchema.parse(value ?? {}) }; }
export function empathizeIssues(d: Draft, notes: { id: string; source: string }[]) {
  const issues: string[] = [];
  const selected = notes.filter(n => isResearchSource(n.source) && d.selectedEvidenceIds.includes(n.id));
  if (!d.researchArea.trim()) issues.push("请明确小组的研究领域。");
  if (!d.courseConnection.trim()) issues.push("请说明研究与课程的联系。");
  if (new Set(selected.map(n => n.id)).size < 2) issues.push("请选择至少两条不同的已发表研究资料作为依据；个人经验和待验证想法不计入。");
  if (!selected.some(n => n.source === "Article" || n.source === "Journal")) issues.push("依据中至少包含一条研究文章或期刊论文。");
  if (!d.emergingFocus.trim()) issues.push("请记录小组讨论形成的初步聚焦。");
  if (!d.unknowns.some(u => u.question.trim() && u.method.trim())) issues.push("请提出至少一个待查问题，并说明查证方法。");
  if (d.unknowns.some(u => (u.question.trim() || u.method.trim()) && (!u.question.trim() || !u.method.trim()))) issues.push("请补全已开始填写的待查问题与查证方法，或删除该行。");
  return issues;
}
export function fourPartIssues(d: Draft) {
  const fields = [[d.researchQuestion, "请写出研究问题。"], [d.scope, "请界定报告范围。"], [d.rationale, "请说明选题理由与重要性。"], [d.keyConcepts, "请解释核心概念。"]];
  return fields.filter(([value]) => !value.trim()).map(([, message]) => message);
}
export function seminarPlanIssues(d: Draft) {
  const issues = fourPartIssues(d);
  const active = d.seminarSections.filter(s => s.title.trim() || s.content.trim() || s.lead.trim() || s.evidenceIds.length || s.minutes !== 0);
  const complete = active.filter(s => s.title.trim() && s.content.trim() && Number.isFinite(s.minutes) && s.minutes > 0);
  if (complete.length < 2) issues.push("请规划至少两个报告环节，每个环节填写标题、内容与正数时长。");
  if (active.some(s => !s.title.trim() || !s.content.trim() || !Number.isFinite(s.minutes) || s.minutes <= 0)) issues.push("请补全已开始填写的报告环节，或删除该行；负责人及关联资料可选填。");
  return issues;
}
export function definitionIssues(d: Draft) {
  const issues = seminarPlanIssues(d);
  if (d.synthesis.trim().length < 20) issues.push("请撰写资料综合与报告主要论点，至少 20 字。");
  if (d.criticalReflection.trim().length < 20) issues.push("请撰写批判性反思，至少 20 字。");
  if (d.discussionQuestions.trim().length < 8) issues.push("请提出讨论问题，至少 8 字。");
  if (!d.selectedCandidateId || !d.candidates.some(c => c.id === d.selectedCandidateId && c.title.trim())) issues.push("请选择一个报告主题。");
  return issues;
}
export function localizedZodIssues(error: z.ZodError) {
  return error.issues.map(issue => /[\u3400-\u9fff]/u.test(issue.message) ? issue.message : `请检查「${issue.path.join(".") || "输入内容"}」的格式、长度或选项。`);
}
