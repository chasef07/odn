"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FormLayout } from '@/components/form-layout';
import { CheckCircle2 } from 'lucide-react';

const CURRENT_STEP = 10;

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const paymentIntent = searchParams.get('payment_intent');

  useEffect(() => {
    if (!paymentIntent) {
      setStatus('error');
      return;
    }

    // Verify the payment status with Stripe
    const verifyPayment = async () => {
      try {
        const response = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent }),
        });

        if (!response.ok) {
          setStatus('error');
          return;
        }

        const data = await response.json();

        if (data.status === 'succeeded') {
          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    verifyPayment();
  }, [paymentIntent]);

  if (status === 'loading') {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Processing Payment"
        description="Please wait while we confirm your payment"
        usePersonalization={false}
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verifying your payment...</p>
          </div>
        </div>
      </FormLayout>
    );
  }

  if (status === 'error') {
    return (
      <FormLayout
        currentStep={CURRENT_STEP}
        title="Payment Error"
        description="There was an issue with your payment"
        usePersonalization={false}
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-600 font-medium mb-2">Payment verification failed</p>
          <p className="text-sm text-red-600">
            Please contact support if you believe this is an error.
          </p>
        </div>
      </FormLayout>
    );
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
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Thank you for your payment!
          </h2>
          <p className="text-muted-foreground">
            Your doctor's note is being processed and will be sent to your email shortly.
          </p>
        </div>

        <div className="rounded-xl border border-border/40 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            What happens next?
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 rounded-full bg-primary/10 text-primary text-center mr-3 flex-shrink-0">
                1
              </span>
              <span>You'll receive a confirmation email within the next few minutes</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 rounded-full bg-primary/10 text-primary text-center mr-3 flex-shrink-0">
                2
              </span>
              <span>Your doctor's note will be reviewed and processed</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-6 h-6 rounded-full bg-primary/10 text-primary text-center mr-3 flex-shrink-0">
                3
              </span>
              <span>The completed note will be sent to your registered email address</span>
            </li>
          </ul>
        </div>

        <div className="text-center pt-4">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-semibold transition-all shadow-sm bg-primary text-white hover:bg-primary/90"
          >
            Return to Home
          </a>
        </div>
      </div>
    </FormLayout>
  );
}
