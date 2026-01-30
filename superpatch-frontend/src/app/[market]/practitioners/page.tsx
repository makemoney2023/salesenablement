import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { getMarketById, isValidMarket } from "@/data/markets";
import { b2bPractitionerTypes } from "@/data/wordtracks";
import { MarketId } from "@/types";
import { notFound, redirect } from "next/navigation";

interface PractitionersPageProps {
  params: Promise<{ market: string }>;
}

// Practitioner icons/emojis
const practitionerEmojis: Record<string, string> = {
  chiropractors: "🦴",
  naturopaths: "🌿",
  acupuncturists: "📍",
  "massage-therapists": "💆",
  "functional-medicine": "🔬",
  "integrative-medicine": "⚕️",
};

// Practitioner descriptions
const practitionerDescriptions: Record<string, string> = {
  chiropractors: "Sales word track for chiropractors focused on spine and nervous system care",
  naturopaths: "Sales word track aligned with naturopathic principles and natural healing",
  acupuncturists: "Sales word track connecting VTT to meridian and energy-based therapy",
  "massage-therapists": "Sales word track for touch-based therapy professionals",
  "functional-medicine": "Sales word track for root-cause focused practitioners",
  "integrative-medicine": "Sales word track bridging conventional and complementary medicine",
};

export default async function PractitionersPage({ params }: PractitionersPageProps) {
  const { market } = await params;

  // Only B2B market has practitioners
  if (market !== "b2b") {
    if (market === "d2c") {
      redirect("/d2c/products");
    } else if (market === "canadian") {
      redirect("/canadian/wellness");
    }
    notFound();
  }

  if (!isValidMarket(market)) {
    notFound();
  }

  const marketInfo = getMarketById(market as MarketId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {marketInfo?.shortName}
            </Badge>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {b2bPractitionerTypes.length} practitioner types
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            B2B Practitioner Word Tracks
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales guides tailored for different healthcare practitioner types
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search practitioners..." className="pl-8 h-9" />
        </div>

        {/* Practitioners Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {b2bPractitionerTypes.map((practitioner) => (
            <Link key={practitioner.id} href={`/${market}/practitioners/${practitioner.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">
                      {practitionerEmojis[practitioner.id] || "👤"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{practitioner.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {practitioner.shortName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {practitionerDescriptions[practitioner.id]}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                        >
                          <Users className="size-3 mr-0.5" />
                          Full Word Track
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
    </div>
  );
}





