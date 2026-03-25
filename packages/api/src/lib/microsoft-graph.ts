/**
 * Microsoft Graph API helpers for the API package.
 * Used by the connector browse routes and OAuth flow.
 * The full Graph client (with delta sync, download, etc.) lives in @nova/worker-shared.
 */

// ── Types ──

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
  driveType: string;
  webUrl: string;
}

export interface GraphDriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
}

export interface GraphTeam {
  id: string;
  displayName: string;
  description?: string;
}

export interface GraphChannel {
  id: string;
  displayName: string;
  description?: string;
  membershipType?: string;
}

// ── Delegated OAuth ──

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

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

// ── Browse Endpoints ──

export async function listSites(token: string, search?: string): Promise<GraphSite[]> {
  const path = search
    ? `/sites?search=${encodeURIComponent(search)}&$top=50`
    : `/sites?search=*&$top=50`;
  const data = await graphGet<{ value: GraphSite[] }>(token, path);
  return data.value;
}

export async function listSiteDrives(token: string, siteId: string): Promise<GraphDrive[]> {
  const data = await graphGet<{ value: GraphDrive[] }>(
    token,
    `/sites/${encodeURIComponent(siteId)}/drives`,
  );
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

export async function listTeams(token: string): Promise<GraphTeam[]> {
  const data = await graphGet<{ value: GraphTeam[] }>(
    token,
    `/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$select=id,displayName,description&$top=100`,
  );
  return data.value;
}

export async function listTeamChannels(token: string, teamId: string): Promise<GraphChannel[]> {
  const data = await graphGet<{ value: GraphChannel[] }>(
    token,
    `/teams/${encodeURIComponent(teamId)}/channels`,
  );
  return data.value;
}
