-- Additive independent work submissions. Existing course records are preserved.
CREATE TABLE "WorkSubmission" (
  "id" TEXT NOT NULL,
  "groupId" INTEGER NOT NULL,
  "memberId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "links" JSONB NOT NULL DEFAULT '[]',
  "submittedBy" TEXT NOT NULL,
  "version" INTEGER,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkSubmission_kind_check" CHECK ("kind" IN ('ppt', 'prototype', 'tool', 'other'))
);
CREATE TABLE "WorkFile" (
  "id" TEXT NOT NULL,
  "workId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "chunkCount" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "WorkFile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkFile_size_check" CHECK ("size" > 0 AND "size" <= 20000000),
  CONSTRAINT "WorkFile_chunk_count_check" CHECK ("chunkCount" >= 1 AND "chunkCount" <= 10)
);
CREATE TABLE "WorkChunk" (
  "fileId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "bytes" BYTEA NOT NULL,
  "size" INTEGER NOT NULL,
  CONSTRAINT "WorkChunk_pkey" PRIMARY KEY ("fileId", "index"),
  CONSTRAINT "WorkChunk_size_check" CHECK ("size" > 0 AND "size" <= 2000000),
  CONSTRAINT "WorkChunk_index_check" CHECK ("index" >= 0 AND "index" <= 9)
);
CREATE UNIQUE INDEX "WorkSubmission_memberId_requestId_key" ON "WorkSubmission"("memberId", "requestId");
CREATE UNIQUE INDEX "WorkSubmission_groupId_version_key" ON "WorkSubmission"("groupId", "version");
CREATE INDEX "WorkSubmission_groupId_publishedAt_idx" ON "WorkSubmission"("groupId", "publishedAt");
CREATE UNIQUE INDEX "WorkFile_workId_position_key" ON "WorkFile"("workId", "position");
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkFile" ADD CONSTRAINT "WorkFile_workId_fkey" FOREIGN KEY ("workId") REFERENCES "WorkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkChunk" ADD CONSTRAINT "WorkChunk_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "WorkFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
