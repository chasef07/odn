export const ATTRIBUTION_COOKIE = 'odn_attr'
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60

const MAX_VALUE_LENGTH = 200
const MAX_COOKIE_LENGTH = 3500

export const CLICK_ID_KEYS = [
  'gclid',
  'gbraid',
  'wbraid',
  'rdt_cid',
  'fbclid',
  'msclkid',
  'ttclid',
] as const

export type ClickIdKey = (typeof CLICK_ID_KEYS)[number]

export const ATTRIBUTION_CHANNELS = [
  'reddit',
  'google_ads',
  'meta',
  'microsoft_ads',
  'tiktok',
  'email',
  'sms',
  'other_campaign',
  'organic_search',
  'social',
  'referral',
  'direct',
] as const

export type AttributionChannel = (typeof ATTRIBUTION_CHANNELS)[number]

export const ATTRIBUTION_CHANNEL_LABELS: Record<AttributionChannel, string> = {
  reddit: 'Reddit Ads',
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  microsoft_ads: 'Microsoft Ads',
  tiktok: 'TikTok Ads',
  email: 'Email',
  sms: 'SMS',
  other_campaign: 'Other campaign',
  organic_search: 'Organic search',
  social: 'Social (organic)',
  referral: 'Referral',
  direct: 'Direct',
}

export interface AttributionTouch {
  channel: AttributionChannel
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  clickIds: Partial<Record<ClickIdKey, string>>
  referrer: string | null
  landingPath: string | null
  at: string
}

export interface AttributionData {
  first: AttributionTouch
  last: AttributionTouch
}

const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsearch',
  'paid_search',
  'paid-search',
  'paidsocial',
  'paid_social',
  'paid-social',
  'cpm',
  'display',
  'ads',
])

const SEARCH_HOST_PATTERNS = [
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)yahoo\.com$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)search\.brave\.com$/,
]

const SOCIAL_HOST_PATTERNS = [
  /(^|\.)reddit\.com$/,
  /(^|\.)facebook\.com$/,
  /(^|\.)instagram\.com$/,
  /(^|\.)t\.co$/,
  /(^|\.)x\.com$/,
  /(^|\.)twitter\.com$/,
  /(^|\.)linkedin\.com$/,
  /(^|\.)tiktok\.com$/,
  /(^|\.)youtube\.com$/,
  /(^|\.)pinterest\.com$/,
]

const IGNORED_REFERRER_PATTERNS = [
  /(^|\.)stripe\.com$/,
  /(^|\.)stripe\.network$/,
  /(^|\.)link\.com$/,
  /(^|\.)cash\.app$/,
  /(^|\.)klarna\.com$/,
  /(^|\.)affirm\.com$/,
  /(^|\.)afterpay\.com$/,
  /(^|\.)paypal\.com$/,
]

function matchesAny(host: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(host))
}

function cleanValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_VALUE_LENGTH)
}

function cleanLower(value: unknown): string | null {
  return cleanValue(value)?.toLowerCase() ?? null
}

function isOwnHost(host: string, ownHost: string): boolean {
  const strip = (h: string) => h.replace(/^www\./, '')
  return strip(host) === strip(ownHost)
}

interface ClassifyInput {
  source: string | null
  medium: string | null
  clickIds: Partial<Record<ClickIdKey, string>>
  referrerHost: string | null
}

