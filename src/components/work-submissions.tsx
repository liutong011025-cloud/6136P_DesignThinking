"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Download, FileUp, ImageIcon, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { WORK_CHUNK_SIZE, MAX_WORK_FILE_SIZE, MAX_WORK_FILES, MAX_WORK_LINKS, WORK_KINDS, WORK_KIND_LABELS } from "@/lib/work-validation";
import { Button, Empty, Field, Notice, Panel } from "./ui";

export type WorkKind = "ppt" | "prototype" | "tool" | "other";
export interface WorkFile { id: string; filename: string; mime: string; size: number; chunkCount: number }
export interface SubmittedWork { id: string; groupId: number; groupName: string; title: string; kind: WorkKind; description: string; links: { url: string; label: string }[]; submittedBy: string; createdAt: string; version: number; files: WorkFile[] }
interface CreatedWork { id: string; files: WorkFile[] }
type LinkRow = { id: string; url: string; label: string };
const MIME_BY_EXTENSION: Record<string, string> = { ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const ACCEPT = ".ppt,.pptx,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp";
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const sizeLabel = (size: number) => size < 1000000 ? `${Math.ceil(size / 1000)} KB` : `${Number((size / 1000000).toFixed(1))} MB`;
function safeLink(value: string) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } }
async function worksRequest(payload: object): Promise<Record<string, unknown>> {
  const response = await fetch("/api/works", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json(); if (!response.ok) throw new Error(result.details?.[0] || result.error || "作品操作未完成，请重试。"); return result;
}

function WorkAttachment({ file }: { file: WorkFile }) {
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [error, setError] = useState(""); const [preview, setPreview] = useState("");
  const previewRef = useRef(""); const downloading = useRef(false);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, [file.id]);
  async function getFile(showPreview: boolean) {
    if (downloading.current) return; downloading.current = true; setBusy(true); setProgress(0); setError("");
    try {
      const pieces: ArrayBuffer[] = [];
      for (let index = 0; index < file.chunkCount; index++) {
        const response = await fetch(`/api/works?fileId=${encodeURIComponent(file.id)}&chunk=${index}`, { cache: "no-store" });
        if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "文件读取未完成，请重试。"); }
        pieces.push(await response.arrayBuffer()); setProgress(Math.round((index + 1) / file.chunkCount * 100));
      }
      const blob = new Blob(pieces, { type: file.mime }); if (blob.size !== file.size) throw new Error("文件读取不完整，请重新下载。");
      const url = URL.createObjectURL(blob);
      if (showPreview) { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = url; setPreview(url); }
      else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "文件读取未完成，请重试。"); }
    finally { downloading.current = false; setBusy(false); }
  }
  return <div className="work-attachment"><div className="work-file-row"><div><strong>{file.filename}</strong><small>{sizeLabel(file.size)}</small></div><div className="button-row"><Button secondary disabled={busy} onClick={() => void getFile(false)}><Download size={15} />{busy ? `正在读取 ${progress}%` : "下载文件"}</Button>{IMAGE_MIMES.has(file.mime) ? <Button secondary disabled={busy} onClick={() => { if (preview) { URL.revokeObjectURL(previewRef.current); previewRef.current = ""; setPreview(""); } else void getFile(true); }}><ImageIcon size={15} />{preview ? "收起图片" : "查看图片"}</Button> : null}</div></div>{error ? <Notice error>{error}</Notice> : null}{preview ? <div className="work-image-preview">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt={file.filename} /></div> : null}</div>;
}

