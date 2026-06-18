import { NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import SemisDocument, { SemisDocumentProps } from '@/lib/pdf/semis-document'

export const dynamic = 'force-dynamic'

// POST /api/pdf/semis
// body: SemisDocumentProps
// Retourne un PDF bon de travail pour un semis validé
export async function POST(req: NextRequest) {
  const body: SemisDocumentProps = await req.json()

  if (!body.lignes || !body.dateSemis) {
    return Response.json({ error: 'lignes et dateSemis requis' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(SemisDocument, body) as any)

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="semis-${body.dateSemis}.pdf"`,
    },
  })
}
