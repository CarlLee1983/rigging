import type { UserId } from '../../domain/auth-context'

export interface User {
  readonly id: UserId
  readonly email: string
  readonly emailVerified: boolean
  readonly name: string
  readonly image: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(userId: UserId): Promise<User | null>
  save(input: {
    id: UserId
    email: string
    emailVerified: boolean
    name: string
    image: string | null
    createdAt?: Date
    updatedAt?: Date
  }): Promise<void>
}