export function WorkSubmissionList({ works }: { works: SubmittedWork[] }) {
  return <div className="work-submission-list">{works.length ? works.map(work => <article className="work-submission" key={work.id}>
    <div className="work-card-heading"><div><span className={`tag work-kind-${work.kind}`}>{WORK_KIND_LABELS[work.kind]}</span><h3>{work.title}</h3></div><span className="work-version">作品版本 {work.version}</span></div>
    <p className="work-meta">{work.submittedBy} 提交 · {new Date(work.createdAt).toLocaleString("zh-CN")}</p>
    {work.description ? <p className="work-description">{work.description}</p> : null}
    {work.kind === "tool" ? <p className="muted compact">这是小组提交用于分析的工具或网站资源；作品类别不代表该工具由小组开发。</p> : null}
    {work.files.map(file => <WorkAttachment key={file.id} file={file} />)}
    {work.links.length ? <ul className="work-links">{work.links.map((link, index) => { const url = safeLink(link.url); return url ? <li key={`${link.url}:${index}`}><a href={url} target="_blank" rel="noopener noreferrer">{link.label || "打开作品链接"}<ArrowUpRight size={15} /></a><small>{url}</small></li> : null; })}</ul> : null}
  </article>) : <Empty title="还没有展示作品。">报告方案与展示作品分开保存。提交文件或链接后，作品会显示在这里。</Empty>}</div>;
}

export function WorkSubmissions({ groupId, student = false, refreshKey = 0 }: { groupId?: number; student?: boolean; refreshKey?: number }) {
  const [works, setWorks] = useState<SubmittedWork[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const sequence = useRef(0); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; }; }, []);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch(`/api/works${groupId ? `?group=${groupId}` : ""}`, { cache: "no-store" }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "暂时无法载入展示作品。"); if (alive.current && request === sequence.current) { setWorks(result.works); setError(""); }
    } catch (issue) { if (alive.current && request === sequence.current) setError(issue instanceof Error ? issue.message : "暂时无法载入展示作品。"); }
    finally { if (alive.current && request === sequence.current) setLoading(false); }
  }, [groupId]);
  useEffect(() => { setWorks([]); setLoading(true); setError(""); void reload(); const timer = setInterval(() => { if (!document.hidden) void reload(); }, 15000); return () => { sequence.current++; clearInterval(timer); }; }, [reload, refreshKey]);
  return <div className="work-submissions-area">{student ? <WorkUploadForm onPublished={reload} /> : null}
    <Panel title={student ? "小组已提交的展示作品" : "展示作品与原型"}><div className="work-list-intro"><p className="muted">{student ? "这里显示已经正式提交的文件和链接。每次提交保存新版本，之前的作品会保留。" : "展示 PPT、报告原型、讨论设计及分析的工具资源在这里单独列出。报告方案草稿和历史方案保留在下方。"}</p><Button secondary disabled={loading} onClick={() => void reload()}><RefreshCw size={16} />刷新作品</Button></div>{error ? <Notice error>{error}<Button secondary onClick={() => void reload()}>重试载入</Button></Notice> : null}{loading ? <p role="status">正在载入作品…</p> : <WorkSubmissionList works={works} />}</Panel>
  </div>;
}

