import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { COURSE_ID } from "./course";
const globalDb = globalThis as unknown as { int6136pStudioDb?: PrismaClient };
export class CourseMismatchError extends Error {}
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("缺少 INT6136P 数据库连接配置。");
  if (!globalDb.int6136pStudioDb) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: process.env.LOCAL_DATABASE ? 1 : 4, idleTimeoutMillis: 10000 });
    globalDb.int6136pStudioDb = new PrismaClient({ adapter });
  }
  return globalDb.int6136pStudioDb;
}
export async function verifyCourseDatabase() {
  let metadata;
  try { metadata = await db().courseMetadata.findUnique({ where: { id: 1 } }); }
  catch (error) {
    if ((error as { code?: string }).code === "P2021") throw new CourseMismatchError("此数据库未初始化为 INT6136P；请连接独立的新数据库，不要连接 INT6066。");
    throw error;
  }
  if (!metadata || metadata.courseId !== COURSE_ID) throw new CourseMismatchError("课程数据库不匹配；INT6136P 必须使用独立数据库，不能复用其他课程的数据。");
}
