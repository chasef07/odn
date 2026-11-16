import { GoogleAuth } from 'google-auth-library'
import type { GoogleAdsAccount } from '@/lib/env'

export const GOOGLE_ADS_ROW_LIMIT = 500

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v24'
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'
const GOOGLE_ADS_TIMEOUT_MS = 30_000

export type GoogleAdsRow = Record<string, unknown>

export type GoogleAdsResult = { columns: string[]; rows: GoogleAdsRow[]; truncated: boolean }

type SearchResponse = {
  results?: Record<string, unknown>[]
  fieldMask?: string
  nextPageToken?: string
}

type ErrorResponse = {
  error?: { message?: string; details?: { errors?: { message?: string }[] }[] }
}

let googleAuth: GoogleAuth | null = null

async function accessToken(): Promise<string> {
  googleAuth ??= new GoogleAuth({ scopes: GOOGLE_ADS_SCOPE })
  const token = await googleAuth.getAccessToken()
  if (!token) throw new Error('Google returned no access token for the Google Ads scope')
  return token
}

function fieldValue(result: Record<string, unknown>, path: string): unknown {
  let value: unknown = result
  for (const key of path.split('.')) {
    if (typeof value !== 'object' || value === null) return null
    value = (value as Record<string, unknown>)[key]
  }
  return value ?? null
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ErrorResponse | null
  const googleErrors = (body?.error?.details ?? [])
    .flatMap((detail) => detail.errors ?? [])
    .map((error) => error.message)
    .filter(Boolean)
  if (googleErrors.length > 0) return googleErrors.join(' ')
  return body?.error?.message ?? 'no error details'
}

export async function searchGoogleAds(
  account: GoogleAdsAccount,
  query: string
): Promise<GoogleAdsResult> {
  const token = await accessToken()
  const response = await fetch(
    `${GOOGLE_ADS_API}/customers/${account.customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-goog-user-project': account.quotaProject,
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(GOOGLE_ADS_TIMEOUT_MS),
    }
  )
  if (!response.ok) {
    const detail = await errorMessage(response)
    if (response.status === 400) throw new Error(`Google Ads rejected the query: ${detail}`)
    throw new Error(`Google Ads request failed with HTTP ${response.status}: ${detail}`)
  }
  const body = (await response.json()) as SearchResponse
  const columns = body.fieldMask ? body.fieldMask.split(',') : []
  const results = body.results ?? []
  const rows = results
    .slice(0, GOOGLE_ADS_ROW_LIMIT)
    .map((result) =>
      Object.fromEntries(columns.map((column) => [column, fieldValue(result, column)]))
    )
  const truncated = results.length > GOOGLE_ADS_ROW_LIMIT || Boolean(body.nextPageToken)
  return { columns, rows, truncated }
}
