-- Allow project-scoped editor grants so a user can be given editor-level
-- access to a single project without becoming a workspace member.
ALTER TYPE "share_link_access" ADD VALUE 'edit';
