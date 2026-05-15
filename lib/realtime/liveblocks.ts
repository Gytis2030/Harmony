import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

const client = createClient({
  authEndpoint: '/api/liveblocks-auth',
})

// Presence stays empty until playhead/cursor sharing is introduced
type Presence = Record<string, never>
type Storage = Record<string, never>

export type UserMeta = {
  id: string
  info: {
    id: string
    name: string
    email?: string
    color: string
  }
}

export type CommentRealtimeEvent =
  | { type: 'comment.created'; projectId: string; commentId: string }
  | { type: 'comment.replied'; projectId: string; commentId: string; replyId: string }
  | { type: 'comment.resolved'; projectId: string; commentId: string }
  | { type: 'comment.reopened'; projectId: string; commentId: string }
  | { type: 'comment.deleted'; projectId: string; commentId: string }
  | { type: 'comment.pinned'; projectId: string; commentId: string }
  | { type: 'version.created'; projectId: string; versionId: string }
  | { type: 'version.restored'; projectId: string; versionId: string }
  | { type: 'activity.created'; projectId: string }

export const { RoomProvider, useOthers, useSelf, useStatus, useBroadcastEvent, useEventListener } =
  createRoomContext<Presence, Storage, UserMeta, CommentRealtimeEvent>(client)
