"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Header, Ornaments, Notice, Button } from "@/components/ui";
import { WorkSubmissions } from "@/components/work-submissions";
import { PRACTICE_GROUP_ID } from "@/lib/course";
import type { ProjectData } from "@/lib/types";

export default function WorksPage() {
  const [data, setData] = useState<ProjectData | null>(null); const [error, setError] = useState(""); const router = useRouter();
  useEffect(() => {
    let disposed = false;
    void (async () => { try { const response = await fetch("/api/studio", { cache: "no-store" }); const result = await response.json(); if (response.status === 401) { router.replace("/join"); return; } if (!response.ok) throw new Error(result.error || "暂时无法打开作品提交页面。"); if (result.session.role === "teacher") { router.replace("/teacher"); return; } if (!disposed) setData(result); } catch (issue) { if (!disposed) setError(issue instanceof Error ? issue.message : "暂时无法连接，请重试。"); } })();
    return () => { disposed = true; };
  }, [router]);
  return <div className="page works-page"><Ornaments /><Header active="works" groupName={data?.group.name} members={data?.group.members} name={data?.session.name} />
    <main id="main" className="works-main"><div className="works-heading"><div><p className="eyebrow">展示文件 · 报告原型 · 作品链接</p><h1>让你的作品<br />看得见。</h1><p className="subtitle">这里单独保存小组的实际展示作品。研究过程和报告方案继续记录在小组项目中。</p></div><ArrowUpRight size={65} /></div>
      {data?.group.id === PRACTICE_GROUP_ID ? <Notice>测试组 · 试用作品不计入正式课程统计。</Notice> : null}
      {error ? <Notice error>{error}<Button secondary onClick={() => window.location.reload()}>重新连接</Button></Notice> : null}
      {data ? <WorkSubmissions student /> : !error ? <p role="status">正在打开小组作品区…</p> : null}
    </main>
  </div>;
}
