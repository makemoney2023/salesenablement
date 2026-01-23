"use client";

import { AppShell } from "@/components/layout/app-shell";

export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell defaultMarket="b2b">{children}</AppShell>;
}
