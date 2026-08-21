/**
 * Does a realtime event actually ARRIVE, and does it arrive only at the right person?
 *
 *   npm run realtime:check            (needs `npx supabase start` — it RESEEDS the local database)
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────
 * `20260821000002` put `notifications` and `chat_messages` into the `supabase_realtime`
 * publication, which is what three long-standing `postgres_changes` subscriptions had been
 * missing since they shipped. That migration can assert the CATALOGUE — the table is a member,
 * the replica identity is not FULL, the policy helpers are executable — and it cannot assert
 * the only thing anybody cares about, because that needs a websocket, a running Realtime
 * container, and a real signed-in member.
 *
 * This is that half. It is a test wearing a script's clothes: it exits 1 on a finding, exactly
 * as `npm run email:check` and `npm run art:check` do, so it reads like a gate at a call site.
 *
 * ── WHY IT IS NOT IN `tests/rls`, AND NOT IN `verify.yml` ───────────────────────────
 * `tests/rls` calls server ACTIONS over HTTP-shaped plumbing; there is no action here to call,
 * and a websocket subscription is not a request-response. And `verify.yml` holds no Supabase
 * stack at all — a gate that a legitimate `npm ci` turns red is a gate people learn to ignore,
 * which is the argument `art:check` already records for staying out of that workflow.
 *
 * ── IT REUSES `tests/rls`' FIXTURE, DELIBERATELY ────────────────────────────────────
 * Proving RLS-over-realtime needs two approved members of one family with real `people` rows,
 * a chat room they both participate in, and a SECOND family to attack from. That is exactly
 * what `seed()` builds, and building a second, thinner version of it is how the two come to
 * disagree about what an approved member looks like. `tests/rls/env.mjs` also carries the
 * refusal to run against anything that is not 127.0.0.1, which this script must inherit rather
 * than restate: it CREATES AND DELETES ROWS.
 *
 * ── EVERY CHECK IS A PAIR, FOR AGENTS.md §7's REASON ────────────────────────────────
 * A subscription that receives NOTHING passes every isolation assertion perfectly. So each
 * table is asked two questions with the same subscriber and the same socket:
 *
 *   arrives   the row the subscriber is entitled to      -> must be received
 *   withheld  a row belonging to somebody else           -> must NOT be received
 *
 * and the withheld half is written so the CLIENT-SIDE `filter` cannot be what refuses it:
 *
 *   * The notifications subscriber subscribes UNFILTERED, where `NotificationBell` filters on
 *     `recipient_id`. If the filter were doing the work, the withheld row would still arrive
 *     here — so this is an assertion about the POLICY.
 *   * The chat subscriber also subscribes unfiltered, which is what `ChatShell` genuinely
 *     does, and the withheld message is in ANOTHER FAMILY's room. That is the one assertion
 *     anywhere that `auth_uid_is_room_participant()` narrows a realtime stream, which
 *     AGENTS.md §2b calls load-bearing and nothing has ever exercised.
 *
 * ── WHAT IT CANNOT TELL YOU ─────────────────────────────────────────────────────────
 * Whether HOSTED is published. Publication membership is per-database and the dashboard edits
 * it by hand, so a green run here says the migration is right, not that production received
 * it. `npm run db:check -- --linked` answers whether the migration arrived; the query in
 * TODO.md answers the membership directly.
 */
import '../tests/rls/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { API_URL, ANON_KEY, SERVICE_ROLE_KEY } from '../tests/rls/env.mjs'
import { seed, signIn } from '../tests/rls/seed.mjs'

const GREEN = s => `\x1b[32m${s}\x1b[0m`
const RED = s => `\x1b[31m${s}\x1b[0m`
const GREY = s => `\x1b[90m${s}\x1b[0m`

/**
 * How long to wait for a row that SHOULD arrive, and for one that should not.
 *
 * They are different numbers for different reasons, and neither is a guess at network latency.
 * `ARRIVE_MS` is generous because a false negative here is a false FINDING — a green feature
 * reported broken is worse than a slow check. `WITHHELD_MS` is the shorter one because it is
 * spent on every run whether or not anything is wrong, and because the positive half has
 * already proved the socket is live and delivering: an event that has not come by then is not
 * coming.
 */
