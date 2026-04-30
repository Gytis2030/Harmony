import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { healthCheck } from '@/lib/db/schema'

export async function GET() {
  try {
    const rows = await db
      .insert(healthCheck)
      .values({})
      .returning({ id: healthCheck.id, createdAt: healthCheck.createdAt })

    return NextResponse.json({
      status: 'ok',
      timestamp: rows[0].createdAt,
    })
  } catch (error) {
    console.error('[health] DB error:', error)
    return NextResponse.json({ status: 'error', message: 'Database unreachable' }, { status: 500 })
  }
}
