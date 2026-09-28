import { z } from 'zod'
import { differenceInYears } from 'date-fns'
import { isAtLeastAge, parseIsoDateOnly } from './date-only'

export const isAgeValid = (dateOfBirth: string, minAge: number = 18): boolean => {
  if (parseIsoDateOnly(dateOfBirth)) {
    return isAtLeastAge(dateOfBirth, minAge)
  }

  const parsedDate = new Date(dateOfBirth)
  if (Number.isNaN(parsedDate.getTime())) return false

  return differenceInYears(new Date(), parsedDate) >= minAge
}

export const createAgeValidator = (minAge: number = 18, fieldName: string = 'You') => {
  return z.string().refine((val) => isAgeValid(val, minAge), {
    message: `${fieldName} must be ${minAge} years or older`,
  })
}
