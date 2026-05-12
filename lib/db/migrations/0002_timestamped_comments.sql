CREATE TYPE "public"."comment_status" AS ENUM('open', 'resolved');--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_author_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "comments" RENAME COLUMN "author_id" TO "author_user_id";--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "time_range_start_seconds" real;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "time_range_end_seconds" real;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "status" "comment_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
UPDATE "comments"
SET "project_id" = "tracks"."project_id"
FROM "tracks"
WHERE "comments"."track_id" = "tracks"."id";--> statement-breakpoint
UPDATE "comments" SET "status" = 'resolved' WHERE "resolved_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "track_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "resolved_at";--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_project_idx" ON "comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "comments_project_timestamp_idx" ON "comments" USING btree ("project_id","timestamp_seconds");
