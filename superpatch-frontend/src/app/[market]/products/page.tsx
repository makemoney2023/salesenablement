import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, FlaskConical } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getProductsByMarket } from "@/data/products";
import { getMarketById, isValidMarket } from "@/data/markets";
import { MarketId } from "@/types";
import { notFound } from "next/navigation";

interface ProductsPageProps {
  params: Promise<{ market: string }>;
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { market } = await params;

  if (!isValidMarket(market)) {
    notFound();
  }

  const marketInfo = getMarketById(market as MarketId);
  const marketProducts = getProductsByMarket(market);

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
              {marketProducts.length} products
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-8 h-9" />
        </div>

        {/* Products Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {marketProducts.map((product) => (
            <Link key={product.id} href={`/${market}/products/${product.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative size-12 flex-shrink-0 rounded-full overflow-hidden bg-muted">
                      <Image
                        src={product.image}
                        alt={`${product.name} patch`}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {product.tagline}
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
                        {product.hasClinicalStudy && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                          >
                            <FlaskConical className="size-3 mr-0.5" />
                            Study
                          </Badge>
                        )}
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
