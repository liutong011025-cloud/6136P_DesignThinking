import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { session, type Session } from "@/lib/auth";
import { db, verifyCourseDatabase, CourseMismatchError } from "@/lib/db";
import { sameOrigin } from "@/lib/origin";
import { GROUP_NAMES } from "@/lib/course";
import { localizedZodIssues } from "@/lib/validation";
import { createWorkSchema, expectedWorkChunkSize, validateWorkFileMagic, WORK_CHUNK_SIZE } from "@/lib/work-validation";
import type { Prisma } from "@/generated/prisma/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const includeWork = {
  group: { select: { name: true } },
  files: { orderBy: { position: "asc" as const }, select: { id: true, filename: true, mime: true, size: true, chunkCount: true } }
};
type WorkRecord = Prisma.WorkSubmissionGetPayload<{ include: typeof includeWork }>;
class WorkError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new WorkError(status, message); }
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }
function handle(error: unknown) {
  if (error instanceof WorkError) return json({ error: error.message }, error.status);
  if (error instanceof CourseMismatchError) return json({ error: error.message }, 503);
  if (error instanceof z.ZodError) return json({ error: "请检查作品标题、类型、文件或链接。", details: localizedZodIssues(error) }, 400);
  if (error instanceof SyntaxError) return json({ error: "提交内容格式不正确，请重试。" }, 400);
  console.error("作品请求失败：", error instanceof Error ? error.message : "未知错误");
  return json({ error: "作品暂时无法读取或保存，请稍后重试。" }, 503);
}
function displayWork(work: WorkRecord) {
  return { id: work.id, groupId: work.groupId, groupName: work.group.name, title: work.title, kind: work.kind,
    description: work.description, links: work.links, submittedBy: work.submittedBy,
    createdAt: work.publishedAt ?? work.createdAt, version: work.version, files: work.files };
}
async function authenticated() { await verifyCourseDatabase(); const s = await session(); if (!s) fail(401, "请先选择小组并登录。"); return s; }
function contributor(s: Session) {
  if (s.role !== "student" || !s.groupId || !s.memberId) fail(403, "请使用学生身份提交本组作品。");
  return { groupId: s.groupId, memberId: s.memberId, name: s.name };
}
// Limit the actual bytes, not only a client-supplied Content-Length header.
async function boundedBody(req: NextRequest, maximum: number) {
  if (Number(req.headers.get("content-length") ?? 0) > maximum) fail(413, "单次上传分块过大，请按 2 MB 分块上传。");
  if (!req.body) fail(400, "没有收到提交内容。");
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > maximum) { await reader.cancel(); fail(413, "单次上传分块过大，请按 2 MB 分块上传。"); }
      chunks.push(item.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
export async function GET(req: NextRequest) {
  try {
    const s = await authenticated();
    const fileId = req.nextUrl.searchParams.get("fileId");
    if (fileId) {
      const id = z.string().min(1).max(100).parse(fileId);
      if (!req.nextUrl.searchParams.has("chunk")) fail(400, "请指定文件分块序号。");
      const index = z.coerce.number().int().min(0).max(9).parse(req.nextUrl.searchParams.get("chunk"));
      const file = await db().workFile.findUnique({ where: { id }, include: { work: { select: { groupId: true, memberId: true, publishedAt: true } } } });
      const allowed = file && (file.work.publishedAt ? s.role === "teacher" || s.groupId === file.work.groupId : s.role === "student" && s.memberId === file.work.memberId);
      if (!allowed || !file) fail(404, "找不到该作品文件，或无权访问。");
      const chunk = await db().workChunk.findUnique({ where: { fileId_index: { fileId: id, index } } });
      if (!chunk || index >= file.chunkCount) fail(404, "找不到该文件分块。");
      return new NextResponse(chunk.bytes, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(chunk.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const groupQuery = req.nextUrl.searchParams.get("group") ?? req.nextUrl.searchParams.get("groupId");
    const groupId = s.role === "teacher" ? groupQuery === null ? undefined : z.coerce.number().int().min(1).max(GROUP_NAMES.length).parse(groupQuery) : s.groupId;
    const works = await db().workSubmission.findMany({ where: { ...(groupId === undefined ? {} : { groupId }), publishedAt: { not: null } }, include: includeWork, orderBy: [{ publishedAt: "desc" }, { version: "desc" }] });
    return json({ works: works.map(displayWork) });
  } catch (error) { return handle(error); }
}
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) fail(403, "请通过本课程网站提交作品。");
    const s = await authenticated(); const { groupId, memberId, name } = contributor(s);
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.startsWith("multipart/form-data")) {
      const bytes = await boundedBody(req, WORK_CHUNK_SIZE + 250_000);
      const form = await new Request(req.url, { method: "POST", headers: { "Content-Type": contentType }, body: bytes }).formData();
      if (form.get("action") !== "chunk") fail(400, "上传分块操作不正确。");
      const workId = z.string().min(1).max(100).parse(form.get("workId"));
      const fileId = z.string().min(1).max(100).parse(form.get("fileId"));
      const index = z.coerce.number().int().min(0).max(9).parse(form.get("index"));
      const file = form.get("file");
      if (!(file instanceof File) || file.size < 1 || file.size > WORK_CHUNK_SIZE) fail(400, "每个文件分块须大于零且不超过 2 MB。");
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "WorkSubmission" WHERE id = ${workId} AND "memberId" = ${memberId} AND "groupId" = ${groupId} FOR UPDATE`;
        const work = await tx.workSubmission.findFirst({ where: { id: workId, groupId, memberId } });
        if (!work) fail(404, "找不到自己的作品草稿。");
        if (work.publishedAt) fail(409, "已提交版本不可修改，请创建新的作品提交。");
        const metadata = await tx.workFile.findFirst({ where: { id: fileId, workId } });
        if (!metadata || index >= metadata.chunkCount) fail(400, "文件或分块序号与草稿不匹配。");
        if (file.size !== expectedWorkChunkSize(metadata.size, index)) fail(400, "分块大小与文件登记信息不一致，请重新选择原文件上传。");
        await tx.workChunk.upsert({ where: { fileId_index: { fileId, index } }, create: { fileId, index, bytes: fileBytes, size: file.size }, update: { bytes: fileBytes, size: file.size } });
      });
      return json({ ok: true });
    }
    if (!contentType.startsWith("application/json")) fail(415, "请使用网页的作品提交表单。");
    const input = z.object({ action: z.string().max(30) }).passthrough().parse(JSON.parse(new TextDecoder().decode(await boundedBody(req, 100_000))));
    const { action, ...values } = input;
    if (action === "create") {
      const parsed = createWorkSchema.parse(values);
      const requestId = parsed.requestId ?? randomUUID();
      const fingerprint = createHash("sha256").update(JSON.stringify({ title: parsed.title, kind: parsed.kind, description: parsed.description, links: parsed.links, files: parsed.files })).digest("hex");
      const work = await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
        const found = await tx.workSubmission.findUnique({ where: { memberId_requestId: { memberId, requestId } }, include: includeWork });
        if (found) { if (found.fingerprint !== fingerprint) fail(409, "同一次提交的内容已有变化，请重新发起新的提交。"); return found; }
        return tx.workSubmission.create({ data: { groupId, memberId, requestId, fingerprint, title: parsed.title, kind: parsed.kind, description: parsed.description,
          links: parsed.links as Prisma.InputJsonValue, submittedBy: name, files: { create: parsed.files.map((file, position) => ({ ...file, position })) } }, include: includeWork });
      });
      return json({ id: work.id, files: work.files });
    }
    const { id } = z.object({ id: z.string().min(1).max(100) }).strict().parse(values);
    if (action === "discard") {
      await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "WorkSubmission" WHERE id = ${id} AND "memberId" = ${memberId} AND "groupId" = ${groupId} FOR UPDATE`;
        const work = await tx.workSubmission.findFirst({ where: { id, groupId, memberId } });
        if (!work) fail(404, "找不到自己的作品草稿。");
        if (work.publishedAt) fail(409, "已提交版本不可删除；请提交新的版本。");
        await tx.workSubmission.delete({ where: { id } });
      });
      return json({ ok: true });
    }
    if (action === "publish") {
      const work = await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "WorkSubmission" WHERE id = ${id} AND "memberId" = ${memberId} AND "groupId" = ${groupId} FOR UPDATE`;
        const current = await tx.workSubmission.findFirst({ where: { id, groupId, memberId }, include: includeWork });
        if (!current) fail(404, "找不到自己的作品草稿。");
        if (current.publishedAt) return current;
        const links = z.array(z.object({ url: z.string(), label: z.string() })).parse(current.links);
        if (!current.files.length && !links.length) fail(422, "请至少添加一个作品文件或链接。");
        for (const file of current.files) {
          const chunks = await tx.workChunk.findMany({ where: { fileId: file.id }, orderBy: { index: "asc" } });
          if (chunks.length !== file.chunkCount || chunks.some((chunk, index) => chunk.index !== index || chunk.size !== expectedWorkChunkSize(file.size, index) || chunk.bytes.byteLength !== chunk.size)) fail(422, `「${file.filename}」还未完整上传，请重试上传。`);
          const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk.bytes)), file.size);
          const problem = validateWorkFileMagic(file.filename, bytes);
          if (problem) fail(422, `「${file.filename}」：${problem}`);
        }
        const latest = await tx.workSubmission.findFirst({ where: { groupId, publishedAt: { not: null } }, orderBy: { version: "desc" }, select: { version: true } });
        return tx.workSubmission.update({ where: { id }, data: { version: (latest?.version ?? 0) + 1, publishedAt: new Date() }, include: includeWork });
      }, { maxWait: 10_000, timeout: 60_000 });
      return json({ work: displayWork(work) });
    }
    fail(400, "无法执行此作品操作。");
  } catch (error) { return handle(error); }
}
