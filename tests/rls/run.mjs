/**
 * Cross-family isolation suite for the RLS-path server actions.
 *
 *   npm run test:rls          (needs `npx supabase start` first)
 *
 * Every case runs the real exported action — the same function Next.js exposes
 * as an HTTP endpoint — against a real local Postgres with the real policies
 * applied. Nothing about authorization is simulated: the only substitutions are
 * the cookie-to-JWT plumbing and two `next/*` modules that need a request scope.
 * See hooks.mjs.
 */
import './env.mjs'
import { createClient } from '@supabase/supabase-js'
import { API_URL, SERVICE_ROLE_KEY } from './env.mjs'
import { seed, signIn } from './seed.mjs'
import { setActor } from './actor.mjs'
import { CASES, alphaMarkers } from './cases.mjs'

const db = createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const only = process.argv.slice(2).filter(a => !a.startsWith('-'))
const results = []

const GREEN = s => `\x1b[32m${s}\x1b[0m`
const RED = s => `\x1b[31m${s}\x1b[0m`
const GREY = s => `\x1b[90m${s}\x1b[0m`
const YELLOW = s => `\x1b[33m${s}\x1b[0m`

function record(id, phase, ok, detail, severity = 'fail') {
  results.push({ id, phase, ok, detail, severity })
  const tag = ok ? GREEN('PASS') : severity === 'warn' ? YELLOW('WARN') : RED('FAIL')
  console.log(`  ${tag} ${GREY(phase.padEnd(9))} ${id}${detail ? `\n         ${detail}` : ''}`)
}

/** Every ALPHA-only value that appears anywhere in a response. */
function leaks(result, markers) {
  let json
  try {
    json = JSON.stringify(result ?? null)
  } catch {
    json = String(result)
  }
  return markers.filter(m => json.includes(m))
}

async function loadAction(mod, fn) {
  const imported = await import(`../../${mod}`)
  const target = imported[fn]
  if (typeof target !== 'function') {
    throw new Error(`${mod} has no exported function '${fn}'`)
  }
  return target
}

async function callAs(actor, action, args) {
  setActor(actor)
  try {
    return { value: await action(...args) }
  } catch (err) {
    return { threw: err }
  } finally {
    setActor(null)
  }
}

async function runRead(c, fx, actors, markers) {
  const action = await loadAction(c.mod, c.fn)
  const args = c.args(fx)

  // ── attack: BRAVO's administrator, using ALPHA's arguments ────────────────
  const attacker = actors[c.attacker ?? 'bravoAdmin']
  // `setup` RUNS FOR READS TOO, and it did not until 2026-08-20. Write cases have always
  // had it; read cases silently ignored it, so a case that planted a row to be read
  // asserted against whatever happened to be there. STORAGE_CASES found that the expensive
  // way: two `documents` cases seed an object as the service role, passed when run alone
  // (the object was left over from an earlier run — Storage is not reset by `seed()`), and
  // failed in the full suite after a fresh `db reset`. Both phases get it, exactly as
  // runWrite does, because the attack half needs the row present just as much: a download
  // refused because the file is missing is not evidence that a policy refused it.
  if (c.setup) await c.setup(db, fx)
  const attack = await callAs(attacker, action, args)
  if (attack.threw) {
    // A refusal is a perfectly good outcome — the data did not come out.
    record(c.id, 'attack', true, GREY(`refused: ${attack.threw.message}`))
  } else if (c.expectAttack) {
    const ok = c.expectAttack(attack.value, fx)
    record(c.id, 'attack', ok, ok ? '' : RED(`unexpected: ${JSON.stringify(attack.value)?.slice(0, 300)}`))
  } else {
    const found = leaks(attack.value, markers)
    record(c.id, 'attack', found.length === 0,
      found.length ? RED(`LEAKED ${found.length}: ${found.slice(0, 4).join(', ')}`) : '')
  }

  // ── positive control: ALPHA's own member, same arguments ──────────────────
  if (c.positive === 'not-applicable') {
    record(c.id, 'control', true, GREY(`skipped — ${c.why}`), 'warn')
    results[results.length - 1].skipped = true
    return
  }
  const owner = actors[c.positiveActor ?? 'alphaMember']
  if (c.setup) await c.setup(db, fx)
  const control = await callAs(owner, action, c.positiveArgs ? c.positiveArgs(fx) : args)
  if (control.threw) {
    record(c.id, 'control', false, RED(`owner could not call it: ${control.threw.message}`))
    return
  }
  const ok = c.expectPositive
    ? c.expectPositive(control.value, fx)
    : leaks(control.value, markers).length > 0
  record(c.id, 'control', ok, ok ? '' :
    RED(`owner saw none of their own data — this case proves nothing: ${JSON.stringify(control.value)?.slice(0, 200)}`))
}