const SUBSCRIBE_MS = 15_000
const ARRIVE_MS = 8_000
const WITHHELD_MS = 3_000

/**
 * ── THE READINESS GATE, WHICH IS THE ONLY REASON THIS SCRIPT IS TRUSTWORTHY ────────
 *
 * `SUBSCRIBED` means the CLIENT has its reply. It does not mean walrus is watching: Realtime
 * registers a `postgres_changes` subscription as a row in `realtime.subscription` and the
 * replication side picks it up from there, so a row written in the gap is delivered to nobody
 * at all — which is indistinguishable, from here, from a policy refusing it.
 *
 * MEASURED, twice. On this script's first run the notifications half reported zero events while
 * the chat half — same socket, same actor, moments later — delivered its row; bisecting the
 * policy conjunct by conjunct and then restoring it whole delivered every time, so the policy
 * was never the cause. A fixed one-second settle then passed twice and failed on the third run.
 * The pattern is that the FIRST channel on a freshly-opened socket is the slow one, and a sleep
 * long enough to cover it is a sleep nobody can justify.
 *
 * So the gate is not a sleep. Before asserting anything, the script writes a THROWAWAY row
 * addressed to the subscriber and waits for it to come back, retrying the write until one does.
 * That is a positive observation of the exact path under test rather than a guess about how long
 * it takes to become live — and if it never becomes live, THAT is the finding, reported in its
 * own words instead of as a mysterious withheld row.
 *
 * It does not make the real assertion tautological. The gate proves the socket delivers SOME row
 * on this table; the pair that follows still has to show that the intended row arrives and that
 * somebody else's does not, and the second of those is the assertion that matters and is
 * untouched by any of this. The failure direction this closes is the expensive one: a working
 * feature reported broken, about a security boundary.
 */
const READY_ATTEMPTS = 8
const READY_WAIT_MS = 1_500

const findings = []
let checks = 0

function record(ok, label, detail = '') {
  checks += 1
  if (!ok) findings.push(label)
  console.log(`  ${ok ? GREEN('PASS') : RED('FAIL')} ${label}${detail ? `\n         ${GREY(detail)}` : ''}`)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const db = createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * A signed-in client with its realtime socket authenticated as that member.
 *
 * `setAuth` is called EXPLICITLY rather than relying on `signInWithPassword` having wired it.
 * supabase-js does propagate the session to the realtime client on sign-in, and depending on
 * that here would make this script's whole result depend on an ordering inside a dependency —
 * on the one code path where getting it wrong looks exactly like a policy refusing.
 */
async function subscriber(user) {
  const client = createClient(API_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const actor = await signIn(user)
  await client.auth.setSession({
    access_token: actor.accessToken, refresh_token: actor.refreshToken,
  })
  await client.realtime.setAuth(actor.accessToken)
  return { client, actor }
}

/**
 * Subscribe to INSERTs on one table and collect them.
 *
 * UNFILTERED, on purpose — see the header. Resolves once the channel reports SUBSCRIBED, which
 * is NOT the same as the subscription being registered — see `awaitLive` below and the
 * readiness-gate note above it. Callers must gate on that before writing anything they intend
 * to assert about; a row written too early reaches nobody and reads exactly like a policy
 * refusing it, which is this script's first false finding and the reason it is not four lines.
 */
async function listen(client, table) {
  const received = []
  const channel = client.channel(`check:${table}:${Math.random().toString(36).slice(2)}`)
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table },
    payload => received.push(payload.new))

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`channel for ${table} never reached SUBSCRIBED in ${SUBSCRIBE_MS}ms`)),
      SUBSCRIBE_MS,
    )
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`channel for ${table} reported ${status}`))
      }
    })
  })


  return {
    received,
    /** Wait until `predicate` matches something received, or the budget runs out. */
    async waitFor(predicate, budgetMs) {
      const deadline = Date.now() + budgetMs
      while (Date.now() < deadline) {
        if (received.some(predicate)) return true
        await sleep(150)
      }
      return received.some(predicate)
    },
    /** Forget everything received so far — used by the readiness gate. */
    clear: () => { received.length = 0 },
    close: () => client.removeChannel(channel),
  }
}

