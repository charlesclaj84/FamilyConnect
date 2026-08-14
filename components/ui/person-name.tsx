import { cn } from '@/lib/utils'

/**
 * A person's nickname, on its own line under their name.
 *
 * ONE COMPONENT RATHER THAN THE MARKUP AT EACH CALL SITE, for the reason
 * `components/ui/form-message.tsx` and the required-field asterisk in
 * `components/ui/label.tsx` both exist: three characters of styling repeated by hand at
 * four call sites is invisible until you put two screens side by side, and then one of
 * them is `text-xs` and another is `text-[11px]` and nobody chose either.
 *
 * IT RENDERS NOTHING FOR AN EMPTY NICKNAME, so the call site is `<NickName
 * nickName={p.nickName} />` and never `{p.nickName && <NickName … />}`. Most people in a
 * real family have no nickname recorded, so the guard belongs here rather than at every
 * caller. Same convention as `FormError`.
 *
 * NOT A `<span>` INSIDE THE NAME — it is a block, and it must stay one. The point is a
 * second line: inline it would wrap mid-name at narrow widths and read as part of the
 * surname. `block` on a span rather than a `<p>` because the two current callers put this
 * inside a `<span>` (the tree card) and a `<div>` (the directory), and a `<p>` nested in
 * a phrasing context is invalid markup that browsers reparent.
 *
 * PAIR IT WITH `disambiguatedName(p, all, { nickShownSeparately: true })`. That flag is
 * what stops the nickname appearing twice — once in the parentheses the disambiguator
 * adds for two people of the same name, and again here.
 */
export function NickName({
  nickName, className,
}: {
  nickName?: string | null
  className?: string
}) {
  const trimmed = nickName?.trim()
  if (!trimmed) return null
  return (
    <span className={cn('block text-xs font-normal italic text-muted-foreground', className)}>
      {trimmed}
    </span>
  )
}
