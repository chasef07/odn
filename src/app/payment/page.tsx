'use client'

import { useState, useEffect } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { ArrowLeft } from 'lucide-react'
import { FormLayout } from '@/components/form-layout'
import { getFormData } from '@/lib/form-storage'
import { useI18n } from '@/components/i18n/I18nProvider'
import { useFunnelStep } from '@/components/useFunnelStep'
import { publicEnv } from '@/lib/public-env'

const stripePromise = loadStripe(publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

export default function PaymentPage() {
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { locale, t } = useI18n()
  useFunnelStep('/payment', clientSecret !== '')

  useEffect(() => {
    const createCheckoutSession = async () => {
      try {
        const formData = getFormData()

        if (!formData.email || !formData.patientFirstName) {
          setError(t('Form data is incomplete. Please go back and complete the form.'))
          setLoading(false)
          return
        }

        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData, offerCode: formData.offerCode, locale }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          if (errorData.route) {
            router.replace(errorData.route)
            return
          }
          setError(t(errorData.error || 'Failed to initialize payment'))
          return
        }

        const data = await response.json()

        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError(t('Failed to initialize payment'))
        }
      } catch (err) {
        console.error('Checkout Session creation error:', err)
        setError(t('Failed to connect to payment service. Please try again.'))
      } finally {
        setLoading(false)
      }
    }

    createCheckoutSession()
  }, [router, t, locale])

  return (
    <FormLayout
      title="Payment"
      description="Secure payment powered by Stripe"
      usePersonalization={false}
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Loading payment form...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {clientSecret && (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}

      {!loading && (
        <div className="pt-4">
          <button
            type="button"
            onClick={() => router.push('/review')}
            className="text-foreground hover:bg-accent inline-flex h-11 w-11 items-center justify-center rounded-lg transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      )}
    </FormLayout>
  )
}
