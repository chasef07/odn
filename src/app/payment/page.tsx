'use client'

import { useState, useEffect } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { ArrowLeft } from 'lucide-react'
import { FormLayout } from '@/components/form-layout'
import { getFormData } from '@/lib/form-storage'
import { useI18n } from '@/components/i18n/I18nProvider'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { publicEnv } from '@/lib/public-env'

const CURRENT_STEP = 10

const stripePromise = loadStripe(publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

type PriceInfo = {
  amount: number
  currency: string
  priceId: string
  formattedAmount: string
  offerApplied: boolean
  offerCode: string | null
}

function CheckoutForm({ priceInfo }: { priceInfo: PriceInfo | null }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { t, path } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${path('/payment/success')}`,
      },
    })

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || t('An error occurred'))
      } else {
        setMessage(t('An unexpected error occurred.'))
      }
    }

    setIsLoading(false)
  }

  return (
    <LocalizedPage>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border-border/40 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-foreground mb-4 text-sm font-semibold">Order Summary</h3>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-foreground text-base font-medium">
                Doctor&apos;s Note - Online Medical Documentation
              </p>
              {priceInfo?.offerApplied && (
                <p className="mt-1 text-sm font-medium text-green-700">Discount applied</p>
              )}
            </div>
            <span className="text-primary text-xl font-bold">
              {priceInfo ? (
                `$${priceInfo.formattedAmount}`
              ) : (
                <span className="text-base text-red-600">Price unavailable</span>
              )}
            </span>
          </div>
        </div>

        <div className="border-border/40 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-foreground mb-4 text-sm font-semibold">Payment Details</h3>
          <PaymentElement />
        </div>

        {message && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{message}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="text-foreground hover:bg-accent inline-flex items-center justify-center rounded-lg p-2 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !stripe || !elements}
            className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </form>
    </LocalizedPage>
  )
}

export default function PaymentPage() {
  const [clientSecret, setClientSecret] = useState<string>('')
  const [priceInfo, setPriceInfo] = useState<PriceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { locale, t } = useI18n()

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const formData = getFormData()

        if (!formData.email || !formData.patientFirstName) {
          setError(t('Form data is incomplete. Please go back and complete the form.'))
          setLoading(false)
          return
        }

        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData, offerCode: formData.offerCode }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          setError(t(errorData.error || 'Failed to create payment intent'))
          return
        }

        const data = await response.json()

        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
          setPriceInfo({
            amount: data.amount,
            currency: data.currency,
            priceId: data.priceId,
            formattedAmount: data.formattedAmount,
            offerApplied: data.offerApplied,
            offerCode: data.offerCode,
          })
        } else {
          setError(t('Failed to initialize payment'))
        }
      } catch (err) {
        console.error('Payment intent creation error:', err)
        setError(t('Failed to connect to payment service. Please try again.'))
      } finally {
        setLoading(false)
      }
    }

    createPaymentIntent()
  }, [t])

  const appearance = {
    theme: 'stripe' as const,
  }

  const options = {
    clientSecret,
    appearance,
    locale: locale === 'es' ? ('es' as const) : ('en' as const),
  }

  if (loading) {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Payment"
        description="Secure payment powered by Stripe"
        usePersonalization={false}
        hideProgressAndBadges={true}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading payment form...</p>
          </div>
        </div>
      </FormLayout>
    )
  }

  if (error) {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Payment"
        description="Secure payment powered by Stripe"
        usePersonalization={false}
        hideProgressAndBadges={true}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-600">{error}</p>
        </div>
      </FormLayout>
    )
  }

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="Payment"
      description="Secure payment powered by Stripe"
      usePersonalization={false}
      hideProgressAndBadges={true}
    >
      {clientSecret && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm priceInfo={priceInfo} />
        </Elements>
      )}
    </FormLayout>
  )
}
