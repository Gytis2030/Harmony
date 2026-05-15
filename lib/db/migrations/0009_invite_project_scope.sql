-- Add project_id to workspace_invites so that viewer/commenter invites can be
-- scoped to a single project (creating a projectShareGrant on accept) instead
-- of granting workspace-level membership to all projects.
ALTER TABLE "workspace_invites" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;

-- Make share_link_id nullable on project_share_grants so that invite-based
-- project grants (which have no associated share link) can be stored here.
ALTER TABLE "project_share_grants" ALTER COLUMN "share_link_id" DROP NOT NULL;
