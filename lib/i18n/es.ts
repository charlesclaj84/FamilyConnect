import type { Catalogue } from '@/lib/i18n/t'

/**
 * Español. Latin American Spanish, formal address.
 *
 * ── `usted`, NEVER `tú` ─────────────────────────────────────────────────────────────
 * The decision is recorded in `lib/i18n/locales.ts` and this file is where it is kept. It
 * reaches every string that addresses the reader — verb forms, pronouns and possessives all
 * move with it — so it is not something a later edit can change one line at a time. **Do not
 * "warm up" a single string to `tú`:** a product that addresses you two ways is worse than one
 * that addresses you formally.
 *
 * The reasoning, briefly: this product speaks as the family's institution. It records minutes,
 * collects dues and runs elections, and its readers include grandparents on the family tree.
 * Formal address cannot offend anyone; familiar address can read as presumptuous to an older
 * relative being asked about money.
 *
 * Visible here in `language.choose` (*Elija*, not *Elige*) and `switcher.heading` (*Sus
 * familias*, not *Tus familias*).
 *
 * ── TWO WORDS SPANISH DISTINGUISHES AND ENGLISH DOES NOT ────────────────────────────
 * This is the payoff for `en.ts`' rule that a caption appearing twice keeps two keys.
 *
 *   **reunión vs junta.** English calls both a "gathering" and a "meeting" by names that only
 *   just differ. Spanish has a real distinction: a *reunión* is the social occasion — the
 *   reunion, the picnic, the three-day family event — and a *junta* is the formal proceeding
 *   with a secretary and minutes. So `/gatherings` is *Reuniones* and `/reporting/meetings` is
 *   *Juntas*, and `/library/meeting-minutes` is *Actas*, which are the minutes OF a junta.
 *   Collapsing those keys in English would have made this impossible to say.
 *
 *   **envíos, not distribuciones.** `/community/distributions` mails the family. *Distribución*
 *   in Spanish leans logistical — the distribution of goods — where *envío* is a mailing, which
 *   is what the feature does.
 *
 * ── AND ONE THAT IS DELIBERATELY NOT TRANSLATED ─────────────────────────────────────
 * `Chat` stays `Chat`. It is the word Spanish speakers use for this, and *Mensajes* would name
 * a different thing (a message list rather than a conversation).
 *
 * ── WHAT KEEPS THIS HONEST ──────────────────────────────────────────────────────────
 * `npm run i18n:check`. A key here that is not in `en.ts` is an ORPHAN and can never render; a
 * `{placeholder}` the English does not have renders literally; and when an English string is
 * edited, every key here whose source hash no longer matches is reported STALE by name. After
 * re-checking wording, `npm run i18n:accept es` records the new sources.
 *
 * It cannot tell whether the words are any good. That part is a person's.
 */