/**
 * Wait until this channel is genuinely delivering, by watching a throwaway row do it.
 *
 * `write(n)` inserts attempt `n`'s probe row and returns a predicate that matches it. Every
 * attempt writes a NEW row rather than re-waiting on the first, because the row written before
 * walrus was watching is never delivered — waiting longer for it cannot succeed, and that is
 * precisely the mistake a plain sleep makes.
 *
 * Returns true once one arrives. The caller reports a false as its own finding: "never
 * delivered anything", which points at the publication, not at a policy.
 */
async function awaitLive(handle, write) {
  for (let n = 1; n <= READY_ATTEMPTS; n += 1) {
    const matches = await write(n)
    if (await handle.waitFor(matches, READY_WAIT_MS)) {
      handle.clear()
      return { live: true, attempts: n }
    }
  }
  return { live: false, attempts: READY_ATTEMPTS }
}

/**
 * THERE IS NO CATALOGUE CHECK HERE, AND THAT IS NOT AN OMISSION.
 *
 * `pg_publication_tables` is in `pg_catalog`, and PostgREST exposes `public` and
 * `graphql_public` only — the same wall `tests/rls`' Storage cases ran into when their first
 * draft asked PostgREST for `storage.objects` and every probe answered `[]`. So a client
 * cannot read publication membership at all, whatever key it holds.
 *
 * The migration is where it belongs anyway: `20260821000002` §4 asserts membership, the replica
 * identity, RLS being enabled, a SELECT policy existing, and five function grants — all of it
 * inside the transaction that changes them, which is strictly better than a script asking
 * afterwards. What is left for this file is the one question a catalogue cannot answer, and
 * the failure message at the foot of `main()` is what points a reader back at the migration
 * when both halves of a pair fail together.
 */

