'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FormLayout } from '@/components/form-layout'
import { CheckCircle2 } from 'lucide-react'
import { clearFormData } from '@/lib/form-storage'

const CURRENT_STEP = 10

export default function PaymentSuccessPage() {
  // Get payment intent from URL on client side (lazy initialization avoids setState in effect)
  const [paymentIntent] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('payment_intent')
  })

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(() => {
    // If no payment intent on mount, start with error state
    if (typeof window === 'undefined') return 'loading'
    const params = new URLSearchParams(window.location.search)
    return params.get('payment_intent') ? 'loading' : 'error'
  })

  useEffect(() => {
    if (!paymentIntent) {
      return
    }

    // Verify the payment status with Stripe
    const verifyPayment = async () => {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent }),
        })

        if (!response.ok) {
          setStatus('error')
          return
        }

        const data = await response.json()

        if (data.status === 'succeeded') {
          setStatus('success')

          // Clear form data after successful payment verification
          try {
            clearFormData()
          } catch (clearError) {
            console.warn('Failed to clear form data:', clearError)
            // Non-critical - don't show error to user
          }
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    }

    verifyPayment()
  }, [paymentIntent])

  if (status === 'loading') {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Processing Payment"
        description="Please wait while we confirm your payment"
        usePersonalization={false}
        hideProgressAndBadges={true}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Verifying your payment...</p>
          </div>
        </div>
      </FormLayout>
    )
  }

  if (status === 'error') {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Payment Error"
        description="There was an issue with your payment"
        usePersonalization={false}
        hideProgressAndBadges={true}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="mb-2 font-medium text-red-600">Payment verification failed</p>
          <p className="text-sm text-red-600">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </FormLayout>
    )
  }

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="Payment Successful"
      description="Your doctor's note is being processed"
      usePersonalization={true}
      hideProgressAndBadges={true}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-600" />
          <h2 className="text-foreground mb-2 text-2xl font-bold">Thank you for your payment!</h2>
          <p className="text-muted-foreground">
            Your doctor&apos;s note is being processed and will be sent to your email shortly.
          </p>
        </div>

        <div className="border-border/40 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-foreground mb-3 text-sm font-semibold">What happens next?</h3>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li className="flex items-start">
              <span className="bg-primary/10 text-primary mr-3 inline-block h-6 w-6 flex-shrink-0 rounded-full text-center">
                1
              </span>
              <span>You&apos;ll receive a confirmation email within the next few minutes</span>
            </li>
            <li className="flex items-start">
              <span className="bg-primary/10 text-primary mr-3 inline-block h-6 w-6 flex-shrink-0 rounded-full text-center">
                2
              </span>
              <span>Your doctor&apos;s note will be reviewed and processed</span>
            </li>
            <li className="flex items-start">
              <span className="bg-primary/10 text-primary mr-3 inline-block h-6 w-6 flex-shrink-0 rounded-full text-center">
                3
              </span>
              <span>The completed note will be sent to your registered email address</span>
            </li>
          </ul>
        </div>

        <div className="pt-4 text-center">
          <Link
            href="/"
            className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm transition-all"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </FormLayout>
  )
}
