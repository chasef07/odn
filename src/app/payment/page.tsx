"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { ArrowLeft } from 'lucide-react';
import { FormLayout } from '@/components/form-layout';

const CURRENT_STEP = 10;

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success`,
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`.
    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") {
        setMessage(error.message || 'An error occurred');
      } else {
        setMessage("An unexpected error occurred.");
      }
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="rounded-xl border border-border/40 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Order Summary
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-base text-foreground">Doctor&apos;s Note - Online Medical Documentation</span>
            <span className="text-base font-semibold text-foreground">
              ${((parseInt(process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2999')) / 100).toFixed(2)}
            </span>
          </div>
          <div className="border-t border-border/40 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-foreground">Total</span>
              <span className="text-lg font-bold text-primary">
                ${((parseInt(process.env.NEXT_PUBLIC_PAYMENT_AMOUNT || '2999')) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Payment Details
        </h3>
        <PaymentElement />
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{message}</p>
        </div>
      )}

      <div className="pt-2 flex justify-between items-center">
        <button
          type="button"
          onClick={() => router.push('/review')}
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground transition-all hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="submit"
          disabled={isLoading || !stripe || !elements}
          className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold transition-all shadow-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Pay Now'}
        </button>
      </div>
    </form>
  );
}

export default function PaymentPage() {
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create PaymentIntent as soon as the page loads
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError('Failed to initialize payment');
        }
      })
      .catch(() => {
        setError('Failed to connect to payment service');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const appearance = {
    theme: 'stripe' as const,
  };

  const options = {
    clientSecret,
    appearance,
  };

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading payment form...</p>
          </div>
        </div>
      </FormLayout>
    );
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
    );
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
  );
}
