import Link from "next/link";
import { COURSE_ID } from "@/lib/course";
export default function NotFound() { return <main id="main" className="loading-page"><p className="eyebrow">{COURSE_ID} · 课程设计工作区</p><h1>回到课程学习路径。</h1><p>没有找到这个页面。</p><Link className="btn" href="/">返回课程首页</Link></main>; }
