import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ServiceUnavailable } from "@/components/auth/states";
import type { BrandSummary } from "@/lib/brand";
import type { CampaignSummary, CampaignTemplateView, CampaignView } from "@/lib/campaign";
import type { PostView } from "@/lib/social/publishing";
import { customerPage } from "@/server/auth/pages";
import { brandSummaries } from "@/server/brand";
import { getCampaign, listCampaigns, listTemplates, summaryOf } from "@/server/campaign";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { listPosts } from "@/server/social/publishing";

/** Loads the signed-in customer's own campaigns per request. Campaign data is private: there is no public or sample data. */
function Fallback() {
  const block = "animate-pulse rounded-3xl bg-muted motion-reduce:animate-none";
  return (
    <div className="mx-auto max-w-[90rem] px-3 py-4 sm:px-6 sm:py-7 lg:px-8" aria-busy="true">
      <span className="sr-only">Loading your marketing plans…</span>
      <div className={`h-20 max-w-lg ${block}`} />
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-20 ${block}`} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-52 ${block}`} />
        ))}
      </div>
    </div>
  );
}

function wrap(node: React.ReactNode) {
  return <Suspense fallback={<Fallback />}>{node}</Suspense>;
}

async function own<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export interface HomeData {
  campaigns: CampaignSummary[];
  templates: CampaignTemplateView[];
  brands: BrandSummary[];
}

async function LoadHome({ render }: { render: (data: HomeData) => React.ReactNode }) {
  await connection();
  const r = await customerPage();
  if (r.status !== "ok") return <ServiceUnavailable />;
  const db = getDb();
  const [list, templates, brands] = await Promise.all([listCampaigns(db, r.viewer.customerId), listTemplates(db, r.viewer.customerId), brandSummaries(db, r.viewer.customerId)]);
  return <>{render({ campaigns: list.map(summaryOf), templates, brands })}</>;
}

export const CampaignsPage = ({ render }: { render: (data: HomeData) => React.ReactNode }) => wrap(<LoadHome render={render} />);

export interface FormData {
  /** Undefined when creating. */
  campaign?: CampaignView;
  count: number;
  templates: CampaignTemplateView[];
  brands: BrandSummary[];
}

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function LoadForm({ params, searchParams, render }: { params?: Params; searchParams?: Search; render: (data: FormData, query: { template?: string }) => React.ReactNode }) {
  const id = params ? (await params).id : undefined;
  const template = searchParams ? one((await searchParams).template) : undefined;
  await connection();
  const r = await customerPage();
  if (r.status !== "ok") return <ServiceUnavailable />;
  const db = getDb();
  const campaign = id ? await own(() => getCampaign(db, r.viewer.customerId, id)) : undefined;
  const [list, templates, brands] = await Promise.all([listCampaigns(db, r.viewer.customerId), listTemplates(db, r.viewer.customerId), brandSummaries(db, r.viewer.customerId)]);
  return <>{render({ campaign, count: list.length, templates, brands }, { template })}</>;
}

export const CampaignFormPage = (props: { params?: Params; searchParams?: Search; render: (data: FormData, query: { template?: string }) => React.ReactNode }) => wrap(<LoadForm {...props} />);

export interface DetailData {
  campaign: CampaignView;
  brands: BrandSummary[];
  /** The customer's own posts (archived included) for linked content and the content picker. */
  posts: PostView[];
  /** Other campaigns' names, to explain why a draft can't be linked. */
  campaignNames: Record<string, string>;
}

async function LoadDetail({ params, searchParams, render }: { params: Params; searchParams: Search; render: (data: DetailData, query: { tab?: string }) => React.ReactNode }) {
  const [{ id }, query] = [await params, await searchParams];
  await connection();
  const r = await customerPage();
  if (r.status !== "ok") return <ServiceUnavailable />;
  const db = getDb();
  const campaign = await own(() => getCampaign(db, r.viewer.customerId, id));
  const [brands, posts, list] = await Promise.all([brandSummaries(db, r.viewer.customerId), listPosts(db, r.viewer.customerId, "include"), listCampaigns(db, r.viewer.customerId)]);
  return <>{render({ campaign, brands, posts, campaignNames: Object.fromEntries(list.map((c) => [c.id, c.name])) }, { tab: one(query.tab) })}</>;
}

export const CampaignDetailPage = (props: { params: Params; searchParams: Search; render: (data: DetailData, query: { tab?: string }) => React.ReactNode }) => wrap(<LoadDetail {...props} />);
