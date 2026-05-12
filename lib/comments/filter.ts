import type { CommentDto } from '@/lib/actions/comments'

export type CommentFilter = 'open' | 'resolved' | 'all'

export function filterComments(comments: CommentDto[], filter: CommentFilter): CommentDto[] {
  if (filter === 'all') return comments
  return comments.filter((c) => c.status === filter)
}

export function sortComments(comments: CommentDto[]): CommentDto[] {
  return [...comments].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return a.timestampSeconds - b.timestampSeconds
  })
}

export function countByFilter(comments: CommentDto[]): Record<CommentFilter, number> {
  return {
    open: comments.filter((c) => c.status === 'open').length,
    resolved: comments.filter((c) => c.status === 'resolved').length,
    all: comments.length,
  }
}
