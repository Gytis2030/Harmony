CREATE TYPE "public"."share_link_access" AS ENUM('view', 'comment');--> statement-breakpoint
CREATE TABLE "project_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"access_level" "share_link_access" NOT NULL,
	"token_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "project_share_grants" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access_level" "share_link_access" NOT NULL,
	"share_link_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_share_grants_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_share_links" ADD CONSTRAINT "project_share_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share_links" ADD CONSTRAINT "project_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share_grants" ADD CONSTRAINT "project_share_grants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share_grants" ADD CONSTRAINT "project_share_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_share_grants" ADD CONSTRAINT "project_share_grants_share_link_id_project_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."project_share_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_share_links_project_idx" ON "project_share_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_share_links_token_hash_idx" ON "project_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "project_share_grants_user_idx" ON "project_share_grants" USING btree ("user_id");
