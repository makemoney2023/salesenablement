"use client";

import { notFound } from "next/navigation";
import Image from "next/image";
import { use, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Maximize2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { MarketId } from "@/types";

const MARKETS: Record<string, { name: string; description: string }> = {
  d2c: {
    name: "D2C Sales",
    description: "Direct-to-consumer sales process visualizations",
  },
  b2b: {
    name: "B2B Healthcare",
    description: "Healthcare practitioner sales process visualizations",
  },
  canadian: {
    name: "Canadian Business",
    description: "Canadian corporate wellness sales visualizations",
  },
};

// Map product IDs to their roadmap image files
function getRoadmapImagePath(market: string, productId: string): string {
  return `/roadmaps/${market}/${productId}.png`;
}

interface RoadmapViewerProps {
  roadmap: {
    id: string;
    name: string;
    description: string;
    emoji: string;
    image?: string;
  };
  market: string;
  marketInfo: { name: string; description: string };
}

function RoadmapViewer({ roadmap, market, marketInfo }: RoadmapViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imagePath = getRoadmapImagePath(market, roadmap.id);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleReset = () => setZoom(1);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Maximize2 className="size-4 mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <DialogTitle className="flex items-center gap-2">
              {"image" in roadmap && roadmap.image ? (
                <div className="relative size-6 flex-shrink-0 rounded-full overflow-hidden">
                  <Image
                    src={roadmap.image}
                    alt={roadmap.name}
                    fill
                    className="object-cover"
                    sizes="24px"
                  />
                </div>
              ) : (
                <span>{roadmap.emoji}</span>
              )}
              {roadmap.name} Sales Roadmap
            </DialogTitle>
            <DialogDescription>
              {roadmap.description} - {marketInfo.name}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="size-4" />
            </Button>
            <Badge variant="secondary" className="px-2 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </Badge>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="relative overflow-auto max-h-[calc(95vh-120px)] bg-muted/30 rounded-lg">
          <div
            className="transition-transform duration-200 origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            <Image
              src={imagePath}
              alt={`${roadmap.name} Sales Roadmap`}
              width={3840}
              height={2160}
              className="w-full h-auto"
              onLoad={() => setIsImageLoaded(true)}
              priority
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RoadmapsPage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = use(params);

  if (!MARKETS[market]) {
    notFound();
  }

  const marketInfo = MARKETS[market];

  // For Canadian market, there's only one roadmap
  const roadmaps =
    market === "canadian"
      ? [
          {
            id: "wellness",
            name: "Canadian Business Wellness",
            description: "Corporate wellness program sales process",
            emoji: "🍁",
          },
        ]
      : PRODUCTS.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.tagline,
          emoji: p.emoji,
          image: p.image,
        }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {market.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {roadmaps.length} roadmap{roadmaps.length !== 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {marketInfo.name} Roadmaps
          </h1>
          <p className="text-sm text-muted-foreground">
            {marketInfo.description}
          </p>
        </div>

        {/* Roadmap Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roadmaps.map((roadmap) => {
            const imagePath = getRoadmapImagePath(market, roadmap.id);
            return (
              <Card key={roadmap.id} className="group overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {"image" in roadmap && roadmap.image ? (
                      <div className="relative size-8 flex-shrink-0 rounded-full overflow-hidden">
                        <Image
                          src={roadmap.image}
                          alt={roadmap.name}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      </div>
                    ) : (
                      <span className="text-xl">{roadmap.emoji}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-medium truncate">
                        {roadmap.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        {roadmap.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Image Preview */}
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                    <Image
                      src={imagePath}
                      alt={`${roadmap.name} Roadmap`}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <RoadmapViewer
                        roadmap={roadmap}
                        market={market}
                        marketInfo={marketInfo}
                      />

                      <Button variant="secondary" size="sm" asChild>
                        <a href={imagePath} download={`${roadmap.id}-roadmap.png`}>
                          <Download className="size-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card className="bg-muted/30 mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">About These Roadmaps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              Each roadmap provides a step-by-step visual guide for the sales
              process, from initial contact to close and follow-up.
            </p>
            <p>
              <strong>Resolution:</strong> 4K quality for print and presentation.
            </p>
            <p>
              <strong>Usage:</strong> Display during training, print for desk
              reference, or share digitally with your team.
            </p>
          </CardContent>
        </Card>
    </div>
  );
}
