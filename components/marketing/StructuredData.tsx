/**
 * Renders a schema.org graph as JSON-LD.
 *
 * A plain `<script>`, not `next/script`: that component exists to schedule the
 * loading and execution of JavaScript, and this is neither — it is data, and the
 * browser must never run it. `type="application/ld+json"` is what stops it.
 *
 * ── The escape is the point of this component ────────────────────────────────
 * `dangerouslySetInnerHTML` puts the string into the document verbatim, and the
 * contents of a `<script>` element are raw text: the parser is looking for the
 * literal characters `</script` and nothing else terminates it. React's usual
 * escaping does not apply inside `dangerouslySetInnerHTML`, and `JSON.stringify`
 * does not escape `<` — so a value containing `</script>` would close this element
 * early and everything after it would be parsed as markup. That is stored XSS.
 *
 * The `.replace()` below closes it, by rewriting every `<` as its six-character
 * JSON unicode escape. That escape is legal JSON and parses back to `<`, so a
 * consumer reads the original string unchanged; only the HTML parser — which
 * does not decode JSON escapes — is denied the character it needs to end the
 * element early. This is the escape Next's own JSON-LD guide prescribes.
 *
 * It lives in a component rather than at each call site because that is a
 * transformation that has to be applied EVERY time and is invisible when it is
 * missing — the page renders identically until the day a value contains a tag.
 * Every graph in the app goes through this one function or it is not protected.
 */
export function StructuredData({ graph }: { graph: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
    />
  )
}
