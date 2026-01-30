import { AppShell } from '@/components/layout/app-shell'
import { getAuthUser } from '@/lib/auth'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getAuthUser()

  return (
    <AppShell user={user} profile={profile}>
      {children}
    </AppShell>
  )
}
