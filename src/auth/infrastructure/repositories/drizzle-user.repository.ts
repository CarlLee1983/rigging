import { eq } from 'drizzle-orm'
import type { DrizzleDb } from '../../../shared/infrastructure/db/client'
import type { IUserRepository } from '../../application/ports/user-repository.port'
import type { UserId } from '../../domain'
import { UserMapper } from '../mappers/user.mapper'
import { user } from '../schema/user.schema'

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DrizzleDb) {}

  async findByEmail(email: string) {
    const rows = await this.db.select().from(user).where(eq(user.email, email)).limit(1)
    return rows[0] ? UserMapper.toDomain(rows[0]) : null
  }

  async findById(userId: UserId) {
    const rows = await this.db.select().from(user).where(eq(user.id, userId)).limit(1)
    return rows[0] ? UserMapper.toDomain(rows[0]) : null
  }

  async save(input: {
    id: UserId
    email: string
    emailVerified: boolean
    name: string
    image: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Promise<void> {
    const now = input.updatedAt ?? new Date()
    await this.db
      .insert(user)
      .values({
        id: input.id,
        email: input.email,
        emailVerified: input.emailVerified,
        name: input.name,
        image: input.image,
        createdAt: input.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          email: input.email,
          emailVerified: input.emailVerified,
          name: input.name,
          image: input.image,
          updatedAt: now,
        },
      })
  }
}
