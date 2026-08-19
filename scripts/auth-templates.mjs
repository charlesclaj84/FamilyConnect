#!/usr/bin/env node
/**
 * Ties supabase/templates/*.html to the hosted project's Auth email templates.
 *
 *   node scripts/auth-templates.mjs check   # read-only: does hosted match the repo?
 *   node scripts/auth-templates.mjs push    # make hosted match the repo
 *   node scripts/auth-templates.mjs pull    # overwrite the repo from hosted
 *
 *   --project-ref=<ref>  override the linked project      --yes    skip the push prompt
 *   --quiet              check without the body diffs
 *
 * Needs SUPABASE_ACCESS_TOKEN — a Management API token (sbp_…), not the service role key.
 * `check` exits 1 on drift, so it reads as a test.
 *
 * WHY THIS EXISTS RATHER THAN `supabase config push`. That command sends the whole
 * [auth] block, `site_url` included — so pushing a template edit from a checkout whose
 * config points anywhere but production reconfigures production's redirect handling as
 * a side effect. TODO.md's GO LIVE section has carried that warning since before this
 * script, and it is the reason the templates were pasted by hand for two months.
 *
 * The Management API takes a partial body, so this sends TEN fields and nothing else:
 * a subject and a content string for each of the five templates config.toml declares.
 * `assertOnlyMailerFields` refuses to transmit anything outside `mailer_subjects_*` and
 * `mailer_templates_*_content`, because "we only build safe keys" is a property of the
 * code as written and the check is a property of the code as run.
 *
 * config.toml stays the single source of truth for WHICH file is WHICH template and
 * what its subject is — the same table the local stack reads. A template hosted has
 * that config.toml does not declare (magic link, the notification mails) is not read,
 * not written and not reported on. This synchronises the five we own.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = resolve(REPO, 'supabase/config.toml')
const API = 'https://api.supabase.com'

/**
 * config.toml's `[auth.email.template.<key>]` names map onto the Management API's
 * field names, which are not quite the same word in one case (`email_change` is the
 * config key, `mailer_*_email_change_*` the API field — they agree, but `invite` vs
 * `mailer_subjects_invite` and friends are close enough that this table is worth
 * having explicit rather than derived by string interpolation over a guess).
 */
const TEMPLATES = {
  confirmation: {
    subjectField: 'mailer_subjects_confirmation',
    contentField: 'mailer_templates_confirmation_content',
    dashboard: 'Confirm signup',
  },
  recovery: {
    subjectField: 'mailer_subjects_recovery',
    contentField: 'mailer_templates_recovery_content',
    dashboard: 'Reset password',
  },
  invite: {
    subjectField: 'mailer_subjects_invite',
    contentField: 'mailer_templates_invite_content',
    dashboard: 'Invite user',
  },
  email_change: {
    subjectField: 'mailer_subjects_email_change',
    contentField: 'mailer_templates_email_change_content',
    dashboard: 'Change email address',
  },
  reauthentication: {
    subjectField: 'mailer_subjects_reauthentication',
    contentField: 'mailer_templates_reauthentication_content',
    dashboard: 'Reauthentication',
  },
}

// ---------------------------------------------------------------- config.toml

/**
 * A deliberately small reader for exactly the shape we need: the `subject` and
 * `content_path` of each `[auth.email.template.*]` section. A general TOML parser is a
 * dependency, and this file is read by the Supabase CLI itself — if it ever stops
 * parsing, `supabase start` says so long before this script does.
 */
function readTemplateMap() {
  const lines = readFileSync(CONFIG, 'utf8').split(/\r?\n/)
  const found = {}
  let section = null

  for (const line of lines) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/)
    if (header) {
      const m = header[1].match(/^auth\.email\.template\.(\w+)$/)
      section = m ? m[1] : null
      if (section) found[section] ??= {}
      continue
    }
    if (!section) continue

    const kv = line.match(/^\s*(subject|content_path)\s*=\s*"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/)
    if (kv) found[section][kv[1]] = kv[2].replace(/\\(.)/g, '$1')
  }

  const templates = []
  const unknown = []

  for (const [key, value] of Object.entries(found)) {
    if (!TEMPLATES[key]) {
      unknown.push(key)
      continue
    }
    if (!value.content_path) {
      throw new Error(`[auth.email.template.${key}] has no content_path in supabase/config.toml`)
    }
    // content_path is written relative to the repo root ("./supabase/templates/…"),
    // which is where the CLI is run from — not relative to config.toml.
    const path = resolve(REPO, value.content_path)
    if (!existsSync(path)) {
      throw new Error(`[auth.email.template.${key}] points at ${value.content_path}, which does not exist`)
    }
    templates.push({ key, ...TEMPLATES[key], subject: value.subject ?? null, path })
  }

  return { templates, unknown }
}

