'use client'

import { useEffect } from 'react'
import { getFormData, saveFormData } from '@/lib/form-storage'
import { normalizeOfferCode, OFFER_QUERY_PARAM } from '@/lib/offer-codes'

export default function OfferCodeCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const offerCode = normalizeOfferCode(params.get(OFFER_QUERY_PARAM))

    if (!offerCode) {
      return
    }

    const existing = getFormData()
    if (existing.offerCode !== offerCode) {
      saveFormData({ offerCode })
    }
  }, [])

  return null
}
