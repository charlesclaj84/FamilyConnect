import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const ROOT = process.cwd()
const HOOK = `
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const ROOT = ${JSON.stringify(ROOT)}
const EXT = ['', '.ts', '.tsx', '/index.ts']
export async function resolve(spec, ctx, next) {
  if (spec === 'server-only') return { url: 'data:text/javascript,', format: 'module', shortCircuit: true }
  if (spec.startsWith('@/')) {
    const base = join(ROOT, spec.slice(2))
    for (const e of EXT) {
      const c = base + e
      if (existsSync(c) && !statSync(c).isDirectory()) return next(pathToFileURL(c).href, ctx)
    }
  }
  return next(spec, ctx)
}
`
register(`data:text/javascript,${encodeURIComponent(HOOK)}`)

const { deriveHelpEnglish } = await import(pathToFileURL(join(ROOT, 'lib/help/keys.ts')).href)
const { HELP_PARTS } = await import(pathToFileURL(join(ROOT, 'lib/help/content.ts')).href)

const en = deriveHelpEnglish()
const want = process.argv[2]           // a part id, or nothing for the index

if (!want) {
  for (const part of HELP_PARTS) {
    const keys = Object.keys(en).filter(k =>
      k === `help.part.${part.id}.title` || k === `help.part.${part.id}.blurb`
      || part.chapters.some(c => k.startsWith(`help.${c.slug}.`)))
    let words = 0
    for (const k of keys) words += en[k].split(/\s+/).length
    console.log(`${part.id.padEnd(14)} ${String(keys.length).padStart(5)} keys  ${String(words).padStart(6)} words  ${part.chapters.length} chapters`)
    for (const c of part.chapters) {
      const ck = Object.keys(en).filter(k => k.startsWith(`help.${c.slug}.`))
      let cw = 0
      for (const k of ck) cw += en[k].split(/\s+/).length
      console.log(`    ${c.slug.padEnd(28)} ${String(ck.length).padStart(4)} keys  ${String(cw).padStart(5)} words`)
    }
  }
  process.exit(0)
}

const part = HELP_PARTS.find(p => p.id === want)
const chap = part ? null : HELP_PARTS.flatMap(p => p.chapters).find(c => c.slug === want)
if (!part && !chap) { console.error('no such part or chapter'); process.exit(1) }
const keys = Object.keys(en).filter(k => chap
  ? k.startsWith(`help.${chap.slug}.`)
  : (k === `help.part.${part.id}.title` || k === `help.part.${part.id}.blurb`
     || part.chapters.some(c => k.startsWith(`help.${c.slug}.`))))
const out = keys.map(k => JSON.stringify(k) + ': ' + JSON.stringify(en[k])).join(',\n')
writeFileSync(`help-${want}.json`, '{\n' + out + '\n}\n')
console.log(`wrote help-${want}.json — ${keys.length} keys`)
