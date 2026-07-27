import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import { listMetaPagePosts, type MetaPagePost } from "@/lib/platforms/meta-api";
import {
  pipeboardAttachImageAd,
  pipeboardBoostPost,
  pipeboardUploadAdImage,
} from "@/mastra/pipeboard-bridge";
import { isPipeboardConfigured } from "@/mastra/pipeboard-mcp";

export type ChatAttachment = {
  kind: "image";
  /** data:image/...;base64,... preferred for Pipeboard upload_ad_image */
  dataUrl?: string;
  /** Public HTTPS URL alternative */
  url?: string;
  name?: string;
};

export async function resolveOrgMetaIds(orgId: string): Promise<{
  accountId: string;
  pageId: string;
  connectionId: string;
  accessToken: string;
}> {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, orgId));
  const meta = rows.find((c) => c.connector === "meta_ads" && c.status === "connectée");
  if (!meta?.encryptedTokens) throw new Error("Meta Ads non connecté");
  const tokens = await ensureFreshTokens(meta.id, orgId, "meta_ads");
  const accountId =
    (await resolveActiveAdAccountId(orgId, "meta_ads")) ||
    tokens.accountId ||
    meta.externalAccount ||
    "";
  const pageId = (await resolveMetaPageId(orgId, null)) || "";
  if (!accountId) throw new Error("Compte Meta manquant — choisissez un compte pub dans Connexions");
  if (!pageId) throw new Error("Page Facebook manquante — choisissez une Page dans Connexions");
  return { accountId, pageId, connectionId: meta.id, accessToken: tokens.accessToken };
}

export async function listOrgPagePosts(orgId: string, limit = 10): Promise<MetaPagePost[]> {
  const { pageId, accessToken } = await resolveOrgMetaIds(orgId);
  return listMetaPagePosts(accessToken, pageId, limit);
}

export async function uploadChatImageToMeta(
  orgId: string,
  attachment: ChatAttachment,
): Promise<{ imageHash: string }> {
  if (!isPipeboardConfigured()) {
    throw new Error("Upload de créa temporairement indisponible — réessayez ou contactez le support.");
  }
  const { accountId } = await resolveOrgMetaIds(orgId);
  const up = await pipeboardUploadAdImage({
    accountId,
    file: attachment.dataUrl,
    imageUrl: attachment.url,
    name: attachment.name ?? "Orkestria créa",
  });
  return { imageHash: up.imageHash };
}

export async function attachPausedImageAd(orgId: string, input: {
  adSetId: string;
  name: string;
  linkUrl: string;
  message?: string;
  headline?: string;
  attachment?: ChatAttachment;
  imageHash?: string;
}): Promise<{ adId: string; creativeId: string; imageHash: string }> {
  if (!isPipeboardConfigured()) throw new Error("Création d'annonce temporairement indisponible.");
  const { accountId, pageId } = await resolveOrgMetaIds(orgId);
  const res = await pipeboardAttachImageAd({
    accountId,
    pageId,
    adSetId: input.adSetId,
    name: input.name,
    linkUrl: input.linkUrl,
    message: input.message,
    headline: input.headline,
    imageHash: input.imageHash,
    file: input.attachment?.dataUrl,
    imageUrl: input.attachment?.url,
  });
  return { adId: res.adId, creativeId: res.creativeId, imageHash: res.imageHash };
}

export async function boostOrgPagePost(orgId: string, input: {
  objectStoryId: string;
  name?: string;
  dailyBudget: number;
  countries?: string[];
}): Promise<Record<string, unknown>> {
  if (!isPipeboardConfigured()) throw new Error("Boost de post temporairement indisponible.");
  const { accountId, pageId } = await resolveOrgMetaIds(orgId);
  return pipeboardBoostPost({
    accountId,
    pageId,
    objectStoryId: input.objectStoryId,
    name: input.name ?? `Boost post ${new Date().toISOString().slice(0, 10)}`,
    dailyBudget: input.dailyBudget,
    countries: input.countries,
  });
}

/** Parse Meta object_story_id from free text / Facebook URLs. */
export function extractObjectStoryId(text: string): string | null {
  const explicit = text.match(/\b(\d{5,})_(\d{5,})\b/);
  if (explicit) return `${explicit[1]}_${explicit[2]}`;
  const posts = text.match(/facebook\.com\/[^/\s]+\/posts\/(\d+)/i);
  if (posts?.[1]) return null; // need page id — handled by caller with resolve
  const permalink = text.match(/story_fbid=(\d+)/i);
  if (permalink?.[1] && explicit) return null;
  const pfbid = text.match(/facebook\.com\/(?:permalink\.php\?|.*[?&]id=)(\d+)/i);
  void pfbid;
  return null;
}

export function extractObjectStoryIdWithPage(text: string, pageId: string): string | null {
  const full = text.match(/\b(\d{5,})_(\d{5,})\b/);
  if (full) return `${full[1]}_${full[2]}`;
  const postOnly =
    text.match(/\/posts\/(\d+)/i)?.[1] ||
    text.match(/story_fbid=(\d+)/i)?.[1] ||
    text.match(/\bpost(?:e)?\s*[#:]?\s*(\d{8,})\b/i)?.[1];
  if (postOnly) {
    const pid = pageId.replace(/\D/g, "") || pageId;
    return `${pid}_${postOnly}`;
  }
  return null;
}
