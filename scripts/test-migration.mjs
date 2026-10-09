import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const migration = await readFile('prisma/migrations/20261007000000_int6136p/migration.sql', 'utf8');
const addGroupMigration = await readFile('prisma/migrations/20261009000000_add_lian_shang_ai_group/migration.sql', 'utf8');
const unrelated = await PGlite.create();
await unrelated.exec(`CREATE TABLE "Group" (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO "Group" VALUES (1, '另一课程的原始记录');`);
await assert.rejects(() => unrelated.exec(migration), /independent database/);
assert.equal((await unrelated.query('SELECT name FROM "Group" WHERE id = 1')).rows[0].name, '另一课程的原始记录');
assert.equal((await unrelated.query(`SELECT to_regclass('public."CourseMetadata"') AS present`)).rows[0].present, null);
await unrelated.close();
const existingCourse = await PGlite.create();
await existingCourse.exec(migration);
await existingCourse.exec(`INSERT INTO "Member" (id, "groupId", name, "nameKey") VALUES ('migration-member', 1, '迁移测试成员', 'migration-member');
  UPDATE "Group" SET draft = '{"researchArea":"保留原始研究方向"}', revision = 7 WHERE id = 1;
  INSERT INTO "Submission" (id, "groupId", version, snapshot, "submittedBy") VALUES ('migration-plan', 1, 1, '{"draft":{"researchArea":"已提交方案"}}', '迁移测试成员');`);
await existingCourse.exec(await readFile('prisma/migrations/20261007010000_works/migration.sql', 'utf8'));
const originalGroups = (await existingCourse.query('SELECT id, name FROM "Group" ORDER BY id')).rows;
await existingCourse.exec(addGroupMigration);
await existingCourse.exec(addGroupMigration);
const expandedGroups = (await existingCourse.query('SELECT id, name FROM "Group" ORDER BY id')).rows;
assert.deepEqual(expandedGroups.slice(0, 26), originalGroups);
assert.deepEqual(expandedGroups[26], { id: 27, name: '恋上AI' }); assert.equal(expandedGroups.length, 27);
assert.equal((await existingCourse.query('SELECT revision, draft FROM "Group" WHERE id = 1')).rows[0].revision, 7);
assert.equal((await existingCourse.query('SELECT draft FROM "Group" WHERE id = 1')).rows[0].draft.researchArea, '保留原始研究方向');
assert.equal((await existingCourse.query('SELECT name FROM "Member" WHERE id = \'migration-member\'')).rows[0].name, '迁移测试成员');
assert.equal((await existingCourse.query('SELECT snapshot FROM "Submission" WHERE id = \'migration-plan\'')).rows[0].snapshot.draft.researchArea, '已提交方案');
assert.equal((await existingCourse.query('SELECT COUNT(*)::int AS count FROM "WorkSubmission"')).rows[0].count, 0);
await existingCourse.close();
const database = await PGlite.create();
const server = new PGLiteSocketServer({ db: database, host: '127.0.0.1', port: 54340 });
await server.start();
async function deploy() {
  const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54340/postgres?sslmode=disable' }
  });
  assert.equal(await new Promise(resolve => child.on('exit', resolve)), 0, 'Prisma 部署迁移必须成功。');
}
try {
  await deploy();
  assert.equal((await database.query('SELECT "courseId" FROM "CourseMetadata" WHERE id = 1')).rows[0].courseId, 'INT6136P');
  const groups = await database.query('SELECT id, name FROM "Group" ORDER BY id');
  assert.deepEqual(groups.rows.map(g => g.id), Array.from({ length: 27 }, (_, i) => i + 1)); assert.equal(groups.rows[0].name, '獅子山上的青春'); assert.equal(groups.rows[24].name, '缘聚大埔山，科技赴新程'); assert.equal(groups.rows[25].name, '测试组'); assert.equal(groups.rows[26].name, '恋上AI');
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM "Member"')).rows[0].count, 0);
  await deploy();
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM "Group"')).rows[0].count, 27);
  console.log('PASS：独立课程标识、26 个正式组与原编号测试组、新增恋上AI、无预填学生、保留原有组编号及记录、迁移重跑安全、误连接其他课程时保留原始数据。');
} finally { await server.stop(); await database.close(); }
