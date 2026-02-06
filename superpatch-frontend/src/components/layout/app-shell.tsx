"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AppSidebar } from "./app-sidebar";
import { AuthProvider } from "@/contexts/auth-context";
import { MarketId } from "@/types";
import { products } from "@/data/products";
import { markets } from "@/data/markets";
import type { UserProfile } from "@/lib/db/types";

interface AppShellProps {
  children: React.ReactNode;
  defaultMarket?: MarketId;
  user?: User | null;
  profile?: UserProfile | null;
}

export function AppShell({ children, defaultMarket = "d2c", user, profile }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentMarket, setCurrentMarket] = React.useState<MarketId>(defaultMarket);

  // Global handler for unhandled promise rejections (AbortError from Supabase)
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if it's an AbortError
      if (
        event.reason?.name === 'AbortError' || 
        event.reason?.message?.includes('AbortError') ||
        event.reason?.message?.includes('aborted')
      ) {
        // Prevent the error from propagating
        event.preventDefault();
        console.log('[AppShell] Suppressed AbortError:', event.reason?.message);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  // Extract market from URL if present
  React.useEffect(() => {
    const pathParts = pathname.split("/").filter(Boolean);
    if (pathParts.length > 0 && ["d2c", "b2b", "canadian"].includes(pathParts[0])) {
      setCurrentMarket(pathParts[0] as MarketId);
    }
  }, [pathname]);

  // Handle market change
  const handleMarketChange = (market: MarketId) => {
    setCurrentMarket(market);
    // Navigate to new market's products page
    router.push(`/${market}/products`);
  };

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    const pathParts = pathname.split("/").filter(Boolean);
    const breadcrumbs: { label: string; href?: string }[] = [];

    pathParts.forEach((part, index) => {
      const href = "/" + pathParts.slice(0, index + 1).join("/");
      
      // Check if it's a market
      const market = markets.find(m => m.id === part);
      if (market) {
        breadcrumbs.push({ label: market.shortName, href });
        return;
      }

      // Check if it's a product
      const product = products.find(p => p.id === part);
      if (product) {
        breadcrumbs.push({ label: product.name, href });
        return;
      }

      // Capitalize and format other parts
      const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
      breadcrumbs.push({ label, href });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <AuthProvider initialUser={user} initialProfile={profile}>
      <SidebarProvider>
        <AppSidebar
          currentMarket={currentMarket}
          onMarketChange={handleMarketChange}
          user={user}
          profile={profile}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href || index}>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}





