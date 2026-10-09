-- Preserve existing group IDs, including the practice group at ID 26.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CourseMetadata" WHERE "id" = 1 AND "courseId" = 'INT6136P') THEN
    RAISE EXCEPTION 'Course database mismatch: this migration requires INT6136P.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Group" WHERE ("id" = 27 AND "name" <> '恋上AI') OR ("name" = '恋上AI' AND "id" <> 27)) THEN
    RAISE EXCEPTION 'Group ID or name conflict: existing records have not been changed.';
  END IF;
END $$;

INSERT INTO "Group" ("id", "name", "updatedAt")
VALUES (27, '恋上AI', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
