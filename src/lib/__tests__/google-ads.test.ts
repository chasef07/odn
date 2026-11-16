import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAccessToken, MockGoogleAuth } = vi.hoisted(() => {
  const mockGetAccessToken = vi.fn()
  const MockGoogleAuth = vi.fn(
    class {
      getAccessToken = mockGetAccessToken
    }
  )
  return { mockGetAccessToken, MockGoogleAuth }
})

vi.mock('google-auth-library', () => ({ GoogleAuth: MockGoogleAuth }))

import { GOOGLE_ADS_ROW_LIMIT, searchGoogleAds } from '@/lib/google-ads'

const ACCOUNT = { customerId: '7678754198', quotaProject: 'acuity-ads-api' }
const QUERY =
  'select campaign.name, metrics.cost_micros, metrics.conversions from campaign where segments.date during LAST_7_DAYS'

const fetchMock = vi.fn()

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function campaignRow(index: number) {
  return {
    campaign: { resourceName: `customers/7678754198/campaigns/${index}`, name: `C${index}` },
    metrics: { costMicros: '1000000', conversions: 1 },
  }
}

beforeEach(() => {
  mockGetAccessToken.mockResolvedValue('test-access-token')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('searchGoogleAds', () => {
  it('sends the query to the account with the Google Ads scope and the quota project', async () => {
    fetchMock.mockResolvedValue(
      reply(200, { results: [], fieldMask: 'campaign.name', requestId: 'r1' })
    )

    await searchGoogleAds(ACCOUNT, QUERY)

    expect(MockGoogleAuth).toHaveBeenCalledWith({
      scopes: 'https://www.googleapis.com/auth/adwords',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://googleads.googleapis.com/v24/customers/7678754198/googleAds:search')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      authorization: 'Bearer test-access-token',
      'content-type': 'application/json',
      'x-goog-user-project': 'acuity-ads-api',
    })
    expect(JSON.parse(init.body)).toEqual({ query: QUERY })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns one row per result with the selected fields as columns, a missing metric as null', async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        results: [
          campaignRow(1),
          {
            campaign: { resourceName: 'customers/7678754198/campaigns/2', name: 'C2' },
            metrics: {},
          },
        ],
        fieldMask: 'campaign.name,metrics.costMicros,metrics.conversions',
      })
    )

    const result = await searchGoogleAds(ACCOUNT, QUERY)

    expect(result).toEqual({
      columns: ['campaign.name', 'metrics.costMicros', 'metrics.conversions'],
      rows: [
        { 'campaign.name': 'C1', 'metrics.costMicros': '1000000', 'metrics.conversions': 1 },
        { 'campaign.name': 'C2', 'metrics.costMicros': null, 'metrics.conversions': null },
      ],
      truncated: false,
    })
  })

  it('returns no rows when the query matches nothing', async () => {
    fetchMock.mockResolvedValue(reply(200, { fieldMask: 'campaign.name' }))

    expect(await searchGoogleAds(ACCOUNT, QUERY)).toEqual({
      columns: ['campaign.name'],
      rows: [],
      truncated: false,
    })
  })

  it('stops at the row limit and says the result was cut, also when Google has another page', async () => {
    const results = Array.from({ length: GOOGLE_ADS_ROW_LIMIT + 1 }, (_, index) =>
      campaignRow(index)
    )
    fetchMock.mockResolvedValueOnce(reply(200, { results, fieldMask: 'campaign.name' }))

    const cut = await searchGoogleAds(ACCOUNT, QUERY)
    expect(cut.rows).toHaveLength(GOOGLE_ADS_ROW_LIMIT)
    expect(cut.truncated).toBe(true)

    fetchMock.mockResolvedValueOnce(
      reply(200, { results: [campaignRow(1)], fieldMask: 'campaign.name', nextPageToken: 'p2' })
    )
    const paged = await searchGoogleAds(ACCOUNT, QUERY)
    expect(paged.rows).toHaveLength(1)
    expect(paged.truncated).toBe(true)
  })

  it("throws Google's own error message so the agent can fix its query", async () => {
    fetchMock.mockResolvedValue(
      reply(400, {
        error: {
          code: 400,
          message: 'Request contains an invalid argument.',
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.ads.googleads.v24.errors.GoogleAdsFailure',
              errors: [{ message: "Error in SELECT clause: invalid field name 'metrics.cost'." }],
            },
          ],
        },
      })
    )

    await expect(searchGoogleAds(ACCOUNT, QUERY)).rejects.toThrow(
      "Google Ads rejected the query: Error in SELECT clause: invalid field name 'metrics.cost'."
    )
  })

  it('says the call failed, not the query, when Google refuses access', async () => {
    fetchMock.mockResolvedValue(
      reply(403, {
        error: {
          code: 403,
          message: 'The caller does not have permission',
          details: [
            {
              errors: [
                {
                  message: 'The Google Cloud project is only approved for use with test accounts.',
                },
              ],
            },
          ],
        },
      })
    )

    await expect(searchGoogleAds(ACCOUNT, QUERY)).rejects.toThrow(
      'Google Ads request failed with HTTP 403: The Google Cloud project is only approved for use with test accounts.'
    )
  })

  it('names the status when the error body is not Google JSON', async () => {
    fetchMock.mockResolvedValue(new Response('upstream down', { status: 503 }))

    await expect(searchGoogleAds(ACCOUNT, QUERY)).rejects.toThrow(
      'Google Ads request failed with HTTP 503: no error details'
    )
  })

  it('refuses to call Google without an access token', async () => {
    mockGetAccessToken.mockResolvedValue(null)

    await expect(searchGoogleAds(ACCOUNT, QUERY)).rejects.toThrow(
      'Google returned no access token for the Google Ads scope'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
