# INT6136P 普通话版部署指南

1. 将本项目解压后上传到一个新的 GitHub 仓库。项目根目录应直接包含 package.json、prisma、src、public 和 vercel.json。
2. 在 Vercel 导入该仓库并新建项目，例如 int6136p-seminar-studio。不要选择已有的 INT6066 项目。
3. 给 INT6136P 单独创建 Prisma Postgres 数据库，并连接到这个新项目。不要把 DATABASE_URL 指向 INT6066 数据库。
4. 在 Vercel 项目 Settings → Environment Variables 中确认以下三个变量，勾选 Production 和 Preview；需要本地云库预览时才选择 Development。

| Name | Value |
| --- | --- |
| DATABASE_URL | 新数据库的标准 postgresql:// 或 postgres:// 连接地址 |
| SESSION_SECRET | 至少 32 字符的独立随机密钥，建议 64 位十六进制字符串 |
| TEACHER_PASSWORD | 课程负责人指定的 Nicole 登录密码；当前预览沿用原课程配置 |

SESSION_SECRET 用于验证登录状态，学生不用填写。它不是教师密码，也不是数据库密码。不要给变量加 NEXT_PUBLIC_ 前缀；不要把实际值上传到 GitHub。生成后保持稳定，以免已有登录失效。

可以在自己电脑上用下面的 Node 命令生成随机密钥，把输出仅填入 Vercel：

~~~sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
~~~

5. 保留默认 Next.js 框架。项目已设置 npm run vercel-build，使用 Node 22.x。首次部署会校验变量并创建数据表及 25 个正式组和独立测试组。
6. 如果添加变量前已经部署失败，保存变量后，在 Deployments 中重新点击 Redeploy。旧部署不会自动获得新变量。
7. 看到 Ready 后，打开正式网址。检查组名下拉菜单，先在测试组中试用，再用 Nicole 查看各组进度。

## 常见错误

- “请在 Vercel … 添加 SESSION_SECRET”：该变量没有配置到本次部署的环境，或保存后未重新部署。上传新代码不会替你添加环境变量。
- “TEACHER_PASSWORD”：需单独填写教师密码，不要与 SESSION_SECRET 混用。
- 数据库无法连接：确认新项目拥有自己的 DATABASE_URL，连接格式为标准 PostgreSQL 地址，而不是 prisma+postgres:// 加速服务地址。
- 课程数据库标识不匹配或已存在其他课程数据：新建 INT6136P 数据库并修改连接；不要删表或重置 INT6066 数据库。
- 构建成功但页面空白：检查浏览器和 Vercel 运行日志，确认云数据库在运行时也可访问。

保存是按小组写入数据库，提交是保存不可变的历史版本。重新部署代码不会清空小组数据。数据库迁移使用 migrate deploy，脚本不执行 reset。
