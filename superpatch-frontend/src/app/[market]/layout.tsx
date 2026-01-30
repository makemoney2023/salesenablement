import { getAuthUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { MarketId } from "@/types";

export default async function MarketLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ market: string }>;
}) {
  const { user, profile } = await getAuthUser();
  const resolvedParams = await params;
  const market = resolvedParams.market as MarketId;

  return (
    <AppShell user={user} profile={profile} defaultMarket={market}>
      {children}
    </AppShell>
  );
}
