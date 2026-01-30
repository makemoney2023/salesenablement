import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Users, 
  Shield, 
  User, 
  Mail,
  ChevronRight 
} from 'lucide-react'
import { getAuthUser } from '@/lib/auth'

export default async function SettingsPage() {
  const { user, profile } = await getAuthUser()

  const isAdmin = profile?.role === 'admin'

  const settingsItems = [
    {
      title: 'Profile',
      description: 'Manage your personal information',
      href: '/settings/profile',
      icon: User,
      adminOnly: false,
    },
    {
      title: 'User Management',
      description: 'Invite and manage team members',
      href: '/settings/users',
      icon: Users,
      adminOnly: true,
    },
  ]

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and application settings
        </p>
      </div>

      {/* Current User Info */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {profile?.full_name || user.email}
                </CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
            <Badge variant={isAdmin ? 'default' : 'secondary'}>
              <Shield className="h-3 w-3 mr-1" />
              {profile?.role || 'user'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Settings Sections */}
      <div className="space-y-4">
        {settingsItems.map((item) => {
          // Skip admin-only items for non-admins
          if (item.adminOnly && !isAdmin) {
            return null
          }

          const Icon = item.icon

          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {item.title}
                        {item.adminOnly && (
                          <Badge variant="outline" className="text-xs">Admin</Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
