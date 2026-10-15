import { describe, it, expect } from 'vitest'
import {
  type AttributionData,
  attributionStripeMetadata,
  classifyChannel,
  mergeAttribution,
  parseAttribution,
  parseAttributionCookie,
  serializeAttributionCookie,
  touchFromVisit,
} from '@/lib/attribution'

const now = new Date('2026-10-07T12:00:00.000Z')
const visit = (url: string, referrer = '') => touchFromVisit(new URL(url), referrer, now)

describe('touchFromVisit', () => {
  it('credits Reddit ads by click id and keeps UTM details', () => {
    const touch = visit(
      'https://onlinedoctornote.com/?utm_source=Reddit&utm_medium=paid&utm_campaign=fall_promo&rdt_cid=abc123'
    )

    expect(touch).toEqual({
      channel: 'reddit',
      source: 'reddit',
      medium: 'paid',
      campaign: 'fall_promo',
      content: null,
      term: null,
      clickIds: { rdt_cid: 'abc123' },
      referrer: null,
      landingPath: '/',
      at: now.toISOString(),
    })
  })

  it('credits Google Ads by gclid, gbraid or wbraid', () => {
    expect(visit('https://onlinedoctornote.com/?gclid=g1').channel).toBe('google_ads')
    expect(visit('https://onlinedoctornote.com/?gbraid=g2').channel).toBe('google_ads')
    expect(visit('https://onlinedoctornote.com/?wbraid=g3').channel).toBe('google_ads')
    expect(visit('https://onlinedoctornote.com/?utm_source=google&utm_medium=cpc').channel).toBe(
      'google_ads'
    )
  })

  it('classifies email, sms and other tagged campaigns', () => {
    expect(visit('https://onlinedoctornote.com/?utm_source=resend&utm_medium=email').channel).toBe(
      'email'
    )
    expect(visit('https://onlinedoctornote.com/?utm_source=telnyx&utm_medium=sms').channel).toBe(
      'sms'
    )
    expect(visit('https://onlinedoctornote.com/?utm_source=walletpass').channel).toBe(
      'other_campaign'
    )
  })

  it('treats fbclid alone as organic social since Facebook adds it to all links', () => {
    expect(visit('https://onlinedoctornote.com/?fbclid=f1').channel).toBe('social')
    expect(
      visit('https://onlinedoctornote.com/?fbclid=f1&utm_source=facebook&utm_medium=paid_social')
        .channel
    ).toBe('meta')
  })

  it('classifies untagged referrers and keeps only origin + path', () => {
    const search = visit('https://onlinedoctornote.com/faq', 'https://www.google.com/search?q=note')
    expect(search.channel).toBe('organic_search')
    expect(search.source).toBe('www.google.com')
    expect(search.referrer).toBe('https://www.google.com/search')

    expect(visit('https://onlinedoctornote.com/', 'https://www.reddit.com/r/x/').channel).toBe(
      'social'
    )
    expect(visit('https://onlinedoctornote.com/', 'https://someblog.example/post').channel).toBe(
      'referral'
    )
  })

  it('treats own-site, payment and missing referrers as direct', () => {
    expect(
      visit('https://onlinedoctornote.com/start', 'https://www.onlinedoctornote.com/').channel
    ).toBe('direct')
    expect(
      visit('https://onlinedoctornote.com/start', 'https://checkout.stripe.com/').channel
    ).toBe('direct')
    expect(visit('https://onlinedoctornote.com/start').channel).toBe('direct')
  })

  it('never stores the landing query string', () => {
    const touch = visit('https://onlinedoctornote.com/start?utm_source=reddit&email=a@b.com')
    expect(touch.landingPath).toBe('/start')
    expect(JSON.stringify(touch)).not.toContain('a@b.com')
  })
})

describe('classifyChannel', () => {
  it('falls back to direct with no signals', () => {
    expect(classifyChannel({ source: null, medium: null, clickIds: {}, referrerHost: null })).toBe(
      'direct'
    )
  })
})

