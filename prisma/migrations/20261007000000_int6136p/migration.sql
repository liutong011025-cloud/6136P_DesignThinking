-- INT6136P uses its own database. Abort before writing if another course is present.
DO $$
BEGIN
  IF to_regclass('public."Group"') IS NOT NULL OR to_regclass('public."CourseMetadata"') IS NOT NULL THEN
    RAISE EXCEPTION 'INT6136P requires a fresh independent database; existing course tables were found. No existing data has been changed.';
  END IF;
END $$;

CREATE TABLE "CourseMetadata" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "courseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseMetadata_pkey" PRIMARY KEY ("id")
);
INSERT INTO "CourseMetadata" ("id", "courseId") VALUES (1, 'INT6136P');
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Group" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "draft" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "empathizeCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "memberId" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceDetail" TEXT NOT NULL DEFAULT '',
    "referenceUrl" TEXT NOT NULL DEFAULT '',
    "publicationYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_groupId_nameKey_key" ON "Member"("groupId", "nameKey");

-- CreateIndex
CREATE INDEX "Observation_groupId_createdAt_idx" ON "Observation"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_observationId_key" ON "Attachment"("observationId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_groupId_version_key" ON "Submission"("groupId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_memberId_key" ON "Reflection"("memberId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Course owner supplied only group names. No student identities or reading records are seeded.
INSERT INTO "Group" ("id", "name", "updatedAt") VALUES
  (1, '獅子山上的青春', CURRENT_TIMESTAMP),
  (2, '连名字都想让AI取', CURRENT_TIMESTAMP),
  (3, 'WIFI密码8个（8）', CURRENT_TIMESTAMP),
  (4, 'ai联盟-aiep', CURRENT_TIMESTAMP),
  (5, '一半儿一半儿', CURRENT_TIMESTAMP),
  (6, '人本智行', CURRENT_TIMESTAMP),
  (7, '豆包Eduhk限定版', CURRENT_TIMESTAMP),
  (8, '刚刚好', CURRENT_TIMESTAMP),
  (9, '收手吧阿组', CURRENT_TIMESTAMP),
  (10, '8 颗神经元', CURRENT_TIMESTAMP),
  (11, '脑洞处理器', CURRENT_TIMESTAMP),
  (12, 'AI打杂天团', CURRENT_TIMESTAMP),
  (13, '全都星', CURRENT_TIMESTAMP),
  (14, '711', CURRENT_TIMESTAMP),
  (15, '唔知叫咩名', CURRENT_TIMESTAMP),
  (16, 'AIEP复仇者联盟', CURRENT_TIMESTAMP),
  (17, 'Aimoney', CURRENT_TIMESTAMP),
  (18, '八方来财', CURRENT_TIMESTAMP),
  (19, '合光共燃', CURRENT_TIMESTAMP),
  (20, '哈吉米南北绿豆', CURRENT_TIMESTAMP),
  (21, '六个核桃队', CURRENT_TIMESTAMP),
  (22, 'AAA教大苹果供应', CURRENT_TIMESTAMP),
  (23, '👑Real-Seven-Eleven', CURRENT_TIMESTAMP),
  (24, '元启TEAM', CURRENT_TIMESTAMP),
  (25, '缘聚大埔山，科技赴新程', CURRENT_TIMESTAMP),
  (26, '测试组', CURRENT_TIMESTAMP);
