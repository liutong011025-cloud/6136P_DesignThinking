import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { applyLocalMigrations } from './local-migrations.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const database = await PGlite.create();
await applyLocalMigrations(database);
const socket = new PGLiteSocketServer({ db: database, port: 54341, host: '127.0.0.1' });
await socket.start();
const base = 'http://127.0.0.1:3011';
const password = randomBytes(16).toString('hex');
const secret = randomBytes(32).toString('hex');
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3011'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54341/postgres?sslmode=disable', LOCAL_DATABASE: '1', SESSION_SECRET: secret, TEACHER_PASSWORD: password }
});
let appExit;
app.on('exit', code => { appExit = code ?? -1; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (appExit !== undefined) throw new Error('独立测试服务器在就绪前退出，请先构建项目。');
    try { const r = await fetch(base + '/api/studio'); if (r.status === 401) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, '独立测试服务器必须成功启动。');
  // This mutation is confined to the disposable test database.
  await database.exec(`UPDATE "CourseMetadata" SET "courseId" = 'INT6066' WHERE id = 1`);
  const mismatched = await fetch(base + '/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ action: 'login', group: 1, name: '拒绝误连接测试' }) });
  assert.equal(mismatched.status, 503); assert.ok((await mismatched.json()).error.includes('课程数据库不匹配'));
  assert.equal((await database.query('SELECT COUNT(*)::int AS count FROM "Member"')).rows[0].count, 0);
  await database.exec(`UPDATE "CourseMetadata" SET "courseId" = 'INT6136P' WHERE id = 1`);
  const worker = spawn(process.execPath, ['tests/integration.mjs'], { stdio: 'inherit', env: { ...process.env, ISOLATED_INTEGRATION: '1', TEST_BASE_URL: base, TEST_TEACHER_PASSWORD: password, TEST_SESSION_SECRET: secret } });
  const [code] = await once(worker, 'exit');
  assert.equal(code, 0, '独立 API 集成测试必须通过。');
  console.log('独立测试数据库已丢弃；两个课程的预览及云端数据库均未改动。');
} finally {
  if (appExit === undefined) { const exited = once(app, 'exit'); app.kill(); await exited; }
  await socket.stop(); await database.close();
}
