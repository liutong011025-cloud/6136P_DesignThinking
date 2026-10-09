import { config } from "dotenv";
config({ path: ".env.local" }); config();
import { db, verifyCourseDatabase } from "../src/lib/db";
import { GROUP_NAMES, OFFICIAL_GROUP_COUNT } from "../src/lib/course";
await verifyCourseDatabase();
await db().group.createMany({ data: GROUP_NAMES.map((name, i) => ({ id: i + 1, name })), skipDuplicates: true });
console.log(`INT6136P 的 ${OFFICIAL_GROUP_COUNT} 个正式组及测试组已就绪；已有记录保持不变。`);
await db().$disconnect();
