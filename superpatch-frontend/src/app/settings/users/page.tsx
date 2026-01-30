import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { UsersManagement } from './users-management'
import type { UserProfile } from '@/lib/db/types'

export default async function UsersPage() {
  // Verify admin access
  const { user } = await requireAdmin()
  
  // Fetch all users
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="container max-w-4xl py-8">
      <UsersManagement 
        initialUsers={(users || []) as UserProfile[]} 
        currentUserId={user.id}
      />
    </div>
  )
}
