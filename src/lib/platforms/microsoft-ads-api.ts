import { requireEnv } from "@/lib/platforms/config";
import type { UnifiedAccountSnapshot, UnifiedCampaign } from "@/lib/unified-ad-schema";

/**
 * Microsoft Advertising (Bing Ads) SOAP API v13.
 * REST is not generally available, so we build minimal SOAP envelopes.
 */
const CUSTOMER_MGMT = "https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc";
const CAMPAIGN_MGMT = "https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc";
const REPORTING = "https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc";

function soapEnvelope(opts: {
  action: string;
  accessToken: string;
  customerId?: string;
  accountId?: string;
  body: string;
  ns: string;
  service?: "customer" | "campaign" | "reporting";
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
  const service = opts.service ?? (opts.action.includes("Account") || opts.action.includes("User") ? "customer" : "campaign");
  const url = service === "reporting" ? REPORTING : service === "customer" ? CUSTOMER_MGMT : CAMPAIGN_MGMT;
  return {
    url,
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function periodToDates(period?: string): { start: string; end: string } {
  const end = new Date();
  let days = 30;
  if (period?.includes("7")) days = 7;
  else if (period?.includes("14")) days = 14;
  else if (period?.includes("90")) days = 90;
  const start = new Date(end.getTime() - days * 86400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function fetchCampaignPerformanceReport(
  accessToken: string,
  accountId: string,
  customerId: string | undefined,
  period?: string,
): Promise<Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>> {
  const { start, end } = periodToDates(period);
  const submitXml = await soapCall({
    action: "SubmitGenerateReport",
    accessToken,
    accountId,
    customerId,
    service: "reporting",
    ns: "https://bingads.microsoft.com/Reporting/v13",
    body: `<SubmitGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
      <ReportRequest i:type="CampaignPerformanceReportRequest" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
        <ExcludeColumnHeaders>false</ExcludeColumnHeaders>
        <ExcludeReportFooter>true</ExcludeReportFooter>
        <ExcludeReportHeader>true</ExcludeReportHeader>
        <Format>Tsv</Format>
        <ReportName>OrkestriaCampaignPerf</ReportName>
        <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
        <Aggregation>Summary</Aggregation>
        <Columns>
          <CampaignPerformanceReportColumn>CampaignId</CampaignPerformanceReportColumn>
          <CampaignPerformanceReportColumn>Spend</CampaignPerformanceReportColumn>
          <CampaignPerformanceReportColumn>Impressions</CampaignPerformanceReportColumn>
          <CampaignPerformanceReportColumn>Clicks</CampaignPerformanceReportColumn>
          <CampaignPerformanceReportColumn>Conversions</CampaignPerformanceReportColumn>
        </Columns>
        <Scope>
          <AccountIds xmlns:a1="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
            <a1:long>${accountId}</a1:long>
          </AccountIds>
        </Scope>
        <Time>
          <CustomDateRangeStart><Day>${Number(start.slice(8, 10))}</Day><Month>${Number(start.slice(5, 7))}</Month><Year>${Number(start.slice(0, 4))}</Year></CustomDateRangeStart>
          <CustomDateRangeEnd><Day>${Number(end.slice(8, 10))}</Day><Month>${Number(end.slice(5, 7))}</Month><Year>${Number(end.slice(0, 4))}</Year></CustomDateRangeEnd>
        </Time>
      </ReportRequest>
    </SubmitGenerateReportRequest>`,
  });

  const reportRequestId = extractOne(submitXml, "ReportRequestId");
  if (!reportRequestId) throw new Error("Microsoft Ads reporting: ReportRequestId manquant");

  let downloadUrl: string | null = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const pollXml = await soapCall({
      action: "PollGenerateReport",
      accessToken,
      accountId,
      customerId,
      service: "reporting",
      ns: "https://bingads.microsoft.com/Reporting/v13",
      body: `<PollGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
        <ReportRequestId>${reportRequestId}</ReportRequestId>
      </PollGenerateReportRequest>`,
    });
    const status = extractOne(pollXml, "Status");
    if (status === "Error") throw new Error(`Microsoft Ads reporting error: ${pollXml.slice(0, 400)}`);
    if (status === "Success") {
      downloadUrl = extractOne(pollXml, "ReportDownloadUrl");
      break;
    }
  }
  if (!downloadUrl) throw new Error("Microsoft Ads reporting: timeout en attendant le rapport");

  const tsvRes = await fetch(downloadUrl);
  if (!tsvRes.ok) throw new Error(`Microsoft Ads report download: ${tsvRes.status}`);
  const tsv = await tsvRes.text();
  const metrics = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
  for (const line of tsv.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("CampaignId") || line.startsWith('"CampaignId"')) continue;
    const cols = line.split("\t").map((c) => c.replace(/^"|"$/g, ""));
    if (cols.length < 5) continue;
    const [campaignId, spend, impressions, clicks, conversions] = cols;
    if (!campaignId || !/^\d+$/.test(campaignId)) continue;
    metrics.set(campaignId, {
      spend: Number(spend) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      conversions: Number(conversions) || 0,
    });
  }
  return metrics;
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
  const accounts = await listMicrosoftAdAccounts(accessToken).catch(() => [] as { id: string; customerId: string; name: string }[]);
  const match = accounts.find((a) => a.id === accountId);
  const customerId = match?.customerId || undefined;

  const xml = await soapCall({
    action: "GetCampaignsByAccountId",
    accessToken,
    accountId,
    customerId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AccountId>${accountId}</AccountId>
      <CampaignType>Search Shopping DynamicSearchAds Audience PerformanceMax</CampaignType>
    </GetCampaignsByAccountIdRequest>`,
  });

  const blocks = xml.split(/<(?:[a-zA-Z0-9]+:)?Campaign>/).slice(1);
  const baseCampaigns = blocks.map((b) => ({
    id: extractOne(b, "Id") ?? "",
    name: extractOne(b, "Name") ?? "Campagne",
    status: extractOne(b, "Status") ?? "UNKNOWN",
  }));

  const issues: string[] = [];
  let metrics = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
  try {
    metrics = await fetchCampaignPerformanceReport(accessToken, accountId, customerId, period);
  } catch (e) {
    issues.push(e instanceof Error ? e.message : "Reporting Microsoft indisponible");
  }

  let spend = 0;
  let conversions = 0;
  const campaigns: UnifiedCampaign[] = baseCampaigns.map((c) => {
    const m = metrics.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    spend += m.spend;
    conversions += m.conversions;
    return {
      platform: "Microsoft Ads",
      id: c.id,
      name: c.name,
      status: c.status,
      spend: m.spend,
      currency: "USD",
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      cpa: m.conversions > 0 ? m.spend / m.conversions : null,
      roas: null,
    };
  });

  if (!campaigns.length) issues.push("Aucune campagne Microsoft Ads trouvée sur ce compte");

  return {
    platform: "Microsoft Ads",
    accountId,
    accountName: match?.name ?? `Microsoft Ads ${accountId}`,
    period,
    spend,
    currency: "USD",
    conversions,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
    campaigns,
    issues,
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

export async function addMicrosoftKeywords(
  accessToken: string,
  accountId: string,
  adGroupId: string,
  keywords: { text: string; matchType?: string }[],
): Promise<{ count: number }> {
  const kwXml = keywords
    .map(
      (kw) => `<Keyword>
      <AdGroupId>${adGroupId}</AdGroupId>
      <Text>${kw.text.replace(/[<>&]/g, "")}</Text>
      <MatchType>${kw.matchType ?? "Broad"}</MatchType>
      <Status>Active</Status>
    </Keyword>`,
    )
    .join("");
  await soapCall({
    action: "AddKeywords",
    accessToken,
    accountId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<AddKeywordsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AdGroupId>${adGroupId}</AdGroupId>
      <Keywords>${kwXml}</Keywords>
    </AddKeywordsRequest>`,
  });
  return { count: keywords.length };
}

export async function createMicrosoftCampaignPaused(
  accessToken: string,
  accountId: string,
  input: { name: string; dailyBudget: number },
): Promise<{ campaignId: string; details: Record<string, unknown> }> {
  const safeName = input.name.replace(/[<>&]/g, "").slice(0, 128);
  const xml = await soapCall({
    action: "AddCampaigns",
    accessToken,
    accountId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<AddCampaignsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AccountId>${accountId}</AccountId>
      <Campaigns>
        <Campaign>
          <Name>${safeName}</Name>
          <BudgetType>DailyBudgetStandard</BudgetType>
          <DailyBudget>${Math.max(1, input.dailyBudget)}</DailyBudget>
          <TimeZone>GreenwichMeanTimeDublinEdinburghLisbonLondon</TimeZone>
          <Status>Paused</Status>
          <CampaignType>Search</CampaignType>
        </Campaign>
      </Campaigns>
    </AddCampaignsRequest>`,
  });
  const campaignId = extractOne(xml, "Id") ?? extractAll(xml, "long")[0];
  if (!campaignId) throw new Error("Microsoft Ads create campaign: id manquant");
  return {
    campaignId,
    details: { status: "Paused", maturity: "experimental", note: "Campagne Microsoft Ads créée en Paused (experimental)" },
  };
}

export async function addMicrosoftNegativeKeywords(
  accessToken: string,
  accountId: string,
  campaignId: string,
  keywords: { text: string; matchType?: string }[],
): Promise<{ count: number }> {
  const kwXml = keywords
    .map(
      (kw) => `<NegativeKeyword>
      <Text>${kw.text.replace(/[<>&]/g, "")}</Text>
      <MatchType>${kw.matchType ?? "Phrase"}</MatchType>
    </NegativeKeyword>`,
    )
    .join("");
  await soapCall({
    action: "AddNegativeKeywordsToEntities",
    accessToken,
    accountId,
    ns: "https://bingads.microsoft.com/CampaignManagement/v13",
    body: `<AddNegativeKeywordsToEntitiesRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <EntityNegativeKeywords>
        <EntityNegativeKeyword>
          <EntityId>${campaignId}</EntityId>
          <EntityType>Campaign</EntityType>
          <NegativeKeywords>${kwXml}</NegativeKeywords>
        </EntityNegativeKeyword>
      </EntityNegativeKeywords>
    </AddNegativeKeywordsToEntitiesRequest>`,
  });
  return { count: keywords.length };
}
