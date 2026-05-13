DROP TABLE IF EXISTS "project_versions" CASCADE;--> statement-breakpoint
CREATE TABLE "project_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_version_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"track_id" uuid,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"volume" real NOT NULL,
	"is_muted" boolean NOT NULL,
	"is_soloed" boolean NOT NULL,
	"color" text,
	"r2_key" text,
	"original_filename" text,
	"duration_seconds" real
);
--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_version_tracks" ADD CONSTRAINT "project_version_tracks_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_version_tracks" ADD CONSTRAINT "project_version_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_versions_project_idx" ON "project_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_version_tracks_version_idx" ON "project_version_tracks" USING btree ("version_id");