/**
 * Git on Windows can be configured to check these files out with CRLF. Sending that
 * would be harmless in the mail but would make `check` report drift forever, since
 * what comes back is what GoTrue stored. Normalise on the way out and on the way in,
 * so the comparison is about content rather than about somebody's core.autocrlf.
 */
const lf = (s) => s.replace(/\r\n/g, '\n')

// ------------------------------------------------------------ credentials

function resolveRef(flagRef) {
  if (flagRef) return { ref: flagRef, from: '--project-ref' }
  if (process.env.SUPABASE_PROJECT_REF) {
    return { ref: process.env.SUPABASE_PROJECT_REF, from: 'SUPABASE_PROJECT_REF' }
  }
  const linked = resolve(REPO, 'supabase/.temp/project-ref')
  if (existsSync(linked)) {
    return { ref: readFileSync(linked, 'utf8').trim(), from: 'supabase/.temp/project-ref (linked)' }
  }
  throw new Error(
    'No project ref. Pass --project-ref, set SUPABASE_PROJECT_REF, or run `npx supabase link`.',
  )
}

function resolveToken() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (token) return token
  throw new Error(
    'No SUPABASE_ACCESS_TOKEN.\n' +
      '  This is a Management API personal access token (sbp_…), which is NOT the service\n' +
      '  role key and NOT the database password. Create one at\n' +
      '  https://supabase.com/dashboard/account/tokens and export it for this command only:\n\n' +
      '    SUPABASE_ACCESS_TOKEN=sbp_… npm run email:check\n\n' +
      '  `supabase login` stores its own copy in the OS keyring, which is not readable\n' +
      '  from here, so having logged in to the CLI is not enough.',
  )
}

// ------------------------------------------------------------ the API

async function call(method, ref, token, body) {
  const res = await fetch(`${API}/v1/projects/${ref}/config/auth`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const detail = await res.text()
    const hint =
      res.status === 401 ? ' (the token is not a valid Management API token, or has expired)'
      : res.status === 403 ? ' (the token is valid but has no access to this project)'
      : res.status === 404 ? ' (no such project ref)'
      : ''
    throw new Error(`${method} config/auth → ${res.status}${hint}\n${detail}`)
  }
  return res.json()
}

/**
 * The guard that makes this safe to run against production. `config push` is dangerous
 * because it sends everything; this is safe only for as long as it sends nothing but
 * mail bodies, so say that out loud rather than trusting the constructor above.
 */
function assertOnlyMailerFields(body) {
  const allowed = /^mailer_(subjects_|templates_).+$/
  const bad = Object.keys(body).filter((k) => !allowed.test(k))
  if (bad.length) {
    throw new Error(
      `refusing to PATCH: body carries non-template field(s) ${bad.join(', ')}.\n` +
        'This script must never write site_url, redirect URLs or any other auth setting.',
    )
  }
  return body
}

// ------------------------------------------------------------ diffing

/** Unified-ish diff, enough to see what drifted without pulling in a dependency. */
function diff(a, b, context = 2) {
  const A = a.split('\n')
  const B = b.split('\n')

  // LCS table. These files are ~250 lines, so the quadratic table is ~60k cells.
  const L = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1))
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }

  const ops = []
  let i = 0
  let j = 0
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) ops.push([' ', A[i], ++i, ++j])
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', A[i], ++i, j])
    else ops.push(['+', B[j], i, ++j])
  }
  while (i < A.length) ops.push(['-', A[i], ++i, j])
  while (j < B.length) ops.push(['+', B[j], i, ++j])

  const keep = new Set()
  ops.forEach((op, n) => {
    if (op[0] === ' ') return
    for (let k = Math.max(0, n - context); k <= Math.min(ops.length - 1, n + context); k++) keep.add(k)
  })

  const out = []
  let gap = false
  ops.forEach((op, n) => {
    if (!keep.has(n)) {
      gap = true
      return
    }
    if (gap) out.push('       …')
    gap = false
    const at = op[0] === '+' ? `+${String(op[3]).padStart(4)}` : ` ${String(op[2]).padStart(4)}`
    out.push(`  ${at} ${op[0]} ${op[1]}`)
  })
  return out.join('\n')
}

