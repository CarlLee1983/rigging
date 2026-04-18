import { type Brand, brand } from './brand'

export type UUID<K extends string> = Brand<string, K>

export const newUUID = <K extends string>(): UUID<K> => brand<K>()(crypto.randomUUID())
