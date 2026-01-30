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
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  MessageSquare,
  HelpCircle,
  Presentation,
  ShieldQuestion,
  CheckCircle,
  Calendar,
  Zap,
  Copy,
  Star,
  Map,
  Briefcase,
  Target,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { isValidMarket } from "@/data/markets";
import { MarketId } from "@/types";
import { notFound, redirect } from "next/navigation";
import { getCanadianWordTrack } from "@/data/wordtracks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CorporateWellnessPageProps {
  params: Promise<{ market: string }>;
}

const sections = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "opening", label: "Opening", icon: MessageSquare },
  { id: "discovery", label: "Discovery", icon: HelpCircle },
  { id: "presentation", label: "Presentation", icon: Presentation },
  { id: "objections", label: "Objections", icon: ShieldQuestion },
  { id: "closing", label: "Closing", icon: CheckCircle },
  { id: "followup", label: "Follow-Up", icon: Calendar },
  { id: "quickref", label: "Quick Ref", icon: Zap },
];

export default async function CorporateWellnessPage({
  params,
}: CorporateWellnessPageProps) {
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

  // Get word track data
  const wordTrack = getCanadianWordTrack();
  const hasWordTrackData = wordTrack !== null;

  // Helper to safely access quickReference
  const getQuickReference = () => wordTrack?.quickReference;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Briefcase className="size-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Corporate Wellness Program
                </h1>
                {hasWordTrackData && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 py-0 text-[10px] text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                  >
                    Full Word Track
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Canadian Business Wellness Sales Guide
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
                  <MapPin className="size-3 mr-0.5" />
                  Canadian
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
                  Corporate
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${market}/roadmaps`}>
                <Map className="mr-1.5 size-4" />
                Roadmap
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="size-8">
              <Star className="size-4" />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Word Track Tabs */}
        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0 overflow-x-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Icon className="mr-1.5 size-4" />
                  {section.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Program Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {hasWordTrackData ? (
                    <div className="prose prose-sm max-w-none">
                      {wordTrack?.overview?.split("\n\n").map((paragraph, i) => (
                        <p key={i} className="text-muted-foreground">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No overview available.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="size-4" />
                    Quick Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {hasWordTrackData && getQuickReference() ? (
                    <>
                      <div>
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Key Value Propositions
                        </p>
                        <ul className="space-y-1">
                          {getQuickReference()?.keyBenefits.slice(0, 4).map((benefit, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle className="size-3 text-green-600" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div>
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Key Stats
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {getQuickReference()?.keyStats?.slice(0, 4).map((stat, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {stat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      No quick reference available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Opening Scripts Tab */}
          <TabsContent value="opening" className="mt-4 space-y-3">
            {hasWordTrackData &&
            wordTrack?.openingScripts &&
            wordTrack.openingScripts.length > 0 ? (
              wordTrack.openingScripts.map((script) => (
                <Card key={script.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{script.title}</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <CardDescription>{script.scenario}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {script.script || script.content}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No opening scripts available.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Discovery Questions Tab */}
          <TabsContent value="discovery" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Discovery Questions</CardTitle>
                <CardDescription>
                  Questions organized by buyer persona and category
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasWordTrackData &&
                wordTrack?.discoveryQuestions &&
                wordTrack.discoveryQuestions.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {["opening", "pain_point", "impact", "solution"].map((category) => {
                      const questions = wordTrack.discoveryQuestions?.filter(
                        (q) => q.category === category
                      );
                      if (!questions || questions.length === 0) return null;
                      const categoryLabel = category
                        .replace("_", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="text-sm">
                            {categoryLabel} Questions ({questions.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-3">
                              {questions.map((q, i) => (
                                <li key={q.id} className="flex items-start gap-3">
                                  <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                    {i + 1}
                                  </span>
                                  <p className="text-sm text-muted-foreground pt-0.5">
                                    &ldquo;{q.question}&rdquo;
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  <p className="text-muted-foreground">
                    No discovery questions available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Presentation Tab */}
          <TabsContent value="presentation" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Value Presentation - ROI Framework
                </CardTitle>
                <CardDescription>
                  Problem-Agitate-Solve script with ROI focus
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasWordTrackData && wordTrack?.productPresentation ? (
                  <>
                    <div>
                      <Badge
                        variant="outline"
                        className="mb-2 text-red-600 border-red-200 bg-red-50"
                      >
                        Problem
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {typeof wordTrack.productPresentation === "string"
                          ? wordTrack.productPresentation
                          : wordTrack.productPresentation.problem}
                      </p>
                    </div>
                    {typeof wordTrack.productPresentation !== "string" && (
                      <>
                        <Separator />
                        <div>
                          <Badge
                            variant="outline"
                            className="mb-2 text-orange-600 border-orange-200 bg-orange-50"
                          >
                            Agitate
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {wordTrack.productPresentation.agitate}
                          </p>
                        </div>
                        <Separator />
                        <div>
                          <Badge
                            variant="outline"
                            className="mb-2 text-green-600 border-green-200 bg-green-50"
                          >
                            Solve
                          </Badge>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {wordTrack.productPresentation.solve}
                          </p>
                        </div>
                        {wordTrack.productPresentation.fullScript && (
                          <>
                            <Separator />
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="secondary">Full ROI Presentation</Badge>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <Copy className="size-4" />
                                </Button>
                              </div>
                              <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                                {wordTrack.productPresentation.fullScript}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No presentation script available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Objections Tab */}
          <TabsContent value="objections" className="mt-4 space-y-3">
            {hasWordTrackData &&
            wordTrack?.objections &&
            wordTrack.objections.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {wordTrack.objections.map((obj) => (
                  <Card key={obj.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          &ldquo;{obj.objection}&rdquo;
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="size-8">
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Response
                        </p>
                        <p className="text-muted-foreground">{obj.response}</p>
                      </div>
                      {obj.psychology && (
                        <>
                          <Separator />
                          <div>
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              💡 Psychology
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {obj.psychology}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No objection responses available.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Closing Tab */}
          <TabsContent value="closing" className="mt-4 space-y-3">
            {hasWordTrackData &&
            wordTrack?.closingScripts &&
            wordTrack.closingScripts.length > 0 ? (
              wordTrack.closingScripts.map((script) => (
                <Card key={script.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{script.title}</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    {script.type && (
                      <Badge variant="outline" className="w-fit text-[10px]">
                        {script.type.charAt(0).toUpperCase() + script.type.slice(1)}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                      {script.script || script.content}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No closing scripts available.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Follow-Up Tab */}
          <TabsContent value="followup" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Follow-Up Sequence</CardTitle>
                <CardDescription>Multi-day follow-up templates</CardDescription>
              </CardHeader>
              <CardContent>
                {hasWordTrackData &&
                wordTrack?.followUpSequence &&
                wordTrack.followUpSequence.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {wordTrack.followUpSequence.map((item, index) => (
                      <AccordionItem key={index} value={item.day}>
                        <AccordionTrigger className="text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {item.day}
                            </Badge>
                            {item.title}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          {item.email && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  ✉️ Email Template
                                </p>
                                <Button variant="ghost" size="icon" className="size-6">
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                              <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {item.email}
                              </div>
                            </div>
                          )}
                          {item.voicemail && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  📞 Voicemail
                                </p>
                                <Button variant="ghost" size="icon" className="size-6">
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                              <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                                {item.voicemail}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-muted-foreground">
                    No follow-up sequence available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Reference Tab */}
          <TabsContent value="quickref" className="mt-4 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="size-4 text-green-600" />
                  Key Value Propositions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {hasWordTrackData && getQuickReference() ? (
                    getQuickReference()?.keyBenefits.map((benefit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                        {benefit}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">
                      No benefits available.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="size-4 text-blue-600" />
                  Top Discovery Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-inside list-decimal space-y-2">
                  {hasWordTrackData && getQuickReference() ? (
                    getQuickReference()?.bestQuestions.map((question, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {question}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">
                      No questions available.
                    </li>
                  )}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldQuestion className="size-4 text-orange-600" />
                  Top 5 Objection Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {hasWordTrackData && getQuickReference() ? (
                    getQuickReference()?.topObjections.slice(0, 5).map((obj, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium">&ldquo;{obj.objection}&rdquo;</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          → {obj.response || obj.shortResponse}
                        </p>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">
                      No objection responses available.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle className="size-4 text-purple-600" />
                  Closing Techniques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {hasWordTrackData && getQuickReference() ? (
                    getQuickReference()?.bestClosingLines.map((line, i) => (
                      <li key={i} className="rounded-lg bg-muted p-2 text-sm">
                        &ldquo;{line}&rdquo;
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">
                      No closing lines available.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>

            {hasWordTrackData && getQuickReference()?.keyStats && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="size-4 text-yellow-600" />
                    Key Stats to Remember
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {getQuickReference()?.keyStats?.map((stat, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {stat}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}





