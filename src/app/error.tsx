"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="loading-page"><h1>暂时无法打开工作区。</h1><p>请重试。已保存的小组记录会保留。</p><button className="btn" onClick={reset}>重试</button></main>; }
