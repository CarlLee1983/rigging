// Result<T, E> — neverthrow-style, self-implemented, no dep.
// See docs/decisions/0003-ddd-layering.md — kernel stays framework-free.

export type Result<T, E> = Ok<T, E> | Err<T, E>

class Ok<T, E> {
  readonly _tag = 'Ok' as const

  constructor(readonly value: T) {}

  isOk(): this is Ok<T, E> {
    return true
  }

  isErr(): this is Err<T, E> {
    return false
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok(fn(this.value))
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return this as unknown as Result<T, F>
  }

  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value)
  }

  match<R>(handlers: { ok: (value: T) => R; err: (error: E) => R }): R {
    return handlers.ok(this.value)
  }
}

class Err<T, E> {
  readonly _tag = 'Err' as const

  constructor(readonly error: E) {}

  isOk(): this is Ok<T, E> {
    return false
  }

  isErr(): this is Err<T, E> {
    return true
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as unknown as Result<U, E>
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new Err(fn(this.error))
  }

  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return this as unknown as Result<U, E>
  }

  match<R>(handlers: { ok: (value: T) => R; err: (error: E) => R }): R {
    return handlers.err(this.error)
  }
}

export type { Err, Ok }

export const ok = <T, E = never>(value: T): Result<T, E> => new Ok(value)

export const err = <T = never, E = unknown>(error: E): Result<T, E> => new Err(error)

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result._tag === 'Ok'

export const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => result._tag === 'Err'
