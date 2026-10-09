import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, BookOpen, MessagesSquare, Clock3 } from "lucide-react";
import { Header, Ornaments, DesignThinkingMap } from "@/components/ui";
import { OFFICIAL_GROUP_COUNT } from "@/lib/course";
export default function Home() {
 return <div className="page home"><Ornaments /><Header active="home" /><main id="main" className="home-main">
  <div className="home-intro"><div><p className="eyebrow">INT6136P · 普通话班 · 专题研讨室</p><h1>从真实情境出发。<br/>让研究有依据，<br/><span className="green-text">让讨论有深度。</span></h1><p className="subtitle">用设计思维，走进一个值得讨论的课程议题。</p><p className="muted">个人观察与阅读 → 小组讨论 → 聚焦问题 → 报告与反思。<br/>{OFFICIAL_GROUP_COUNT} 个小组，记录每一步思考和理解的变化。</p></div><div className="diagram"><DesignThinkingMap /><div className="diagram-caption"><span className="dot green" />设计思维贯穿研究、讨论与报告 <ArrowUpRight size={20}/></div></div></div>
  <div className="today-band"><div><span className="eyebrow">从理解议题，到公开讨论</span><h2>先理解。再定义。<br/>用依据回应问题。</h2></div><ol><li><Check size={17}/>理解相关人群、情境与课程议题</li><li><Check size={17}/>审查近期文章、期刊、案例及其他资料</li><li><Check size={17}/>设计约 20 分钟的专题报告与讨论</li></ol><Link className="btn" href="/join">进入小组，开始共情 <ArrowRight size={22}/></Link></div>
  <div className="assignment-strip"><div><BookOpen size={22}/><strong>联系课程概念</strong><span>把课堂知识转化为分析主题的视角。</span></div><div><MessagesSquare size={22}/><strong>深入讨论与反思</strong><span>比较证据、解释分歧，检查自己的假设。</span></div><div><Clock3 size={22}/><strong>约 20 分钟小组报告</strong><span>向全班呈现研究，带出有依据的讨论。</span></div></div>
  <section className="dt-journey"><p className="eyebrow">设计思维如何支持专题报告</p><div className="dt-stage-grid">{[{n:'01',t:'共情理解',c:'观察相关人群与情境，带着问题阅读资料。',color:'orange'},{n:'02',t:'定义问题',c:'从发现中聚焦课程相关的主题和研究问题。',color:'ink'},{n:'03',t:'构思方案',c:'比较报告角度，选择观点、案例和讨论方式。',color:'green'},{n:'04',t:'形成原型',c:'用时间安排和内容提纲形成报告初稿。',color:'orange'},{n:'05',t:'测试检验',c:'预演论证，检查反例，收集讨论与反馈。',color:'coral'},{n:'06',t:'实施迭代',c:'向全班报告，依据反馈修改并记录反思。',color:'cyan'}].map(s=><div className={'dt-stage '+s.color} key={s.n}><span>{s.n}</span><h3>{s.t}</h3><p>{s.c}</p></div>)}</div></section>
  <div className="course-bottom"><section><p className="eyebrow">课程要求</p><h3>从课程内容中，自主选择一个主题。</h3><p>结合本科目学到的知识和概念，全面研究所选主题，审查近期文章、期刊、案例研究和其他相关材料，并进行深入讨论和反思。每组在全班面前进行约 20 分钟的专题报告。</p></section><section><p className="eyebrow">让过程可见</p><h3>你的思考，不只有最后一份幻灯片。</h3><p>记录最初的观察、查阅的资料、改变观点的依据和仍待解决的问题。提交的是可追溯的报告方案；课堂呈现后，你们还可以回来继续修改。</p></section></div>
 </main><footer className="site-footer"><span>INT6136P · 专题研讨室</span><Link href="/join">Nicole · 教师入口 <ArrowUpRight size={15}/></Link></footer></div>;
}
