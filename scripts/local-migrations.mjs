import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Only for local PGlite previews and disposable tests. Vercel uses Prisma migrations.
export async function applyLocalMigrations(database) {
  const folder = fileURLToPath(new URL('../prisma/migrations/', import.meta.url));
  const migrations = (await readdir(folder, { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
  const existing = (await database.query(`SELECT to_regclass('public."Group"') AS present`)).rows[0].present;
  if (existing) {
    const marker = (await database.query(`SELECT to_regclass('public."CourseMetadata"') AS present`)).rows[0].present;
    if (!marker || (await database.query('SELECT "courseId" FROM "CourseMetadata" WHERE id = 1')).rows[0]?.courseId !== 'INT6136P') {
      throw new Error('课程数据库不匹配，请使用 INT6136P 独立的本地数据目录。');
    }
  }
  await database.exec('CREATE TABLE IF NOT EXISTS "LocalMigration" (name TEXT PRIMARY KEY)');
  if (existing) await database.query('INSERT INTO "LocalMigration" (name) VALUES ($1) ON CONFLICT DO NOTHING', ['20261007000000_int6136p']);
  for (const name of migrations) {
    if ((await database.query('SELECT name FROM "LocalMigration" WHERE name = $1', [name])).rows.length) continue;
    await database.transaction(async transaction => {
      await transaction.exec(await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8'));
      await transaction.query('INSERT INTO "LocalMigration" (name) VALUES ($1)', [name]);
    });
  }
}
