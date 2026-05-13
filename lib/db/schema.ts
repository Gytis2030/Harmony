import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  real,
  bigint,
  jsonb,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core'

export const planEnum = pgEnum('plan', ['free', 'pro'])
export const workspaceMemberRoleEnum = pgEnum('workspace_member_role', [
  'owner',
  'editor',
  'viewer',
])
export const commentStatusEnum = pgEnum('comment_status', ['open', 'resolved'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  plan: planEnum('plan').default('free').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: workspaceMemberRoleEnum('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index('workspace_members_user_idx').on(t.userId),
  ]
)

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    bpm: integer('bpm'),
    timeSignatureNumerator: integer('time_signature_numerator').default(4).notNull(),
    timeSignatureDenominator: integer('time_signature_denominator').default(4).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('projects_workspace_idx').on(t.workspaceId),
    index('projects_deleted_at_idx').on(t.deletedAt),
  ]
)

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    volume: real('volume').default(1.0).notNull(),
    isMuted: boolean('is_muted').default(false).notNull(),
    isSoloed: boolean('is_soloed').default(false).notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('tracks_project_idx').on(t.projectId)]
)

export const audioFiles = pgTable('audio_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id),
  r2Key: text('r2_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  durationSeconds: real('duration_seconds'),
  waveformData: jsonb('waveform_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    trackId: uuid('track_id').references(() => tracks.id),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    timestampSeconds: real('timestamp_seconds').notNull(),
    timeRangeStartSeconds: real('time_range_start_seconds'),
    timeRangeEndSeconds: real('time_range_end_seconds'),
    status: commentStatusEnum('status').default('open').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('comments_project_idx').on(t.projectId),
    index('comments_track_idx').on(t.trackId),
    index('comments_project_timestamp_idx').on(t.projectId, t.timestampSeconds),
    index('comments_project_pinned_idx').on(t.projectId, t.isPinned),
  ]
)

export const commentReplies = pgTable(
  'comment_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('comment_replies_comment_idx').on(t.commentId),
    index('comment_replies_author_idx').on(t.authorUserId),
  ]
)

export const projectVersions = pgTable(
  'project_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    projectTitle: text('project_title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('project_versions_project_idx').on(t.projectId)]
)

export const projectVersionTracks = pgTable(
  'project_version_tracks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    versionId: uuid('version_id')
      .notNull()
      .references(() => projectVersions.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id').references(() => tracks.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    volume: real('volume').notNull(),
    isMuted: boolean('is_muted').notNull(),
    isSoloed: boolean('is_soloed').notNull(),
    color: text('color'),
    r2Key: text('r2_key'),
    originalFilename: text('original_filename'),
    durationSeconds: real('duration_seconds'),
  },
  (t) => [index('project_version_tracks_version_idx').on(t.versionId)]
)
