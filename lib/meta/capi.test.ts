import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendMetaEvents, type MetaServerEvent } from '@/lib/meta/capi'

/**
 * The transport, and the two promises it makes to everything upstream of it:
 *
 *   * IT NEVER THROWS. Every call site sits after a business decision has been committed —
 *     an account created, a payment settled — so an advertising measurement call must not
 *     be able to fail one. That is asserted here rather than reasoned about, because it is
 *     one `await` away from being false.
 *   * THE ACCESS TOKEN NEVER REACHES A URL OR A LOG. Query strings land in access logs,
 *     proxy logs and exception reporters.
 *
 * Mutation-checked: moving the token to the query string turns the credential case red;
 * removing the retry turns the transient case red; retrying on 4xx turns the "no retry"
 * case red; throwing instead of returning turns four cases red.
 */

const TOKEN = 'EAAG-not-a-real-token'
const EVENT: MetaServerEvent = {
  event_name: 'Purchase',
  event_time: 1_700_000_000,
  event_id: 'purchase_abc',
  action_source: 'website',
  event_source_url: 'https://genorra.com/upgrade',
  user_data: { em: 'a'.repeat(64) },
  custom_data: { value: 5, currency: 'USD' },
}

const KEYS = ['META_PIXEL_ID', 'META_CONVERSIONS_API_ACCESS_TOKEN', 'META_TEST_EVENT_CODE', 'VERCEL_ENV'] as const
let saved: Record<string, string | undefined>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  process.env.META_PIXEL_ID = '1234567890'
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = TOKEN
  process.env.VERCEL_ENV = 'production'
  delete process.env.META_TEST_EVENT_CODE
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const ok = (received = 1) =>
  new Response(JSON.stringify({ events_received: received }), { status: 200 })

describe('the request', () => {
  it('goes to a PINNED Graph API version', async () => {
    // An unpinned call follows whatever Meta promotes to default, so a breaking change to
    // user_data normalisation would arrive with no deploy of ours in between.
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    const [url] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/1234567890\/events$/)
  })

  it('puts the access token in the BODY and never in the URL', async () => {
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain(TOKEN)
    expect(JSON.parse(init.body).access_token).toBe(TOKEN)
  })

  it('sends the event verbatim under `data`', async () => {
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).data).toEqual([EVENT])
  })

  it('carries no test_event_code in production', async () => {
    process.env.META_TEST_EVENT_CODE = 'TEST12345'
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).test_event_code).toBeUndefined()
  })

  it('carries one on a QA deployment', async () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.META_TEST_EVENT_CODE = 'TEST12345'
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).test_event_code).toBe('TEST12345')
  })

  it('is bounded by a timeout', async () => {
    fetchMock.mockResolvedValue(ok())
    await sendMetaEvents([EVENT])
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('failure never propagates', () => {
  it('returns rather than throwing when the network is down', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await sendMetaEvents([EVENT])
    expect(result.sent).toBe(false)
    expect(result.error).toContain('ECONNREFUSED')
  })

  it('returns rather than throwing when Meta refuses the payload', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"Invalid parameter"}}', { status: 400 }))
    const result = await sendMetaEvents([EVENT])
    expect(result.sent).toBe(false)
    expect(result.error).toContain('400')
  })

  it('returns rather than throwing when the response is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway</html>', { status: 200 }))
    const result = await sendMetaEvents([EVENT])
    // A 200 that cannot be parsed still counts as delivered — Meta accepted it.
    expect(result.sent).toBe(true)
  })

  it('reports a half-configured deployment instead of guaranteeing a 401', async () => {
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN
    const result = await sendMetaEvents([EVENT])
    expect(result).toMatchObject({ sent: false, skipped: true })
    expect(fetchMock).not.toHaveBeenCalled()
    // The diagnostic names the missing variable and cannot contain the token — there
    // isn't one.
    expect(result.error).toContain('META_CONVERSIONS_API_ACCESS_TOKEN')
  })

  it('never puts the access token in the error it returns', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"bad token"}}', { status: 401 }))
    const result = await sendMetaEvents([EVENT])
    expect(result.error).not.toContain(TOKEN)
  })
})

describe('retrying', () => {
  it('retries a transient failure once, and succeeds', async () => {
    // Safe because the event carries a stable id: a retry after a request that in fact
    // landed is deduplicated by Meta rather than counted twice.
    fetchMock
      .mockResolvedValueOnce(new Response('upstream', { status: 503 }))
      .mockResolvedValueOnce(ok())
    const result = await sendMetaEvents([EVENT])
    expect(result.sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a rate limit', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(ok())
    expect((await sendMetaEvents([EVENT])).sent).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a rejection — identical bytes get an identical verdict', async () => {
    fetchMock.mockResolvedValue(new Response('{"error":{"message":"Invalid parameter"}}', { status: 400 }))
    await sendMetaEvents([EVENT])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after the second attempt', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    expect((await sendMetaEvents([EVENT])).sent).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('an empty batch', () => {
  it('is a no-op rather than a request', async () => {
    expect(await sendMetaEvents([])).toEqual({ sent: true, received: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