describe('mergeAttribution', () => {
  const reddit = visit('https://onlinedoctornote.com/?rdt_cid=r1')
  const google = visit('https://onlinedoctornote.com/?gclid=g1')
  const direct = visit('https://onlinedoctornote.com/')

  it('sets first and last on the first visit, including a direct one', () => {
    expect(mergeAttribution(null, direct)).toEqual({ first: direct, last: direct })
  })

  it('keeps first touch and moves last touch for later campaign visits', () => {
    const merged = mergeAttribution(mergeAttribution(null, reddit), google)
    expect(merged.first.channel).toBe('reddit')
    expect(merged.last.channel).toBe('google_ads')
  })

  it('does not let a direct return visit overwrite an earlier campaign', () => {
    const existing = mergeAttribution(null, reddit)
    expect(mergeAttribution(existing, direct)).toBe(existing)
  })
})

describe('cookie round trip and validation', () => {
  const data = mergeAttribution(
    null,
    visit('https://onlinedoctornote.com/?rdt_cid=r1&utm_source=reddit')
  )

  const roundTrip = (value: AttributionData) =>
    parseAttributionCookie(decodeURIComponent(serializeAttributionCookie(value)!))

  it('serializes and parses back to the same data', () => {
    expect(roundTrip(data)).toEqual(data)
  })

  it('keeps values containing a literal percent sign', () => {
    const percent = mergeAttribution(
      null,
      visit('https://onlinedoctornote.com/?utm_source=reddit&utm_campaign=20%25off')
    )
    expect(percent.last.campaign).toBe('20%off')
    expect(roundTrip(percent)?.last.campaign).toBe('20%off')
  })

  it('drops optional detail until the cookie fits', () => {
    const long = 'x'.repeat(200)
    const clickIds = { gclid: long, gbraid: long, wbraid: long, rdt_cid: long, fbclid: long }
    const heavy = {
      ...data.last,
      campaign: long,
      content: long,
      term: long,
      referrer: long,
      landingPath: long,
      clickIds,
    }
    const encoded = serializeAttributionCookie({ first: heavy, last: heavy })

    expect(encoded).not.toBeNull()
    expect(encoded!.length).toBeLessThanOrEqual(3500)
    const parsed = parseAttributionCookie(decodeURIComponent(encoded!))
    expect(parsed?.last.clickIds.gclid).toBe(long)
    expect(parsed?.last.content).toBeNull()
    expect(parsed?.first.clickIds).toEqual({})
  })

  it('returns null rather than an oversized cookie', () => {
    const long = '%'.repeat(200)
    const allClickIds = {
      gclid: long,
      gbraid: long,
      wbraid: long,
      rdt_cid: long,
      fbclid: long,
      msclkid: long,
      ttclid: long,
    }
    const huge = {
      ...data.last,
      campaign: long,
      source: long,
      landingPath: long,
      clickIds: allClickIds,
    }
    expect(serializeAttributionCookie({ first: huge, last: huge })).toBeNull()
  })

  it('rejects malformed or tampered values', () => {
    expect(parseAttributionCookie(null)).toBeNull()
    expect(parseAttributionCookie('not-json')).toBeNull()
    expect(parseAttribution({ first: { channel: 'made_up', at: now.toISOString() } })).toBeNull()
    expect(parseAttribution({ first: data.first })).toBeNull()
  })

  it('truncates oversized values', () => {
    const long = 'x'.repeat(500)
    const parsed = parseAttribution({
      first: { ...data.first, campaign: long },
      last: { ...data.last, campaign: long },
    })
    expect(parsed?.last.campaign).toHaveLength(200)
  })
})

describe('attributionStripeMetadata', () => {
  it('returns compact last/first touch keys and omits empty values', () => {
    const data = mergeAttribution(
      mergeAttribution(null, visit('https://onlinedoctornote.com/?rdt_cid=r1&utm_source=reddit')),
      visit('https://onlinedoctornote.com/?gclid=g1&utm_source=google&utm_campaign=brand')
    )

    expect(attributionStripeMetadata(data)).toEqual({
      attr_channel: 'google_ads',
      attr_source: 'google',
      attr_campaign: 'brand',
      attr_first_channel: 'reddit',
      attr_first_source: 'reddit',
    })
    expect(attributionStripeMetadata(null)).toEqual({})
  })
})
