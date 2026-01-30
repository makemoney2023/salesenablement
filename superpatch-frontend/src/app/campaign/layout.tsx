import { AppShell } from "@/components/layout/app-shell";
import { getAuthUser } from "@/lib/auth";

export default async function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getAuthUser();

  return (
    <AppShell 
      defaultMarket="b2b" 
      user={user} 
      profile={profile}
    >
      {children}
    </AppShell>
  );
}
