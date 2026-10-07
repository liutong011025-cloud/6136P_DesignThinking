import { NextRequest, NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { db, verifyCourseDatabase, CourseMismatchError } from "@/lib/db";
import { sameOrigin } from "@/lib/origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
function unavailable(error: unknown) { return NextResponse.json({ error: error instanceof CourseMismatchError ? error.message : "暂时无法读取或保存附件，请稍后重试。" }, { status: 503 }); }
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "请通过本课程网站上传附件。" }, { status: 403 });
    await verifyCourseDatabase();
    const s = await session();
    if (!s?.memberId) return NextResponse.json({ error: "请先登录学生身份。" }, { status: 401 });
    if (Number(req.headers.get("content-length") ?? 0) > 2200000) return NextResponse.json({ error: "请使用小于 2 MB 的文件。" }, { status: 413 });
    const form = await req.formData();
    const id = String(form.get("observationId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2000000 || !allowed.includes(file.type)) return NextResponse.json({ error: "请使用小于 2 MB 的 JPG、PNG、WebP 或 PDF。" }, { status: 400 });
    if (!await db().observation.findFirst({ where: { id, memberId: s.memberId, groupId: s.groupId } })) return NextResponse.json({ error: "只能为自己的阅读记录添加附件。" }, { status: 403 });
    const data = { filename: file.name.slice(0, 150).replace(/[\r\n]/g, ""), mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()), size: file.size };
    await db().attachment.upsert({ where: { observationId: id }, create: { observationId: id, ...data }, update: data });
    return NextResponse.json({ ok: true });
  } catch (error) { return unavailable(error); }
}
export async function GET(req: NextRequest) {
  try {
    await verifyCourseDatabase();
    const s = await session();
    if (!s) return new NextResponse("请先登录。", { status: 401 });
    const item = await db().attachment.findUnique({ where: { id: req.nextUrl.searchParams.get("id") ?? "" }, include: { observation: { select: { groupId: true } } } });
    if (!item || (s.role !== "teacher" && item.observation.groupId !== s.groupId)) return new NextResponse("找不到附件。", { status: 404 });
    return new NextResponse(item.bytes, { headers: {
      "Content-Type": item.mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.filename)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) { return unavailable(error); }
}
