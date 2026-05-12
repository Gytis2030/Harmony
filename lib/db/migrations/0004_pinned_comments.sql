ALTER TABLE "comments" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "comments_project_pinned_idx" ON "comments" USING btree ("project_id","is_pinned");
