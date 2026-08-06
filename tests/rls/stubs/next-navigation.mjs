/**
 * `next/navigation` outside a request scope.
 *
 * `notFound()` and `redirect()` work by throwing a signal Next catches upstream.
 * Reproducing that shape matters: `requireView()` denies by calling `notFound()`,
 * so a test that expects a denial must see a throw, not a return.
 */
export class NotFoundSignal extends Error {
  constructor() {
    super('NEXT_NOT_FOUND')
    this.digest = 'NEXT_NOT_FOUND'
  }
}

export class RedirectSignal extends Error {
  constructor(url) {
    super(`NEXT_REDIRECT:${url}`)
    this.digest = `NEXT_REDIRECT;replace;${url};307;`
    this.url = url
  }
}

export function notFound() {
  throw new NotFoundSignal()
}

export function redirect(url) {
  throw new RedirectSignal(url)
}

export function permanentRedirect(url) {
  throw new RedirectSignal(url)
}
