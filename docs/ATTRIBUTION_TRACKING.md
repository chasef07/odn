# Attribution Tracking

How each paid order is credited to one traffic source, independent of what
Google Ads or Reddit report.

## How it works

1. `AttributionCapture` (root layout) runs on every full page load and records the
   visit in a first-party cookie `odn_attr` (90 days):
   - **first** touch: the first visit we saw
   - **last** touch: the most recent visit that was not direct
   - Direct visits and returns from Stripe/wallet redirects never overwrite a campaign.
2. `/api/create-payment-intent` reads the cookie server side (never from the request
   body), stores it with the TemporarySubmission and adds `attr_*` keys to the
   PaymentIntent metadata so the source is visible in Stripe.
3. The Stripe webhook copies it onto the Submission: `attribution_channel`,
   `utm_source`, `utm_medium`, `utm_campaign` (last touch) and the full `attribution`
   JSON (first and last touch, click IDs, referrer, landing path).

Only the referrer's origin and path and the landing path are stored, never query
strings, so form data cannot leak into attribution.

## Channels

| Channel        | Rule (first match wins)                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Reddit Ads     | `rdt_cid` present, or `utm_source=reddit`                                |
| Google Ads     | `gclid` / `gbraid` / `wbraid`, or `utm_source=google` with a paid medium |
| Microsoft Ads  | `msclkid`, or `utm_source=bing` with a paid medium                       |
| TikTok Ads     | `ttclid`, or `utm_source=tiktok` with a paid medium                      |
| Meta Ads       | `utm_source` facebook/instagram/meta with a paid (or no) medium          |
| Email / SMS    | `utm_medium=email` / `utm_medium=sms`                                    |
| Other campaign | any other `utm_source` (e.g. `walletpass`)                               |
| Social         | `fbclid` alone, or a social site referrer (reddit.com, facebook.com, …)  |
| Organic search | search engine referrer                                                   |
| Referral       | any other external referrer                                              |
| Direct         | none of the above                                                        |

Paid mediums: `cpc`, `ppc`, `paid`, `paid_search`, `paid_social`, `cpm`, `display`, `ads`.

## Tagging ads

Google Ads adds `gclid` automatically (auto-tagging must stay on). For every other
platform, add UTM parameters to the ad's destination URL.

**Reddit** (Ads Manager → ad → Destination URL, or URL parameters):

```
?utm_source=reddit&utm_medium=paid&utm_campaign={{CAMPAIGN_ID}}&utm_content={{AD_ID}}
```

**Email / SMS links and partners** (examples):

```
?utm_source=resend&utm_medium=email&utm_campaign=repeat_10off
?utm_source=walletpass&utm_medium=referral&utm_campaign=launch
```

Offer codes (`?offer=...`) keep working alongside UTMs.

## Deploying schema changes

Migrations are applied separately from Vercel builds. Apply
`20261007000000_add_submission_attribution` **before** deploying code that selects the
new columns:

```
npm run db:migrate
```

The migration only adds nullable columns and an index, so it is safe to run while
the current code is live.
