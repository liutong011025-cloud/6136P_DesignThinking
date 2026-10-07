import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db, verifyCourseDatabase, CourseMismatchError } from "@/lib/db";
import { session, setSession, clearSession, teacherPasswordMatches } from "@/lib/auth";
import { GROUP_NAMES, GROUP_MEMBER_LIMIT, PRACTICE_GROUP_ID, STEPS, type StepKey } from "@/lib/course";
import { definitionIssues, draftPatchSchema, empathizeIssues, fullDraft, observationSchema, isResearchSource, localizedZodIssues } from "@/lib/validation";
import { findingsIssues, focusIssues, optionalInterpretationIssues, stepAccess } from "@/lib/learning-path";
import type { Prisma } from "@/generated/prisma/client";
import { sameOrigin } from "@/lib/origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const includeProject = {
  members: { select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
  observations: { orderBy: { createdAt: "asc" as const }, include: {
    member: { select: { id: true, name: true } },
    comments: { orderBy: { createdAt: "asc" as const }, include: { member: { select: { id: true, name: true } } } },
    attachment: { select: { id: true, filename: true, size: true } }
  } },
  submissions: { orderBy: { version: "desc" as const } },
  feedback: { orderBy: { createdAt: "desc" as const } }
};
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
class ApiError extends Error { constructor(public status: number, message: string, public extra = {}) { super(message); } }
function fail(status: number, message: string): never { throw new ApiError(status, message); }
function handleError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message, ...error.extra }, error.status);
  if (error instanceof CourseMismatchError) return json({ error: error.message }, 503);
  if (error instanceof z.ZodError) return json({ error: "请检查填写内容。", details: localizedZodIssues(error) }, 400);
  console.error("Studio request failed:", error instanceof Error ? error.message : "unknown error");
  return json({ error: "课程工作区暂时无法连接，请重试或联系 Nicole。" }, 503);
}
async function ensureGroups() {
  await db().group.createMany({ data: GROUP_NAMES.map((name, i) => ({ id: i + 1, name })), skipDuplicates: true });
}
export async function GET(req: NextRequest) {
  try {
    await verifyCourseDatabase();
    const s = await session();
    if (!s) return json({ session: null }, 401);
    if (req.nextUrl.searchParams.get("reflection") === "1" && s.memberId) {
      const item = await db().reflection.findUnique({ where: { memberId: s.memberId } });
      return json({ body: item?.body ?? "" });
    }
    if (s.role === "teacher" && !req.nextUrl.searchParams.has("group")) {
      await ensureGroups();
      const groups = await db().group.findMany({ orderBy: { id: "asc" }, include: {
        members: { select: { id: true, name: true } },
        _count: { select: { observations: true, submissions: true } },
        submissions: { orderBy: { version: "desc" }, take: 1, select: { createdAt: true, version: true } },
        feedback: { orderBy: { createdAt: "desc" }, take: 1 }
      } });
      return json({ session: s, groups });
    }
    const groupId = s.role === "teacher" ? Number(req.nextUrl.searchParams.get("group")) : s.groupId;
    const group = await db().group.findUnique({ where: { id: groupId }, include: includeProject });
    if (!group) fail(404, "找不到此小组。");
    return json({ session: s, group });
  } catch (e) { return handleError(e); }
}
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) fail(403, "请通过本课程网站修改内容。");
    if (Number(req.headers.get("content-length") ?? 0) > 100000) fail(413, "填写内容过长，请缩减后重试。");
    await verifyCourseDatabase();
    const input = await req.json();
    const action = z.string().parse(input.action);
    if (action === "login") {
      await ensureGroups();
      if (input.group === "Nicole") {
        const password = z.string().max(200).parse(input.password);
        const key = createHash("sha256").update(req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").digest("hex");
        const old = await db().loginLimit.findUnique({ where: { key } });
        if (old && old.expiresAt > new Date() && old.count >= 10) fail(429, "尝试次数过多，请在 15 分钟后重试。");
        if (!teacherPasswordMatches(password)) {
          if (!old || old.expiresAt <= new Date()) await db().loginLimit.upsert({ where: { key }, create: { key, count: 1, expiresAt: new Date(Date.now() + 900000) }, update: { count: 1, expiresAt: new Date(Date.now() + 900000) } });
          else await db().loginLimit.update({ where: { key }, data: { count: { increment: 1 } } });
          fail(401, "教师密码不正确，请重试。");
        }
        await db().loginLimit.deleteMany({ where: { key } });
        await setSession({ role: "teacher", name: "Nicole" });
        return json({ destination: "/teacher" });
      }
      const groupId = z.coerce.number().int().min(1).max(GROUP_NAMES.length).parse(input.group);
      const name = z.string().trim().min(1).max(60).parse(input.name).normalize("NFKC").replace(/\s+/g, " ");
      const nameKey = name.toLocaleLowerCase("en");
      const member = await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
        const found = await tx.member.findUnique({ where: { groupId_nameKey: { groupId, nameKey } } });
        if (found) return found;
        if (GROUP_MEMBER_LIMIT > 0 && groupId !== PRACTICE_GROUP_ID && await tx.member.count({ where: { groupId } }) >= GROUP_MEMBER_LIMIT) fail(409, "此组已达到人数上限，请使用已登记姓名或联系 Nicole 修正成员名单。");
        return tx.member.create({ data: { groupId, name, nameKey } });
      });
      await setSession({ role: "student", name: member.name, groupId, memberId: member.id });
      return json({ destination: "/project/observation" });
    }
    if (action === "logout") { await clearSession(); return json({ ok: true }); }
    const s = await session();
    if (!s) fail(401, "请先选择小组并登录。");
    if (action === "feedback") {
      if (s.role !== "teacher") fail(403, "只有 Nicole 可以添加教师反馈。");
      const groupId = z.number().int().min(1).max(GROUP_NAMES.length).parse(input.groupId);
      const body = z.string().trim().min(5).max(5000).parse(input.body);
      await db().feedback.create({ data: { groupId, body } });
      return json({ ok: true });
    }
    if (action === "removeMember") {
      if (s.role !== "teacher") fail(403, "只有 Nicole 可以修改成员名单。");
      const memberId = z.string().parse(input.memberId);
      await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
        const member = await tx.member.findUnique({ where: { id: memberId }, include: { _count: { select: { observations: true, comments: true, works: { where: { publishedAt: { not: null } } } } }, reflection: true } });
        if (!member) fail(404, "找不到该成员。");
        if (member._count.observations || member._count.comments || member._count.works || member.reflection) fail(409, "该成员已有贡献记录或已提交作品，记录将保留；如需修正，请联系课程负责人。");
        await tx.workSubmission.deleteMany({ where: { memberId, publishedAt: null } });
        await tx.member.delete({ where: { id: memberId } });
      });
      return json({ ok: true });
    }
    if (s.role !== "student" || !s.memberId || !s.groupId) fail(403, "请使用学生身份填写小组内容。");
    const groupId = s.groupId, memberId = s.memberId;
    if (action === "checkStep") {
      const step = z.enum(STEPS.map(item => item.key) as [StepKey, ...StepKey[]]).parse(input.step);
      const group = await db().group.findUniqueOrThrow({ where: { id: groupId }, include: includeProject });
      const blocked = stepAccess(step, {
        draft: fullDraft(group.draft), observations: group.observations, memberId,
        empathizeCompleted: !!group.empathizeCompletedAt, submissionCount: group.submissions.length
      });
      if (blocked) throw new ApiError(422, `请先完成「${STEPS.find(item => item.key === blocked.step)!.title}」再继续。`, { details: blocked.issues, blockedStep: blocked.step });
      return json({ ok: true });
    }
    if (action === "observation") {
      const values = observationSchema.parse(input.values);
      if (input.id) {
        const id = z.string().parse(input.id);
        const result = await db().observation.updateMany({ where: { id, groupId, memberId }, data: values });
        if (!result.count) fail(403, "只能修改自己的阅读或体验记录。");
        return json({ id });
      }
      const item = await db().observation.create({ data: { ...values, groupId, memberId } });
      return json({ id: item.id });
    }
    if (action === "deleteObservation") {
      const id = z.string().parse(input.id);
      await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
        const result = await tx.observation.deleteMany({ where: { id, groupId, memberId } });
        if (!result.count) fail(403, "只能删除自己的阅读或体验记录。");
        const group = await tx.group.findUniqueOrThrow({ where: { id: groupId } });
        const d = fullDraft(group.draft);
        d.selectedEvidenceIds = d.selectedEvidenceIds.filter(v => v !== id);
        for (const list of [d.interpretations, d.patterns, d.candidates, d.seminarSections]) for (const item of list) item.evidenceIds = item.evidenceIds.filter(v => v !== id);
        await tx.group.update({ where: { id: groupId }, data: { draft: d as unknown as Prisma.InputJsonValue, revision: { increment: 1 } } });
      });
      return json({ ok: true });
    }
    if (action === "comment") {
      const observationId = z.string().parse(input.observationId);
      const body = z.string().trim().min(1).max(2000).parse(input.body);
      if (!await db().observation.findFirst({ where: { id: observationId, groupId } })) fail(403, "该资料属于其他小组，无法访问。");
      await db().comment.create({ data: { observationId, memberId, body } });
      return json({ ok: true });
    }
    if (action === "draft") {
      const revision = z.number().int().nonnegative().parse(input.revision);
      const patch = draftPatchSchema.parse(input.patch);
      const current = await db().group.findUniqueOrThrow({ where: { id: groupId } });
      const next = { ...fullDraft(current.draft), ...patch };
      const ids = [...next.selectedEvidenceIds, ...next.interpretations.flatMap(v => v.evidenceIds), ...next.patterns.flatMap(v => v.evidenceIds), ...next.candidates.flatMap(v => v.evidenceIds), ...next.seminarSections.flatMap(v => v.evidenceIds)];
      const notes = await db().observation.findMany({ where: { groupId }, select: { id: true, source: true } });
      if (ids.some(id => !notes.some(n => n.id === id))) fail(400, "关联资料已不存在或不属于本组，请刷新工作区。");
      if (next.selectedEvidenceIds.some(id => !isResearchSource(notes.find(n => n.id === id)?.source ?? ""))) fail(400, "个人经验或待验证想法不能选作已发表研究依据。");
      const result = await db().group.updateMany({ where: { id: groupId, revision }, data: { draft: next as unknown as Prisma.InputJsonValue, revision: { increment: 1 } } });
      if (!result.count) throw new ApiError(409, "组员已更新工作区，请审阅小组最新版本后再保存。", { conflict: true });
      return json({ revision: revision + 1 });
    }
    if (action === "completeEmpathize" || action === "submit") {
      const revision = z.number().int().nonnegative().parse(input.revision);
      const result = await db().$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
        const group = await tx.group.findUniqueOrThrow({ where: { id: groupId }, include: includeProject });
        if (revision !== group.revision) throw new ApiError(409, "小组内容已有更新，请刷新后继续。", { conflict: true });
        const draft = fullDraft(group.draft);
        const problems = [...empathizeIssues(draft, group.observations), ...optionalInterpretationIssues(draft)];
        if (action === "submit") {
          if (!group.empathizeCompletedAt) problems.push("请先完成共情与研究小结。");
          problems.push(...definitionIssues(draft), ...findingsIssues(draft, group.observations), ...focusIssues(draft, group.observations));
        }
        if (problems.length) throw new ApiError(422, problems[0], { details: problems });
        if (action === "completeEmpathize") {
          await tx.group.update({ where: { id: groupId }, data: { empathizeCompletedAt: new Date() } });
          return { ok: true };
        }
        const version = (group.submissions[0]?.version ?? 0) + 1;
        const snapshot = JSON.parse(JSON.stringify({ draft, observations: group.observations, members: group.members }));
        const item = await tx.submission.create({ data: { groupId, version, submittedBy: s.name, snapshot } });
        return { ok: true, version, id: item.id };
      });
      return json(result);
    }
    if (action === "reflection") {
      const body = z.string().trim().max(12000).parse(input.body);
      await db().reflection.upsert({ where: { memberId }, create: { memberId, body }, update: { body } });
      return json({ ok: true });
    }
    fail(400, "无法执行此操作。");
  } catch (e) { return handleError(e); }
}