export const es: Catalogue = {
  // ── THE RAIL: SECTION HEADINGS ────────────────────────────────────────────────────
  'nav.section.community': 'Comunidad',
  'nav.section.gatherings': 'Reuniones',
  'nav.section.library': 'Biblioteca',
  'nav.section.accounting': 'Contabilidad',
  'nav.section.reporting': 'Informes',
  'nav.section.admin': 'Administración',
  'nav.section.help': 'Ayuda',

  // ── THE RAIL: ITEMS ──────────────────────────────────────────────────────────────
  'nav.item./dashboard': 'Panel',

  'nav.item./community/announcements': 'Anuncios',
  'nav.item./community/chat': 'Chat',
  'nav.item./community/directory': 'Directorio',
  'nav.item./community/distributions': 'Envíos',
  'nav.item./community/elections': 'Elecciones',
  'nav.item./community/family-tree': 'Árbol familiar',
  'nav.item./community/gallery': 'Galería',

  'nav.item./gatherings': 'Reuniones',
  'nav.item./gatherings/calendar': 'Calendario',

  'nav.item./library/bylaws': 'Estatutos',
  'nav.item./library/documents': 'Documentos',
  'nav.item./library/meeting-minutes': 'Actas',
  'nav.item./library/officer-notes': 'Notas del cargo',

  'nav.item./accounting/summary': 'Resumen',
  'nav.item./accounting/dues-and-donations': 'Cuotas y donaciones',
  'nav.item./accounting/transactions': 'Transacciones',

  'nav.item./reporting/membership': 'Membresía',
  'nav.item./reporting/payment-history': 'Historial de pagos',
  'nav.item./reporting/dues-projections': 'Proyección de cuotas',
  // "P&L Summary" is an accounting term, and the Spanish one is *estado de resultados*. A
  // literal "Resumen de P&L" would be an English abbreviation in a Spanish sentence.
  'nav.item./reporting/pl-summary': 'Estado de resultados',
  'nav.item./reporting/gatherings': 'Reuniones',
  'nav.item./reporting/elections': 'Elecciones',
  'nav.item./reporting/meetings': 'Juntas',
  'nav.item./reporting/board': 'Directiva y cargos',

  'nav.item./admin/members': 'Miembros',
  'nav.item./admin/gatherings': 'Reuniones',
  'nav.item./admin/accounting': 'Contabilidad',
  'nav.item./admin/elections': 'Elecciones',
  'nav.item./admin/settings': 'Configuración',

  'nav.item./help': 'Manual de uso',

  // ── THE RAIL: ITS OWN CONTROLS ───────────────────────────────────────────────────
  'nav.open': 'Abrir el menú de navegación',
  'nav.close': 'Cerrar el menú de navegación',

  // ── THE FAMILY SWITCHER ──────────────────────────────────────────────────────────
  // *Sus*, not *Tus* — the formal address, and the most visible instance of it.
  'switcher.heading': 'Sus familias',
  'switcher.switching': 'Cambiando…',
  'switcher.badge.pending': 'Esperando aprobación',
  'switcher.badge.removed': 'Esta familia fue eliminada',
  'switcher.badge.default': 'Se abre al iniciar sesión',

  // ── THE ACCOUNT MENU ─────────────────────────────────────────────────────────────
  // *Mi* and *Mis* are FIRST person and correct under formal address: the member is naming
  // their own things, not being addressed. Only `switcher.heading` and `language.choose` carry
  // the second person here.
  'account.profile': 'Mi perfil',
  'account.families': 'Mis familias',
  'account.appearance': 'Apariencia',
  'account.staff': 'Consola de personal de GENORRA',
  'account.staffHint': 'Todas las familias · se abre en una ventana nueva',
  'account.signOut': 'Cerrar sesión',

  // ── THE THEME TOGGLE ─────────────────────────────────────────────────────────────
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.system': 'Sistema',
  'theme.switchLabel': 'Apariencia: {current}. Cambiar a {next}.',
  'theme.currentLabel': 'Apariencia: {current}',

  // ── THE NOTIFICATION BELL ────────────────────────────────────────────────────────
  'bell.label': 'Notificaciones',
  'bell.heading': 'Notificaciones',
  'bell.markAll': 'Marcar todo como leído',
  'bell.empty': 'Aún no hay notificaciones.',

  // ── HOW LONG AGO ─────────────────────────────────────────────────────────────────
  // *hace* leads in Spanish where "ago" trails in English, which is exactly the reordering a
  // string can express and a concatenation in JSX cannot.
  'time.now': 'Ahora mismo',
  'time.minutes': 'hace {n} min',
  'time.hours': 'hace {n} h',

  // ── THE LANGUAGE SWITCHER ────────────────────────────────────────────────────────
  // *Elija*, not *Elige* — formal.
  'language.label': 'Idioma',
  'language.choose': 'Elija un idioma',

  // ── PAGE HEADINGS ────────────────────────────────────────────────────────────────
  // The same words as the rail for most screens, and kept as separate keys for the reason
  // `en.ts` gives. *Reuniones* / *Juntas* divides here exactly as it does above.
  'page./accounting/dues-and-donations.title': 'Cuotas y donaciones',
  'page./accounting/summary.title': 'Resumen',
  'page./accounting/transactions.title': 'Transacciones',
  'page./admin/accounting.title': 'Contabilidad',
  'page./admin/elections.title': 'Elecciones',
  'page./admin/gatherings.title': 'Reuniones',
  'page./admin/members.title': 'Miembros',
  'page./admin/settings.title': 'Configuración',
  'page./community/announcements.title': 'Anuncios',
  'page./community/chat.title': 'Chat',
  'page./community/directory.title': 'Directorio',
  'page./community/elections.title': 'Elecciones',
  'page./community/family-tree.title': 'Árbol familiar',
  'page./gatherings.title': 'Reuniones',
  'page./gatherings/calendar.title': 'Calendario',
  'page./help.title': 'Ayuda',
  'page./library/documents.title': 'Documentos',
  'page./library/officer-notes.title': 'Notas del cargo',
  'page./my-families.title': 'Mis familias',
  'page./personal-info.title': 'Mi perfil',
  'page./reporting/board.title': 'Directiva y cargos',
  'page./reporting/dues-projections.title': 'Proyección de cuotas',
  'page./reporting/elections.title': 'Elecciones',
  'page./reporting/gatherings.title': 'Reuniones',
  'page./reporting/meetings.title': 'Juntas',
  'page./reporting/membership.title': 'Membresía',
  'page./reporting/payment-history.title': 'Historial de pagos',
  'page./reporting/pl-summary.title': 'Estado de resultados',

  // ── THE DASHBOARD ────────────────────────────────────────────────────────────────
  // *Reunión destacada* for the premier gathering: *destacada* is what a product would say for
  // "featured", and *premier* is not a Spanish word in this sense.
  'dash.welcome': 'Bienvenido de nuevo,',
  'dash.atAGlance': 'Un vistazo',
  'dash.quickActions': 'Acciones rápidas',
  'dash.premier.label': 'Reunión destacada',
  'dash.premier.view': 'Ver detalles',
  'dash.donations.title': 'Campañas de donación',
  'dash.donations.view': 'Ver campañas de donación',
  'dash.donations.met': 'Cumplida',
  'dash.collected.title': 'Recaudado este año',
  'dash.collected.view': 'Ver pagos',
  'dash.tree.title': 'Árbol familiar',
  'dash.tree.generationOne': 'Generación',
  'dash.tree.generationMany': 'Generaciones',
  'dash.tree.empty': 'Todavía no hay nadie en esta familia con quien construir un árbol.',
  'dash.tree.allConnected':
    'No hay hojas sueltas: todos en la familia están conectados con alguien.',
  'dash.tree.oneLeaf':
    'Una hoja suelta: un miembro que aún no está conectado con nadie en el árbol.',
  'dash.tree.open': 'Abrir el árbol',
  'dash.tree.view': 'Ver el árbol familiar',
  'dash.updates.title': 'Novedades',
  'dash.updates.empty': 'No hay novedades por ahora.',
  'dash.updates.viewAll': 'Ver todas las novedades',
  'dash.updates.unpin': 'Ocultar esto de la parte superior de mis novedades',
  'dash.updates.pin': 'Mostrar esto en la parte superior de mis novedades',
  'dash.profile.title': 'Complete su perfil',
  'dash.profile.action': 'Actualizar mi perfil',
  'dash.safety.title': 'Su familia pregunta si está a salvo',
  'dash.safety.action': 'Abrir los avisos de seguridad',
  'dash.chapter.title': 'Elija su capítulo',
  'dash.chapter.lede':
    'Elegir su capítulo hace que reciba los anuncios correctos y quede agrupado correctamente dentro de la familia.',
  'dash.chapter.select': 'Seleccione su capítulo',
  'dash.chapter.action': 'Guardar capítulo',
  'dash.chapter.saving': 'Guardando capítulo',
  'dash.chapter.required': 'Seleccione un capítulo.',
  'dash.chapter.saved': 'Su capítulo se guardó.',
  'dash.chapter.failed': 'No se pudo guardar. Inténtelo de nuevo.',
  'dash.link.title': '¿Ya lo habían agregado a la familia?',
  'dash.link.maybe': 'Estos podrían ser usted',
  'dash.link.isThisYou': '¿Es usted?',
  'dash.link.thisIsMe': 'Soy yo',
  'dash.link.everyoneElse': 'Todos los demás',
  'dash.link.search': 'Buscar por nombre…',
  'dash.link.none': 'No se encontró ningún familiar que coincida.',
  'dash.link.match.name': 'Coincide el nombre',
  'dash.link.match.email': 'Coincide el correo',
  'dash.link.match.phone': 'Coincide el teléfono',
  'dash.link.match.dob': 'Coincide la fecha de nacimiento',
  'dash.link.action': 'Vincular registro',
  'dash.link.linking': 'Vinculando…',
  'dash.link.aria': 'Vincular con su cuenta',
  'dash.plan.pay': 'Pagar ahora',
  'dash.plan.opening': 'Abriendo…',
  'dash.plan.advance': 'Comprar meses por adelantado',
  'dash.dismiss': 'Descartar',
  'dash.cancel': 'Cancelar',
  'dash.plan.explain':
    '**{pay}** lo lleva a Stripe para pagar cada mes, empezando por lo que resta de este mes. '
    + '**{cancel}** descarta el plan y deja a su familia en Gratis: no se cobra nada en ningún '
    + 'caso, y puede contratarlo después. ',
  'dash.safety.titleMany': 'Su familia pregunta si está a salvo ({n} avisos)',
  'dash.tree.manyLeaves':
    '{n} hojas sueltas: miembros que aún no están conectados con nadie en el árbol.',
}
