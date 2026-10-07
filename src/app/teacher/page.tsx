"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpLeft, ArrowLeft, ArrowUpRight, RefreshCw, Download, Users, Check, BookOpen } from "lucide-react";
import { EMPTY_DRAFT, type ProjectData, type Draft, type ObservationData } from "@/lib/types";
import { COURSE_ID, OFFICIAL_GROUP_COUNT, PRACTICE_GROUP_ID, RESEARCH_SOURCES, SOURCE_LABELS } from "@/lib/course";
import { api } from "@/components/project-context";
import { Ornaments, Panel, Field, Button, Notice, Empty, SignOut } from "@/components/ui";

interface GroupSummary {
  id: number; name: string; empathizeCompletedAt: string | null; draft: Partial<Draft>;
  members: { id: string; name: string }[]; _count: { observations: number; submissions: number };
  submissions: { createdAt: string; version: number }[]; feedback: { body: string; createdAt: string }[];
}
function hasFocus(group: GroupSummary) { return Boolean(group.draft.selectedCandidateId && group.draft.researchQuestion?.trim()); }
function dateLabel(value: string) { return new Date(value).toLocaleString("zh-CN"); }
function Recorded({ label, value }: { label: string; value: string }) {
  return <div className="unknown-summary"><h3>{label}</h3><p style={{ whiteSpace: "pre-wrap" }}>{value || "尚未填写"}</p></div>;
}
function EvidenceList({ ids, observations }: { ids: string[]; observations: ObservationData[] }) {
  if (!ids.length) return <p className="muted">尚未关联依据</p>;
  return <ul>{ids.map(id => { const note = observations.find(item => item.id === id); return <li key={id}>{note ? `${note.user} · ${note.member.name}：${note.body}` : "原依据已不存在"}</li>; })}</ul>;
}
function citedIds(draft: Draft) {
  return new Set([...draft.selectedEvidenceIds, ...draft.patterns.flatMap(item => item.evidenceIds), ...(draft.candidates.find(item => item.id === draft.selectedCandidateId)?.evidenceIds ?? []), ...draft.seminarSections.flatMap(item => item.evidenceIds)]);
}
function Bibliography({ draft, observations }: { draft: Draft; observations: ObservationData[] }) {
  const ids = citedIds(draft);
  const references = observations.filter(note => ids.has(note.id) && RESEARCH_SOURCES.some(source => source === note.source));
  return <><p className="muted">以下条目来自方案所关联的文章、论文、案例与其他资料。请核对完整引用与正文引用是否对应。</p>{references.length ? <ol>{references.map(note => <li key={note.id}><p style={{ whiteSpace: "pre-wrap" }}>{note.sourceDetail || "尚未填写完整引用，请补充作者、年份、标题及出处。"}</p>{note.publicationYear ? <small className="muted">发表年份：{note.publicationYear}</small> : null}{note.referenceUrl ? <p>{/^https?:\/\//i.test(note.referenceUrl) ? <a href={note.referenceUrl} target="_blank" rel="noreferrer">打开资料链接</a> : note.referenceUrl}</p> : null}</li>)}</ol> : <p className="muted">方案尚未关联可列入参考文献的资料。</p>}</>;
}
function PlanRecord({ draft, observations }: { draft: Draft; observations: ObservationData[] }) {
  const topic = draft.candidates.find(item => item.id === draft.selectedCandidateId);
  const minutes = draft.seminarSections.reduce((total, section) => total + section.minutes, 0);
  return <>
    <p className="eyebrow">共情理解：从处境与资料出发</p>
    <Recorded label="研究方向" value={draft.researchArea} /><Recorded label="与课程的联系" value={draft.courseConnection} /><Recorded label="初步关注点" value={draft.emergingFocus} />
    <h3>小组选中的依据</h3><EvidenceList ids={draft.selectedEvidenceIds} observations={observations} />
    <h3>小组解读与待查问题</h3>{!draft.interpretations.length && !draft.unknowns.length ? <p className="muted">尚未添加</p> : null}
    {draft.interpretations.map(item => <div className="unknown-summary" key={item.id}><h4>{item.text}</h4><EvidenceList ids={item.evidenceIds} observations={observations} /><p><strong>另一种解读：</strong>{item.alternative || "尚未填写"}</p></div>)}
    {draft.unknowns.map(item => <div className="unknown-summary" key={item.id}><h4>{item.question}</h4><p><strong>核查方法：</strong>{item.method || "尚未填写"}</p></div>)}
    <hr /><p className="eyebrow">定义问题：聚焦值得探究的主题</p>
    <h3>整理出的主题与观点</h3>{draft.patterns.length ? draft.patterns.map(item => <div className="unknown-summary" key={item.id}><h4>{item.title}</h4><EvidenceList ids={item.evidenceIds} observations={observations} /></div>) : <p className="muted">尚未整理</p>}
    <h3>候选报告主题</h3>{draft.candidates.length ? draft.candidates.map(item => <div className="unknown-summary" key={item.id}><h4>{item.title}{item.id === draft.selectedCandidateId ? " · 已选定" : ""}</h4><EvidenceList ids={item.evidenceIds} observations={observations} /></div>) : <p className="muted">尚未添加</p>}
    <Recorded label="确定的报告主题" value={topic?.title ?? ""} /><Recorded label="研究问题" value={draft.researchQuestion} /><Recorded label="课程概念" value={draft.keyConcepts} /><Recorded label="研究范围" value={draft.scope} /><Recorded label="选题理由" value={draft.rationale} /><Recorded label="学习目标" value={draft.learningGoal} />
    <hr /><p className="eyebrow">构思与验证：组织报告，检视观点</p>
    <Recorded label="综合观点" value={draft.synthesis} /><Recorded label="批判性反思" value={draft.criticalReflection} /><Recorded label="课堂讨论问题" value={draft.discussionQuestions} />
    <h3>报告环节与时间</h3><p className="muted">目前合计 {minutes} 分钟；课程小组报告约 20 分钟。</p>
    {draft.seminarSections.length ? draft.seminarSections.map((section, index) => <div className="unknown-summary" key={section.id}><h4>{index + 1}. {section.title || "未命名环节"} · {section.minutes} 分钟</h4><p style={{ whiteSpace: "pre-wrap" }}>{section.content || "尚未填写环节内容"}</p><p><strong>负责人：</strong>{section.lead || "尚未填写"}</p><EvidenceList ids={section.evidenceIds} observations={observations} /></div>) : <p className="muted">尚未规划报告环节</p>}
    <Recorded label="小组分工" value={draft.divisionOfWork} /><Recorded label="希望获得的反馈" value={draft.feedbackRequest} /><Recorded label="下一步探究" value={draft.nextInquiry} />
    <hr /><h3>完整参考文献</h3><Bibliography draft={draft} observations={observations} />
  </>;
}

export default function Teacher() {
  const [groups, setGroups] = useState<GroupSummary[]>([]); const [selected, setSelected] = useState<number | null>(null); const [project, setProject] = useState<ProjectData | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [filter, setFilter] = useState("all"); const [search, setSearch] = useState("");
  const [text, setText] = useState(""); const [sending, setSending] = useState(false); const [success, setSuccess] = useState(""); const router = useRouter();
  const load = useCallback(async () => {
    const response = await fetch("/api/studio", { cache: "no-store" }); const value = await response.json();
    if (response.status === 401) { router.replace("/join"); return; }
    if (!response.ok) throw new Error(value.error || "暂时无法载入课程进度。");
    if (value.session.role !== "teacher") { router.replace("/project/observation"); return; }
    setGroups(value.groups); setLoading(false);
  }, [router]);
  const selectedRef = useRef<number | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const detail = useCallback(async (id: number) => {
    const response = await fetch(`/api/studio?group=${id}`, { cache: "no-store" }); const value = await response.json();
    if (!response.ok) throw new Error(value.error || "暂时无法载入小组记录。");
    if (selectedRef.current === id) setProject(value);
  }, []);
  useEffect(() => { void load().catch(issue => { setError(issue.message); setLoading(false); }); const timer = setInterval(() => { if (!document.hidden) void load().catch(() => {}); }, 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { if (selected) { setProject(null); setSuccess(""); setText(""); void detail(selected).catch(issue => setError(issue.message)); } }, [selected, detail]);
  async function feedback(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setSending(true); setError("");
    try { await api("feedback", { groupId: selected, body: text }); setText(""); setSuccess("反馈已保存，小组可以在工作区中查看。"); await Promise.all([load(), detail(selected)]); }
    catch (issue) { setError((issue as Error).message); } finally { setSending(false); }
  }
  const classGroups = groups.filter(group => group.id !== PRACTICE_GROUP_ID);
  function exportProgress() {
    const rows = [["小组", "已加入人数", "资料与观察记录", "共情与研究完成时间", "报告方案版本数", "最近提交时间"], ...classGroups.map(group => [group.name, group.members.length, group._count.observations, group.empathizeCompletedAt ?? "", group._count.submissions, group.submissions[0]?.createdAt ?? ""])];
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${COURSE_ID}-课程进度.csv`; link.click(); URL.revokeObjectURL(url);
  }
  const shown = groups.filter(group => group.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "all" || filter === "submitted" && group._count.submissions > 0 || filter === "empathize" && !group.empathizeCompletedAt || filter === "define" && !!group.empathizeCompletedAt && !hasFocus(group) && !group._count.submissions || filter === "planning" && hasFocus(group) && !group._count.submissions));
  const draft = project ? { ...EMPTY_DRAFT, ...project.group.draft } : EMPTY_DRAFT;
  return <div className="page teacher-page"><Ornaments /><header className="site-header"><Link href="/" className="brand"><ArrowUpLeft size={38} strokeWidth={4} />{COURSE_ID}</Link><nav><Link href="/">课程首页</Link><span className="active">教师工作区</span></nav><div className="identity"><strong>Nicole</strong><SignOut /></div></header>
    <main id="main" className="teacher-main"><div className="teacher-heading"><div><p className="eyebrow">Nicole 的课程全景</p><h1>{selected ? project?.group.name ?? "正在打开小组…" : "看见每组的思考与进展。"}</h1><p className="subtitle">{selected ? "沿着依据、问题与报告方案，给予具体反馈。" : "从共情理解与资料研究出发，聚焦问题，构思并检视约 20 分钟的专题报告。"}</p></div><div className="button-row">{selected ? <Button secondary onClick={() => { selectedRef.current = null; setSelected(null); setProject(null); }}><ArrowLeft size={17} />查看全部小组</Button> : <Button secondary onClick={exportProgress} disabled={!groups.length}><Download size={17} />导出课程进度</Button>}<Button secondary aria-label="刷新课程进度" onClick={() => void Promise.all([load(), ...(selected ? [detail(selected)] : [])]).catch(issue => setError(issue.message))}><RefreshCw size={17} /></Button></div></div>
      {error ? <Notice error>{error}</Notice> : null}
      {!selected ? <>
        <div className="stats-grid"><div><span className="stat-icon green"><Users size={22} /></span><strong>{classGroups.reduce((total, group) => total + group.members.length, 0)}</strong><span>已加入课程的学生</span></div><div><span className="stat-icon orange"><Check size={22} /></span><strong>{classGroups.filter(group => group.empathizeCompletedAt).length} <small>/ {OFFICIAL_GROUP_COUNT}</small></strong><span>共情与研究完成</span></div><div><span className="stat-icon coral"><ArrowUpRight size={22} /></span><strong>{classGroups.filter(group => group._count.submissions).length} <small>/ {OFFICIAL_GROUP_COUNT}</small></strong><span>已提交报告方案的小组</span></div><div><span className="stat-icon cyan"><BookOpen size={22} /></span><strong>{classGroups.reduce((total, group) => total + group._count.observations, 0)}</strong><span>资料与观察记录</span></div></div>
        <p className="muted compact">课程统计与导出涵盖 {OFFICIAL_GROUP_COUNT} 个正式小组。测试组是独立练习工作区，不计入课程统计；各组人数不设上限。</p>
        <div className="teacher-filters"><div className="tabs">{[["all", "全部小组"], ["empathize", "共情与研究中"], ["define", "定义问题中"], ["planning", "构思与验证中"], ["submitted", "已提交方案"]].map(([value, title]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{title}</button>)}</div><label className="search-label">查找小组<input type="search" placeholder="输入小组名称" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        <div className="teacher-group-grid">{shown.map(group => <button key={group.id} className="group-card" onClick={() => { selectedRef.current = group.id; setSelected(group.id); setError(""); }}><div className="item-heading"><span className="eyebrow">{group.id === PRACTICE_GROUP_ID ? "测试工作区" : `第 ${String(group.id).padStart(2, "0")} 组`}</span><ArrowUpRight size={19} /></div><h2>{group.name}</h2><div className="avatars">{group.members.slice(0, 8).map(member => <span key={member.id} title={member.name}>{Array.from(member.name)[0]}</span>)}{group.members.length > 8 ? <span title={`共 ${group.members.length} 位成员`}>+{group.members.length - 8}</span> : null}</div><p>{group.members.length} 位{group.id === PRACTICE_GROUP_ID ? "练习用户" : "成员"} · {group._count.observations} 条记录</p><div className="group-progress"><span className={group.empathizeCompletedAt ? "done" : ""}>01 共情理解</span><span className={hasFocus(group) || group._count.submissions ? "done" : ""}>02 定义问题</span><span className={group._count.submissions ? "done" : ""}>03 构思与验证</span></div><span className={`tag ${group._count.submissions ? "observation" : ""}`}>{group._count.submissions ? `已提交 · 第 ${group.submissions[0]?.version ?? group._count.submissions} 版` : hasFocus(group) ? "正在构思与检视报告" : group.empathizeCompletedAt ? "正在聚焦研究问题" : group.members.length ? "正在理解处境与研究资料" : "等待小组加入"}</span></button>)}</div>
        {loading ? <p role="status">正在载入课程进度…</p> : !shown.length ? <Empty title="没有符合条件的小组。" /> : null}
      </> : project ? <div className="two-columns"><div className="stack">
        <Panel title="小组当前的研究与报告方案"><p className="eyebrow">当前工作草稿</p>{project.group.empathizeCompletedAt ? <p className="muted">共情与研究完成：{dateLabel(project.group.empathizeCompletedAt)}</p> : null}<PlanRecord draft={draft} observations={project.group.observations} /></Panel>
        <Panel title="资料、观察与小组交流">{project.group.observations.length ? project.group.observations.map(note => <article className="note-card" key={note.id}><div className="note-top"><strong>{note.member.name}</strong><span className={`tag ${note.source.toLowerCase()}`}>{SOURCE_LABELS[note.source]}{draft.selectedEvidenceIds.includes(note.id) ? " · 已选为依据" : ""}</span></div><h3>{note.user}</h3><p style={{ whiteSpace: "pre-wrap" }}>{note.body}</p><small className="muted">{note.context}</small>{note.sourceDetail ? <p className="context-line" style={{ whiteSpace: "pre-wrap" }}>资料出处：{note.sourceDetail}</p> : null}{note.publicationYear ? <p className="muted">发表年份：{note.publicationYear}</p> : null}{note.referenceUrl && /^https?:\/\//i.test(note.referenceUrl) ? <p><a href={note.referenceUrl} target="_blank" rel="noreferrer">打开资料链接</a></p> : null}{note.attachment ? <p><a href={`/api/attachment?id=${note.attachment.id}`}>下载附件：{note.attachment.filename}</a></p> : null}{note.comments.map(comment => <div className="teacher-comment" key={comment.id}><strong>{comment.member.name}：</strong>{comment.body}</div>)}</article>) : <p className="muted">尚未保存资料与观察记录。</p>}</Panel>
      </div><div className="stack">
        <Panel title="引导小组的下一步"><p className="muted">反馈可以帮助小组深化对相关群体处境的理解，检视研究问题与证据的联系，并改进报告观点、讨论问题和时间安排。</p><p><strong>小组希望获得的反馈：</strong>{draft.feedbackRequest || "尚未提出具体反馈请求"}</p><form onSubmit={feedback}><Field label="你的反馈"><textarea required minLength={5} rows={6} maxLength={5000} value={text} onChange={event => setText(event.target.value)} placeholder="哪个观点需要更多依据？研究范围是否清晰？报告如何呈现不同观点与局限？" /></Field><Button disabled={sending || text.trim().length < 5}>{sending ? "正在保存反馈…" : "保存对这个小组的反馈"}<ArrowUpRight size={17} /></Button></form>{success ? <Notice>{success}</Notice> : null}{project.group.feedback.map(item => <div className="feedback" key={item.id}><span className="eyebrow">Nicole · {dateLabel(item.createdAt)}</span><p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p></div>)}</Panel>
        <Panel title="小组参与与名单">{project.group.members.map(member => <div className="contribution-row" key={member.id}><div><strong>{member.name}</strong><p>{project.group.observations.filter(note => note.memberId === member.id).length} 条资料与观察记录 · {project.group.observations.reduce((total, note) => total + note.comments.filter(comment => comment.member.id === member.id).length, 0)} 条讨论</p></div>{!project.group.observations.some(note => note.memberId === member.id) ? <button className="text-btn danger" onClick={async () => { if (!window.confirm(`移除误加入的“${member.name}”账号吗？已有贡献的账号会被保留，无法在这里移除。`)) return; try { await api("removeMember", { memberId: member.id }); await Promise.all([detail(project.group.id), load()]); } catch (issue) { setError((issue as Error).message); } }}>更正名单</button> : null}</div>)}<small className="muted">可移除误加入且没有贡献记录的账号；学生已有资料、讨论和反思会保留。</small></Panel>
        <Panel title="已保存的报告方案版本"><p className="muted">展开版本可查看提交时的方案、所关联的依据与完整参考文献。后续草稿修改不会改写这些快照。</p>{project.group.submissions.map(submission => <details className="version-detail" key={submission.id}><summary>第 {submission.version} 版 · {submission.submittedBy}<small>{dateLabel(submission.createdAt)}</small></summary><p><strong>提交时的成员：</strong>{submission.snapshot.members.map(member => member.name).join("、") || "尚未记录"}</p><PlanRecord draft={{ ...EMPTY_DRAFT, ...submission.snapshot.draft }} observations={submission.snapshot.observations} /></details>)}{!project.group.submissions.length ? <p className="muted">这个小组尚未提交报告方案。</p> : null}</Panel>
      </div></div> : <p role="status">正在打开小组记录…</p>}
    </main>
  </div>;
}
