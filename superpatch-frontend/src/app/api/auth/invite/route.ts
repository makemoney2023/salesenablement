import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email domain - only allow superpatch.com emails
    const emailLower = email.toLowerCase()
    if (!emailLower.endsWith('@superpatch.com')) {
      return NextResponse.json(
        { error: 'Only @superpatch.com email addresses are allowed' },
        { status: 400 }
      )
    }

    // Validate role
    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Get the current user to verify they're an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if current user is admin
    const { data: currentProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null }

    if (currentProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can invite users' },
        { status: 403 }
      )
    }

    // Use admin client to invite user
    const adminClient = await createAdminClient()
    
    // Invite user via email
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role: role || 'user',
        invited_by: user.id,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    })

    if (error) {
      console.error('Error inviting user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Update the user_profiles table with the role if the user was created
    if (data.user) {
      const { error: profileError } = await adminClient
        .from('user_profiles')
        .upsert({
          id: data.user.id,
          email: email,
          role: role || 'user',
          invited_by: user.id,
        } as any)

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Don't fail the request, the trigger should handle this
      }
    }

    return NextResponse.json({ 
      success: true,
      user: data.user 
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
