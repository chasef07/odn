'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { ArrowLeft } from 'lucide-react'
import { FormLayout } from '@/components/form-layout'
import { getFormData } from '@/lib/form-storage'

const CURRENT_STEP = 10

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [priceInfo, setPriceInfo] = useState<{ amount: number; formattedAmount: string } | null>(
    null
  )
  const [priceLoading, setPriceLoading] = useState(true)

  // Fetch price on component mount
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch('/api/get-price')
        if (!response.ok) {
          throw new Error('Failed to fetch price')
        }
        const data = await response.json()
        setPriceInfo({
          amount: data.amount,
          formattedAmount: data.formattedAmount,
        })
      } catch (error) {
        console.error('Failed to fetch price:', error)
        // Fallback to error state - user can still see the form
      } finally {
        setPriceLoading(false)
      }
    }

    fetchPrice()
  }, [])

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
        return_url: `${window.location.origin}/payment/success`,
      },
    })

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`.
    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message || 'An error occurred')
      } else {
        setMessage('An unexpected error occurred.')
      }
    }

    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="border-border/40 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-foreground mb-4 text-sm font-semibold">Order Summary</h3>
        <div className="flex items-center justify-between">
          <p className="text-foreground text-base font-medium">
            Doctor&apos;s Note - Online Medical Documentation
          </p>
          <span className="text-primary text-xl font-bold">
            {priceLoading ? (
              <span className="text-muted-foreground text-base">Loading...</span>
            ) : priceInfo ? (
              `$${priceInfo.formattedAmount}`
            ) : (
              <span className="text-red-600 text-base">Price unavailable</span>
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
  )
}

export default function PaymentPage() {
  const [clientSecret, setClientSecret] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    const createPaymentIntent = async () => {
      try {
        // Get form data from localStorage
        const formData = getFormData()

        // Validate form data exists
        if (!formData.email || !formData.patientFirstName) {
          setError('Form data is incomplete. Please go back and complete the form.')
          setLoading(false)
          return
        }

        // Call API with form data
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formData }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || 'Failed to create payment intent')
        }

        const data = await response.json()

        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError('Failed to initialize payment')
        }
      } catch (err) {
        console.error('Payment intent creation error:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to connect to payment service. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }

    createPaymentIntent()
  }, [])

  const appearance = {
    theme: 'stripe' as const,
  }

  const options = {
    clientSecret,
    appearance,
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
          <CheckoutForm />
        </Elements>
      )}
    </FormLayout>
  )
}
