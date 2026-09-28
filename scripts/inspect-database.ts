import prisma from '../src/lib/prisma'

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Database...\n')

    const tempCount = await prisma.temporarySubmission.count()
    const submissionCount = await prisma.submission.count()

    console.log('📊 Record Counts:')
    console.log(`  TemporarySubmissions: ${tempCount}`)
    console.log(`  Submissions (permanent): ${submissionCount}\n`)

    if (tempCount > 0) {
      console.log('📝 Recent Temporary Submissions:')
      const tempSubmissions = await prisma.temporarySubmission.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          paymentIntentId: true,
          createdAt: true,
          expiresAt: true,
        },
      })
      console.table(tempSubmissions)
    }

    if (submissionCount > 0) {
      console.log('\n✅ Recent Permanent Submissions:')
      const submissions = await prisma.submission.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          status: true,
          createdAt: true,
          patientFirstName: true,
          patientLastName: true,
        },
      })
      console.table(submissions)
    }

    const expiredCount = await prisma.temporarySubmission.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    if (expiredCount > 0) {
      console.log(
        `\n⚠️  Found ${expiredCount} expired temporary submissions (should be cleaned up)`
      )
    }

    const statusBreakdown = await prisma.submission.groupBy({
      by: ['status'],
      _count: true,
    })

    if (statusBreakdown.length > 0) {
      console.log('\n📈 Submissions by Status:')
      console.table(statusBreakdown)
    }

    console.log('\n✅ Database inspection complete!')
  } catch (error) {
    console.error('❌ Error inspecting database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

inspectDatabase()
