import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/db/types'

export interface AuthUser {
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getUser']>>['data']['user']>
  profile: UserProfile | null
}

/**
 * Get the authenticated user and profile from the server.
 * Redirects to login if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
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
