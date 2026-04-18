// Brand<T, K> — phantom property pattern, compile-time only, runtime zero-cost.
// See docs/decisions/0003-ddd-layering.md — kernel stays framework-free.

declare const __brand: unique symbol

export type Brand<T, K extends string> = T & { readonly [__brand]: K }

/**
 * Internal `as` cast helper. Callers should define typed constructors per feature:
 *
 *   export type UserId = Brand<string, 'UserId'>
 *   export const UserId = (value: string): UserId => brand<'UserId'>()(value)
 *
 * If runtime validation is needed (e.g. UUID format check) the feature's
 * constructor performs the check before calling brand().
 */
export const brand =
  <K extends string>() =>
  <T>(value: T): Brand<T, K> =>
    value as Brand<T, K>
