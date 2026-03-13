async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CDN purge request failed (${response.status}): ${text}`);
  }

  return response.json().catch(() => ({}));
}

class CdnPurgeService {
  constructor(options = {}) {
    this.enabled = Boolean(options.enabled);
    this.provider = options.provider || 'generic';
    this.zoneId = options.zoneId;
    this.apiToken = options.apiToken;
    this.baseUrl = options.baseUrl;
    this.purgeUrl = options.purgeUrl;
  }

  async purgePaths(paths) {
    if (!this.enabled || !Array.isArray(paths) || paths.length === 0) {
      return { purged: false, reason: 'disabled-or-empty' };
    }

    if (
      this.provider === 'cloudflare' &&
      this.zoneId &&
      this.apiToken &&
      this.baseUrl
    ) {
      const files = paths.map((path) => `${this.baseUrl}${path}`);
      const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`;
      const data = await postJson(
        url,
        { files },
        { Authorization: `Bearer ${this.apiToken}` },
      );
      return { purged: true, provider: 'cloudflare', result: data };
    }

    if (this.purgeUrl) {
      const data = await postJson(this.purgeUrl, { paths });
      return { purged: true, provider: 'generic', result: data };
    }

    return { purged: false, reason: 'missing-cdn-config' };
  }
}

function createCdnPurgeService() {
  return new CdnPurgeService({
    enabled: String(process.env.CDN_PURGE_ENABLED || 'false') === 'true',
    provider: process.env.CDN_PROVIDER || 'generic',
    zoneId: process.env.CDN_ZONE_ID,
    apiToken: process.env.CDN_API_TOKEN,
    baseUrl: process.env.CDN_BASE_URL,
    purgeUrl: process.env.CDN_PURGE_URL,
  });
}

module.exports = {
  CdnPurgeService,
  createCdnPurgeService,
};
