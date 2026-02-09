import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/db/types'

export interface AuthUser {
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getUser']>>['data']['user']>
  profile: UserProfile | null
}

/**
 * Result type for API route auth checks.
 * If auth fails, returns a NextResponse (401/403).
 * If auth succeeds, returns the user and profile.
 */
export type ApiAuthResult =
  | { authorized: true; user: AuthUser['user']; profile: UserProfile | null }
  | { authorized: false; response: NextResponse }

/**
 * Check authentication for API routes.
 * Returns JSON 401/403 instead of redirecting (unlike getAuthUser).
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }
    }

    const adminClient = await createAdminClient()
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return {
      authorized: true,
      user,
      profile: profile as UserProfile | null,
    }
  } catch {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Authentication failed' }, { status: 401 }),
    }
  }
}

/**
 * Check authentication + admin role for API routes.
 * Returns JSON 401/403 instead of redirecting.
 */
export async function requireApiAdmin(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth()
  if (!auth.authorized) return auth

  if (auth.profile?.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
    }
  }

  return auth
}

/**
 * Get the authenticated user and profile from the server.
 * Redirects to login if not authenticated.
 * Uses admin client to bypass RLS for reliable profile fetching.
 */
export async function getAuthUser(): Promise<AuthUser> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Use admin client to bypass RLS and reliably fetch profile
  // This is safe because we've already authenticated the user above
  const adminClient = await createAdminClient()
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    user,
    profile: profile as UserProfile | null,
  }
}

/**
 * Get the authenticated user and profile, requiring admin role.
 * Redirects to login if not authenticated, or home if not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const auth = await getAuthUser()
  
  if (auth.profile?.role !== 'admin') {
    redirect('/')
  }
  
  return auth
}
