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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  MessageSquare,
  ShieldQuestion,
  CheckCircle,
  Copy,
  Star,
  Map,
  FlaskConical,
  Zap,
  Target,
  Calendar,
  Quote,
  User,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getProductById, products } from "@/data/products";
import { isValidMarket } from "@/data/markets";
import { MarketId } from "@/types";
import { notFound } from "next/navigation";
import { getWordTrackByProductAndMarket } from "@/data/wordtracks";

interface ProductDetailPageProps {
  params: Promise<{ market: string; product: string }>;
}

const sections = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "opening", label: "Opening", icon: MessageSquare },
  { id: "discovery", label: "Discovery", icon: Target },
  { id: "presentation", label: "Presentation", icon: Lightbulb },
  { id: "objections", label: "Objections", icon: ShieldQuestion },
  { id: "closing", label: "Closing", icon: CheckCircle },
  { id: "followup", label: "Follow-Up", icon: Calendar },
  { id: "quickref", label: "Quick Ref", icon: Zap },
];

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { market, product: productId } = await params;

  if (!isValidMarket(market)) {
    notFound();
  }

  const product = getProductById(productId);

  if (!product || !product.markets.includes(market as MarketId)) {
    notFound();
  }

  // Get word track data if available
  const wordTrack = getWordTrackByProductAndMarket(productId, market as "d2c" | "b2b" | "canadian");
  const hasWordTrackData = wordTrack !== null;
  
  // Helper functions to safely access wordtrack data (supports both naming conventions)
  const getOverviewText = () => {
    if (!wordTrack) return "";
    return wordTrack.overview || wordTrack.productOverview || "";
  };
  const overviewText = getOverviewText();
  
  const getOpeningScripts = () => wordTrack?.openingScripts || [];
  const getDiscoveryQuestions = () => wordTrack?.discoveryQuestions || [];
  const getProductPresentation = () => {
    if (!wordTrack) return "";
    if (typeof wordTrack.productPresentation === 'string') {
      return wordTrack.productPresentation;
    }
    if (wordTrack.productPresentation) {
      return wordTrack.productPresentation.fullScript || 
             `<p><strong>Problem:</strong> ${wordTrack.productPresentation.problem || ''}</p>
              <p><strong>Agitate:</strong> ${wordTrack.productPresentation.agitate || ''}</p>
              <p><strong>Solve:</strong> ${wordTrack.productPresentation.solve || ''}</p>`;
    }
    return "";
  };
  const getObjections = () => wordTrack?.objections || wordTrack?.objectionHandling || [];
  const getClosingScripts = () => wordTrack?.closingScripts || [];
  const getFollowUpSequence = () => wordTrack?.followUpSequence || wordTrack?.followUpSequences || [];
  const getQuickReference = () => wordTrack?.quickReference;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Product Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative size-16 flex-shrink-0 rounded-full overflow-hidden bg-muted shadow-lg">
              <Image
                src={product.image}
                alt={`${product.name} patch`}
                fill
                className="object-cover"
                sizes="64px"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {product.name}
                </h1>
                {product.hasClinicalStudy && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                  >
                    <FlaskConical className="size-3 mr-0.5" />
                    {product.studyName}
                  </Badge>
                )}
                {hasWordTrackData && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                  >
                    Full Word Track
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {wordTrack?.tagline || product.tagline}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5"
                  style={{
                    borderColor: product.color + "40",
                    color: product.color,
                    backgroundColor: product.color + "10",
                  }}
                >
                  {product.category}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                  {market.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${market}/roadmaps`}>
                <Map className="size-4 mr-1.5" />
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
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className="relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-3 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none text-xs md:text-sm md:px-4"
                  >
                    <Icon className="size-3 md:size-4 mr-1 md:mr-1.5" />
                    <span className="hidden sm:inline">{section.label}</span>
                    <span className="sm:hidden">{section.label.slice(0, 4)}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </ScrollArea>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Product Overview</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  {hasWordTrackData && overviewText ? (
                    <div className="prose prose-sm max-w-none">
                      {overviewText.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: paragraph }} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p>
                        <strong>{product.name}</strong> uses Vibrotactile Technology
                        (VTT) to provide drug-free support for {product.category}-related
                        concerns.
                      </p>
                      <div>
                        <p className="font-medium mb-1.5">How VTT Works</p>
                        <p className="text-muted-foreground">
                          The patch contains a specific pattern that, when in contact
                          with the skin, creates a subtle vibrotactile signal that
                          interacts with the body&apos;s nervous system.
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="font-medium mb-1.5">Key Differentiators</p>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• 100% drug-free and non-invasive</li>
                      <li>• No side effects or contraindications</li>
                      <li>• Can be used alongside other treatments</li>
                      <li>• Immediate application</li>
                      {product.hasClinicalStudy && (
                        <li>• Backed by clinical research ({product.studyName})</li>
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {hasWordTrackData && wordTrack.customerProfile ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="size-4" />
                      Ideal Customer Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-4">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Pain Points
                      </p>
                      <ul className="space-y-1">
                        {wordTrack.customerProfile.painPoints.slice(0, 5).map((point, i) => (
                          <li key={i} className="text-muted-foreground text-xs">
                            &ldquo;{point}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        What They&apos;ve Tried
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {wordTrack.customerProfile.previousSolutions.slice(0, 6).map((solution, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {solution.length > 25 ? solution.slice(0, 25) + '...' : solution}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="size-4" />
                      Quick Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-4">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Key Benefits
                      </p>
                      <ul className="space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="size-3 text-green-600" />
                          Drug-free {product.category} support
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="size-3 text-green-600" />
                          No contraindications
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="size-3 text-green-600" />
                          Works within hours
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="size-3 text-green-600" />
                          Lasts up to 24 hours
                        </li>
                      </ul>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Ideal Customer
                      </p>
                      <p className="text-muted-foreground">
                        People seeking natural alternatives for {product.category}{" "}
                        support, those who want to avoid medications, and
                        health-conscious individuals.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Opening Scripts Tab */}
          <TabsContent value="opening" className="mt-4 space-y-3">
            {hasWordTrackData && getOpeningScripts().length > 0 ? (
              getOpeningScripts().map((script, idx) => (
                <Card key={script.id || idx}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{script.title}</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    {script.scenario && <CardDescription>{script.scenario}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                      {script.script || script.content}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">📞 Cold Call Script</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <CardDescription>Initial outreach call</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                      {`"Hi [Name], this is [Your Name] from Super Patch. 

I'm reaching out because we've developed an innovative drug-free solution for ${product.category} that's getting remarkable results.

Do you have 2 minutes to hear how it works?"`}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">🤝 Referral Opening</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <CardDescription>Following up on a referral</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                      {`"Hi [Name], [Referrer] mentioned you might be interested in a drug-free ${product.category} solution.

They thought our ${product.name} patch could be a great fit. Would you like to hear more?"`}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Discovery Questions Tab */}
          <TabsContent value="discovery" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Discovery Questions</CardTitle>
                <CardDescription>
                  Questions to uncover customer needs and pain points
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasWordTrackData && getDiscoveryQuestions().length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {['opening', 'pain_point', 'pain', 'impact', 'solution'].map((category) => {
                      const questions = getDiscoveryQuestions().filter(q => q.category === category);
                      if (questions.length === 0) return null;
                      const categoryLabel = category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <AccordionItem key={category} value={category}>
                          <AccordionTrigger className="text-sm">
                            {categoryLabel} Questions ({questions.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-3">
                              {questions.map((q, i) => (
                                <li key={q.id || i} className="flex items-start gap-3">
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
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">1</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        &ldquo;What have you tried so far for {product.category}?&rdquo;
                      </p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">2</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        &ldquo;How does {product.category} impact your daily life?&rdquo;
                      </p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">3</span>
                      <p className="text-sm text-muted-foreground pt-0.5">
                        &ldquo;On a scale of 1-10, how much does this affect your quality of life?&rdquo;
                      </p>
                    </li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Presentation Tab */}
          <TabsContent value="presentation" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Product Presentation (P-A-S Framework)</CardTitle>
                <CardDescription>
                  Problem-Agitate-Solve script for your presentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasWordTrackData && getProductPresentation() ? (
                  typeof wordTrack?.productPresentation === 'string' ? (
                    <div 
                      className="prose prose-sm max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: wordTrack.productPresentation }}
                    />
                  ) : wordTrack?.productPresentation ? (
                    <>
                      <div>
                        <Badge variant="outline" className="mb-2 text-red-600 border-red-200 bg-red-50">
                          Problem
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {wordTrack.productPresentation.problem}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2 text-orange-600 border-orange-200 bg-orange-50">
                          Agitate
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {wordTrack.productPresentation.agitate}
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <Badge variant="outline" className="mb-2 text-green-600 border-green-200 bg-green-50">
                          Solve
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {wordTrack.productPresentation.solve}
                        </p>
                      </div>
                      {wordTrack.productPresentation.fullScript && (
                        <>
                          <Separator />
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary">Full 2-Minute Script</Badge>
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
                  ) : null
                ) : (
                  <>
                    <div>
                      <Badge variant="outline" className="mb-2 text-red-600 border-red-200 bg-red-50">
                        Problem
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Many people experience {product.category} issues that significantly impact their quality of life.
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Badge variant="outline" className="mb-2 text-orange-600 border-orange-200 bg-orange-50">
                        Agitate
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        This can lead to frustration, reduced productivity, and a reliance on temporary solutions.
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Badge variant="outline" className="mb-2 text-green-600 border-green-200 bg-green-50">
                        Solve
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        The {product.name} patch offers a revolutionary, drug-free way to address {product.category} issues through Vibrotactile Technology.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Objections Tab */}
          <TabsContent value="objections" className="mt-4 space-y-3">
            {hasWordTrackData && getObjections().length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {getObjections().map((obj, idx) => (
                  <Card key={obj.id || idx}>
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
                    <CardContent className="text-sm space-y-3">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          Response
                        </p>
                        <p className="text-muted-foreground">
                          {obj.response}
                        </p>
                      </div>
                      {obj.psychology && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
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
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        &ldquo;It&apos;s too expensive&rdquo;
                      </CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Response
                      </p>
                      <p className="text-muted-foreground">
                        &ldquo;I understand cost is a consideration. What are you currently
                        spending on {product.category} solutions? When you factor in
                        effectiveness and being completely drug-free, most people find
                        it&apos;s quite economical.&rdquo;
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">&ldquo;Does it really work?&rdquo;</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Response
                      </p>
                      <p className="text-muted-foreground">
                        &ldquo;I appreciate your skepticism. Yes, it works, and we have{" "}
                        {product.hasClinicalStudy
                          ? `clinical studies to back it up. The ${product.studyName} showed significant results.`
                          : "thousands of satisfied customers."}{" "}
                        Want to try it risk-free?&rdquo;
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Closing Tab */}
          <TabsContent value="closing" className="mt-4 space-y-3">
            {hasWordTrackData && getClosingScripts().length > 0 ? (
              getClosingScripts().map((script, idx) => (
                <Card key={script.id || idx}>
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
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Assumptive Close</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                      {`"Great! Should I set you up with a single pack to start, or does the 3-pack make more sense since it includes free shipping?"`}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Trial Close</CardTitle>
                      <Button variant="ghost" size="icon" className="size-8">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-3 font-mono text-sm">
                      {`"We have a satisfaction guarantee, so you can try it risk-free. If you don't see results, we'll make it right. Ready to give it a shot?"`}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Follow-Up Tab */}
          <TabsContent value="followup" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Follow-Up Sequence</CardTitle>
                <CardDescription>
                  Multi-day follow-up templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasWordTrackData && getFollowUpSequence().length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {getFollowUpSequence().map((item, index) => (
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
                          {item.voicemail && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
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
                          {item.email && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  ✉️ Email
                                </p>
                                <Button variant="ghost" size="icon" className="size-6">
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                              <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                                {item.email}
                              </div>
                            </div>
                          )}
                          {item.text && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                  💬 Text
                                </p>
                                <Button variant="ghost" size="icon" className="size-6">
                                  <Copy className="size-3" />
                                </Button>
                              </div>
                              <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                                {item.text}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Badge variant="outline" className="mb-2">Day 1</Badge>
                      <p className="text-sm text-muted-foreground">
                        Send a thank-you email with key benefits and a link to relevant resources.
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Badge variant="outline" className="mb-2">Day 3-4</Badge>
                      <p className="text-sm text-muted-foreground">
                        Check in to see if they have any initial questions or need assistance.
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <Badge variant="outline" className="mb-2">Day 7</Badge>
                      <p className="text-sm text-muted-foreground">
                        Share a success story or a tip for maximizing results.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Reference Tab */}
          <TabsContent value="quickref" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="size-4 text-green-600" />
                    Key Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {hasWordTrackData && getQuickReference()?.keyBenefits ? (
                      getQuickReference()!.keyBenefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                          {benefit}
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                          Drug-free {product.category} support
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                          No contraindications or side effects
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="size-4 text-green-600 mt-0.5 shrink-0" />
                          Works with your body&apos;s natural systems
                        </li>
                      </>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="size-4 text-blue-600" />
                    Best Discovery Questions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-2 list-decimal list-inside">
                    {hasWordTrackData && getQuickReference()?.bestQuestions ? (
                      getQuickReference()!.bestQuestions.map((question, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {question}
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="text-sm text-muted-foreground">
                          What have you tried so far?
                        </li>
                        <li className="text-sm text-muted-foreground">
                          How does this impact your daily life?
                        </li>
                        <li className="text-sm text-muted-foreground">
                          What matters most in a solution?
                        </li>
                      </>
                    )}
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldQuestion className="size-4 text-orange-600" />
                    Top Objection Responses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {hasWordTrackData && getQuickReference()?.topObjections ? (
                      getQuickReference()!.topObjections.map((obj, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-medium">&ldquo;{obj.objection}&rdquo;</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            → {obj.response || obj.shortResponse}
                          </p>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="text-sm">
                          <p className="font-medium">&ldquo;Too expensive&rdquo;</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            → What other factors matter to you beyond price?
                          </p>
                        </li>
                        <li className="text-sm">
                          <p className="font-medium">&ldquo;Does it work?&rdquo;</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            → What would help you feel confident in trying it?
                          </p>
                        </li>
                      </>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Quote className="size-4 text-purple-600" />
                    Best Closing Lines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {hasWordTrackData && getQuickReference()?.bestClosingLines ? (
                      getQuickReference()!.bestClosingLines.map((line, i) => (
                        <li key={i} className="text-sm bg-muted p-2 rounded-lg">
                          &ldquo;{line}&rdquo;
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="text-sm bg-muted p-2 rounded-lg">
                          &ldquo;How many should we start you with today?&rdquo;
                        </li>
                        <li className="text-sm bg-muted p-2 rounded-lg">
                          &ldquo;Would you prefer the single pack or the 3-pack for better value?&rdquo;
                        </li>
                      </>
                    )}
                  </ul>
                </CardContent>
              </Card>

              {hasWordTrackData && getQuickReference()?.keyStats && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical className="size-4 text-green-600" />
                      Key Clinical Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {getQuickReference()!.keyStats!.map((stat, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {stat}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}

export async function generateStaticParams() {
  const params: { market: string; product: string }[] = [];

  products.forEach((product) => {
    product.markets.forEach((market) => {
      params.push({ market, product: product.id });
    });
  });

  return params;
}