export function classifyChannel({
  source,
  medium,
  clickIds,
  referrerHost,
}: ClassifyInput): AttributionChannel {
  const paidMedium = medium ? PAID_MEDIUMS.has(medium) : false

  if (clickIds.rdt_cid || source === 'reddit' || source === 'reddit.com') return 'reddit'
  if (clickIds.gclid || clickIds.gbraid || clickIds.wbraid) return 'google_ads'
  if (source === 'google' && paidMedium) return 'google_ads'
  if (clickIds.msclkid || (source === 'bing' && paidMedium)) return 'microsoft_ads'
  if (clickIds.ttclid || (source === 'tiktok' && paidMedium)) return 'tiktok'
  if (
    source &&
    ['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(source) &&
    (paidMedium || !medium)
  ) {
    return 'meta'
  }
  if (medium === 'email') return 'email'
  if (medium === 'sms') return 'sms'
  if (source) return 'other_campaign'
  if (clickIds.fbclid) return 'social'

  if (referrerHost) {
    if (matchesAny(referrerHost, SEARCH_HOST_PATTERNS)) return 'organic_search'
    if (matchesAny(referrerHost, SOCIAL_HOST_PATTERNS)) return 'social'
    return 'referral'
  }

  return 'direct'
}

export function touchFromVisit(
  pageUrl: URL,
  referrer: string | null | undefined,
  now: Date = new Date()
): AttributionTouch {
  const params = pageUrl.searchParams
  const clickIds: Partial<Record<ClickIdKey, string>> = {}
  for (const key of CLICK_ID_KEYS) {
    const value = cleanValue(params.get(key))
    if (value) clickIds[key] = value
  }

  let referrerHost: string | null = null
  let referrerValue: string | null = null
  if (referrer) {
    try {
      const ref = new URL(referrer)
      const host = ref.hostname.toLowerCase()
      if (!isOwnHost(host, pageUrl.hostname) && !matchesAny(host, IGNORED_REFERRER_PATTERNS)) {
        referrerHost = host
        referrerValue = cleanValue(`${ref.origin}${ref.pathname}`)
      }
    } catch {}
  }

  const source = cleanLower(params.get('utm_source'))
  const medium = cleanLower(params.get('utm_medium'))

  return {
    channel: classifyChannel({ source, medium, clickIds, referrerHost }),
    source: source ?? referrerHost,
    medium,
    campaign: cleanValue(params.get('utm_campaign')),
    content: cleanValue(params.get('utm_content')),
    term: cleanValue(params.get('utm_term')),
    clickIds,
    referrer: referrerValue,
    landingPath: cleanValue(pageUrl.pathname),
    at: now.toISOString(),
  }
}

export function mergeAttribution(
  existing: AttributionData | null,
  touch: AttributionTouch
): AttributionData {
  if (!existing) return { first: touch, last: touch }
  if (touch.channel === 'direct') return existing
  return { first: existing.first, last: touch }
}

function parseTouch(value: unknown): AttributionTouch | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const channel = raw.channel
  if (
    typeof channel !== 'string' ||
    !(ATTRIBUTION_CHANNELS as readonly string[]).includes(channel)
  ) {
    return null
  }

  const clickIds: Partial<Record<ClickIdKey, string>> = {}
  if (raw.clickIds && typeof raw.clickIds === 'object') {
    for (const key of CLICK_ID_KEYS) {
      const id = cleanValue((raw.clickIds as Record<string, unknown>)[key])
      if (id) clickIds[key] = id
    }
  }

  const at = cleanValue(raw.at)
  if (!at || Number.isNaN(Date.parse(at))) return null

  return {
    channel: channel as AttributionChannel,
    source: cleanLower(raw.source),
    medium: cleanLower(raw.medium),
    campaign: cleanValue(raw.campaign),
    content: cleanValue(raw.content),
    term: cleanValue(raw.term),
    clickIds,
    referrer: cleanValue(raw.referrer),
    landingPath: cleanValue(raw.landingPath),
    at,
  }
}

export function parseAttribution(value: unknown): AttributionData | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const first = parseTouch(raw.first)
  const last = parseTouch(raw.last)
  if (!first || !last) return null
  return { first, last }
}

export function parseAttributionCookie(
  cookieValue: string | null | undefined
): AttributionData | null {
  if (!cookieValue) return null
  try {
    return parseAttribution(JSON.parse(cookieValue))
  } catch {
    return null
  }
}

function withoutDetail(touch: AttributionTouch): AttributionTouch {
  return { ...touch, content: null, term: null, referrer: null }
}

function summaryOnly(touch: AttributionTouch): AttributionTouch {
  return { ...withoutDetail(touch), clickIds: {}, landingPath: null }
}

export function serializeAttributionCookie(data: AttributionData): string | null {
  const candidates: AttributionData[] = [
    data,
    { first: withoutDetail(data.first), last: withoutDetail(data.last) },
    { first: summaryOnly(data.first), last: withoutDetail(data.last) },
  ]
  for (const candidate of candidates) {
    const encoded = encodeURIComponent(JSON.stringify(candidate))
    if (encoded.length <= MAX_COOKIE_LENGTH) return encoded
  }
  return null
}

export function attributionStripeMetadata(data: AttributionData | null): Record<string, string> {
  if (!data) return {}
  const { first, last } = data
  const entries: Array<[string, string | null | undefined]> = [
    ['attr_channel', last.channel],
    ['attr_source', last.source],
    ['attr_medium', last.medium],
    ['attr_campaign', last.campaign],
    ['attr_first_channel', first.channel],
    ['attr_first_source', first.source],
  ]
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])))
}
