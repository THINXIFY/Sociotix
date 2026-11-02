"use client";

import { Archive, CircleCheck, PencilLine } from "lucide-react";
import type { CategoryScope } from "@/components/admin/blog/categories";
import { DIGITAL_CATEGORIES, priceLabel } from "@/lib/digital-products";
import { PRODUCT_STATUS_LABEL, type Pricing, type ProductStatus } from "@/lib/digital-products/admin";
import { cn } from "@/lib/utils";

/* Pieces shared by the Digital Products list and editor. */

export const PRODUCT_CATEGORY_SCOPE: CategoryScope = {
  endpoint: "/api/admin/digital-products/categories",
  builtIn: DIGITAL_CATEGORIES.map((c) => ({ id: c.id, key: null, name: c.name, description: "", builtIn: true, postCount: 0 })),
  noun: "product",
  where: "the marketplace",
};

const STATUS_STYLE: Record<ProductStatus, { className: string; Icon: typeof CircleCheck }> = {
  draft: { className: "bg-muted text-muted-foreground", Icon: PencilLine },
  published: { className: "bg-ok-soft text-ok", Icon: CircleCheck },
  archived: { className: "bg-soon-soft text-soon", Icon: Archive },
};

export function ProductStatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  const { className: tone, Icon } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset", tone, className)}>
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {PRODUCT_STATUS_LABEL[status]}
    </span>
  );
}

export const adminPriceLabel = (pricing: Pricing, cents: number | null, currency: string) => (pricing === "paid" && cents ? priceLabel({ kind: "paid", cents, currency }) : pricing === "free" ? "Free" : "Not set");
