import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema/index";
import { resolveMetaPageId } from "@/lib/mcp/meta-org";
import { resolveActiveAdAccountId } from "@/lib/mcp/resolve-ad-account";
import { runWriteAction } from "@/lib/mcp/policy-engine";
import { ensureFreshTokens } from "@/lib/platforms/token-refresh";
import {
  listMetaPagePosts,
  uploadMetaCreative,
  type MetaPagePost,
} from "@/lib/platforms/meta-api";

export type ChatAttachment = {
  kind: "image";
  dataUrl?: string;
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
  const { accountId, accessToken } = await resolveOrgMetaIds(orgId);
  return uploadMetaCreative(accessToken, accountId, {
    imageUrl: attachment.url,
    bytesBase64: attachment.dataUrl,
    name: attachment.name ?? "Orkestria créa",
  });
}

/** Upload image then create PAUSED ad via policy pipeline (no policy bypass). */
export async function attachPausedImageAd(orgId: string, input: {
  adSetId: string;
  name: string;
  linkUrl: string;
  message?: string;
  headline?: string;
  attachment?: ChatAttachment;
  imageHash?: string;
  callToAction?: string;
}): Promise<{ adId: string; creativeId: string; imageHash: string }> {
  void input.callToAction;
  const { accountId, pageId } = await resolveOrgMetaIds(orgId);
  let imageHash = input.imageHash ?? "";
  if (!imageHash) {
    if (!input.attachment?.dataUrl && !input.attachment?.url) {
      throw new Error("imageHash ou pièce jointe image requis");
    }
    const up = await uploadChatImageToMeta(orgId, input.attachment!);
    imageHash = up.imageHash;
  }

  const outcome = await runWriteAction({
    orgId,
    connector: "meta_ads",
    action: "create_ad",
    accountId,
    mode: "live",
    params: {
      adSetId: input.adSetId,
      name: input.name,
      pageId,
      linkUrl: input.linkUrl,
      message: input.message,
      headline: input.headline,
      imageHash,
    },
  });

  if (outcome.status !== "executed") {
    throw new Error(outcome.message || `Création annonce : ${outcome.status}`);
  }
  const result = (outcome.result ?? {}) as Record<string, unknown>;
  return {
    adId: String(result.adId ?? ""),
    creativeId: String(result.creativeId ?? ""),
    imageHash,
  };
}

export async function boostOrgPagePost(_orgId: string, _input: {
  objectStoryId: string;
  name?: string;
  dailyBudget: number;
  countries?: string[];
}): Promise<Record<string, unknown>> {
  throw new Error(
    "Boost de post Meta : bientôt via API native. Créez une campagne + annonce image pour l'instant.",
  );
}

export function extractObjectStoryId(text: string): string | null {
  const explicit = text.match(/\b(\d{5,})_(\d{5,})\b/);
  if (explicit) return `${explicit[1]}_${explicit[2]}`;
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
