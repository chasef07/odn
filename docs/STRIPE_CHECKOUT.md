# Stripe Checkout Setup

`/payment` embeds Stripe Checkout, Stripe's prebuilt payment page, inside the
site. Stripe draws the whole form: wallet buttons, Link, the order summary and
the Pay button. Most of how it looks is set in the Stripe Dashboard, not in code.

## How a payment flows

1. `/payment` posts the draft to `/api/create-checkout-session`. The route checks
   the draft, saves it as a TemporarySubmission, and creates a Checkout Session in
   `embedded` mode for the standard or offer price. The draft id goes into the
   metadata of the payment intent that the session creates.
2. The page mounts Checkout with the session's client secret.
3. After paying, Stripe sends the customer to `/payment/success?session_id=...`
   (`/es/payment/success` for Spanish). The page asks `/api/verify-payment` for the
   session and shows one of:
   - **paid**: confirmation, and the purchase conversion is recorded.
   - **processing**: a bank payment that has not cleared yet. The customer is told
     it can take a few business days. No conversion is recorded.
   - **open**: the session is unpaid, so the customer goes back to `/payment`.
   - **expired**, or anything else: the error message.
4. Stripe sends `payment_intent.succeeded` to `/api/webhooks/stripe-prod3` when the
   money is in, the same moment for a card or for a bank payment days later. The
   webhook finds the draft by its metadata id and creates the submission.

## Required Stripe settings

None beyond what the site already uses:

- The same API keys: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`.
- The same webhook endpoint, subscribed to `payment_intent.succeeded`. Checkout
  creates a regular payment intent, so no new events are needed.
- The same price ids: `STRIPE_PRICE_ID`, and the optional offer prices
  `STRIPE_FRIENDS_FAMILY_PRICE_ID` and `STRIPE_DOCTOR_10_PRICE_ID`.

Checkout is available on every Stripe account.

## Before launch

These settings decide how the page looks and which options customers see. Set
them in live mode, and in test mode for staging.

| Setting                      | Where                                                                                             | What to set                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branding                     | [Settings → Branding → Checkout](https://dashboard.stripe.com/settings/branding/checkout)         | Logo, icon, brand color, accent color and font. Without these, Checkout looks plain.                                                                                                                                    |
| Product name and description | [Product catalog](https://dashboard.stripe.com/products)                                          | Checkout shows the name and description of the product behind each price, for example "Physician-Reviewed Doctor's Note" and the review time. Check the product of the standard price and of each offer price.          |
| Payment methods              | [Settings → Payment methods](https://dashboard.stripe.com/settings/payment_methods)               | Turn off methods that do not fit a medical service, such as Crypto and Klarna. Leave Cards, Apple Pay, Google Pay and Link on. Bank payments take days to clear, so turn them off if waiting for the note is a problem. |
| Payment method domains       | [Settings → Payment method domains](https://dashboard.stripe.com/settings/payment_method_domains) | Register `onlinedoctornote.com` and the staging domain. Embedded Checkout shows Apple Pay only on a registered domain.                                                                                                  |
| Public details               | [Settings → Public details](https://dashboard.stripe.com/settings/public)                         | Support email and phone, and the statement descriptor customers see on their card statement. A clear descriptor prevents chargebacks.                                                                                   |
| Receipts                     | [Settings → Customer emails](https://dashboard.stripe.com/settings/emails)                        | Turn on emails for successful payments.                                                                                                                                                                                 |

## Testing

Use test-mode keys on staging or locally. Stripe's test cards:

| Card                  | Result                            |
| --------------------- | --------------------------------- |
| `4242 4242 4242 4242` | Succeeds                          |
| `4000 0025 0000 3155` | Asks for 3D Secure authentication |
| `4000 0000 0000 9995` | Declined                          |

Check each of these after a change to the payment flow:

- A card payment lands on the success page and the submission appears in `/admin`.
- A Spanish checkout from `/es/payment` shows Checkout in Spanish and returns to
  `/es/payment/success`.
- An offer code charges the offer price.
- If bank payments are on, a test bank payment shows the processing message.
