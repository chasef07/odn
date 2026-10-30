# GTM Purchase Tracking

How purchase conversions reach Google Ads and Reddit, and the GTM setup that
container `GTM-PJPQQ5V4` needs to use it.

## What the site sends

After `/api/verify-payment` confirms the Checkout Session is paid, the success
page (`src/app/payment/success/page.tsx`, also served at `/es/payment/success`)
pushes **one** event per PaymentIntent:

```js
dataLayer.push({
  event: 'purchase',
  transaction_id: 'pi_...', // Stripe PaymentIntent id, used for dedupe
  value: 24.95, // actual amount charged, offers included
  currency: 'USD',
  user_data: { sha256_email_address: '<sha256 of trimmed, lowercased email>' },
})
```

- Refreshing or revisiting the success page does not push again (localStorage guard).
- Failed, processing, or unverifiable payments never push. A bank payment that is
  still processing does not push when it later clears.
- The success page URL carries only `session_id`, which is not a secret.

## GTM setup

Deploy the site change **before** publishing these GTM changes. If GTM is
published first, the purchase tags wait for an event that does not exist yet and
no conversions are recorded.

Container `GTM-PJPQQ5V4` is configured as follows (workspace 8):

1. **Data Layer Variables** (version 2):
   - `DLV - transaction_id` → `transaction_id`
   - `DLV - value` → `value`
   - `DLV - currency` → `currency`
   - `DLV - user_data` → `user_data`
2. **User-Provided Data variable** `User Data - purchase`, type _Code_, data source
   `{{DLV - user_data}}` (an object with `sha256_email_address`).
3. **Custom Event trigger** `CE - purchase`, event name `purchase`.
4. **Purchase January 7 2026** (Google Ads Conversion Tracking, label `44gyCJaVvd4bEIW46bE_`):
   - Trigger: `CE - purchase`
   - Conversion Value `{{DLV - value}}`, Transaction ID `{{DLV - transaction_id}}`,
     Currency Code `{{DLV - currency}}`
5. **Enhanced Conversion - purchase** (Google Ads User-provided Data Event, formerly
   _Enhanced Conversion Automatic_):
   - User-provided Data `{{User Data - purchase}}` instead of automatic page scraping
   - Trigger: `CE - purchase` only (previously every form submission plus the success page)
   - In Google Ads: Goals → Settings → Enhanced conversions → on, method _Google Tag Manager_
6. **Reddit Payment Success** (Reddit Pixel, Purchase):
   - Trigger: `CE - purchase`
   - Currency `{{DLV - currency}}`, Transaction Value `{{DLV - value}}`,
     Transaction ID and Conversion ID `{{DLV - transaction_id}}`
7. The old _Payment/Success_ (Window Loaded) and _Form Submission_ triggers no
   longer fire any tag and can be deleted, along with the unused
   _Automatic Collection_ variable.
8. Google Tag, Conversion Linker, and Reddit Pixel (PageVisit) are unchanged.

## Google Ads checks

Under Goals → Conversions → Summary:

- Only **one** purchase conversion action should be _Primary_. A second primary
  action (URL rule created in Google Ads, or an imported GA4 event) double counts.
- The purchase action's **Count** should be _Every_; transaction IDs handle dedupe.

## Testing

1. GTM **Preview** against a Vercel preview deploy using Stripe test keys.
2. Pay with a test card and confirm a single `purchase` event appears with the
   right `value` and `transaction_id`, and that the Google Ads and Reddit tags fire on it.
3. Refresh the success page: no new `purchase` event.
4. Use a declining test card: no `purchase` event.
5. **Publish**, then check Google Ads Tag diagnostics and Reddit Events Manager.

After launch, compare daily Google Ads conversions with paid submissions in the
admin dashboard. Reported conversions are expected to drop as duplicates stop
being counted.
