import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "./font.css";
import "./globals.css";
export const metadata: Metadata = { title: "INT6136P · 专题研讨室", description: "以设计思维理解议题，联系课程概念，研究文献与案例，在讨论和反思中形成专题报告。", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="zh-CN"><body><a className="skip-link" href="#main">跳转到主要内容</a>{children}</body></html>;
}
