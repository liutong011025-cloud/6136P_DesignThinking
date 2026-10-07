"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Header, Ornaments, Panel, Field, Button, Notice } from "@/components/ui";
import { api } from "@/components/project-context";
import type { ProjectData } from "@/lib/types";

export default function Reflection() {
  const [data, setData] = useState<ProjectData | null>(null); const [body, setBody] = useState(""); const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const response = await fetch("/api/studio", { cache: "no-store" }); const value = await response.json();
        if (response.status === 401) { router.replace("/join"); return; }
        if (!response.ok) throw new Error(value.error || "暂时无法打开个人反思。");
        if (value.session.role === "teacher") { router.replace("/teacher"); return; }
        if (disposed) return;
        const item = await fetch("/api/studio?reflection=1", { cache: "no-store" }); const reflection = await item.json();
        if (!item.ok) throw new Error(reflection.error || "暂时无法载入已保存的反思。");
        let backup: string | null = null;
        try { backup = sessionStorage.getItem(`int6136p-reflection-v1:${value.session.memberId}`); } catch { /* Browser backup is optional. */ }
        if (!disposed) { setBody(backup ?? reflection.body ?? ""); setData(value); }
      } catch (issue) { if (!disposed) setError(issue instanceof Error ? issue.message : "暂时无法连接，请重试。"); }
    })();
    return () => { disposed = true; };
  }, [router]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) { setError("请先写下反思内容再保存。个人反思为选填，不影响小组继续课程学习路径。"); return; }
    setBusy(true);
    try {
      await api("reflection", { body }); setSaved(true); setError("");
      try { sessionStorage.removeItem(`int6136p-reflection-v1:${data?.session.memberId}`); } catch { /* Database save has already succeeded. */ }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "反思保存未完成，请重试。"); }
    finally { setBusy(false); }
  }
  return <div className="page"><Ornaments /><Header active="reflection" groupName={data?.group.name} members={data?.group.members} name={data?.session.name} />
    <main id="main" className="reflection-main"><p className="eyebrow">你的个人课程学习记录</p><h1>记录你的理解<br />如何改变。</h1><p className="subtitle">回顾自己如何从共情理解、资料阅读与小组讨论，走向问题聚焦和报告修订。</p>
      {error ? <Notice error>{error}</Notice> : null}
      <div className="two-columns"><Panel title="我的反思"><form onSubmit={save}><Field label="这次阅读与研讨让你对课程议题有了哪些新的理解？" hint="选填。输入会保留在本次浏览器会话中；点击保存后，反思会写入你的个人课程记录。"><textarea rows={13} maxLength={12000} value={body} disabled={!data || busy} onChange={event => { setBody(event.target.value); setSaved(false); if (data) { try { sessionStorage.setItem(`int6136p-reflection-v1:${data.session.memberId}`, event.target.value); } catch { /* Keep editing available when browser storage is unavailable. */ } } }} placeholder="哪项资料改变了你对相关群体处境的理解？课程概念与研究观点如何联系起来？小组的研究问题怎样变得更清晰？报告还有哪些观点与局限需要检视？" /></Field><Button disabled={busy || !data || !body.trim()}>{busy ? "正在保存…" : "保存我的反思"}<ArrowRight size={17} /></Button>{saved ? <Notice>你的个人反思已保存。</Notice> : null}</form></Panel>
        <Panel title="可以从这些问题开始"><ul className="reflection-prompts"><li><strong>共情理解：</strong>哪项资料、案例或真实经验，让你重新理解了学习者、教师或其他相关群体的处境？</li><li>你怎样把课堂概念与阅读中的研究观点联系起来？哪些联系仍需更多依据？</li><li><strong>定义问题：</strong>你们如何从宽泛的议题，聚焦到一个范围清晰、值得探究的研究问题？</li><li><strong>构思与验证：</strong>你们为什么这样安排报告环节？讨论、排练或反馈让你重新考虑了什么？</li><li>哪些主张证据不足？哪些观点存在分歧或局限？下一步怎样核查？</li><li>你的阅读、讨论与修订贡献，如何改变了小组的理解？</li></ul><p className="muted">这份记录属于你的个人课程学习过程。可以随课程推进继续补充，说明自己的理解如何变化。</p></Panel>
      </div>
    </main>
  </div>;
}
