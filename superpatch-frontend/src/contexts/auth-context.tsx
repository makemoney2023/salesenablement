'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, UserRole } from '@/lib/db/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  role: UserRole | null
  isAdmin: boolean
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ 
  children,
  initialUser,
  initialProfile,
}: { 
  children: React.ReactNode
  initialUser?: User | null
  initialProfile?: UserProfile | null
}) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile ?? null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(!initialUser)
  const router = useRouter()
  const supabase = createClient()

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (err) {
      console.error('Error in fetchProfile:', err)
      return null
    }
  }, [supabase])

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }, [user, fetchProfile])

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        
        if (initialSession?.user) {
          setUser(initialSession.user)
          setSession(initialSession)
          
          // Fetch profile if not provided
          if (!initialProfile) {
            const profileData = await fetchProfile(initialSession.user.id)
            setProfile(profileData)
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (!initialUser) {
      initAuth()
    } else {
      setIsLoading(false)
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_IN' && newSession?.user) {
          setUser(newSession.user)
          setSession(newSession)
          const profileData = await fetchProfile(newSession.user.id)
          setProfile(profileData)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
          setProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession)
        } else if (event === 'USER_UPDATED' && newSession?.user) {
          setUser(newSession.user)
          // Refresh profile on user update
          const profileData = await fetchProfile(newSession.user.id)
          setProfile(profileData)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, initialUser, initialProfile, fetchProfile])

  // Sign out function
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setProfile(null)
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const value: AuthContextType = {
    user,
    profile,
    session,
    role: profile?.role ?? null,
    isAdmin: profile?.role === 'admin',
    isLoading,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