async function main() {
  console.log(GREY('\n  Reseeding the local database (this is tests/rls\' fixture) …'))
  const fx = await seed()

  // ── notifications ─────────────────────────────────────────────────────────
  // The subscriber is ALPHA's ordinary member. The row that must arrive is addressed to them;
  // the row that must not is addressed to another member OF THE SAME FAMILY, which is the
  // sharper of the two available attacks — a cross-family row would also be refused by
  // `auth_family_code()`, so it would not tell us the recipient conjunct works.
  console.log('\n  ── notifications ──')
  const me = await subscriber(fx.users.alphaMember)
  const notif = await listen(me.client, 'notifications')

  const notifReady = await awaitLive(notif, async n => {
    const title = `realtime-check ready ${n} ${Date.now()}`
    const { error } = await db.from('notifications').insert({
      family_code: fx.alpha.familyCode, recipient_id: fx.users.alphaMember.personId,
      type: 'test', title, body: 'readiness probe',
    })
    if (error) throw new Error(`readiness probe insert: ${error.message}`)
    return r => r.title === title
  })
  record(
    notifReady.live,
    'notifications: the socket becomes live at all',
    notifReady.live
      ? `delivered a readiness probe on attempt ${notifReady.attempts}`
      : `nothing arrived in ${READY_ATTEMPTS} attempts — the table is probably not in the`
        + ' supabase_realtime publication (20260821000002)',
  )

  const mineTitle = `realtime-check mine ${Date.now()}`
  const theirsTitle = `realtime-check theirs ${Date.now()}`
  const rows = [
    { family_code: fx.alpha.familyCode, recipient_id: fx.users.alphaMember.personId,
      type: 'test', title: mineTitle, body: 'addressed to the subscriber' },
    { family_code: fx.alpha.familyCode, recipient_id: fx.users.alphaOther.personId,
      type: 'test', title: theirsTitle, body: 'addressed to somebody else' },
  ]
  const { error: notifError } = await db.from('notifications').insert(rows)
  if (notifError) throw new Error(`inserting the probe notifications: ${notifError.message}`)

  record(
    await notif.waitFor(r => r.title === mineTitle, ARRIVE_MS),
    'notifications: the recipient receives their own notification',
    `waited up to ${ARRIVE_MS}ms · ${notif.received.length} event(s) on the socket`,
  )
  // Waited AFTER the positive assertion, so the budget overlaps the time already spent rather
  // than being added to it — and by now the socket has demonstrably delivered.
  await sleep(WITHHELD_MS)
  record(
    !notif.received.some(r => r.title === theirsTitle),
    'notifications: another member\'s notification is withheld by RLS',
    'subscribed UNFILTERED, so the client-side recipient_id filter cannot be what refused it',
  )
  await notif.close()

  // ── chat_messages ─────────────────────────────────────────────────────────
  // Unfiltered, which is what `ChatShell` does. The withheld message is in BRAVO's room, so
  // the only thing that can refuse it is `auth_uid_is_room_participant()` in the SELECT
  // policy — the function AGENTS.md §2b calls load-bearing for chat and which, until
  // 20260821000002, was narrowing a stream that carried nothing.
  console.log('\n  ── chat_messages ──')
  const chat = await listen(me.client, 'chat_messages')

  const chatReady = await awaitLive(chat, async n => {
    const body = `realtime-check ready ${n} ${Date.now()}`
    const { error } = await db.from('chat_messages').insert({
      room_id: fx.alpha.room.id, sender_id: fx.users.alphaOther.userId, body,
    })
    if (error) throw new Error(`readiness probe insert: ${error.message}`)
    return r => r.body === body
  })
  record(
    chatReady.live,
    'chat_messages: the socket becomes live at all',
    chatReady.live
      ? `delivered a readiness probe on attempt ${chatReady.attempts}`
      : `nothing arrived in ${READY_ATTEMPTS} attempts — the table is probably not in the`
        + ' supabase_realtime publication (20260821000002)',
  )

  const mineBody = `realtime-check own room ${Date.now()}`
  const theirsBody = `realtime-check other family ${Date.now()}`
  const { error: chatError } = await db.from('chat_messages').insert([
    { room_id: fx.alpha.room.id, sender_id: fx.users.alphaOther.userId, body: mineBody },
    { room_id: fx.bravo.room.id, sender_id: fx.users.bravoMember.userId, body: theirsBody },
  ])
  if (chatError) throw new Error(`inserting the probe messages: ${chatError.message}`)

  record(
    await chat.waitFor(r => r.body === mineBody, ARRIVE_MS),
    'chat_messages: a participant receives a message in their own room',
    `waited up to ${ARRIVE_MS}ms · ${chat.received.length} event(s) on the socket`,
  )
  await sleep(WITHHELD_MS)
  record(
    !chat.received.some(r => r.body === theirsBody),
    'chat_messages: another family\'s message is withheld by RLS',
    'auth_uid_is_room_participant() is the only conjunct that can refuse it',
  )
  await chat.close()

  await me.client.auth.signOut()
  await me.client.removeAllChannels()

  console.log(`\n  ${checks} check(s) run`)
  if (findings.length) {
    console.log(RED(`\n  ${findings.length} finding(s):`))
    for (const f of findings) console.log(RED(`  · ${f}`))
    console.log(
      '\n  If a "becomes live" check failed, the table is not being replicated — start with\n'
      + '  `npx supabase db reset` and re-read 20260821000002\'s NOTICE. Nothing below it in\n'
      + '  the same section means anything until that one passes.\n'
      + '  If a "receives" check failed while "becomes live" passed, the SELECT policy is\n'
      + '  refusing a row the subscriber is entitled to.\n'
      + '  If a "withheld" check failed, a SELECT policy is not narrowing a realtime stream,\n'
      + '  which is a live disclosure and not a test problem.\n',
    )
    process.exit(1)
  }
  console.log(GREEN('\n  Clean.') + GREY(' NOTE: this says nothing about the HOSTED publication —\n')
    + GREY('  membership is per-database and the dashboard edits it by hand. See TODO.md.\n'))
}

main().catch(err => {
  console.error(RED(`\n  realtime:check could not run: ${err.message}\n`))
  process.exit(1)
})
