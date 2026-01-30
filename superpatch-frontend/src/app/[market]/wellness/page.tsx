import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  Briefcase, 
  TrendingUp,
  ArrowRight,
  MapPin,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { getMarketById, isValidMarket } from "@/data/markets";
import { MarketId } from "@/types";
import { notFound, redirect } from "next/navigation";

interface WellnessPageProps {
  params: Promise<{ market: string }>;
}

export default async function WellnessPage({ params }: WellnessPageProps) {
  const { market } = await params;

  // Only Canadian market has wellness pages
  if (market !== "canadian") {
    if (market === "d2c") {
      redirect("/d2c/products");
    } else if (market === "b2b") {
      redirect("/b2b/practitioners");
    }
    notFound();
  }

  if (!isValidMarket(market)) {
    notFound();
  }

  const marketInfo = getMarketById(market as MarketId);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <MapPin className="size-3 mr-1" />
              {marketInfo?.shortName}
            </Badge>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              Corporate Wellness Program
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Canadian Business Wellness
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Comprehensive sales enablement for selling SuperPatch wellness programs 
            to Canadian businesses through the Chamber of Commerce network.
          </p>
        </div>

        {/* Market Opportunity Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                  <DollarSign className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">$600M-900M</p>
                  <p className="text-xs text-muted-foreground">Annual Market Opportunity</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Building2 className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">200,000+</p>
                  <p className="text-xs text-muted-foreground">Chamber Network Businesses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
                  <Users className="size-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">2.16M</p>
                  <p className="text-xs text-muted-foreground">Potential Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card - Corporate Wellness */}
        <Link href={`/${market}/wellness/corporate`}>
          <Card className="group hover:shadow-lg transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Briefcase className="size-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Corporate Wellness Program</CardTitle>
                    <CardDescription className="mt-1">
                      Complete sales word track for selling SuperPatch to Canadian businesses
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-[10px]">
                        HR Directors
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        SMB Owners
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Chamber Executives
                      </Badge>
                    </div>
                  </div>
                </div>
                <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Opening Scripts</p>
                  <p className="text-xs text-muted-foreground">
                    Cold calls, emails, LinkedIn, referrals
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">ROI Framework</p>
                  <p className="text-xs text-muted-foreground">
                    Cost savings, productivity, retention
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Objection Handling</p>
                  <p className="text-xs text-muted-foreground">
                    Budget, skepticism, timing, competition
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Key Value Propositions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <TrendingUp className="size-8 text-green-600 mb-3" />
              <p className="font-medium">20-30%</p>
              <p className="text-xs text-muted-foreground">Reduction in Absenteeism</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <DollarSign className="size-8 text-blue-600 mb-3" />
              <p className="font-medium">25-35%</p>
              <p className="text-xs text-muted-foreground">Lower Pharmaceutical Claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Users className="size-8 text-purple-600 mb-3" />
              <p className="font-medium">60%+</p>
              <p className="text-xs text-muted-foreground">Employee Adoption Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <TrendingUp className="size-8 text-orange-600 mb-3" />
              <p className="font-medium">3-5x</p>
              <p className="text-xs text-muted-foreground">Expected ROI</p>
            </CardContent>
          </Card>
        </div>

        {/* Buyer Personas */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Target Buyer Personas</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">👔</span>
                  <p className="font-medium">HR Directors</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Benefits managers at companies with 100-1000+ employees seeking 
                  to reduce costs and improve employee wellness.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🏢</span>
                  <p className="font-medium">SMB Owners/CEOs</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Small business owners (5-99 employees) looking to compete 
                  with larger companies on benefits.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🤝</span>
                  <p className="font-medium">Chamber Executives</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chamber of Commerce leaders seeking new member benefits 
                  and revenue opportunities.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Ready to start selling?</p>
                <p className="text-sm text-muted-foreground">
                  Access the complete word track with scripts, objection handling, and closing techniques.
                </p>
              </div>
              <Button asChild>
                <Link href={`/${market}/wellness/corporate`}>
                  View Full Word Track
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}





