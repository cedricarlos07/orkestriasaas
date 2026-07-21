import { requireEnv } from "@/lib/platforms/config";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

/**
 * Microsoft Advertising (Bing Ads) SOAP API v13.
 * REST is not generally available, so we build minimal SOAP envelopes.
 */
const CUSTOMER_MGMT = "https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc";
const CAMPAIGN_MGMT = "https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc";

function soapEnvelope(opts: {
  action: string;
  accessToken: string;
  customerId?: string;
  accountId?: string;
  body: string;
  ns: string;
}): { url: string; headers: Record<string, string>; xml: string } {
  const devToken = requireEnv("MICROSOFT_ADS_DEVELOPER_TOKEN");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header xmlns="${opts.ns}">
    <Action mustUnderstand="1">${opts.action}</Action>
    <AuthenticationToken>${opts.accessToken}</AuthenticationToken>
    ${opts.customerId ? `<CustomerId>${opts.customerId}</CustomerId>` : ""}
    ${opts.accountId ? `<CustomerAccountId>${opts.accountId}</CustomerAccountId>` : ""}
    <DeveloperToken>${devToken}</DeveloperToken>
  </s:Header>
  <s:Body>
    ${opts.body}
  </s:Body>
</s:Envelope>`;
  return {
    url: opts.action.includes("Account") || opts.action.includes("User") ? CUSTOMER_MGMT : CAMPAIGN_MGMT,
    headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: opts.action },
    xml,
  };
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function extractOne(xml: string, tag: string): string | null {
  return extractAll(xml, tag)[0] ?? null;
}

async function soapCall(opts: Parameters<typeof soapEnvelope>[0]): Promise<string> {
  const { url, headers, xml } = soapEnvelope(opts);
  const res = await fetch(url, { method: "POST", headers, body: xml });
  const text = await res.text();
  if (!res.ok || text.includes("<s:Fault>") || text.includes("FaultDetail")) {
    throw new Error(`Microsoft Ads SOAP (${opts.action}): ${text.slice(0, 500)}`);
  }
  return text;
}

export async function listMicrosoftAdAccounts(
  accessToken: string,
): Promise<{ id: string; name: string; customerId: string }[]> {
  const userXml = await soapCall({
    action: "GetUser",
    accessToken,
    ns: "https://bingads.microsoft.com/Customer/v13",
    body: `<GetUserRequest xmlns="https://bingads.microsoft.com/Customer/v13"><UserId i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/></GetUserRequest>`,
  });
  const userId = extractOne(userXml, "Id");
  if (!userId) throw new Error("Microsoft Ads: utilisateur introuvable");

  const accountsXml = await soapCall({
    action: "SearchAccounts",
    accessToken,
    ns: "https://bingads.microsoft.com/Customer/v13",
    body: `<SearchAccountsRequest xmlns="https://bingads.microsoft.com/Customer/v13">
      <Predicates xmlns:a="https://bingads.microsoft.com/Customer/v13/Entities">
        <a:Predicate><a:Field>UserId</a:Field><a:Operator>Equals</a:Operator><a:Value>${userId}</a:Value></a:Predicate>
      </Predicates>
      <Ordering i:nil="true" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"/>
      <PageInfo xmlns:a="https://bingads.microsoft.com/Customer/v13/Entities"><a:Index>0</a:Index><a:Size>50</a:Size></PageInfo>
    </SearchAccountsRequest>`,
  });

  const blocks = accountsXml.split(/<(?:[a-zA-Z0-9]+:)?AdvertiserAccount>/).slice(1);
  return blocks.map((b) => ({
    id: extractOne(b, "Id") ?? "",
    name: extractOne(b, "Name") ?? "Compte Microsoft",
    customerId: extractOne(b, "ParentCustomerId") ?? "",
  }));
}

export async function fetchMicrosoftSnapshot(
  accessToken: string,
  accountId: string,
  period = "30 derniers jours",
): Promise<UnifiedAccountSnapshot> {
  const xml = await soapCall({
    action: "GetCampaignsByAccountId",
    accessToken,
    accountId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AccountId>${accountId}</AccountId>
      <CampaignType>Search Shopping DynamicSearchAds Audience PerformanceMax</CampaignType>
    </GetCampaignsByAccountIdRequest>`,
  });

  const blocks = xml.split(/<(?:[a-zA-Z0-9]+:)?Campaign>/).slice(1);
  const campaigns: UnifiedCampaign[] = blocks.map((b) => ({
    platform: "Microsoft Ads",
    id: extractOne(b, "Id") ?? "",
    name: extractOne(b, "Name") ?? "Campagne",
    status: extractOne(b, "Status") ?? "UNKNOWN",
    spend: 0,
    currency: "USD",
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    cpa: null,
    roas: null,
  }));

  return {
    platform: "Microsoft Ads",
    accountId,
    accountName: `Microsoft Ads ${accountId}`,
    period,
    spend: 0,
    currency: "USD",
    conversions: 0,
    cpa: null,
    roas: null,
    campaigns,
    issues: campaigns.length
      ? ["Les métriques de performance Microsoft nécessitent l'API Reporting (asynchrone) — lecture structure seulement"]
      : ["Aucune campagne Microsoft Ads trouvée sur ce compte"],
    opportunities: ["Importez vos campagnes Google Ads dans Microsoft Ads pour toucher l'audience Bing à moindre CPC"],
  };
}

async function updateMicrosoftCampaign(
  accessToken: string,
  accountId: string,
  campaignId: string,
  fields: string,
): Promise<void> {
  await soapCall({
    action: "UpdateCampaigns",
    accessToken,
    accountId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<UpdateCampaignsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AccountId>${accountId}</AccountId>
      <Campaigns>
        <Campaign><Id>${campaignId}</Id>${fields}</Campaign>
      </Campaigns>
    </UpdateCampaignsRequest>`,
  });
}

export async function pauseMicrosoftCampaign(accessToken: string, accountId: string, campaignId: string) {
  await updateMicrosoftCampaign(accessToken, accountId, campaignId, `<Status>Paused</Status>`);
}

export async function enableMicrosoftCampaign(accessToken: string, accountId: string, campaignId: string) {
  await updateMicrosoftCampaign(accessToken, accountId, campaignId, `<Status>Active</Status>`);
}

export async function updateMicrosoftCampaignBudget(
  accessToken: string,
  accountId: string,
  campaignId: string,
  dailyBudget: number,
): Promise<void> {
  await updateMicrosoftCampaign(accessToken, accountId, campaignId, `<DailyBudget>${dailyBudget}</DailyBudget>`);
}
