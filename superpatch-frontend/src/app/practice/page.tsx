"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import { PRODUCTS } from "@/data/products";

type Flashcard = {
  id: string;
  objection: string;
  response: string;
  productId: string;
  category: string;
};

// Sample flashcards data
const flashcards: Flashcard[] = [
  {
    id: "1",
    objection: "It's too expensive.",
    response:
      "I understand cost is important. Consider this: many customers find that one patch can replace multiple products they're currently using - supplements, creams, or medications. At about $3 per day, it's often less than their morning coffee. Plus, with our 30-day guarantee, there's zero risk to try it.",
    productId: "all",
    category: "Price",
  },
  {
    id: "2",
    objection: "Does it really work? It sounds too good to be true.",
    response:
      "That's a fair question! Our Freedom patch is backed by the RESTORE study - a double-blind, placebo-controlled clinical trial with 118 participants. It showed statistically significant improvements in pain and range of motion. Would you like me to share the specifics?",
    productId: "freedom",
    category: "Skepticism",
  },
  {
    id: "3",
    objection: "I've tried patches before and they didn't work.",
    response:
      "I hear that often. Traditional patches use drugs or chemicals that absorb through skin. SuperPatch is completely different - it uses Vibrotactile Technology that works with your nervous system through touch receptors. No drugs enter your body. It's a whole new category of wellness.",
    productId: "all",
    category: "Skepticism",
  },
  {
    id: "4",
    objection: "I need to think about it.",
    response:
      "Absolutely, take your time. While you're thinking, consider this: we have a 30-day money-back guarantee. So you can try it risk-free for a month. If it doesn't work for you, just send it back. What questions can I answer to help with your decision?",
    productId: "all",
    category: "Stall",
  },
  {
    id: "5",
    objection: "My doctor hasn't recommended this.",
    response:
      "That makes sense - many doctors aren't yet familiar with VTT technology. The great news is SuperPatch is 100% drug-free and has zero interactions with medications. Many of our customers share their results with their doctors afterwards. Would clinical study information help?",
    productId: "all",
    category: "Authority",
  },
  {
    id: "6",
    objection: "I already take medication for sleep.",
    response:
      "Many of our REM patch users started in the same situation. In our HARMONI study, 80% of participants actually stopped using their sleep medications during the trial. REM works differently - it supports your body's natural sleep patterns without any drugs. It can be used alongside medications while you transition.",
    productId: "rem",
    category: "Competition",
  },
  {
    id: "7",
    objection: "My patients won't believe in patches.",
    response:
      "I understand that concern. What we've found is that results speak louder than explanations. Many practitioners start by trying it themselves, then with a few open-minded patients. Once they see results - like 46% faster sleep onset or significant pain reduction - the conversations become much easier.",
    productId: "all",
    category: "B2B",
  },
  {
    id: "8",
    objection: "We don't have budget for new wellness initiatives right now.",
    response:
      "I completely understand budget constraints. Here's what's interesting: studies show poor sleep and chronic pain cost employers $1,967 per employee annually in lost productivity. A pilot program with SuperPatch typically costs a fraction of that, with measurable ROI within 90 days.",
    productId: "all",
    category: "Budget",
  },
];

export default function PracticePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [productFilter, setProductFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());

  const filteredCards = useMemo(() => {
    return flashcards.filter((card) => {
      const matchesProduct =
        productFilter === "all" || card.productId === productFilter || card.productId === "all";
      const matchesCategory =
        categoryFilter === "all" || card.category === categoryFilter;
      return matchesProduct && matchesCategory;
    });
  }, [productFilter, categoryFilter]);

  const currentCard = filteredCards[currentIndex];
  const categories = Array.from(new Set(flashcards.map((c) => c.category)));

  const goNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
  };

  const goPrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) =>
      prev === 0 ? filteredCards.length - 1 : prev - 1
    );
  };

  const shuffle = () => {
    setIsFlipped(false);
    setCurrentIndex(Math.floor(Math.random() * filteredCards.length));
  };

  const toggleMastered = () => {
    if (!currentCard) return;
    const newMastered = new Set(masteredCards);
    if (newMastered.has(currentCard.id)) {
      newMastered.delete(currentCard.id);
    } else {
      newMastered.add(currentCard.id);
    }
    setMasteredCards(newMastered);
  };

  const masteredCount = filteredCards.filter((c) =>
    masteredCards.has(c.id)
  ).length;
  const progress =
    filteredCards.length > 0 ? (masteredCount / filteredCards.length) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Practice Mode
          </h1>
          <p className="text-sm text-muted-foreground">
            Master objection handling with interactive flashcards.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {PRODUCTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <div className="relative size-5 flex-shrink-0 rounded-full overflow-hidden">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="object-cover"
                        sizes="20px"
                      />
                    </div>
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={shuffle}>
            <Shuffle className="size-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <Progress value={progress} className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {masteredCount}/{filteredCards.length} mastered
          </span>
        </div>

        {/* Flashcard */}
        {currentCard ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Card
              className="w-full max-w-xl cursor-pointer transition-all hover:shadow-lg min-h-[280px] flex flex-col"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={isFlipped ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {isFlipped ? "Response" : "Objection"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {currentCard.category}
                    </Badge>
                    {masteredCards.has(currentCard.id) && (
                      <Badge className="bg-green-600 text-xs">Mastered</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 items-center justify-center py-6">
                <p className="text-center text-lg leading-relaxed">
                  {isFlipped ? (
                    <span className="text-muted-foreground">
                      {currentCard.response}
                    </span>
                  ) : (
                    <span className="font-medium">
                      "{currentCard.objection}"
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrev}>
                <ChevronLeft className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <RotateCcw className="mr-2 size-4" />
                Flip
              </Button>

              <Button
                variant={masteredCards.has(currentCard.id) ? "default" : "outline"}
                size="sm"
                onClick={toggleMastered}
              >
                {masteredCards.has(currentCard.id) ? "✓ Mastered" : "Mark Mastered"}
              </Button>

              <Button variant="outline" size="icon" onClick={goNext}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Card {currentIndex + 1} of {filteredCards.length} • Click card to
              flip
            </p>
          </div>
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No flashcards match your filters.
              </p>
              <Button
                variant="link"
                onClick={() => {
                  setProductFilter("all");
                  setCategoryFilter("all");
                }}
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
