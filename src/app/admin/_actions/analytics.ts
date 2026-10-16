'use server'

import { Prisma, SubmissionStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { toNationalDigits } from '@/lib/phone-utils'
import {
  buildFriendsFamilyCustomerDetail,
  buildFriendsFamilyAnalytics,
  type FriendsFamilyAnalytics,
  type FriendsFamilyAnalyticsOptions,
  type FriendsFamilyCustomerRow,
  type FriendsFamilyCustomerSegment,
  type FriendsFamilySegmentFilter,
  type FriendsFamilySubmissionInput,
} from '@/lib/friends-family-analytics'
import {
  buildBusinessAnalytics,
  type BusinessAnalytics,
  type BusinessAnalyticsOptions,
  type BusinessAnalyticsRange,
} from '@/lib/business-analytics'
import { adminAction } from '@/lib/admin-session'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const FRIENDS_FAMILY_LOOKBACK_DAYS = 365

const FRIENDS_FAMILY_PAGE_SIZE = 4000

const FRIENDS_FAMILY_MAX_ROWS = 100_000

const BUSINESS_ANALYTICS_PAGE_SIZE = 4000

const BUSINESS_ANALYTICS_MAX_ROWS = 100_000

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY)
}

function businessAnalyticsFetchStart(range: BusinessAnalyticsRange, referenceDate: Date): Date {
  if (range === '7d') return daysBefore(referenceDate, 14)
  if (range === '30d' || range === '90d') return daysBefore(referenceDate, 180)
  if (range === 'monthly') return daysBefore(referenceDate, 400)
  if (range === 'quarterly') return daysBefore(referenceDate, 770)
  if (range === 'all' || range === 'yearly') return new Date('2000-01-01T00:00:00.000Z')
  return daysBefore(referenceDate, FRIENDS_FAMILY_LOOKBACK_DAYS)
}