function WorkUploadForm({ onPublished }: { onPublished: () => Promise<void> }) {
  const [title, setTitle] = useState(""); const [kind, setKind] = useState<WorkKind>("ppt"); const [description, setDescription] = useState(""); const [links, setLinks] = useState<LinkRow[]>([]); const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [locked, setLocked] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [progress, setProgress] = useState(0); const [stage, setStage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null); const working = useRef(false); const draft = useRef<CreatedWork | null>(null);
  const attempt = useRef<{ requestId: string; title: string; kind: WorkKind; description: string; links: { url: string; label: string }[]; files: { filename: string; mime: string; size: number }[] } | null>(null);
  const actualFiles = useRef<File[]>([]); const allUploaded = useRef(false);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (working.current || locked) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [locked]);
  function addFiles(chosen: FileList | null) {
    if (!chosen) return; setError(""); setSuccess(""); const next = [...files, ...Array.from(chosen)];
    if (next.length > MAX_WORK_FILES) { setError(`一次最多提交 ${MAX_WORK_FILES} 个文件。`); return; }
    for (const file of next) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (file.name.length > 150) { setError(`“${file.name}”的文件名太长，请改为 150 字以内。`); return; }
      if (!MIME_BY_EXTENSION[ext]) { setError("请使用 PPT、PPTX、PDF、Word 或 PNG／JPG／WebP 图片。"); return; }
      if (!file.size || file.size > MAX_WORK_FILE_SIZE) { setError(`“${file.name}”需要有实际内容，并且不超过 20 MB。`); return; }
    }
    setFiles(next); if (inputRef.current) inputRef.current.value = "";
  }
  function reset() { setTitle(""); setKind("ppt"); setDescription(""); setLinks([]); setFiles([]); setLocked(false); setProgress(0); setStage(""); draft.current = null; attempt.current = null; actualFiles.current = []; allUploaded.current = false; if (inputRef.current) inputRef.current.value = ""; }
  async function createOrRecover() {
    if (draft.current) return draft.current;
    const result = await worksRequest({ action: "create", ...attempt.current }); const created = result as unknown as CreatedWork;
    if (!created.id || !Array.isArray(created.files) || created.files.length !== actualFiles.current.length) throw new Error("作品登记结果不完整，请重试；系统会继续本次提交。"); draft.current = created; return created;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (working.current) return;
    if (!attempt.current) {
      const activeLinks = links.filter(link => link.url.trim() || link.label.trim());
      if (!title.trim()) { setError("请先填写作品标题。"); return; }
      if (activeLinks.some(link => !safeLink(link.url))) { setError("请为每个已填写的链接提供完整的 HTTP 或 HTTPS 地址，或移除该行。"); return; }
      if (!files.length && !activeLinks.length) { setError("请至少添加一个作品文件或一个链接。"); return; }
      attempt.current = { requestId: crypto.randomUUID(), title: title.trim(), kind, description: description.trim(), links: activeLinks.map(link => ({ url: safeLink(link.url)!, label: link.label.trim() })), files: files.map(file => ({ filename: file.name, mime: MIME_BY_EXTENSION[file.name.split(".").pop()!.toLowerCase()], size: file.size })) }; actualFiles.current = [...files];
    }
    working.current = true; setBusy(true); setLocked(true); setError(""); setSuccess("");
    try {
      setStage("正在登记本次作品…"); const created = await createOrRecover(); const total = actualFiles.current.reduce((sum, file) => sum + file.size, 0); let sent = 0; setProgress(0);
      for (let fileIndex = 0; !allUploaded.current && fileIndex < actualFiles.current.length; fileIndex++) {
        const file = actualFiles.current[fileIndex]; const metadata = created.files[fileIndex]; const count = Math.ceil(file.size / WORK_CHUNK_SIZE);
        for (let index = 0; index < count; index++) {
          setStage(`正在上传 ${fileIndex + 1}/${actualFiles.current.length}：${file.name}`); const chunk = file.slice(index * WORK_CHUNK_SIZE, Math.min((index + 1) * WORK_CHUNK_SIZE, file.size));
          const body = new FormData(); body.set("action", "chunk"); body.set("workId", created.id); body.set("fileId", metadata.id); body.set("index", String(index)); body.set("file", chunk, file.name);
          const response = await fetch("/api/works", { method: "POST", body }); const result = await response.json(); if (!response.ok) throw new Error(result.error || `“${file.name}”上传未完成，请重试。`);
          sent += chunk.size; setProgress(total ? Math.round(sent / total * 100) : 100);
        }
      }
      allUploaded.current = true; setProgress(100); setStage("正在确认提交…"); await worksRequest({ action: "publish", id: created.id }); reset(); setSuccess("展示作品已正式提交。可以在下方列表查看，原来的作品版本会保留。"); await onPublished();
    } catch (issue) { setError((issue instanceof Error ? issue.message : "作品提交未完成。") + " 点击重试可继续同一次提交，请保持这个页面。"); }
    finally { working.current = false; setBusy(false); }
  }
  async function discard() {
    if (working.current) return; working.current = true; setBusy(true); setError("");
    try { if (attempt.current) { const created = await createOrRecover(); await worksRequest({ action: "discard", id: created.id }); } reset(); setSuccess("本次尚未提交的作品已取消，你可以重新选择内容。"); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "取消未完成，请重试。"); } finally { working.current = false; setBusy(false); }
  }
  return <Panel title="提交展示作品"><p className="muted">报告方案记录你的研究与设计过程；这里单独提交实际展示文件、报告原型或链接。至少添加一个文件或链接，每次正式提交都会保留新版本。</p>
    <form onSubmit={submit}><Field required label="作品标题"><input required maxLength={200} disabled={busy || locked} value={title} onChange={e => { setTitle(e.target.value); setSuccess(""); }} placeholder="例如：专题报告展示 PPT／试讲初稿／讨论活动设计" /></Field><Field required label="作品类型"><select required disabled={busy || locked} value={kind} onChange={e => setKind(e.target.value as WorkKind)}>{WORK_KINDS.map(value => <option key={value} value={value}>{WORK_KIND_LABELS[value]}</option>)}</select></Field>
      <p className="work-kind-help">本课程的“报告原型”可以是提纲、PPT 初稿或讨论活动设计，用于试讲和检验论证。“分析的工具／网站”用于提交研究对象或引用资源。</p>
      <Field label="作品说明"><textarea rows={3} maxLength={5000} disabled={busy || locked} value={description} onChange={e => setDescription(e.target.value)} placeholder="作品的用途、目前完成程度，或希望老师关注的内容……" /></Field>
      <fieldset className="work-upload-fieldset" disabled={busy || locked}><legend>作品文件或链接 <span className="field-requirement required">至少一项必填</span></legend><label className="file-button"><FileUp size={18} /><span>选择作品文件</span><input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={e => addFiles(e.target.files)} /></label><p className="muted compact">支持 PPT／PPTX／PDF／Word／PNG／JPG／WebP；每个文件最大 20 MB，最多 {MAX_WORK_FILES} 个。</p>
        <ul className="work-selected-files">{files.map((file, index) => <li key={`${file.name}:${file.size}:${index}`}><span><strong>{file.name}</strong><small>{sizeLabel(file.size)}</small></span><button type="button" className="icon-btn" aria-label={`移除文件 ${file.name}`} onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={17} /></button></li>)}</ul>
        {links.map((link, index) => <div className="work-link-editor" key={link.id}><div className="item-heading"><strong>链接 {index + 1}</strong><button type="button" className="icon-btn" aria-label={`移除链接 ${index + 1}`} onClick={() => setLinks(links.filter(item => item.id !== link.id))}><Trash2 size={15} /></button></div><Field conditional label="链接地址"><input type="url" maxLength={2000} value={link.url} onChange={e => setLinks(links.map(item => item.id === link.id ? { ...item, url: e.target.value } : item))} placeholder="https://…" /></Field><Field label="链接名称"><input maxLength={150} value={link.label} onChange={e => setLinks(links.map(item => item.id === link.id ? { ...item, label: e.target.value } : item))} placeholder="例如：在线展示文件／试讲原型／分析的工具" /></Field></div>)}
        <Button secondary type="button" disabled={links.length >= MAX_WORK_LINKS} onClick={() => setLinks([...links, { id: crypto.randomUUID(), url: "", label: "" }])}><Plus size={16} />添加链接</Button><small className="muted file-hint">最多 {MAX_WORK_LINKS} 个链接，地址需要完整 HTTP 或 HTTPS；链接名称选填。</small>
      </fieldset>
      {busy || locked ? <div className="work-upload-progress" role="status"><strong>{stage || "这次提交暂未完成，可以重试。"}</strong><progress max={100} value={progress} aria-label="作品上传进度" /><span>{progress}% · 提交确认前，请保持页面。</span></div> : null}
      {error ? <Notice error>{error}</Notice> : null}{success ? <Notice><Check size={17} />{success}</Notice> : null}
      <div className="button-row"><Button disabled={busy || (!locked && (!title.trim() || !files.length && !links.some(link => link.url.trim())))} type="submit"><FileUp size={17} />{busy ? "正在提交…" : locked ? "重试本次提交" : "正式提交展示作品"}</Button>{locked ? <Button secondary type="button" disabled={busy} onClick={() => void discard()}>取消本次提交</Button> : null}</div>
    </form>
  </Panel>;
}
