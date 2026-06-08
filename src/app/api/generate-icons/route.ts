import { NextResponse } from 'next/server'

// Route utilitaire pour vérifier que l'API fonctionne
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Placez des fichiers icon-192.png et icon-512.png dans /public/' })
}
