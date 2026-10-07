import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdir } from 'node:fs/promises';
import { applyLocalMigrations } from './local-migrations.mjs';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
config({ path: '.env.local' }); config();
const port = Number(process.env.LOCAL_PG_PORT || 54339);
await mkdir('.local-data', { recursive: true });
const database = await PGlite.create('.local-data/int6136p-postgres');
await applyLocalMigrations(database);
const metadata = await database.query('SELECT "courseId" FROM "CourseMetadata" WHERE id = 1');
if (metadata.rows[0]?.courseId !== 'INT6136P') throw new Error('课程数据库不匹配，请使用 INT6136P 独立的本地数据目录。');
const server = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1' });
await server.start();
const webPort = process.env.PORT || '3010';
const args = process.env.LOCAL_PRODUCTION ? ['start', '-H', '127.0.0.1', '-p', webPort] : ['dev', '-H', '127.0.0.1', '-p', webPort];
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...args], { stdio: 'inherit', env: {
  ...process.env, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
  LOCAL_DATABASE: '1', SESSION_SECRET: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  TEACHER_PASSWORD: process.env.TEACHER_PASSWORD || 'yinyin2948'
} });
console.log('INT6136P 本地预览：http://127.0.0.1:' + webPort + '（独立本地 PostgreSQL 数据库）');
let closing = false;
async function close() { if (closing) return; closing = true; child.kill(); await server.stop(); await database.close(); process.exit(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
child.on('exit', async code => { if (closing) return; closing = true; await server.stop(); await database.close(); process.exit(code ?? 0); });
