"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Heart, Trash2, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";

type FavoriteItem = {
  id: string;
  type: "script" | "objection" | "product";
  title: string;
  content: string;
  productName?: string;
  productEmoji?: string;
  market?: string;
  addedAt: Date;
};

// Demo data - in real app, this would come from localStorage or a database
const demoFavorites: FavoriteItem[] = [
  {
    id: "1",
    type: "script",
    title: "Freedom Cold Call Opening",
    content:
      "Hi [Name], I'm calling because many of my clients have been dealing with chronic pain that impacts their daily life. Our Freedom patch offers a clinically-proven, drug-free solution. Do you have 2 minutes to hear how it works?",
    productName: "Freedom",
    productEmoji: "🔵",
    market: "d2c",
    addedAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    type: "objection",
    title: "Price Objection Response",
    content:
      "I understand cost is a concern. At about $3 per day, many customers find SuperPatch replaces multiple products they were using. Plus, with our 30-day guarantee, you can try it completely risk-free.",
    productName: "All Products",
    productEmoji: "⭐",
    addedAt: new Date("2024-01-14"),
  },
  {
    id: "3",
    type: "script",
    title: "REM Sleep Study Talking Point",
    content:
      "In our HARMONI study, 80% of participants stopped using their sleep medications during the 14-day trial. They saw sleep onset times drop from 69 minutes to just 37 minutes - that's 46% faster.",
    productName: "REM",
    productEmoji: "🟣",
    market: "d2c",
    addedAt: new Date("2024-01-13"),
  },
  {
    id: "4",
    type: "product",
    title: "Liberty Quick Reference",
    content:
      "Drug-free balance support. Key stat: 31% improvement in balance scores (p<0.05). Best for seniors, athletes recovering from injury, or anyone concerned about stability.",
    productName: "Liberty",
    productEmoji: "🟢",
    market: "d2c",
    addedAt: new Date("2024-01-12"),
  },
];

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(demoFavorites);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scripts = favorites.filter((f) => f.type === "script");
  const objections = favorites.filter((f) => f.type === "objection");
  const products = favorites.filter((f) => f.type === "product");

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRemove = (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  const FavoriteCard = ({ item }: { item: FavoriteItem }) => (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {item.productEmoji && (
              <span className="text-lg shrink-0">{item.productEmoji}</span>
            )}
            <CardTitle className="text-sm font-medium truncate">
              {item.title}
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {item.type}
          </Badge>
        </div>
        {item.productName && (
          <CardDescription className="text-xs">
            {item.productName}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {item.content}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => handleCopy(item.content, item.id)}
            >
              <Copy className="size-3 mr-1" />
              {copiedId === item.id ? "Copied!" : "Copy"}
            </Button>
            {item.market && (
              <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                <Link href={`/${item.market}/products/${item.productName?.toLowerCase()}`}>
                  <ExternalLink className="size-3 mr-1" />
                  View
                </Link>
              </Button>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from favorites?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove "{item.title}" from your favorites. You can
                  always add it back later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleRemove(item.id)}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ type }: { type: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Heart className="size-12 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">
        No favorite {type} yet.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Click the heart icon on any {type} to save it here.
      </p>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
            <p className="text-sm text-muted-foreground">
              Your saved scripts, objections, and quick references.
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {favorites.length} saved
          </Badge>
        </div>

        {favorites.length === 0 ? (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="text-center py-12">
              <Heart className="size-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-1">No favorites yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Click the heart icon on any script, objection, or product to
                save it here for quick access.
              </p>
              <Button asChild className="mt-4">
                <Link href="/d2c/products">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="flex-1">
            <TabsList>
              <TabsTrigger value="all">
                All ({favorites.length})
              </TabsTrigger>
              <TabsTrigger value="scripts">
                Scripts ({scripts.length})
              </TabsTrigger>
              <TabsTrigger value="objections">
                Objections ({objections.length})
              </TabsTrigger>
              <TabsTrigger value="products">
                Products ({products.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {favorites.map((item) => (
                  <FavoriteCard key={item.id} item={item} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="scripts" className="mt-4">
              {scripts.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {scripts.map((item) => (
                    <FavoriteCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState type="scripts" />
              )}
            </TabsContent>

            <TabsContent value="objections" className="mt-4">
              {objections.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {objections.map((item) => (
                    <FavoriteCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState type="objections" />
              )}
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              {products.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((item) => (
                    <FavoriteCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState type="products" />
              )}
            </TabsContent>
          </Tabs>
        )}
    </div>
  );
}
