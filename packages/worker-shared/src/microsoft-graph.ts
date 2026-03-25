/**
 * Microsoft Graph API client for SharePoint, OneDrive, and Teams integration.
 *
 * Supports two auth flows:
 * - App-only (client_credentials) for background sync
 * - Delegated (authorization_code) for interactive browsing during setup
 */

// ── Types ──

export interface GraphToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}

export interface GraphSite {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
  description?: string;
}

export interface GraphDrive {
  id: string;
  name: string;
  driveType: string; // documentLibrary, personal, business
  webUrl: string;
  owner?: { user?: { displayName?: string } };
  quota?: { total?: number; used?: number };
}

export interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
  parentReference?: { driveId?: string; path?: string };
  "@microsoft.graph.downloadUrl"?: string;
}

export interface GraphDeltaResponse<T> {
  items: T[];
  deltaLink: string | null;
  nextLink: string | null;
}

export interface GraphTeam {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
}

export interface GraphChannel {
  id: string;
  displayName: string;
  description?: string;
  membershipType?: string;
}

export interface GraphMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  from?: { user?: { displayName?: string; id?: string } };
  body?: { contentType: string; content: string };
  subject?: string;
  deletedDateTime?: string;
}

// ── Token Cache ──

const tokenCache = new Map<string, GraphToken>();

function cacheKey(tenantId: string, clientId: string): string {
  return `${tenantId}:${clientId}`;
}

// ── App-Only Auth (client_credentials) ──

export async function getAppToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const key = cacheKey(tenantId, clientId);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetchWithRetry(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token acquisition failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const token: GraphToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  tokenCache.set(key, token);
  return token.accessToken;
}

// ── Delegated Auth (authorization_code) ──

export function buildAuthorizeUrl(params: {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const scopes = params.scopes ?? [
    "Sites.Read.All",
    "Files.Read.All",
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "offline_access",
  ];

  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state: params.state,
    response_mode: "query",
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(params.tenantId)}/oauth2/v2.0/authorize?${qs.toString()}`;
}

export async function exchangeCodeForTokens(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(params.tenantId)}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetchWithRetry(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Code exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// ── Graph API Helpers ──

async function graphGet<T>(token: string, path: string): Promise<T> {
  const url = path.startsWith("https://") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error (${res.status}) ${path}: ${text}`);
  }

  return (await res.json()) as T;
}

async function graphGetBeta<T>(token: string, path: string): Promise<T> {
  const url = `https://graph.microsoft.com/beta${path}`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error (${res.status}) ${path}: ${text}`);
  }

  return (await res.json()) as T;
}

async function graphDownload(token: string, url: string): Promise<Buffer> {
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Graph download failed (${res.status}): ${url}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ── SharePoint Sites ──

export async function listSites(
  token: string,
  search?: string,
): Promise<GraphSite[]> {
  const path = search
    ? `/sites?search=${encodeURIComponent(search)}&$top=50`
    : `/sites?search=*&$top=50`;
  const data = await graphGet<{ value: GraphSite[] }>(token, path);
  return data.value;
}

export async function getSite(token: string, siteId: string): Promise<GraphSite> {
  return graphGet<GraphSite>(token, `/sites/${encodeURIComponent(siteId)}`);
}

// ── Drives (SharePoint Document Libraries / OneDrive) ──

export async function listSiteDrives(
  token: string,
  siteId: string,
): Promise<GraphDrive[]> {
  const data = await graphGet<{ value: GraphDrive[] }>(
    token,
    `/sites/${encodeURIComponent(siteId)}/drives`,
  );
  return data.value;
}

export async function listMyDrives(token: string): Promise<GraphDrive[]> {
  const data = await graphGet<{ value: GraphDrive[] }>(token, `/me/drives`);
  return data.value;
}

export async function listDriveChildren(
  token: string,
  driveId: string,
  path?: string,
): Promise<GraphDriveItem[]> {
  const base = `/drives/${encodeURIComponent(driveId)}`;
  const endpoint = path
    ? `${base}/root:/${encodeURIComponent(path)}:/children`
    : `${base}/root/children`;
  const data = await graphGet<{ value: GraphDriveItem[] }>(token, `${endpoint}?$top=200`);
  return data.value;
}

// ── Drive Delta (Incremental Sync) ──

export async function getDriveItemsDelta(
  token: string,
  driveId: string,
  deltaLink?: string | null,
): Promise<GraphDeltaResponse<GraphDriveItem>> {
  const items: GraphDriveItem[] = [];
  let url = deltaLink ?? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/delta?$top=200`;
  let nextDeltaLink: string | null = null;

  while (url) {
    const data = await graphGet<{
      value: GraphDriveItem[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>(token, url);

    items.push(...data.value);

    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
    } else {
      nextDeltaLink = data["@odata.deltaLink"] ?? null;
      url = "";
    }
  }

  return { items, deltaLink: nextDeltaLink, nextLink: null };
}

export async function downloadDriveItem(
  token: string,
  driveId: string,
  itemId: string,
): Promise<Buffer> {
  const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;
  return graphDownload(token, url);
}

// ── Teams ──

export async function listTeams(token: string): Promise<GraphTeam[]> {
  const data = await graphGet<{ value: GraphTeam[] }>(
    token,
    `/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$select=id,displayName,description&$top=100`,
  );
  return data.value;
}

export async function listTeamChannels(
  token: string,
  teamId: string,
): Promise<GraphChannel[]> {
  const data = await graphGet<{ value: GraphChannel[] }>(
    token,
    `/teams/${encodeURIComponent(teamId)}/channels`,
  );
  return data.value;
}

export async function getChannelMessagesDelta(
  token: string,
  teamId: string,
  channelId: string,
  deltaLink?: string | null,
): Promise<GraphDeltaResponse<GraphMessage>> {
  const messages: GraphMessage[] = [];
  let url =
    deltaLink ??
    `https://graph.microsoft.com/beta/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages/delta?$top=50`;
  let nextDeltaLink: string | null = null;

  while (url) {
    const data = await graphGetBeta<{
      value: GraphMessage[];
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    }>(token, url);

    messages.push(...data.value);

    if (data["@odata.nextLink"]) {
      url = data["@odata.nextLink"];
    } else {
      nextDeltaLink = data["@odata.deltaLink"] ?? null;
      url = "";
    }
  }

  return { items: messages, deltaLink: nextDeltaLink, nextLink: null };
}

// ── Retry / Rate-Limit Helper ──

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });

  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = res.headers.get("Retry-After");
    const delayMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    await sleep(delayMs);
    return fetchWithRetry(url, init, attempt + 1);
  }

  if (res.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
    return fetchWithRetry(url, init, attempt + 1);
  }

  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Utilities ──

/** Strip HTML tags from Teams message body */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Check if a drive item is a file (not a folder) */
export function isDriveItemFile(item: GraphDriveItem): boolean {
  return !!item.file && !item.folder;
}

/** Check if a drive item represents a deletion (delta response) */
export function isDriveItemDeleted(item: GraphDriveItem & { deleted?: { state: string } }): boolean {
  return !!(item as any).deleted;
}

/** Clear the token cache (useful in tests) */
export function clearTokenCache(): void {
  tokenCache.clear();
}
