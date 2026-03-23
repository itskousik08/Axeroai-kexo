import { NextRequest, NextResponse } from 'next/server'
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const folder = `kexo/${user.id}/${type || 'misc'}`
    const resourceType = type === 'audio' ? 'video' : type === 'pdf' ? 'raw' : 'image'

    const result = await uploadToCloudinary(buffer, {
      folder,
      resource_type: resourceType as any,
    })

    // For PDFs generate a thumbnail via Cloudinary's image delivery
    let thumbnailUrl: string | null = null
    if (type === 'pdf') {
      thumbnailUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/pg_1,f_jpg,q_auto,w_400/${result.public_id}.jpg`
    }

    return NextResponse.json({
      url: result.url,
      publicId: result.public_id,
      thumbnailUrl,
      duration: result.duration || null,
      format: result.format,
      bytes: result.bytes,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { publicId, resourceType = 'image' } = await req.json()
    if (!publicId) return NextResponse.json({ error: 'No publicId' }, { status: 400 })

    await deleteFromCloudinary(publicId, resourceType)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
