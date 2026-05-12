import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'

const client = createClient({
  authEndpoint: '/api/liveblocks-auth',
})

// Presence stays empty until playhead/cursor sharing is introduced
type Presence = Record<string, never>
type Storage = Record<string, never>

export type UserMeta = {
  info: {
    name: string
    email?: string
    color: string
  }
}

export const { RoomProvider, useOthers, useSelf, useStatus } = createRoomContext<
  Presence,
  Storage,
  UserMeta
>(client)