async function fetchFriendsFamilySubmissions(
  referenceDate: Date
): Promise<FriendsFamilySubmissionInput[]> {
  const lookbackStart = daysBefore(referenceDate, FRIENDS_FAMILY_LOOKBACK_DAYS)

  const submissions: FriendsFamilySubmissionInput[] = []
  let cursor: string | undefined
  while (submissions.length < FRIENDS_FAMILY_MAX_ROWS) {
    const page = await prisma.submission.findMany({
      where: {
        createdAt: { gte: lookbackStart },
      },
      select: {
        id: true,
        status: true,
        patientFirstName: true,
        patientLastName: true,
        patientDateOfBirth: true,
        guardianFirstName: true,
        guardianLastName: true,
        recipient: true,
        email: true,
        phone: true,
        notePurpose: true,
        firstDayOff: true,
        lastDayOff: true,
        denialReason: true,
        maybeReason: true,
        stripeRefundId: true,
        refundedAt: true,
        offerCode: true,
        paymentAmount: true,
        createdAt: true,
        reviewedAt: true,
        approvalEmailSentAt: true,
      },
      orderBy: { id: 'asc' },
      take: FRIENDS_FAMILY_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (page.length === 0) break
    submissions.push(...page)
    if (page.length < FRIENDS_FAMILY_PAGE_SIZE) break
    cursor = page[page.length - 1].id
  }

  return submissions
}

export const getFriendsFamilyAnalytics = adminAction(
  async (
    _admin,
    options: FriendsFamilyAnalyticsOptions = {}
  ): Promise<{
    success: boolean
    data?: FriendsFamilyAnalytics
    error?: string
  }> => {
    try {
      const referenceDate = new Date()
      const submissions = await fetchFriendsFamilySubmissions(referenceDate)

      return {
        success: true,
        data: buildFriendsFamilyAnalytics(submissions, referenceDate, options),
      }
    } catch (error) {
      logger.error('Error fetching friends and family analytics:', error)
      return { success: false, error: 'Failed to fetch friends and family analytics' }
    }
  }
)

export const exportFriendsFamilyCustomers = adminAction(
  async (
    _admin,
    options: {
      segment: FriendsFamilySegmentFilter
    }
  ): Promise<{
    success: boolean
    data?: FriendsFamilyCustomerRow[]
    error?: string
  }> => {
    try {
      const referenceDate = new Date()
      const submissions = await fetchFriendsFamilySubmissions(referenceDate)
      const result = buildFriendsFamilyAnalytics(submissions, referenceDate, {
        segment: options.segment,
        limit: 50_000,
      })
      return { success: true, data: result.customers }
    } catch (error) {
      logger.error('Error exporting friends and family customers:', error)
      return { success: false, error: 'Failed to export customer list' }
    }
  }
)

function getFriendsFamilyCustomerWhere(customerKey: string): Prisma.SubmissionWhereInput | null {
  const separatorIndex = customerKey.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  const keyType = customerKey.slice(0, separatorIndex)
  const keyValue = customerKey.slice(separatorIndex + 1)

  if (keyType === 'email') {
    const email = keyValue.trim().toLowerCase()
    return email ? { email: { equals: email, mode: 'insensitive' } } : null
  }

  if (keyType === 'phone') {
    const digits = toNationalDigits(keyValue)
    if (!digits) {
      return null
    }

    const phoneFilters: Prisma.SubmissionWhereInput[] = [{ phone: { contains: digits } }]

    if (digits.length >= 10) {
      const tenDigits = digits.slice(0, 10)
      phoneFilters.push({
        phone: {
          equals: `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6, 10)}`,
        },
      })
      phoneFilters.push({
        AND: [
          { phone: { contains: tenDigits.slice(0, 3) } },
          { phone: { contains: tenDigits.slice(3, 6) } },
          { phone: { contains: tenDigits.slice(6, 10) } },
        ],
      })
    }

    return { OR: phoneFilters }
  }

  if (keyType === 'patient') {
    const [firstName, lastName, dateOfBirth, ...extraParts] = keyValue.split(':')
    if (!firstName || !lastName || !dateOfBirth || extraParts.length > 0) {
      return null
    }

    const parsedDateOfBirth = new Date(`${dateOfBirth}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsedDateOfBirth.getTime())) {
      return null
    }

    return {
      patientFirstName: { equals: firstName, mode: 'insensitive' },
      patientLastName: { equals: lastName, mode: 'insensitive' },
      patientDateOfBirth: parsedDateOfBirth,
    }
  }

  return null
}

export const getFriendsFamilyCustomerDetail = adminAction(
  async (
    _admin,
    customerKey: string
  ): Promise<{
    success: boolean
    data?: FriendsFamilyCustomerSegment
    error?: string
  }> => {
    try {
      const where = getFriendsFamilyCustomerWhere(customerKey)
      if (!where) {
        return { success: false, error: 'Customer not found' }
      }

      const submissions = await prisma.submission.findMany({
        where,
        select: {
          id: true,
          status: true,
          patientFirstName: true,
          patientLastName: true,
          patientDateOfBirth: true,
          guardianFirstName: true,
          guardianLastName: true,
          recipient: true,
          email: true,
          phone: true,
          notePurpose: true,
          firstDayOff: true,
          lastDayOff: true,
          denialReason: true,
          maybeReason: true,
          stripeRefundId: true,
          refundedAt: true,
          offerCode: true,
          paymentAmount: true,
          createdAt: true,
          reviewedAt: true,
          approvalEmailSentAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      const customer = buildFriendsFamilyCustomerDetail(submissions, customerKey)
      if (!customer) {
        return { success: false, error: 'Customer not found' }
      }

      return { success: true, data: customer }
    } catch (error) {
      logger.error('Error fetching friends and family customer detail:', error)
      return { success: false, error: 'Failed to fetch customer detail' }
    }
  }
)

export const getBusinessAnalytics = adminAction(
  async (
    _admin,
    options: BusinessAnalyticsOptions = {}
  ): Promise<{
    success: boolean
    data?: BusinessAnalytics
    error?: string
  }> => {
    try {
      const referenceDate = new Date()
      const range = options.range ?? '30d'
      const fetchStart = businessAnalyticsFetchStart(range, referenceDate)

      const submissions: Array<{
        id: string
        status: SubmissionStatus
        state: string
        patientFirstName: string
        patientLastName: string
        patientDateOfBirth: Date
        email: string
        phone: string
        offerCode: string | null
        attributionChannel: string | null
        paymentAmount: number | null
        stripeRefundId: string | null
        refundedAt: Date | null
        createdAt: Date
      }> = []
      let cursor: string | undefined
      while (submissions.length < BUSINESS_ANALYTICS_MAX_ROWS) {
        const page = await prisma.submission.findMany({
          where: { createdAt: { gte: fetchStart } },
          select: {
            id: true,
            status: true,
            state: true,
            patientFirstName: true,
            patientLastName: true,
            patientDateOfBirth: true,
            email: true,
            phone: true,
            offerCode: true,
            attributionChannel: true,
            paymentAmount: true,
            stripeRefundId: true,
            refundedAt: true,
            createdAt: true,
          },
          orderBy: { id: 'asc' },
          take: BUSINESS_ANALYTICS_PAGE_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })
        if (page.length === 0) break
        submissions.push(...page)
        if (page.length < BUSINESS_ANALYTICS_PAGE_SIZE) break
        cursor = page[page.length - 1].id
      }

      return {
        success: true,
        data: buildBusinessAnalytics(submissions, referenceDate, {
          ...options,
          range,
        }),
      }
    } catch (error) {
      logger.error('Error fetching business analytics:', error)
      return { success: false, error: 'Failed to fetch business analytics' }
    }
  }
)
