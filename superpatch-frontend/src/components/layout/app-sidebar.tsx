"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User as SupabaseUser } from "@supabase/supabase-js";
import {
  User,
  Building,
  MapPin,
  Package,
  Map,
  FlaskConical,
  GraduationCap,
  Star,
  Search,
  Home,
  ChevronDown,
  Users,
  Briefcase,
  Phone,
  PhoneCall,
  CalendarCheck,
  Activity,
  Lightbulb,
  Mail,
  Box,
  Settings,
  LogOut,
  Shield,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import type { UserProfile } from "@/lib/db/types";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarketSwitcher } from "./market-switcher";
import { products } from "@/data/products";
import { b2bPractitionerTypes } from "@/data/wordtracks";
import { MarketId } from "@/types";

// Icon mapping for markets
const marketIcons = {
  d2c: User,
  b2b: Building,
  canadian: MapPin,
};

// Practitioner icons/emojis
const practitionerEmojis: Record<string, string> = {
  chiropractors: "🦴",
  naturopaths: "🌿",
  acupuncturists: "📍",
  "massage-therapists": "💆",
  "functional-medicine": "🔬",
  "integrative-medicine": "⚕️",
};

// Navigation item type
interface NavSubItem {
  title: string;
  url: string;
  image?: string;
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: NavSubItem[];
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentMarket: MarketId;
  onMarketChange?: (market: MarketId) => void;
  user?: SupabaseUser | null;
  profile?: UserProfile | null;
}

// Quick stats hook for sidebar
function useQuickStats() {
  const [stats, setStats] = useState({
    activeCalls: 0,
    queuedCalls: 0,
    todayBooked: 0,
  });

  useEffect(() => {
    // Load stats from localStorage
    const loadStats = () => {
      if (typeof window === "undefined") return;
      
      try {
        const data = localStorage.getItem("superpatch_campaign_calls");
        if (data) {
          const records = JSON.parse(data);
          const today = new Date().toDateString();
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          
          let active = 0;
          let queued = 0;
          let booked = 0;
          let needsCleanup = false;
          
          Object.entries(records).forEach(([id, record]: [string, any]) => {
            const recordDate = new Date(record.updated_at || record.created_at).toDateString();
            const recordTime = new Date(record.updated_at || record.created_at).getTime();
            
            // Clean up stale in_progress records (older than 24 hours)
            if (record.status === "in_progress" && recordTime < oneDayAgo) {
              record.status = "failed";
              needsCleanup = true;
            }
            
            // Only count as active if from today
            if (record.status === "in_progress" && recordDate === today) {
              active++;
            }
            if (record.status === "queued") queued++;
            if (
              (record.status === "booked" || record.status === "calendar_sent") &&
              recordDate === today
            ) {
              booked++;
            }
          });
          
          // Save cleaned up records back to localStorage
          if (needsCleanup) {
            localStorage.setItem("superpatch_campaign_calls", JSON.stringify(records));
          }
          
          setStats({ activeCalls: active, queuedCalls: queued, todayBooked: booked });
        }
      } catch (error) {
        console.error("Failed to load sidebar stats:", error);
      }
    };

    loadStats();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(loadStats, 10000);
    
    // Also listen for storage events
    window.addEventListener("storage", loadStats);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", loadStats);
    };
  }, []);

  return stats;
}

