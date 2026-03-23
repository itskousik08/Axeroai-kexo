import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { Box, Connection, Note, Workspace } from '@/lib/database.types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load workspace
    const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
    if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Load all boxes
    const { data: boxes } = await supabase.from('boxes').select('*').eq('workspace_id', workspaceId)

    // Load all connections
    const { data: connections } = await supabase.from('connections').select('*').eq('workspace_id', workspaceId)

    // Load notes
    const { data: notes } = await supabase.from('notes').select('*').eq('workspace_id', workspaceId).single()

    const workspaceData = workspace as Workspace
    const boxData = (boxes || []) as Box[]
    const connectionData = (connections || []) as Connection[]
    const notesData = notes as Note | null

    // Build export — all media stays as Cloudinary URLs (no base64 bloat)
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      workspaceName: workspaceData.name,
      description: workspaceData.description,
      workspace: {
        id: workspaceData.id,
        name: workspaceData.name,
        is_public: workspaceData.is_public,
        settings: workspaceData.settings,
      },
      boxes: boxData.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        content: b.content, // includes YouTube URLs
        url: b.url, // Cloudinary URL for image/audio/pdf
        cloudinary_id: b.cloudinary_id,
        thumbnail_url: b.thumbnail_url,
        duration: b.duration,
        metadata: b.metadata, // includes { videoId } for YouTube
        position: { x: b.pos_x, y: b.pos_y },
        size: { width: b.width, height: b.height },
        color: b.color,
        z_index: b.z_index,
        created_at: b.created_at,
      })),
      connections: connectionData.map((c) => ({
        id: c.id,
        from: c.from_box_id,
        to: c.to_box_id,
        label: c.label,
        style: c.style,
      })),
      notes: notesData?.content || '',
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="kexo-${workspaceData.name.replace(/\s+/g, '-')}.json"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
