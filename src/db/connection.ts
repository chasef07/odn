import prisma from './client'

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
