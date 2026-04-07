import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const createCommentSchema = z.object({
  timestampSec: z.number().min(0),
  body: z.string().trim().min(1).max(1000),
  trackId: z.string().uuid().nullable().optional()
});

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  resolved: z.boolean()
});

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = createCommentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const commentInsert = {
    project_id: params.projectId,
    author_id: user.id,
    timestamp_sec: parsed.data.timestampSec,
    body: parsed.data.body,
    track_id: parsed.data.trackId ?? null
  };

  const { data: comment, error } = await supabase
    .from('comments')
    .insert(commentInsert)
    .select('id, project_id, track_id, author_id, timestamp_sec, body, resolved, created_at, profiles:author_id(full_name, email)')
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create comment.' }, { status: 500 });
  }

  return NextResponse.json({ comment });
}

export async function PATCH(request: Request, { params }: { params: { projectId: string } }) {
  const payload = await request.json();
  const parsed = updateCommentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .update({ resolved: parsed.data.resolved })
    .eq('id', parsed.data.commentId)
    .eq('project_id', params.projectId)
    .select('id, resolved')
    .single();

  if (error || !comment) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update comment.' }, { status: 500 });
  }

  return NextResponse.json({ comment });
}
