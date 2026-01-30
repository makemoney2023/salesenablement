import { getAuthUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";

const clinicalStudies = [
  {
    id: "restore",
    name: "RESTORE Study",
    productId: "freedom",
    productName: "Freedom",
    productEmoji: "🔵",
    journal: "Pain Therapeutics",
    year: 2025,
    type: "Randomized, Controlled, Double-Blind",
    registration: "ClinicalTrials.gov NCT06505005",
    participants: 118,
    duration: "14 days",
    results: [
      {
        metric: "Pain Severity",
        result: "Significantly greater improvement in active group",
      },
      {
        metric: "Pain Interference",
        result: "Significantly greater reduction in active group",
      },
      {
        metric: "Range of Motion",
        result: "Greater improvement at Day 7 and Day 14",
      },
    ],
    keyStats: [
      { value: "118", label: "Participants" },
      { value: "14", label: "Days" },
      { value: "RCT", label: "Study Type" },
    ],
    talkingPoints: [
      "Double-blind, placebo-controlled RCT",
      "Published in peer-reviewed Pain Therapeutics",
      "ClinicalTrials.gov registered",
      "Significant improvement in pain and ROM",
    ],
  },
  {
    id: "harmoni",
    name: "HARMONI Study",
    productId: "rem",
    productName: "REM",
    productEmoji: "🟣",
    journal: "Sleep Research",
    year: 2024,
    type: "Prospective Clinical Trial",
    participants: 113,
    duration: "14 days",
    results: [
      {
        metric: "Time to Fall Asleep",
        result: "Reduced from 69 min to 37 min (46% faster)",
      },
      {
        metric: "Total Sleep Duration",
        result: "Increased from 5 to 6.5 hours (+1.5 hrs)",
      },
      {
        metric: "Night Waking",
        result: "Reduced from 83% to 22% (74% reduction)",
      },
      {
        metric: "Sleep Medication Use",
        result: "80% stopped medications during study",
      },
    ],
    keyStats: [
      { value: "46%", label: "Faster Sleep" },
      { value: "+1.5hr", label: "More Sleep" },
      { value: "80%", label: "Stopped Meds" },
    ],
    talkingPoints: [
      "46% faster sleep onset",
      "80% stopped sleep medications",
      "+1.5 hours of sleep per night",
      "Only 4.4% adverse events (minor)",
    ],
  },
  {
    id: "balance",
    name: "Balance Study",
    productId: "liberty",
    productName: "Liberty",
    productEmoji: "🟢",
    journal: "Int'l Journal of Physical Medicine & Rehabilitation",
    year: 2022,
    type: "Controlled Comparative Study",
    participants: 69,
    duration: "Single assessment",
    results: [
      {
        metric: "Balance Score",
        result: "31% improvement (statistically significant p<0.05)",
      },
    ],
    keyStats: [
      { value: "31%", label: "Improvement" },
      { value: "p<0.05", label: "Significant" },
      { value: "69", label: "Participants" },
    ],
    talkingPoints: [
      "31% improvement in balance scores",
      "Statistically significant (p<0.05)",
      "Validated Sway Medical Assessment",
      "Falls are #1 injury death cause in 65+",
    ],
  },
];

export default async function EvidencePage() {
  const { user, profile } = await getAuthUser();

  return (
    <AppShell user={user} profile={profile}>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinical Evidence
          </h1>
          <p className="text-sm text-muted-foreground">
            Peer-reviewed studies supporting SuperPatch products.
          </p>
        </div>

        {/* Study Cards */}
        <div className="space-y-4">
          {clinicalStudies.map((study) => (
            <Card key={study.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{study.productEmoji}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{study.name}</CardTitle>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                          {study.productName}
                        </Badge>
                      </div>
                      <CardDescription className="mt-0.5">
                        {study.journal}, {study.year} • {study.type}
                      </CardDescription>
                      <p className="text-xs text-muted-foreground mt-1">
                        {study.participants} participants • {study.duration}
                      </p>
                    </div>
                  </div>

                  {/* Key Stats */}
                  <div className="flex gap-2">
                    {study.keyStats.map((stat, i) => (
                      <div
                        key={i}
                        className="text-center px-3 py-2 bg-muted rounded-lg"
                      >
                        <p className="text-lg font-semibold text-primary">
                          {stat.value}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Results */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      Key Results
                    </p>
                    <div className="space-y-1.5">
                      {study.results.map((result, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{result.metric}:</span>{" "}
                            <span className="text-muted-foreground">
                              {result.result}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Talking Points */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <FileText className="size-3" />
                      Talking Points
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {study.talkingPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-primary font-medium">•</span>
                          <span className="text-muted-foreground">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Separator className="my-4" />

                <Link
                  href={`/d2c/products/${study.productId}`}
                  className="text-sm text-primary hover:underline"
                >
                  View {study.productName} Word Track →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Usage Tips */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              💡 Using Clinical Evidence in Sales
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p>
              <strong>Build Credibility:</strong> Mention studies early to
              establish trust with skeptical prospects.
            </p>
            <p>
              <strong>Handle Objections:</strong> Use specific stats when
              prospects question effectiveness.
            </p>
            <p>
              <strong>B2B Conversations:</strong> Healthcare practitioners
              especially value clinical data.
            </p>
            <p>
              <strong>Don't Overwhelm:</strong> Lead with 1-2 key stats, have
              details ready if asked.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