export function AppSidebar({
  currentMarket,
  onMarketChange,
  user,
  profile,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const quickStats = useQuickStats();
  const { counts: badgeCounts } = useSidebarBadges();
  
  // Track mounted state to avoid hydration mismatch with Radix UI dropdowns
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    // Use server-side signout to properly clear cookies
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/signout';
    document.body.appendChild(form);
    form.submit();
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Filter products by current market (for D2C)
  const marketProducts = products.filter((p) =>
    p.markets.includes(currentMarket)
  );

  // Get navigation items based on market
  const getNavigationItems = (): NavItem[] => {
    if (currentMarket === "d2c") {
      // D2C: Show products with images
      return [
        {
          title: "Products",
          url: `/${currentMarket}/products`,
          icon: Package,
          items: marketProducts.map((p) => ({
            title: p.name,
            url: `/${currentMarket}/products/${p.id}`,
            image: p.image,
          })),
        },
      ];
    } else if (currentMarket === "b2b") {
      // B2B: Show practitioners
      return [
        {
          title: "Practitioners",
          url: `/${currentMarket}/practitioners`,
          icon: Users,
          items: b2bPractitionerTypes.map((p) => ({
            title: `${practitionerEmojis[p.id] || "👤"} ${p.name}`,
            url: `/${currentMarket}/practitioners/${p.id}`,
          })),
        },
      ];
    } else if (currentMarket === "canadian") {
      // Canadian: Show wellness program
      return [
        {
          title: "Wellness Program",
          url: `/${currentMarket}/wellness`,
          icon: Briefcase,
          items: [
            {
              title: "🏢 Corporate Wellness",
              url: `/${currentMarket}/wellness/corporate`,
            },
          ],
        },
      ];
    }
    return [];
  };

  // Navigation structure - focused on campaign/call center features
  const navigation: NavItem[] = [
    {
      title: "Call Center",
      url: "/campaign",
      icon: Phone,
    },
    {
      title: "Pathway Insights",
      url: "/campaign/pathway-suggestions",
      icon: Lightbulb,
    },
    {
      title: "Follow-Up Queue",
      url: "/campaign/follow-up-queue",
      icon: Mail,
    },
    {
      title: "Appointments",
      url: "/campaign/appointments",
      icon: CalendarCheck,
    },
    {
      title: "Reports",
      url: "/campaign/reports",
      icon: Activity,
    },
    {
      title: "Sample Requests",
      url: "/campaign/samples",
      icon: Package,
    },
  ];

  // Admin navigation items
  const adminNavigation: NavItem[] = profile?.role === 'admin' ? [
    {
      title: "User Management",
      url: "/settings/users",
      icon: Users,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ] : [];

  return (
    <Sidebar variant="sidebar" collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black p-1">
            <Image
              src="/SuperPatch-SYMBL-3_SuperPatch_Logo_SYMBL_WHT.png"
              alt="SuperPatch"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-sidebar-foreground">
              SuperPatch
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Sales Enablement
            </span>
          </div>
        </div>

        {/* Search Trigger */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="w-full justify-start gap-2 bg-sidebar-accent/50"
              tooltip="Search (⌘K)"
            >
              <Search className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">
                Search...
              </span>
              <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-sidebar-accent px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex group-data-[collapsible=icon]:hidden">
                <span className="text-xs">⌘</span>K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url + "/");

                // If item has sub-items, render as collapsible
                if (item.items && item.items.length > 0) {
                  return (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={isActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            isActive={isActive}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.url}
                                >
                                  <Link href={subItem.url} className="flex items-center gap-2">
                                    {subItem.image ? (
                                      <div className="relative size-5 flex-shrink-0 rounded-full overflow-hidden">
                                        <Image
                                          src={subItem.image}
                                          alt={subItem.title}
                                          fill
                                          className="object-cover"
                                          sizes="20px"
                                        />
                                      </div>
                                    ) : null}
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // Regular menu item - with special handling for Call Center
                if (item.title === "Call Center") {
                  const hasActivity = quickStats.activeCalls > 0 || quickStats.queuedCalls > 0;
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        tooltip={`Call Center${hasActivity ? ` (${quickStats.activeCalls + quickStats.queuedCalls} pending)` : ""}`}
                        isActive={isActive}
                        className="relative"
                      >
                        <Link href={item.url} className="flex items-center gap-2">
                          <div className="relative">
                            <Icon className="h-4 w-4" />
                            {/* Active call pulse indicator */}
                            {quickStats.activeCalls > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                              </span>
                            )}
                          </div>
                          <span className="flex-1">{item.title}</span>
                          {/* Stats badges - hidden when collapsed */}
                          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                            {quickStats.activeCalls > 0 && (
                              <Badge 
                                variant="default" 
                                className="h-5 px-1.5 text-[10px] bg-green-500 hover:bg-green-500"
                              >
                                <PhoneCall className="w-3 h-3 mr-0.5" />
                                {quickStats.activeCalls}
                              </Badge>
                            )}
                            {quickStats.queuedCalls > 0 && (
                              <Badge 
                                variant="secondary" 
                                className="h-5 px-1.5 text-[10px]"
                              >
                                {quickStats.queuedCalls}
                              </Badge>
                            )}
                            {quickStats.todayBooked > 0 && (
                              <Badge 
                                variant="outline" 
                                className="h-5 px-1.5 text-[10px] border-purple-300 text-purple-600"
                              >
                                <CalendarCheck className="w-3 h-3 mr-0.5" />
                                {quickStats.todayBooked}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Regular menu item - with badge support for specific items
                const getBadgeCount = () => {
                  if (item.title === "Sample Requests") return badgeCounts.samples;
                  if (item.title === "Appointments") return badgeCounts.appointments;
                  if (item.title === "Pathway Insights") return badgeCounts.pathwayInsights;
                  if (item.title === "Follow-Up Queue") return badgeCounts.followUpQueue;
                  return 0;
                };

                const badgeCount = getBadgeCount();

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={badgeCount > 0 ? `${item.title} (${badgeCount} new)` : item.title}
                      isActive={isActive}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {badgeCount > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="h-5 px-1.5 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 group-data-[collapsible=icon]:hidden"
                          >
                            {badgeCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section - only visible to admins */}
        {adminNavigation.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        <Link href={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {/* Quick Stats Summary - visible when expanded */}
        {(quickStats.activeCalls > 0 || quickStats.queuedCalls > 0 || quickStats.todayBooked > 0) && (
          <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5 text-[10px] text-sidebar-foreground/60 mb-1.5">
              <Activity className="w-3 h-3" />
              <span>Today&apos;s Activity</span>
            </div>
            <div className="flex items-center gap-2">
              {quickStats.activeCalls > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sidebar-foreground/80">{quickStats.activeCalls} active</span>
                </div>
              )}
              {quickStats.queuedCalls > 0 && (
                <div className="flex items-center gap-1 text-xs text-sidebar-foreground/60">
                  <span>{quickStats.queuedCalls} queued</span>
                </div>
              )}
              {quickStats.todayBooked > 0 && (
                <div className="flex items-center gap-1 text-xs text-purple-400">
                  <CalendarCheck className="w-3 h-3" />
                  <span>{quickStats.todayBooked} booked</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* User Menu - only render dropdown after mount to avoid hydration mismatch */}
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">
                        {profile?.full_name || user.email?.split('@')[0]}
                      </span>
                      <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                        {profile?.role === 'admin' && (
                          <Shield className="h-3 w-3 text-primary" />
                        )}
                        {user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                        <AvatarFallback className="rounded-lg">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {profile?.full_name || user.email?.split('@')[0]}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                      {profile?.role === 'admin' && (
                        <Badge variant="default" className="ml-auto">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {profile?.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings/users" className="cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        User Management
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : mounted && !user ? (
              <SidebarMenuButton asChild>
                <Link href="/login">
                  <User className="h-4 w-4" />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            ) : (
              // Loading skeleton while mounting
              <SidebarMenuButton size="lg" disabled>
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
