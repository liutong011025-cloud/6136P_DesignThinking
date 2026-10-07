import { config } from 'dotenv';
config({ path: '.env.local' }); config();
for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'TEACHER_PASSWORD']) {
  if (!process.env[key]) throw new Error(`请在 Vercel 项目设置的环境变量中添加 ${key}，再部署 INT6136P。`);
}
if (!/^(postgres|postgresql):\/\//.test(process.env.DATABASE_URL)) throw new Error('请使用 INT6136P 独立 PostgreSQL 数据库的 postgres:// 或 postgresql:// 连接地址。');
if (process.env.SESSION_SECRET.length < 32 || process.env.SESSION_SECRET.startsWith('REPLACE_')) throw new Error('请为 INT6136P 生成至少 32 位的独立随机 SESSION_SECRET。');
console.log('INT6136P 部署配置已就绪；迁移和运行时还会检查数据库课程标识。');
