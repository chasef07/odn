import { ageOn, parseDateOnly, todayUTC } from './dates'

export const isAgeValid = (dateOfBirth: string, minAge: number = 18): boolean => {
  const day = parseDateOnly(dateOfBirth)
  return day !== null && ageOn(day, todayUTC()) >= minAge
}
