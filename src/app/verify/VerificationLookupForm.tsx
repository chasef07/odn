'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { lookupMedicalRecord, type VerificationLookupState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="h-12 w-full rounded-md text-base">
      <Search className="h-4 w-4" />
      {pending ? 'Verifying...' : 'Verify document'}
    </Button>
  )
}

export function VerificationLookupForm() {
  const [state, action] = useActionState<VerificationLookupState, FormData>(lookupMedicalRecord, {})

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="medicalRecordNumber">Medical Record #</Label>
        <Input
          id="medicalRecordNumber"
          name="medicalRecordNumber"
          autoComplete="off"
          spellCheck={false}
          placeholder="A7B3C9D2"
          className="h-12 text-center font-mono text-base uppercase"
          aria-describedby={state.error ? 'verification-error' : undefined}
        />
      </div>

      {state.error && (
        <p
          id="verification-error"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  )
}
