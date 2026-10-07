import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const migration = await readFile('prisma/migrations/20261007000000_int6136p/migration.sql', 'utf8');
const unrelated = await PGlite.create();
await unrelated.exec(`CREATE TABLE "Group" (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO "Group" VALUES (1, '另一课程的原始记录');`);
await assert.rejects(() => unrelated.exec(migration), /independent database/);
assert.equal((await unrelated.query('SELECT name FROM "Group" WHERE id = 1')).rows[0].name, '另一课程的原始记录');
assert.equal((await unrelated.query(`SELECT to_regclass('public."CourseMetadata"') AS present`)).rows[0].present, null);
await unrelated.close();
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
  const groups = await database.query('SELECT name FROM "Group" ORDER BY id');
  assert.equal(groups.rows.length, 26); assert.equal(groups.rows[0].name, '獅子山上的青春'); assert.equal(groups.rows[24].name, '缘聚大埔山，科技赴新程'); assert.equal(groups.rows[25].name, '测试组');
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM "Member"')).rows[0].count, 0);
  await deploy();
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM "Group"')).rows[0].count, 26);
  console.log('PASS：独立课程标识、25 个正式组与测试组、无预填学生、迁移重跑安全、误连接其他课程时保留原始数据。');
} finally { await server.stop(); await database.close(); }
