import type { User } from '../../application/ports/user-repository.port'

export type UserDbRow = {
  id: string
  email: string
  emailVerified: boolean
  name: string
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export const UserMapper = {
  toDomain(row: UserDbRow): User {
    return {
      id: row.id as User['id'],
      email: row.email,
      emailVerified: row.emailVerified,
      name: row.name,
      image: row.image,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  },
}
