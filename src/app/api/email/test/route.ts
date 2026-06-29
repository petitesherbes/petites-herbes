import { NextResponse } from 'next/server'
import { EMAIL_FROM } from '@/lib/email'
import { Resend } from 'resend'

export async function POST() {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: process.env.EMAIL_DESTINATION || 'petitesherbes@gmail.com',
      subject: '✅ Test — GAEC Les Petites Herbes',
      html: '<h1>Test réussi !</h1><p>L\'application de gestion des semis est bien configurée.</p>',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('email/test error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
