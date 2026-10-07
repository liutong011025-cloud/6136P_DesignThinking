import { STEPS, type StepKey } from "./course";
import type { Draft } from "./types";
import { empathizeIssues, definitionIssues, isResearchSource, seminarPlanIssues } from "./validation";
export { fourPartIssues } from "./validation";
type RecordSummary = { id: string; source: string; memberId: string };
export interface LearningRecord { draft: Draft; observations: RecordSummary[]; memberId: string; empathizeCompleted: boolean; submissionCount: number }
const nonblank = (value: string) => !!value.trim();
function researchLink(ids: string[], notes: RecordSummary[]) { return ids.some(id => notes.some(n => n.id === id && isResearchSource(n.source))); }
export function findingsIssues(d: Draft, notes: RecordSummary[]) {
  const issues: string[] = [];
  if (!d.patterns.some(p => nonblank(p.title) && researchLink(p.evidenceIds, notes))) issues.push("请整理至少一个主题或观点，并关联已发表研究资料。");
  if (d.patterns.some(p => (nonblank(p.title) || p.evidenceIds.length > 0) && (!nonblank(p.title) || !researchLink(p.evidenceIds, notes)))) issues.push("请补全已开始填写的主题或观点及其研究依据，或删除该行。");
  return issues;
}
export function focusIssues(d: Draft, notes: RecordSummary[]) {
  const issues: string[] = [];
  const chosen = d.candidates.find(c => c.id === d.selectedCandidateId && nonblank(c.title));
  if (!chosen) issues.push("请描述并选择一个报告主题。");
  else if (!researchLink(chosen.evidenceIds, notes)) issues.push("请为选定主题关联至少一条已发表研究资料。");
  if (!nonblank(d.learningGoal)) issues.push("请说明研讨希望促进的理解或学习目标。");
  if (d.candidates.some(c => c.evidenceIds.length > 0 && !nonblank(c.title))) issues.push("请补写已关联资料的备选主题，或删除该行。");
  return issues;
}
export function optionalInterpretationIssues(d: Draft) { return d.interpretations.some(v => (nonblank(v.alternative) || v.evidenceIds.length > 0) && !nonblank(v.text)) ? ["请补写已开始填写的解释，或删除该行；解释本身为选填。"] : []; }
export function learningStepIssues(step: StepKey, r: LearningRecord): string[] {
  const d = r.draft;
  switch (step) {
    case "observation": return r.observations.some(n => n.memberId === r.memberId) ? [] : ["请先保存至少一条个人阅读记录或体验记录。"];
    case "discussion": return nonblank(d.emergingFocus) ? [] : ["请记录小组讨论形成的初步聚焦。"];
    case "evidence": return [...empathizeIssues(d, r.observations), ...optionalInterpretationIssues(d)];
    case "summary": return [...empathizeIssues(d, r.observations), ...optionalInterpretationIssues(d), ...(!r.empathizeCompleted ? ["请审阅共情与研究小结，并点击继续下一阶段。"] : [])];
    case "findings": return [...findingsIssues(d, r.observations), ...optionalInterpretationIssues(d)];
    case "focus": return focusIssues(d, r.observations);
    case "definition": return seminarPlanIssues(d);
    case "review": return [...definitionIssues(d), ...(!r.submissionCount ? ["请提交报告方案以保存小组的首个版本。"] : [])];
    case "submitted": return [];
  }
}
export function stepAccess(target: StepKey, r: LearningRecord): { step: StepKey; issues: string[] } | null {
  if (target === "submitted" && r.submissionCount > 0) return null;
  for (const prior of STEPS.slice(0, STEPS.findIndex(s => s.key === target))) { const issues = learningStepIssues(prior.key, r); if (issues.length) return { step: prior.key, issues }; }
  return null;
}