async function runWrite(c, fx, actors) {
  const action = await loadAction(c.mod, c.fn)

  // ── attack ────────────────────────────────────────────────────────────────
  const attacker = actors[c.attacker ?? 'bravoAdmin']
  if (c.setup) await c.setup(db, fx)
  const before = await c.probe(db, fx)
  const attack = await callAs(attacker, action, c.args(fx))
  const after = await c.probe(db, fx)
  const unchanged = before === after
  record(c.id, 'attack', unchanged,
    unchanged
      ? (attack.threw ? GREY(`refused: ${attack.threw.message}`) : GREY('no-op — row untouched'))
      : RED(`ROW MUTATED\n         before ${before}\n         after  ${after}`))

  // ── AND, OPTIONALLY, WHAT THE CALLER WAS TOLD ────────────────────────
  // `expectRefusal` is a SECOND assertion on the same attack call, not a replacement for the
  // probe above: the probe answers *did the row change*, this answers *was the caller told the
  // truth about it*. Those are different failures and only one of them is isolation — an action
  // that changes nothing and reports `{ success: true }` passes the probe assertion perfectly,
  // which is exactly the defect lib/confirmed-write.ts exists to close, and exactly why reading
  // a green attack line for two months was not enough to notice it.
  //
  // Only on the attack half, deliberately. The control half already asserts the write LANDED,
  // and a case that also pinned the owner's success message would be asserting copy.
  if (c.expectRefusal) {
    const told = attack.threw
      ? { ok: false, detail: `threw instead of reporting: ${attack.threw.message}` }
      : c.expectRefusal(attack.value, fx)
    // PHASE 'told', NOT 'attack'. The summary buckets every failed `attack` line under
    // "another family's data was reachable", and this failure is not that — it is one
    // family's own member being lied to. Filed as an attack line it reported a leak that
    // had not happened, which is the kind of wrong label that gets a suite distrusted.
    record(`${c.id} — and says so`, 'told', told.ok === true,
      told.ok === true
        ? GREY(told.detail ?? '')
        : RED(told.detail ?? `reported: ${JSON.stringify(attack.value)?.slice(0, 200)}`))
  }

  // ── positive control: the rightful owner must be able to do it ────────────
  if (c.positive === 'not-applicable') {
    record(c.id, 'control', true, GREY(`skipped — ${c.why}`), 'warn')
    results[results.length - 1].skipped = true
    return
  }
  const owner = actors[c.positiveActor ?? 'alphaMember']
  if (c.setup) await c.setup(db, fx)
  const ctlBefore = await c.probe(db, fx)
  const ctl = await callAs(owner, action, c.positiveArgs ? c.positiveArgs(fx) : c.args(fx))
  const ctlAfter = await c.probe(db, fx)
  if (ctl.threw) {
    record(c.id, 'control', false, RED(`owner could not call it: ${ctl.threw.message}`))
    return
  }
  const changed = ctlBefore !== ctlAfter
  record(c.id, 'control', changed, changed ? '' :
    RED('owner\'s own write did nothing — the attack assertion above is vacuous'))
}

// ── go ──────────────────────────────────────────────────────────────────────
console.log('\nSeeding two-family fixture…')
const fx = await seed()
const markers = alphaMarkers(fx)

const actors = {}
for (const key of Object.keys(fx.users)) {
  actors[key] = await signIn(fx.users[key])
}

// A signed-OUT caller. The supabase-server stub already builds an anonymous client
// when there is no actor, so this needs no plumbing — but without a name in this map
// no case could ask for it, and the anon role was invisible to the whole suite.
//
// That mattered once 20260806000015 revoked EXECUTE on every public function from
// anon: exactly one function is still granted to it, and if that grant is ever lost
// every invitation link breaks for every invitee who does not already have an
// account. Nothing else here would notice.
actors.anon = null
console.log(`Seeded. ALPHA=${fx.alpha.familyCode} BRAVO=${fx.bravo.familyCode}`)
console.log(`Attacker: ${actors.bravoAdmin.label} — administrator of BRAVO, scope 'any' on every resource\n`)

const selected = only.length ? CASES.filter(c => only.some(o => c.id.includes(o))) : CASES
if (!selected.length) {
  console.error(`No cases matched ${only.join(', ')}`)
  process.exit(2)
}

for (const c of selected) {
  try {
    if (c.kind === 'write') await runWrite(c, fx, actors)
    else await runRead(c, fx, actors, markers)
  } catch (err) {
    record(c.id, 'harness', false, RED(`harness error: ${err.message}`))
  }
}

// ── summary ─────────────────────────────────────────────────────────────────
const failures = results.filter(r => !r.ok)
const skipped = results.filter(r => r.skipped)
const attacks = results.filter(r => r.phase === 'attack')
const leaked = attacks.filter(r => !r.ok)

console.log('\n' + '─'.repeat(72))
console.log(`${selected.length} actions · ${results.length} assertions · ` +
  `${GREEN(`${results.length - failures.length} passed`)}` +
  (failures.length ? ` · ${RED(`${failures.length} failed`)}` : '') +
  (skipped.length ? ` · ${YELLOW(`${skipped.length} control(s) not applicable`)}` : ''))

if (leaked.length) {
  console.log(RED(`\n${leaked.length} ISOLATION FAILURE(S) — another family's data was reachable:`))
  for (const r of leaked) console.log(RED(`  · ${r.id}`))
}

const dishonest = results.filter(r => r.phase === 'told' && !r.ok)
if (dishonest.length) {
  console.log(RED(`
${dishonest.length} ACTION(S) REPORTED SUCCESS OVER A WRITE THAT DID NOT HAPPEN.`))
  console.log(RED('No data crossed a family boundary — the caller was told a lie about their own.'))
  for (const r of dishonest) console.log(RED(`  · ${r.id}`))
}

const vacuous = results.filter(r => r.phase === 'control' && !r.ok)
if (vacuous.length) {
  console.log(YELLOW(`\n${vacuous.length} case(s) could not be validated — the positive control failed, so`))
  console.log(YELLOW('their attack result does not yet mean anything. Fix the fixture before trusting them:'))
  for (const r of vacuous) console.log(YELLOW(`  · ${r.id}`))
}

console.log('─'.repeat(72) + '\n')
process.exit(failures.filter(r => r.severity !== 'warn').length ? 1 : 0)
