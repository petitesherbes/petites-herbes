import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST /api/upload
// FormData: file (File), bucket (string), path (string)
// Utilise la clé service role pour contourner les politiques RLS du Storage
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file   = formData.get('file') as File | null
  const bucket = formData.get('bucket') as string | null
  const path   = formData.get('path') as string | null

  if (!file || !bucket || !path) {
    return Response.json({ error: 'file, bucket et path sont requis' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 413 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Créer le bucket s'il n'existe pas encore
  await supabase.storage.createBucket(bucket, { public: true }).catch(() => {})

  const bytes = await file.arrayBuffer()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (error) {
    console.error('[upload] supabase error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return Response.json({ url: urlData.publicUrl })
}