// ------------------------------------------------------------ commands

function compare(templates, hosted) {
  return templates.map((t) => {
    const local = lf(readFileSync(t.path, 'utf8'))
    const remote = lf(hosted[t.contentField] ?? '')
    const remoteSubject = hosted[t.subjectField] ?? ''
    return {
      ...t,
      local,
      remote,
      remoteSubject,
      contentDiffers: local !== remote,
      // A null subject in config.toml means "not declared", which we leave alone
      // rather than blanking — the CLI treats it the same way.
      subjectDiffers: t.subject != null && t.subject !== remoteSubject,
    }
  })
}

function report(rows, { showDiff }) {
  let drift = 0
  for (const row of rows) {
    const rel = relative(REPO, row.path).replace(/\\/g, '/')
    const flags = []
    if (row.contentDiffers) flags.push('body')
    if (row.subjectDiffers) flags.push('subject')

    if (!flags.length) {
      console.log(`  ok       ${row.key.padEnd(17)} ${rel}`)
      continue
    }
    drift++
    console.log(`  DRIFT    ${row.key.padEnd(17)} ${rel}   (${flags.join(', ')}, dashboard: "${row.dashboard}")`)
    if (row.subjectDiffers) {
      console.log(`             hosted subject: ${JSON.stringify(row.remoteSubject)}`)
      console.log(`             repo subject:   ${JSON.stringify(row.subject)}`)
    }
    if (row.contentDiffers && showDiff) {
      if (!row.remote) console.log('             hosted has no override for this template (GoTrue default in use)')
      else console.log(diff(row.remote, row.local).replace(/^/gm, '  '))
    }
  }
  return drift
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    throw new Error('Refusing to push without confirmation from a non-interactive shell. Pass --yes.')
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${question} [y/N] `)
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

async function main() {
  const argv = process.argv.slice(2)
  const command = argv.find((a) => !a.startsWith('-')) ?? 'check'
  const flag = (name) => argv.includes(`--${name}`)
  const value = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : undefined
  }

  if (!['check', 'push', 'pull'].includes(command)) {
    throw new Error(`Unknown command "${command}". Expected check, push or pull.`)
  }

  const { templates, unknown } = readTemplateMap()
  if (!templates.length) throw new Error('supabase/config.toml declares no [auth.email.template.*] sections')
  if (unknown.length) {
    console.warn(`  note     config.toml declares template(s) this script has no mapping for: ${unknown.join(', ')}`)
  }

  const { ref, from } = resolveRef(value('project-ref'))
  const token = resolveToken()

  console.log(`\n  project  ${ref}  (${from})`)
  console.log(`  source   supabase/config.toml → ${templates.length} template(s)\n`)

  const hosted = await call('GET', ref, token)
  const rows = compare(templates, hosted)

  if (command === 'pull') {
    let written = 0
    for (const row of rows) {
      if (!row.contentDiffers) {
        console.log(`  same     ${row.key}`)
        continue
      }
      if (!row.remote) {
        console.log(`  skip     ${row.key} — hosted has no override; nothing to pull`)
        continue
      }
      writeFileSync(row.path, row.remote, 'utf8')
      written++
      console.log(`  written  ${row.key} ← hosted`)
    }
    console.log(
      written
        ? `\n  ${written} file(s) overwritten from hosted. Review with \`git diff\` before committing.\n`
        : '\n  Nothing to pull.\n',
    )

    // Subjects live in config.toml, which this script reads and never writes — it is a
    // hand-maintained file full of load-bearing comments, and a machine rewriting it
    // would eat them. So print the lines instead. This is not a nicety: the first real
    // run of `check` (2026-08-12) found all five subjects drifted and no body drift
    // beyond an uncommitted edit, so the subject is the half that actually moves.
    const subjectDrift = rows.filter((r) => r.subjectDiffers)
    if (subjectDrift.length) {
      console.log(`  ${subjectDrift.length} subject(s) differ. Paste into supabase/config.toml by hand:\n`)
      for (const row of subjectDrift) {
        console.log(`    [auth.email.template.${row.key}]`)
        console.log(`    subject = ${JSON.stringify(row.remoteSubject)}`)
      }
      console.log('')
    }
    return 0
  }

  const drift = report(rows, { showDiff: command === 'check' && !flag('quiet') })

  if (command === 'check') {
    console.log(
      drift
        ? `\n  ${drift} template(s) differ. \`npm run email:push\` makes hosted match the repo.\n`
        : '\n  Hosted matches the repo.\n',
    )
    return drift ? 1 : 0
  }

  // push
  if (!drift) {
    console.log('\n  Hosted already matches the repo. Nothing to push.\n')
    return 0
  }

  // ── NOTHING IMPLAUSIBLE GOES OUT, and this is a guard rather than a nicety now that
  // the push runs unattended from CI. `readTemplateMap` throws for a `content_path` that
  // does not EXIST; a file that exists and is empty or truncated passed straight through,
  // and `contentDiffers` is true for it — so a bad merge resolution committing
  // `recovery.html` as 0 bytes would PATCH `mailer_templates_recovery_content: ""`, GoTrue
  // would fall back to its stock `{{ .ConfirmationURL }}` body, and every password reset
  // from then on would land the user on `site_url` with the session in a URL fragment: the
  // exact bug this directory exists to prevent, shipped by a green step.
  //
  // Two tests, both cheap and both properties of every one of the five templates:
  //   * a plausible length. The smallest of them is several kilobytes of table markup;
  //     anything under 500 bytes is not one of these files.
  //   * at least one GoTrue variable. Each template interpolates something — a
  //     `{{ .ConfirmationURL }}` or a `{{ .Token }}` — and a body that interpolates
  //     nothing cannot do its job whatever else is in it.
  //
  // The symmetric guard already exists in the other direction: `pull` refuses to overwrite
  // a repo file when hosted has no override.
  const MIN_TEMPLATE_BYTES = 500
  const implausible = rows.filter(
    (row) => row.local.length < MIN_TEMPLATE_BYTES || !/\{\{\s*\./.test(row.local),
  )
  if (implausible.length) {
    throw new Error(
      'Refusing to push: ' +
        implausible
          .map((row) => `${row.key} (${relative(REPO, row.path)}, ${row.local.length} bytes` +
            `${/\{\{\s*\./.test(row.local) ? '' : ', no {{ . }} variable'})`)
          .join(', ') +
        `.\n  A template under ${MIN_TEMPLATE_BYTES} bytes or with no GoTrue variable in it is` +
        ' a truncated or empty file, not a copy edit. Fix the file, do not force this.',
    )
  }

  const body = assertOnlyMailerFields(
    Object.fromEntries(
      rows.flatMap((row) => [
        [row.contentField, row.local],
        ...(row.subject != null ? [[row.subjectField, row.subject]] : []),
      ]),
    ),
  )

  console.log(`\n  About to PATCH ${Object.keys(body).length} field(s) on ${ref}:`)
  for (const key of Object.keys(body).sort()) {
    console.log(`    ${key}  (${body[key].length} chars)`)
  }
  console.log('  Nothing else is sent — no site_url, no redirect list, no rate limits.')

  if (!flag('yes') && !(await confirm(`\n  Write these to production?`))) {
    console.log('  Aborted.\n')
    return 1
  }

  const after = await call('PATCH', ref, token, body)
  // `showDiff` ON, and it was off — which left the one failure mode with no diagnostic at
  // all: the message said "read the diff above" and `push` never printed one. If the
  // round-trip is ever not byte-identical this step fails on every merge until somebody
  // changes the repo, so the diff is the difference between a five-minute fix and a wedged
  // release.
  const stillOff = report(compare(templates, after), { showDiff: true })
  console.log(
    stillOff
      ? `\n  PATCH accepted but ${stillOff} template(s) still differ — see the diff above.\n`
      : '\n  Pushed. Hosted now matches the repo.\n' +
          '  Send yourself a real signup before calling it done: this proves the bytes\n' +
          '  arrived, not that the mail renders.\n',
  )
  return stillOff ? 1 : 0
}

/**
 * `process.exitCode`, never `process.exit()`. On Windows, exiting while undici still
 * holds a keep-alive socket from the fetch above trips a libuv assertion
 * (`!(handle->flags & UV_HANDLE_CLOSING)`) and the process dies with 0xC0000409 —
 * which arrives as exit code -1073740791, so `check` reports neither 0 nor 1 and is
 * useless as a gate. Setting the code and letting the loop drain exits cleanly.
 */
main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(`\n  ${error.message}\n`)
    process.exitCode = 2
  })
