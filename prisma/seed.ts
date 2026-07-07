import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  PrismaClient,
  UserRole,
  UserStatus
} from '../src/generated/prisma/client'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL не указан в .env')
}

const adapter = new PrismaPg({
  connectionString: databaseUrl
})

const prisma = new PrismaClient({
  adapter
})

async function main() {
  const clerkId = process.env.FIRST_ADMIN_CLERK_ID
  const email = process.env.FIRST_ADMIN_EMAIL
  const name = process.env.FIRST_ADMIN_NAME || 'Admin'

  if (!clerkId) {
    throw new Error('FIRST_ADMIN_CLERK_ID не указан в .env')
  }

  if (!email) {
    throw new Error('FIRST_ADMIN_EMAIL не указан в .env')
  }

  const existingByClerkId = await prisma.user.findUnique({
    where: {
      clerkId
    }
  })

  const existingByEmail = await prisma.user.findUnique({
    where: {
      email
    }
  })

  let user

  if (existingByClerkId) {
    user = await prisma.user.update({
      where: {
        clerkId
      },
      data: {
        email,
        name,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE
      },
      include: {
        settings: true
      }
    })
  } else if (existingByEmail) {
    user = await prisma.user.update({
      where: {
        email
      },
      data: {
        clerkId,
        name,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE
      },
      include: {
        settings: true
      }
    })
  } else {
    user = await prisma.user.create({
      data: {
        clerkId,
        email,
        name,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        settings: {
          create: {}
        }
      },
      include: {
        settings: true
      }
    })
  }

  await prisma.userSettings.upsert({
    where: {
      userId: user.id
    },
    update: {},
    create: {
      userId: user.id
    }
  })

  console.log('Первый админ создан или обновлен:')
  console.log({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status
  })
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
