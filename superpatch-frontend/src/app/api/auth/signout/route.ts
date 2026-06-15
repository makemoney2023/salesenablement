import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSameOrigin } from '@/lib/csrf'

export async function POST(req: NextRequest) {
  // Same-origin guard. Without this, a malicious site can POST to
  // /api/auth/signout with the user's Supabase auth cookie attached
  // and log them out without their consent (classic CSRF logout
  // attack). The Origin header is set by the browser and cannot be
  // forged from JS, so checking it is sufficient for state-changing
  // cookie-auth endpoints.
  const originCheck = isSameOrigin({
    origin: req.headers.get('origin'),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  })
  if (!originCheck.ok) {
    return NextResponse.json(
      { status: 'error', code: 'forbidden_origin', message: 'Forbidden' },
      { status: 403 },
    )
  }

  // Require an existing session — there is nothing to sign out
  // otherwise, and the redirect-to-login would be a no-op that just
  // helps fingerprint the deploy.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { status: 'error', code: 'unauthorized', message: 'Unauthorized' },
      { status: 401 },
    )
  }

  await supabase.auth.signOut()

  return NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    { status: 302 },
  )
}
