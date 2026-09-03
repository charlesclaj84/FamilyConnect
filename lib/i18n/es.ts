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
  'nav.item./reporting/transactions': 'Transacciones',

  'nav.item./reporting/membership': 'Membresía',
  'nav.item./accounting/payment-history': 'Historial de pagos',
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

  'switcher.badge.removedShort': 'Retirada',
  'switcher.badge.pendingShort': 'Pendiente',
  'switcher.badge.defaultShort': 'Predet.',
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
  'language.choose': 'Elija un idioma',
  'language.changeFailed': 'No se pudo cambiar el idioma.',
  // ── BATCH 1 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // Found by rendering every route as a Spanish-reading member and again as an English
  // one and diffing the visible text — see the note above `i18n:literals`' ceiling on why
  // a static scan could not see these. `field.required` is the sharpest of them: it is
  // read aloud beside the asterisk on EVERY required field in the product.
  'field.required': '(obligatorio)',
  'dash.viewDirectory': 'Ver el directorio',
  'dash.reviewQueue': 'Cola de revisión',
  'dash.viewCalendar': 'Ver el calendario',
  'dash.election.nominations': 'Nominar',
  'dash.election.voting': 'Votar',
  'dash.selectYourChapter': '— Elija su capítulo —',
  'gath.comingUp': 'Próximamente',
  'gath.alreadyHeld': 'Ya celebradas',
  'gath.nothingPlannedYet': 'Todavía no hay nada planeado.',
  'gath.nothingHeldYet': 'Todavía no se ha celebrado nada.',
  'cards.nextInstallmentOne': 'Próxima cuota',
  'cards.nextInstallmentsMany': 'Próximas cuotas',
  // ── BATCH 2 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // `tree.bloodlineFrom*` is the one worth reading: it was six JSX fragments spliced
  // around two names, which hard-codes ENGLISH WORD ORDER and cannot be translated at
  // all. One key with `{anchor}` and `{parents}` lets each language put the names where
  // that language puts them.
  'dash.tree.leafOne': 'Hoja',
  'dash.tree.leavesMany': 'Hojas',
  'plan.perMonthNoAnnual': ' /mes · sin plan anual',
  'set.removalKeepsEverything': 'Cada pago, fondo, fotografía, evento, mensaje y persona se queda exactamente donde está. Quitar no es una manera de borrar nada, y no es algo que usted pueda deshacer desde aquí:',
  'set.onlySupportRestores': 'solo el equipo de soporte de GENORRA puede recuperar una familia.',
  'tree.dashedCardsAreGaps': '· Las tarjetas punteadas son huecos que usted puede llenar',
  'tree.removingNeverRemoves': '· Quitar una conexión nunca saca a nadie de la familia',
  // ── THE TRANSACTIONS LEDGER, 2026-08-29 ────────────────────────────────────
  // This screen carried a note saying it was "not translated yet — on Phase 5's admin
  // pass", and it was the densest concentration of English left in the product: every
  // field label in the detail dialog, every validator refusal, and both module-level
  // registries. `tx.reverseConfirm` is one key rather than the five concatenated clauses
  // it replaced — a sentence spliced around two figures and a name hard-codes English
  // word order and cannot be translated at all.
  'tx.newDuesPayment': 'Nuevo pago de cuotas',
  'tx.newDonationPayment': 'Nuevo pago de donación',
  'tx.source.dues_routing': 'Distribuido',
  'tx.source.admin_manual': 'Registrado',
  'tx.source.member_contribution': 'De un miembro',
  'tx.noLongerInFamily': 'Ya no está en la familia',
  'tx.donationPayment': 'Pago de donación',
  'tx.duesPayment': 'Pago de cuotas',
  'tx.unknownMember': 'Miembro desconocido',
  'tx.correctingEntry': '{kind} — asiento de corrección',
  'tx.correctingEntryPill': 'Asiento de corrección',
  'tx.amount': 'Importe',
  'tx.amountDollars': 'Importe ($)',
  'tx.schedule': 'Calendario de cuotas',
  'tx.noSchedule': 'Sin calendario',
  'tx.entered': 'Introducido',
  'tx.reversed': 'Revertido',
  'tx.reverse': 'Revertir',
  'tx.reversedByCorrecting': 'Sí: un asiento de corrección cancela este pago',
  'tx.corrects': 'Corrige',
  'tx.correctsEarlierPayment': 'Un pago anterior en este libro',
  'tx.routedFromPayment': 'Distribuido desde un pago',
  'tx.fundContribution': 'Aportación al fondo — {source}',
  'tx.unknownFund': 'Fondo desconocido',
  'tx.fundDisbursement': 'Desembolso del fondo',
  'tx.milestone': 'Hito',
  'tx.fundTransfer': 'Transferencia entre fondos: dinero movido dentro de la familia',
  'tx.fromLabel': 'De',
  'tx.toLabel': 'A',
  'tx.reason': 'Motivo',
  'tx.recipient': 'Destinatario',
  'tx.reverseThisPayment': 'Revertir este pago',
  'tx.thisMember': 'este miembro',
  'tx.reverseConfirm': '¿Registrar un asiento de corrección de {credit} contra el pago de {amount} de {member}? El original permanece en el libro: revertir es como se corrige un error, porque los pagos registrados no se pueden editar ni eliminar. Todo el dinero que este pago distribuyó a los fondos se retira de esos mismos fondos.',
  'tx.postReversal': 'Registrar la reversión',
  'tx.failedToReverse': 'No se pudo revertir',
  'tx.memberScheduleAmountRequired': 'Se requieren miembro, calendario e importe',
  'tx.chooseHowPaymentMade': 'Elija cómo se hizo el pago',
  'tx.enterCheckPayment': 'Introduzca el número de cheque o la referencia del pago',
  'tx.fundAndAmountRequired': 'Se requieren fondo e importe',
  'tx.chooseWhoContributionFrom': 'Elija de quién vino la aportación',
  'tx.nameWhoContributionFrom': 'Indique de quién vino la aportación',
  'tx.chooseHowContributionGiven': 'Elija cómo se entregó la aportación',
  'tx.enterCheckContribution': 'Introduzca el número de cheque o la referencia de la aportación',
  'tx.fundMemberAmountRequired': 'Se requieren fondo, miembro e importe',
  'tx.enterCheckDisbursement': 'Introduzca el número de cheque o la referencia del desembolso',
  'tx.bothFundsAmountRequired': 'Se requieren los dos fondos y un importe',
  'tx.chooseTwoDifferentFunds': 'Elija dos fondos distintos',
  'tx.sayWhyMoneyMoved': 'Diga por qué se mueve el dinero',
  'tx.enterAmountAboveZero': 'Introduzca un importe mayor que cero',
  'tx.selectMember': '— Elija un miembro —',
  'tx.selectFund': '— Elija un fondo —',
  'tx.selectMethod': '— Elija un método —',
  'tx.selectOne': '— Elija —',
  'tx.selectNone': '— Ninguno —',
  'tx.recording': 'Registrando…',
  'tx.recordPayment': 'Registrar el pago',
  'tx.addContribution': 'Añadir la aportación',
  'tx.recordDisbursement': 'Registrar el desembolso',
  'tx.transferring': 'Transfiriendo…',
  'tx.transferFunds': 'Transferir fondos',
  'tx.transactionLedgers': 'Libros de transacciones',
  'tx.recordGiftLede': 'Registre un donativo que un miembro ya ha entregado.',
  'tx.recordDuesLede': 'Registre las cuotas que un miembro ya ha pagado.',
  'tx.contributionLede': 'Dinero añadido directamente a un fondo, fuera de la distribución de cuotas.',
  'tx.disbursementLede': 'Dinero pagado desde un fondo a un miembro.',
  'tx.transferLede': 'Mueva dinero de un fondo a otro. Nada sale de la familia.',
  'tx.noDonationsYet': 'Todavía no se ha recibido ninguna donación.',
  'tx.noDuesPaymentsYet': 'Todavía no se ha registrado ningún pago de cuotas.',
  // ── BATCH 3 OF THE 2026-08-29 SWEEP ────────────────────────────────────────
  // The rail's motto is the one worth a note: it was read straight out of `lib/brand.ts`,
  // so the single piece of writing a member sees on EVERY screen was English for every
  // reader. Same call `FeatureShowcase` records about `APP_PROMISE` — the brand file keeps
  // the product's name, and finished prose a reader reads belongs here.
  'ledger.dues': 'Cuotas',
  'ledger.donations': 'Donaciones',
  'ledger.contributions': 'Aportaciones',
  'ledger.disbursements': 'Desembolsos',
  'ledger.transfers': 'Transferencias',
  'nav.menu': 'Menú',
  'brand.motto.lead': 'Nuestras raíces',
  'brand.motto.rest': 'son profundas; nuestro vínculo lo es aún más.',
  // ── CONNECT: WHERE A FAMILY BANKS ──────────────────────────────────────────
  // `country.<iso>` is keyed on the alpha-2 code because that is what
  // `identity.country` takes and what `family_stripe_accounts.country` stores — the id is
  // the contract and the name is copy. Only the ENABLED countries are here; enabling one
  // in `lib/stripe/connect-countries.ts` owes three lines in this file, and `i18n:check`
  // names the missing one rather than letting the picker print a key.
  'proc.countryLabel': 'Dónde tiene la familia su banco',
  'proc.countryPermanent': 'Stripe no puede cambiar esto después de crear la cuenta, así que decide la moneda de los pagos y qué documentos le pedirán.',
  'proc.countryDecidesCurrency': 'Las cuotas, los fondos y los presupuestos de su familia se registrarán en {currency}.',
  'proc.currencyFixedByAccount': 'Su familia cobra en {currency} ({country}). Stripe no puede trasladar una cuenta conectada a otro país, así que esto ya está definido.',
  'proc.currencyFixedByPayments': 'Su familia cobra en {currency} ({country}). Ya se registraron pagos y el libro contable no se puede volver a denominar, así que esto ya está definido.',
  'act.countryNotAvailableForDues': 'Todavía no se puede cobrar cuotas en línea en ese país.',
  'notify.announcement.title': 'Se ha publicado un nuevo aviso',
  'notify.announcement.body': '{title}.',
  'notify.membershipRequest.title': 'Hay una nueva solicitud esperando aprobación',
  'notify.membershipRequest.body': '{who} ha pedido unirse a {family}.',
  'notify.membershipAppeal.title': 'Se ha apelado una solicitud rechazada',
  'notify.membershipAppeal.body': '{who} ha pedido que la familia lo revise de nuevo.',
  'notify.membershipAppeal.bodyNote':
    '{who} ha pedido que la familia lo revise de nuevo: «{note}»',
  'notify.membershipApproved.title': 'Su solicitud fue aprobada',
  'notify.membershipRejected.title': 'Su solicitud de membresía fue rechazada',
  'notify.taskAssigned.title': 'Tiene una nueva tarea de encuentro',
  'notify.taskAssigned.body': '{what}.',
  'notify.taskAssigned.bodyDue': '{what}, para el {due}.',
  'notify.taskSubmitted.title': 'Una tarea de encuentro espera revisión',
  'notify.taskSubmitted.body': '{who} ha enviado «{task}» para {gathering}.',
  'notify.taskApproved.title': 'Se aprobó una tarea de encuentro',
  'notify.taskApproved.body': '{what} ha sido aprobada.',
  'notify.taskApproved.bodyNotes': '{what} ha sido aprobada: «{notes}»',
  // «Devuelta», nunca «rechazada»: vea la nota en la versión en inglés — la tarea vuelve a
  // estar abierta y se pide un cambio, no se juzga a la persona.
  'notify.taskDenied.title': 'Una tarea de encuentro necesita otra revisión',
  'notify.taskDenied.body': '{what} fue devuelta para otra revisión.',
  'notify.taskDenied.bodyNotes': '{what} fue devuelta con notas: «{notes}»',
  'notify.taskReopened.title': 'Se reabrió una tarea de encuentro',
  'notify.taskReopened.body':
    '{what} fue aprobada y se ha reabierto. Su respuesta anterior sigue ahí.',
  'notify.taskReopened.bodyReason':
    '{what} fue aprobada y se ha reabierto: «{reason}». Su respuesta anterior sigue ahí.',
  'notify.meeting.title': 'Se le espera en una reunión',
  'notify.meeting.body': '{title}. Está en su calendario.',
  'notify.meeting.bodyWhen': '{title} el {when}. Está en su calendario.',
  'notify.safety.title': '¿Está a salvo?',
  'notify.safety.body': '{title}: su familia le pide que confirme que está bien.',
  'plan.featuresInPlan': 'Lo que incluye {plan}',
  'gath.status.planning': 'En preparación',
  'gath.status.scheduled': 'Programado',
  'gath.status.complete': 'Terminado',
  'gath.status.cancelled': 'Cancelado',
  'gath.taskStatus.open': 'Sin empezar',
  'gath.taskStatus.submitted': 'Pendiente de revisión',
  'gath.taskStatus.approved': 'Aprobado',
  'gath.taskStatus.denied': 'Necesita otra revisión',
  'acct.rail.funds': 'Fondos',
  'dash.tree.memberOne': 'Integrante',
  'dash.tree.memberMany': 'Integrantes',
  'act.nothingWithheldToLetGo': 'No hay registros conservados que se puedan eliminar.',
  'act.couldNotDeleteRecordsPlease': 'No se pudieron eliminar esos registros. Inténtelo de nuevo.',
  'act.thatCodeNotRight': 'Ese código no es correcto.',
  'act.enterSixDigitCode': 'Escriba el código de seis dígitos de su correo.',
  'ret.heading': 'Registros de su plan anterior',
  'ret.p1': 'Su familia bajó de {tier}. Todo lo que ese plan incluía se ha conservado en vez de eliminarse, y se elimina en {days} días.',
  'ret.p1One': 'Su familia bajó de {tier}. Todo lo que ese plan incluía se ha conservado en vez de eliminarse, y se elimina mañana.',
  'ret.p1Today': 'Su familia bajó de {tier}. Todo lo que ese plan incluía está previsto para eliminarse hoy.',
  'ret.overdue': 'La eliminación lleva {days} días de retraso y está esperando un recordatorio que no se ha enviado. No se ha eliminado nada.',
  'ret.keep': 'Vuelva a {tier} para conservarlo. Eso cubre los {months} mes(es) que estuvo fuera y el mes que viene: {amount}.',
  'ret.freshHeading': 'O elimínelo ahora',
  'ret.fresh': 'Si ya lo decidió, puede eliminarlo hoy en vez de esperar y recibir cuatro recordatorios más.',
  'ret.freshButton': 'Eliminar estos registros…',
  'ret.irreversible': 'Los registros eliminados no se pueden recuperar. Esto no lo puede revertir ni nosotros ni nadie más.',
  'ret.willDelete': 'Esto eliminará:',
  'ret.rows': '{n} fila(s) en {table}',
  'ret.codeSent': 'Se envió un código de seis dígitos a {email}. Dura {minutes} minutos.',
  'ret.codeLabel': 'Código de su correo',
  'ret.confirmButton': 'Eliminar estos registros permanentemente',
  'ret.done': 'Esos registros se han eliminado.',
  'lock.admin.heading': 'El pago de su familia está vencido',
  'lock.admin.p1Members': 'El último pago de {family} no se procesó, así que los familiares ya no pueden usar el sitio. Usted conserva el acceso completo, y pagar lo restaura para todos a la vez.',
  'lock.admin.p1All': 'El último pago de {family} no se procesó, así que todas las pantallas excepto la de facturación están cerradas. Pagar las vuelve a abrir todas.',
  'lock.admin.nothingLost': 'No se ha eliminado nada. Todo lo que la familia ha registrado sigue exactamente donde estaba.',
  'lock.admin.warnOne': 'Mañana la familia pasa al plan Gratis y se elimina todo lo que el plan Gratis no incluye. Eso no se puede revertir.',
  'lock.admin.warnMany': 'En {days} días la familia pasa al plan Gratis y se elimina todo lo que el plan Gratis no incluye: el árbol genealógico, el libro de cuotas, los fondos y las fotografías. Eso no se puede revertir.',
  'lock.admin.button': 'Ir a facturación',
  'lock.member.heading': '{family} no está disponible temporalmente',
  'lock.member.p1': 'Hay un asunto contable en la cuenta de esta familia. Comuníquese con el administrador de su familia.',
  'lock.member.p2': 'No se ha eliminado nada, y todo vuelve en cuanto se resuelva.',
  'lock.otherFamilies': 'Sus otras familias no se ven afectadas:',
  'lock.myFamilies': 'Mis familias',
  'act.chooseKeepOrStartFresh': 'Elija si desea conservar los registros de su plan anterior o empezar de cero antes de continuar.',
  'act.nothingWithheldToKeep': 'No hay registros conservados que este plan pueda recuperar.',
  'bill.catchUpLine': '{plan}: {months} mes(es) que estuvo fuera, más el mes que viene',
  'act.countryAndCurrencySaved': 'Guardado. Su familia cobra en la moneda de este país.',
  'act.couldNotReadFamilyCurrency': 'No pudimos determinar en qué moneda cobra su familia, por lo que este pago no se inició. Inténtelo de nuevo.',
  'act.currencyFixedByPayments': 'Su familia ya registró pagos, por lo que no se pueden cambiar su país ni su moneda.',
  'act.currencyFixedByAccount': 'La cuenta de pagos de su familia ya fue creada, por lo que no se pueden cambiar su país ni su moneda.',
  'country.us': 'Estados Unidos',
  'country.ca': 'Canadá',
  'country.mx': 'México',
  // ── THE STAFF CONSOLE'S DESTRUCTIVE HALF, 2026-08-31 ───────────────────────
  // Two irreversible acts and one read-only screen. `stf.sub*` is the platform's OWN
  // revenue and never a family's dues — the two ledgers must not meet, and a caption
  // here that blurred them would be quoted.
  'staff.subscriptions': 'Suscripciones',
  'stf.subscriptionsReadFailed': 'No pudimos leer los registros de facturación en este momento. No hay ningún problema con el plan de ninguna familia: actualice la página, y si sigue ocurriendo no conviene citar estas cifras.',
  'stf.subPaying': 'Pagando hoy',
  'stf.subMrr': 'Mensual',
  'stf.subMrrHint': 'Solo planes recurrentes',
  'stf.subLifetime': 'Cobrado hasta la fecha',
  'stf.subLifetimeShort': 'A la fecha',
  'stf.subAttention': 'Requieren atención',
  'stf.subAttentionHint': '{delinquent} con fallo, {leaving} se van',
  'stf.subNoneYet': 'Ninguna familia ha llegado al pago todavía.',
  'stf.tierMixHeading': 'Familias por plan',
  'stf.tierMixHint': 'Todas las familias de la plataforma, contadas por el plan vigente, no sólo las que han pagado.',
  'stf.sortOrdersThisPage': 'La ordenación afecta a las filas de esta página, no a toda la lista.',
  'stf.subFamily': 'Familia',
  'stf.subPlan': 'Plan',
  'stf.subPaidThrough': 'Pagado hasta',
  'stf.subStanding': 'Situación',
  'stf.subPaidFor': 'Pagó por {tier}',
  'stf.subMode.recurring': 'Mensual',
  'stf.subMode.prepaid': 'Periodo prepagado',
  'stf.subScheduled': '{tier} desde {on}',
  'stf.subDelinquentSince': 'Pago fallido el {on}',
  'stf.subLeaving': 'No se renueva',
  'stf.subNeverPaid': 'Nunca ha pagado',
  'stf.subPaid': 'Pagado',
  'staff.deleteForever': 'Eliminar…',
  'staff.deleteForeverConfirm': 'Eliminar de forma permanente',
  'staff.deleting': 'Eliminando…',
  'staff.deleteFamilyTitle': '¿Eliminar {name}?',
  'staff.deleteFamilyLede': '{code} · {members} miembros. Esto es permanente y no hay forma de restaurarlo.',
  'staff.deleteFamilyWhatGoes': 'Se destruye cada persona, pago, fondo, fotografía, documento, mensaje, encuentro, elección y reunión de esta familia, junto con sus archivos. Las cuentas no se eliminan: quien pertenezca a otra familia la conserva.',
  'staff.deleteWhyLabel': 'Por qué',
  'staff.deleteWhyPlaceholder': 'El ticket y quién lo pidió',
  'staff.deleteWhyHint': 'Se guarda de forma permanente. Es el único registro que sobrevive a esto.',
  'staff.deleteTypeCodeLabel': 'Escriba {code} para confirmar',
  'staff.deleteEmailedLabel': 'Código de seis dígitos',
  'staff.deleteSendCode': 'Envíenme un código',
  'staff.deleteAccount': 'Eliminar…',
  'staff.deleteAccountConfirm': 'Eliminar esta cuenta',
  'staff.deleteAccountTitle': '¿Eliminar esta cuenta?',
  'staff.deleteAccountLede': '{email} ya no podrá iniciar sesión, y la dirección quedará libre para volver a registrarse.',
  'staff.deleteAccountKeeps': 'Sus {families} familias los conservan en el árbol, en el directorio y en cada libro contable, como un familiar sin cuenta. No se elimina nada de ninguna familia.',
  'staff.deleteAccountKeepsNone': 'Esta cuenta no pertenece a ninguna familia, así que no hay nada más que conservar.',
  'staff.deleteAccountWhyPlaceholder': 'El ticket y quién lo pidió',
  'staff.deleteTypeAddressLabel': 'Escriba la dirección para confirmar',
  'staff.noAddress': 'Sin dirección',
  'staff.actions': 'Acciones',
  'act.couldNotReadThatFamily': 'No pudimos leer esa familia. Inténtelo de nuevo.',
  'act.noFamilyWithThatCode': 'No hay ninguna familia con ese código.',
  'act.couldNotEmailYouCode': 'No pudimos enviarle un código por correo. Inténtelo de nuevo.',
  'act.codeEmailedToYou': 'Un código de seis dígitos va camino a su bandeja de entrada.',
  'act.typeFamilyCodeToConfirm': 'Escriba el código de la familia exactamente para confirmar.',
  'act.sayWhyFamilyDeleted': 'Diga por qué se elimina esta familia.',
  'act.couldNotCheckThatCode': 'No pudimos verificar ese código. Inténtelo de nuevo.',
  'act.couldNotDeleteThatFamily': 'No pudimos eliminar esa familia. No se cambió nada.',
  'act.deleteReturnedNoResult': 'Eso no devolvió ningún resultado. Verifique antes de volver a intentarlo.',
  'act.familyDeletedPermanently': '{code} ha desaparecido. Se destruyeron {rows} registros.',
  'act.someObjectsRemain': 'Algunos archivos no se pudieron eliminar y quedaron huérfanos: {detail}',
  'act.typeAddressToConfirm': 'Escriba la dirección exactamente para confirmar.',
  'act.sayWhyAccountDeleted': 'Diga por qué se elimina esta cuenta.',
  'act.couldNotDeleteThatAccount': 'No pudimos eliminar esa cuenta. No se cambió nada.',
  'act.accountDeleted': '{email} ya no puede iniciar sesión.',
  'act.couldNotStopSubscriptions': 'No se eliminó nada. Esta familia todavía tiene suscripciones activas en Stripe que no se pudieron cancelar, y eliminarla dejaría esos cargos en las tarjetas sin ningún registro de a quién pertenecen. Corríjalo en Stripe y luego solicite un código nuevo.',
  'act.stoppedDuesOne': 'Se canceló un pago recurrente de cuotas en Stripe.',
  'act.stoppedDuesMany': 'Se cancelaron {n} pagos recurrentes de cuotas en Stripe.',
  'act.stoppedGenorraPlan': 'Se canceló el plan de GENORRA de la familia.',
  'act.couldNotStopSubscriptionsRemoval': 'No se eliminó la familia. No pudimos cancelar sus suscripciones en Stripe, y eliminarla dejaría esos pagos en marcha sin que nadie pueda acceder a la pantalla que los detiene. Inténtelo de nuevo en unos minutos con un código nuevo.',
  'act.couldNotStopDuesFirst': 'No se eliminó nada. No pudimos cancelar primero los pagos recurrentes de cuotas de sus miembros en Stripe, y eliminar los registros dejaría esos pagos en marcha sin nada que indique a qué correspondían. Inténtelo de nuevo en unos minutos con un código nuevo.',
  'set.removalStopsBilling': 'La facturación se detiene, y esta parte no se puede revertir.',
  'set.removalBillingBody': 'Su plan de GENORRA no se renovará: sigue vigente hasta el final del periodo que ya pagó, y no se reembolsa nada. A cada miembro que paga sus cuotas automáticamente se le cancela ese pago de inmediato. Restaurar la familia recupera todos los registros, pero no puede recuperar esos pagos automáticos: cada miembro tendría que volver a configurarlo.',
  'stf.deleteStopsBilling': 'Primero se cancelan en Stripe todos los pagos recurrentes de esta familia: las cuotas automáticas de los miembros en la cuenta de la propia familia, y el plan de GENORRA de la familia en la nuestra. Si alguno no se puede cancelar, no se elimina nada.',
  // ── BIRTHDAYS, 2026-08-31 ──────────────────────────────────────────────────
  // `birthday.familyPosted` and `birthday.fromUs` are NOT interchangeable and must not
  // be merged: the first says the family spoke and the second says only that we did.
  // The whole design turns on never claiming the first when nobody wrote anything —
  // see 20260831000002's header.
  'birthday.today': 'Hoy',
  'birthday.heroGreeting': '¡Feliz cumpleaños, {name}!',
  'birthday.familyPosted': 'Su familia le ha publicado algo.',
  'birthday.fromUs': 'De parte de todos en GENORRA: esperamos que su familia lo consienta hoy.',
  'birthday.readIt': 'Leerlo',
  'birthday.promptHeading': 'Alguien tiene un cumpleaños próximo',
  'birthday.promptLede': 'En los próximos {days} días, y nadie ha dicho nada todavía. Lo que usted escriba es lo que publica la familia: nunca lo escribimos nosotros.',
  'birthday.promptReadFailed': 'No pudimos comprobar quién tiene un cumpleaños próximo. Actualice la página.',
  'birthday.isToday': 'Hoy',
  'birthday.inDays': 'En {days} días · {on}',
  'birthday.saySomething': 'Escribir algo',
  'birthday.notThisYear': 'No este año',
  'birthday.notThisYearFor': 'Guardar el recordatorio de cumpleaños de {name}',
  'birthday.suggestedTitle': '¡Feliz cumpleaños, {name}!',
  'birthday.suggestedBody': 'Le deseamos a {name} un cumpleaños maravilloso de parte de todos nosotros.',
  'birthday.editFirst': 'Cambie lo que quiera antes de publicarlo: se publica en su nombre, no en el nuestro.',
  'birthday.postGreeting': 'Publicarlo',
  'birthday.posting': 'Publicando…',
  'act.chooseRelative': 'Elija a un familiar.',
  'act.greetingPosted': 'Publicado. Queda fijado en el tablón de la familia durante los próximos dos días.',
  'act.greetingPostedNotRecorded': 'Publicado, pero no pudimos registrarlo, así que quizá se le pregunte de nuevo.',
  'act.promptPutAway': 'Guardado por este año.',
  'act.couldNotPostThat': 'No pudimos publicar eso. Inténtelo de nuevo.',
  'bill.chooseMonths': 'Elija entre 1 y {max} meses.',
  'bill.notOnSale': '{plan} aún no está a la venta.',
  'bill.notBuyableThisWay': '{plan} todavía no se puede comprar de esta manera.',
  'bill.notBuyableMonthly': '{plan} todavía no se puede comprar por mes.',
  'bill.notBuyableYet': '{plan} todavía no se puede comprar.',
  'bill.useChangePlanInstead':
    'Bajar a {plan} no cuesta nada: use Cambiar de plan. Surte efecto cuando termina el periodo que ya pagó.',
  'bill.tooFewDaysOne':
    'Solo queda 1 día este mes, un cargo demasiado pequeño para hacerlo por separado. Elija la opción que cubre este mes y el siguiente.',
  'bill.tooFewDaysMany':
    'Solo quedan {days} días este mes, un cargo demasiado pequeño para hacerlo por separado. Elija la opción que cubre este mes y el siguiente.',
  'bill.checkoutSubmitCovers':
    '{amount} hoy le cubre hasta finales de {month}. Luego {plan} se renueva a {monthly} al mes, el día 1.',
  'bill.alreadyOnPlan': 'Esta familia ya está en {plan}.',
  'bill.startsOnNextBilling':
    '{plan} comienza el {on}, la próxima fecha de facturación. Nada cambia antes, y no hay reembolso por los días ya pagados.',
  'bill.effectOnceDifferencePaid':
    '{plan} surte efecto en cuanto se pague el importe adicional. Stripe está cobrando la diferencia por el resto de este periodo.',
  'bill.planStopsOn':
    'El plan termina el {on}. Todas las páginas siguen abiertas hasta entonces. Lo que el plan '
    + 'más barato no incluye se conserva sesenta días después, y se elimina si no ha vuelto a subir.',
  'bill.startsOnNoRefund':
    '{plan} comienza el {on}. Nada cambia antes, y no hay reembolso por el periodo ya pagado.',
  'bill.activeNowCredit':
    '{plan} está activo ahora, pagado hasta el {through}. Lo que quedaba del periodo anterior ({credit}) se conserva como crédito para su próxima factura.',
  'bill.activeNowExact':
    '{plan} está activo ahora, pagado hasta el {through}. El periodo que ya había pagado lo cubría exactamente.',
  'bill.openingStripeToCollect': 'Abriendo Stripe para cobrar {amount}.',
  'bill.priceMisconfigured':
    '{plan} no está configurado correctamente para {way} en esta instalación. No se ha cobrado nada. Informe de esto en lugar de volver a intentarlo.',
  'bill.wayMonthly': 'el pago mensual',
  'bill.wayInAdvance': 'el pago por adelantado',
  'tmpl.addStepTo': 'Añadir un paso a {template}',
  'tmpl.editStepQuoted': 'Editar «{step}»',
  'tmpl.deleteStepConfirm':
    '¿Eliminar el paso «{step}» de {template}? Cualquier tarea ya creada a partir de él conserva su redacción, su responsable y su respuesta: solo la plantilla pierde el paso. Esto no se puede deshacer.',
  'tmpl.editTemplateAria': 'Editar la plantilla {template}',
  'tmpl.unarchiveTitle': 'Devolver {template} a la lista de plantillas programables',
  'tmpl.archiveTitle':
    'Quitar {template} de la lista de plantillas programables, dejando todas las reuniones como están',
  'tmpl.cannotDeleteUsedOne':
    '{template} se ha usado para crear 1 reunión, así que no se puede eliminar. Archívela en su lugar.',
  'tmpl.cannotDeleteUsedMany':
    '{template} se ha usado para crear {n} reuniones, así que no se puede eliminar. Archívela en su lugar.',
  'tmpl.deleteTemplateAria': 'Eliminar la plantilla {template}',
  'tmpl.editStepAria': 'Editar el paso «{step}»',
  'tmpl.moveStepEarlierIn': 'Mover «{step}» antes en {template}',
  'tmpl.moveStepEarlier': 'Mover «{step}» antes',
  'tmpl.moveStepLaterIn': 'Mover «{step}» después en {template}',
  'tmpl.moveStepLater': 'Mover «{step}» después',
  'tmpl.deleteStepAria': 'Eliminar el paso «{step}»',
  'plan.downgradeConfirmTitle': '¿Bajar esta familia a {plan}?',
  'plan.whatYouGainOn': 'Lo que gana con {plan}',
  'plan.whatYouHaveNowOn': 'Lo que tiene ahora con {plan}',
  'plan.whatYouKeepOn': 'Lo que conserva con {plan}',
  'plan.whatYouGetTitle': '{plan}: lo que incluye',
  'plan.includedInYours':
    'Incluido en {plan}, el plan de su familia. Todo lo de aquí está activado.',
  'plan.yourFamilyIsOnWhatAdds':
    'Su familia está en {current}. Esto es lo que añadiría {plan}, junto con lo que ya tiene.',
  'plan.rateSetUpInBilling': '{rate} Se configura en la sección Facturación de Ajustes.',
  'plan.rateNoPaymentStep': '{rate} Todavía no hay un paso de pago: aquí no se cobra nada.',
  'plan.whatPlanAdds': 'Lo que añade {plan}',
  'plan.whatPlanIncludes': 'Lo que incluye {plan}',
  'plan.whatYouWouldGainOn': 'Lo que ganaría con {plan}',
  'plan.alsoIncludedFrom': 'También incluido, desde {plan}',
  'perm.scope.none': '—',
  'perm.scope.own': 'Propios',
  'perm.scope.any': 'Todos',
  'perm.action.view': 'Ver',
  'perm.action.create': 'Crear',
  'perm.action.edit': 'Editar',
  'perm.action.delete': 'Eliminar',
  'perm.verb.view': 'ver',
  'perm.verb.create': 'crear',
  'perm.verb.edit': 'editar',
  'perm.verb.delete': 'eliminar',
  'perm.grantedPair': '{action} {scope}',
  'perm.whoMayAction': '{resource}: quién puede {verb}',
  'perm.switchTitle': '{resource} · {verb} · {scope}',
  'access.actionsFor': 'Acciones para {name}',
  'access.applyTemplateConfirm':
    '¿Poner a {name} en «{template}»? Su acceso pasa a ser exactamente lo que concede esa plantilla.',
  'access.applyTemplateConfirmReplacing':
    '¿Poner a {name} en «{template}»? Su acceso pasa a ser exactamente lo que concede esa plantilla, en lugar de «{previous}».',
  'access.enableConfirm':
    '¿Volver a activar el acceso de {name}? Recupera todo lo que concede su plantilla.',
  'access.disableConfirm':
    '¿Desactivar el acceso de {name}? Conserva su cuenta y su perfil, pero no podrá ver nada de esta familia hasta que lo vuelva a activar.',
  'access.copyStartsFrom':
    'La nueva plantilla empieza con exactamente lo que concede {template} hoy. Es una copia, no un enlace: cambiar una después no afecta a la otra.',
  'access.renameTemplateConfirm':
    '¿Cambiar el nombre de «{from}» a «{to}» y guardar su descripción?',
  'access.saveTemplateConfirm': '¿Guardar los cambios en «{template}»?',
  'access.templateStillHasOne':
    '«{template}» todavía tiene 1 miembro. Muévalo a otra plantilla primero.',
  'access.templateStillHasMany':
    '«{template}» todavía tiene {n} miembros. Muévalos a otra plantilla primero.',
  'access.deleteTemplateConfirm': '¿Eliminar «{template}»? Esto no se puede deshacer.',
  'access.setGrantConfirm': '¿Poner «{template}» en {action} {scope} para {resource}? {applies}',
  'access.setGrantNotAllowed':
    '¿Poner «{template}» de modo que {resource} no permita {verb}? {applies}',
  'access.appliesToOne': 'Esto se aplica al único miembro de la plantilla.',
  'access.appliesToMany': 'Esto se aplica a los {n} miembros de la plantilla.',
  'elec.boardReadFailed':
    'No se pudieron leer los cargos de la junta de esta familia. Inténtelo de nuevo.',
  'elec.level.national': 'nacional',
  'elec.level.regional': 'regional',
  'elec.level.chapter': 'de capítulo',
  'elec.wrongLevelOne':
    '{titles} no es un cargo {level} de la junta. Una elección {level} solo puede cubrir cargos {level}: añada el cargo o cambie su alcance en Miembros › Organización primero.',
  'elec.wrongLevelMany':
    '{titles} no son cargos {level} de la junta. Una elección {level} solo puede cubrir cargos {level}: añada los cargos o cambie su alcance en Miembros › Organización primero.',
  'elec.createdWithoutPositions': 'La elección se creó pero sus cargos no: {error}',
  'elec.savedWithoutPositions': 'La elección se guardó pero sus cargos no: {error}',
  'elec.announceWholeFamily': 'Una nueva elección, «{title}», está abierta a toda la familia.',
  'elec.announceForArea': 'Una nueva elección, «{title}», es para {where}.',
  'elec.nominationsOpenOn': 'Las nominaciones abren el {on}.',
  'elec.cannotUnpublish':
    'Esta elección ya tiene {nominations} nominación(es) y {votes} voto(s), así que no se puede volver a borrador. Déjela en marcha o elimínela, lo que borra con ella todas las nominaciones y votos.',
  'elec.nominationsNotOpenedYet': 'Las nominaciones aún no han abierto.',
  'elec.notPublishedYet': 'Esta elección aún no se ha publicado.',
  'elec.nominationsClosedOn': 'Las nominaciones cerraron el {on}.',
  'elec.nominationsClosed': 'Las nominaciones están cerradas.',
  'elec.votingClosedOn': 'La votación cerró el {on}.',
  'elec.votingOpensOn': 'La votación abre el {on}.',
  'elec.votingNotOpen': 'La votación no está abierta.',
  'elec.thisPosition': 'este cargo',
  'elec.standDownFrom': '¿Retirarse de {position}?',
  'elec.retractOthersStayOne':
    'A {name} también lo nominó otro miembro, así que sigue en la papeleta para {position}: solo se retira su nombre.',
  'elec.retractOthersStayMany':
    'A {name} también lo nominaron {n} otros miembros, así que sigue en la papeleta para {position}: solo se retira su nombre.',
  'elec.retractOnlySupporter':
    'Usted es la única persona que nominó a {name} para {position}, así que saldrá de la papeleta.',
  'elec.standingOne': '1 persona nominada',
  'elec.standingMany': '{n} personas nominadas',
  'elec.toBeElected': '{n} para elegir',
  'elec.nominateFor': 'Nominar para {position}',
  'elec.onlyAreaMayBeNominated': 'Solo {where} puede ser nominado en esta elección.',
  'elec.nobodyInAreaYet': 'Todavía no se puede nominar a nadie de {where}.',
  'elec.nominatedByYou': 'nominado por usted',
  'elec.nominatedByYouAndOne': 'nominado por usted y otra persona',
  'elec.nominatedByYouAndMany': 'nominado por usted y {n} más',
  'elec.onTheBallot': 'en la papeleta',
  'elec.nominatedByOne': 'nominado por 1 miembro',
  'elec.nominatedByMany': 'nominado por {n} miembros',
  'chk.payForPlan': 'Pagar {plan}',
  'chk.shortMonthCombinedOne':
    'Solo queda 1 día este mes, un cargo demasiado pequeño para hacerlo por separado, así que el primer pago cubre {through}. El siguiente pago es el {next}.',
  'chk.shortMonthCombinedMany':
    'Solo quedan {days} días este mes, un cargo demasiado pequeño para hacerlo por separado, así que el primer pago cubre {through}. El siguiente pago es el {next}.',
  'chk.throughDate': 'hasta el {date}',
  'chk.nextMonthToo': 'también el mes que viene',
  'chk.onTheFirst': 'el día 1',
  'chk.everyPaymentOnFirst':
    'En cualquier caso, todos los pagos después del primero son el día 1: el siguiente {next}.',
  'chk.isDate': 'es el {date}',
  'chk.isFirstOfNextMonth': 'es el día 1 del mes que viene',
  'chk.upgradeToPlan': 'Mejorar a {plan}',
  'chk.payNowAmount': 'Pagar {amount} ahora',
  'chk.throughEndOfThisMonth': '{plan} hasta el final de este mes.',
  'chk.coverNextTooAmount': 'Cubrir también el mes que viene: {amount}',
  'chk.throughEndOfNextMonth': '{plan} hasta el final del mes que viene.',
  'chk.upgradeNothingToPay': 'Mejorar a {plan}: nada que pagar',
  'chk.upgradePayAmount': 'Mejorar a {plan}: pagar {amount}',
  'dues.freq.annual': 'anual',
  'dues.freq.semi-annual': 'semestral',
  'dues.freq.quarterly': 'trimestral',
  'dues.freq.monthly': 'mensual',
  'dues.freq.one-time': 'pago único',
  'dues.cad.weekly': 'Semanal',
  'dues.cad.monthly': 'Mensual',
  'dues.cad.quarterly': 'Trimestral',
  'dues.cad.annual': 'Anual',
  'dues.cad.one-time': 'Pago único',
  'dues.cadWord.weekly': 'semanal',
  'dues.cadWord.monthly': 'mensual',
  'dues.cadWord.quarterly': 'trimestral',
  'dues.cadWord.annual': 'anual',
  'dues.cadWord.one-time': 'único',
  'agat.removeTemplateConfirm':
    '¿Quitar «{template}» de esta reunión? Se eliminan sus pasos que todavía no se han asignado a nadie. Si alguno se ha asignado o respondido, no se quita nada y se le indicará cuántos: reasigne o apruebe esos primero.',
  'agat.deleteConfirm':
    '¿Eliminar «{title}»? Todas sus tareas se van con ella, y también todas las respuestas y notas que alguien haya escrito. Si simplemente no va a ocurrir, cambie su estado a Cancelada: no se pierde nada y se puede reabrir. Esto no se puede deshacer.',
  'agat.startedBy': 'iniciada por {name}',
  'agat.approvedOfTotal': '{approved} de {total} aprobadas',
  'agat.waitingForReview': '{n} esperando revisión',
  'agat.sentBackCount': '{n} devueltas',
  'agat.dayHappensOn': 'El día en que ocurre «{segment}»',
  'agat.whereHeld': 'Dónde se celebra «{segment}»',
  'agat.removeSegment': 'Quitar {segment} de esta reunión',
  'agat.approveConfirm':
    '¿Aprobar «{task}» en {gathering}? La aprobación es definitiva: pasa a ser el registro de la familia y quien la envió ya no podrá cambiarla. Devuélvala en su lugar si algo sigue necesitando trabajo.',
  'agat.theHolder': 'la persona que la tiene',
  'agat.nobodyUnassigned': 'nadie, porque está sin asignar',
  'agat.notesBack': 'Notas devueltas: {notes}',
  'agat.whoeverHoldsIt': 'quien la tenga',
  'agat.sentWithTaskRequired':
    'Se envía con la tarea a {name}. Una tarea devuelta sin notas no le deja nada sobre lo que actuar, y por eso esto es obligatorio.',
  'agat.approvedRecordNote':
    'Es el registro de la familia de {task} y quien la envió no puede cambiarlo. Reábrala si tiene que cambiar: la respuesta y todos los envíos quedan exactamente como están, y vuelve a esa persona para editarla.',
  'agat.sentWithTaskTo': 'Se envía con la tarea a {name}.',
  'agat.nobodyUnassignedTold': 'nadie: esta tarea está sin asignar, así que no se avisa a nadie',
  'plan.optOutOf': '¿Excluirse de {schedule}?',
  'plan.optBackInTo': '¿Volver a {schedule}?',
  'plan.optBackInHint':
    '{schedule} volverá a contar en lo que debe, a {amount} por cuota {cadence}.',
  'plan.stopAutoHint':
    'No se cobrarán más pagos con tarjeta para {schedule}. Todo lo que ya ha pagado se mantiene en su registro.',
  'plan.includesOverdueOne': 'Incluye 1 cuota vencida desde el {since}',
  'plan.includesOverdueMany': 'Incluye {n} cuotas vencidas desde el {since}',
  'plan.startsWhenYouTurn': 'Comienza el {date}, cuando cumpla {age}',
  'plan.termsProrated': '{now} este año · {full}/año después · {frequency}',
  'plan.termsPlain': '{amount}/año · {frequency}',
  'plan.optionsFor': 'Opciones para {schedule}',
  'plan.changeCadenceHint':
    'Con qué frecuencia paga {schedule}. El total anual no cambia: la frecuencia lo divide.',
  'plan.thenEachTime': ', luego {amount} cada vez',
  'plan.enterAmountFor': 'Introduzca un importe para {schedule}, o cero para dejarlo fuera.',
  'plan.mostThatCanBePaid': 'Lo máximo que se puede pagar en {schedule} es {amount}.',
  'plan.coversEarlierOne': 'cubre 1 cuota anterior',
  'plan.coversEarlierMany': 'cubre {n} cuotas anteriores',
  'plan.payAmountByCard': 'Pagar {amount} con tarjeta',
  'plan.payCadenceFor': 'Frecuencia de pago de {schedule}',
  'plan.perInstallment': 'por cuota',
  'plan.nextPaymentCovering': 'Próximo pago {amount}, que cubre lo vencido hasta ahora',
  'plan.payAmountNext': 'Pagar {amount} a continuación',
  'tree.unattachedLede':
    '{who} en la familia pero sin conexión con nadie, así que no aparecen en ninguna parte más arriba. Pulse un nombre para centrar el árbol en esa persona y luego complete los familiares a su alrededor.',
  'tree.rosterLede':
    'El árbol de arriba muestra las cuatro generaciones alrededor de una persona. Pulse a cualquiera de aquí para centrarlo en esa persona.',
  'tree.rosterFollowsFilter': 'Esta lista también sigue el filtro de Linaje.',
  'tree.moreInGeneration': '+ {n} más en esta generación. Encuéntrelos en',
  'tree.removeLinkConfirm':
    '¿Quitar el vínculo entre {a} y {b}? Esto solo quita la conexión: nadie sale de la familia y no se elimina nada de lo que hayan registrado.',
  'tree.addSomeonesFather': 'Añadir el padre de {who}',
  'tree.addSomeonesMother': 'Añadir la madre de {who}',
  'tree.addAnother': 'Añadir otro {relation}',
  'tree.withPerson': 'Con {name}',
  'tree.noChildrenWith': 'No hay hijos registrados con {name}.',
  'tree.someonesSiblings': 'Hermanos y hermanas de {name}',
  'tree.editRecordAria': 'Editar el registro de {name} o invitarle',
  'tree.removeConnectionAria': 'Quitar la conexión con {name}',
  'gal.imagesReadyOne': '1 imagen lista',
  'gal.imagesReadyMany': '{n} imágenes listas',
  'gal.notAnImageFormat': '{name} no es {formats}: se omitirá.',
  'gal.moreKeepTyping': '{n} más: siga escribiendo para reducir la lista.',
  'gal.deletePhotoNamedConfirm':
    '¿Eliminar «{caption}»? Se quita para todos, junto con sus etiquetas, y también se borra el archivo de imagen. Esto no se puede deshacer.',
  'gal.photographsAddedOne': '1 fotografía añadida.',
  'gal.photographsAddedMany': '{n} fotografías añadidas.',
  'gal.addedSomeFailed': '{added} añadidas. {failed} no: {reasons}',
  'gal.formatsAndSize': '{formats}, hasta 10 MB cada una.',
  'gal.uploadOne': 'Subir fotografía',
  'gal.uploadMany': 'Subir {n} fotografías',
  'gal.removeTagForConfirm': '¿Quitar la etiqueta de {name} de esta fotografía?',
  'gal.addedByName': 'Añadida por {name}',
  'gal.removeTagForAria': 'Quitar la etiqueta de {name}',
  'staff.makeOwnerTitle': '¿Hacer a {name} propietario?',
  'staff.takeOwnerTitle': '¿Quitar el acceso de propietario a {name}?',
  'staff.makeOwnerBody':
    '{name} podrá conceder acceso de personal, cambiar el tipo que tiene cualquiera y quitarlo, incluido el suyo. Nada más de lo que puede ver cambia.',
  'staff.takeOwnerBodyOne':
    '{name} conserva la consola y todo lo que lee, y pierde esta pantalla: no podrá conceder acceso de personal a nadie. Queda 1 propietario.',
  'staff.takeOwnerBodyMany':
    '{name} conserva la consola y todo lo que lee, y pierde esta pantalla: no podrá conceder acceso de personal a nadie. Quedan {n} propietarios.',
  'staff.changeToRole': 'Cambiar a {role}',
  'staff.removeAccessTitle': '¿Quitar el acceso de personal de {name}?',
  'staff.removeAccessBody':
    '{name} pierde toda la consola en su siguiente petición: todas sus páginas responden 404, exactamente igual que para un cliente. Nada de su propia cuenta ni de sus membresías familiares cambia. El motivo registrado para esta concesión se va con la fila y no se guarda en ninguna parte, así que si necesitan acceso de nuevo será una concesión nueva con un motivo nuevo.',
  'dist.stopSendingTitle': '¿Dejar de enviar «{subject}»?',
  'dist.stopSendingBody':
    'Ya se ha enviado el correo a {sent} de {total} familiares. Esos mensajes ya salieron y no se pueden recuperar. El resto no se enviará.',
  'dist.stopSending': 'Dejar de enviar',
  'dist.deleteRecordTitle': '¿Eliminar el registro de «{subject}»?',
  'dist.relativesCount': '{n} familiares',
  'dist.notInAudience': '{n} no están en esta audiencia',
  'dist.noEmailOnFile': '{n} sin dirección de correo registrada',
  'dist.deleteRecordAria': 'Eliminar el registro de {subject}',
  'dist.willBeEmailedOne': 'Se enviará el correo a 1 familiar',
  'dist.willBeEmailedMany': 'Se enviará el correo a {n} familiares',
  'dist.unreachableMoreOne':
    '. Hay 1 más en el árbol familiar sin dirección de correo, al que no se puede escribir.',
  'dist.unreachableMoreMany':
    '. Hay {n} más en el árbol familiar sin dirección de correo, a los que no se puede escribir.',
  'dist.preparing': 'Preparando…',
  'dist.sendToCount': 'Enviar a {n}',
  'dist.notInAudienceOne': '1 familiar no estaba en esta audiencia.',
  'dist.notInAudienceMany': '{n} familiares no estaban en esta audiencia.',
  'ael.droppedOne': '{titles} no es un cargo {level}, así que se ha borrado.',
  'ael.droppedMany': '{titles} no son cargos {level}, así que se han borrado.',
  'ael.publishBody':
    '«{title}» se añade al calendario de {where}. Las nominaciones abren el {opens} y la votación cierra el {closes}; a partir de ahí ambas ventanas abren y cierran por su cuenta.',
  'ael.announcementWillBePosted': ' Se publicará un aviso.',
  'ael.returnToDraftBody':
    '¿Quitar «{title}» del calendario de la familia y volverla a borrador? Nadie ha sido nominado y no se ha votado nada, así que no se pierde nada.',
  'ael.deleteWithVotesBody':
    '¿Eliminar «{title}», sus {nominations} nominación(es) y sus {votes} voto(s)? Esto no se puede deshacer.',
  'ael.deleteBody': '¿Eliminar «{title}» y todos sus cargos? Esto no se puede deshacer.',
  'ael.removePositionAria': 'Quitar el cargo {n}',
  'ael.noOfficesAtLevel':
    'Todavía no hay cargos {level} registrados. Añádalos primero en Miembros › Organización.',
  'chk.monthlyBlurb':
    '{amount} al mes, con cargo el día 1, hasta que lo detenga. Cámbielo o deténgalo cuando quiera: lo que ya ha pagado sigue abierto.',
  'chk.payRemainderOne': 'Pagar {amount} por el día que queda este mes',
  'chk.payRemainderMany': 'Pagar {amount} por los {days} días que quedan este mes',
  'chk.payRestAndNext': 'Pagar {amount} por el resto de este mes y el siguiente',
  'chk.inAdvanceBlurb':
    'Un solo pago que cubre el resto de este mes más meses completos después, hasta {max}. Nada lo renueva, así que no se vuelve a cobrar nada hasta que usted lo decida.',
  'chk.payNowSimple': 'Pagar {amount} ahora',
  'chk.prorationBreakdownOne':
    '{proration} por el día que queda este mes, más {months} por {n} mes completo.',
  'chk.prorationBreakdownMany':
    '{proration} por los {days} días que quedan este mes, más {months} por {n} meses completos.',
  'chk.yourTermUnused': 'Su periodo de {plan}, sin usar',
  'chk.paidThroughDate': 'Pagado hasta el {date}',
  'chk.nextPaymentDate': 'Próximo pago {date}',
  'agat.noBudgetFund': 'Sin presupuesto · {fund}',
  'agat.overBy': 'Excedido en {amount}',
  'agat.overWithOthersBy': 'Excedido en {amount} contando las otras reuniones de este fondo',
  'agat.approveRowConfirm':
    '¿Aprobar «{task}» en {gathering}? La aprobación es definitiva: la respuesta pasa a ser el registro de la familia y quien la envió ya no podrá cambiarla. Devuélvala en su lugar si algo sigue necesitando trabajo.',
  'agat.whoeverHoldsThisTask': 'quien tenga esta tarea',
  'agat.sentToWithTask':
    'Se envía a {name} con la tarea. Una tarea devuelta sin notas no le deja nada sobre lo que actuar, y por eso esto es obligatorio.',
  'agat.chosenTemplatesOne':
    '1 elegida · sus pasos se convierten en las tareas de esta reunión, en el orden mostrado',
  'agat.chosenTemplatesMany':
    '{n} elegidas · sus pasos se convierten en las tareas de esta reunión, en el orden mostrado',
  'agat.createdStepsFailed':
    'Creada, pero no se pudieron añadir los pasos de {templates}. Vuelva a añadir la plantilla desde la reunión.',
  'agat.templateArchived': '«{template}» está archivada y no puede iniciar una reunión nueva',
  'agat.cannotDeleteAnsweredOne':
    '1 tarea de «{title}» ya se ha respondido, así que no se puede eliminar. Cambie su estado a Cancelada: no se pierde nada y se puede reabrir.',
  'agat.cannotDeleteAnsweredMany':
    '{n} tareas de «{title}» ya se han respondido, así que no se puede eliminar. Cambie su estado a Cancelada: no se pierde nada y se puede reabrir.',
  'agat.savedOutsideOneDay': 'Guardado. Ese día queda fuera de la reunión, que es el {on}.',
  'agat.savedOutsideRange':
    'Guardado. Ese día queda fuera de la reunión, que va del {from} al {to}.',
  'agat.templateAlreadyPart': '«{template}» ya forma parte de esta reunión',
  'agat.couldNotAddSteps':
    'No se pudieron añadir los pasos de {templates}. No se cambió nada: inténtelo de nuevo.',
  'agat.templateNotPart': '«{template}» no forma parte de esta reunión',
  'agat.cannotRemoveInFlightOne':
    '1 tarea de esta plantilla se ha asignado o respondido, así que no se puede quitar. Reasígnela o apruébela primero.',
  'agat.cannotRemoveInFlightMany':
    '{n} tareas de esta plantilla se han asignado o respondido, así que no se puede quitar. Reasígnelas o apruébelas primero.',
  'budget.claimedByOthers': '{amount} de eso lo reclaman otras reuniones',
  'budget.theFund': 'el fondo',
  'budget.overFundSentence': '{budget} supera en {over} lo que tiene {fund}.',
  'budget.overWithOthersSentence':
    'Otras reuniones activas ya reclaman {others} del mismo fondo, así que hay {total} comprometidos contra {fund}: {over} más de lo que tiene.',
  'budget.overAllocatedSentence':
    'Los presupuestos de las tareas suman {lines}, que es {over} más de lo presupuestado para esta reunión. No se ha gastado nada: aumente el presupuesto o recorte una línea de tarea.',
  'fnd.routingGapUnder':
    'Falta un {percent}%: añádalo a cualquier fondo de abajo o repártalo entre varios.',
  'fnd.routingGapOver': 'Eso es un {percent}% de más. Quítelo de uno de los fondos de abajo.',
  'fnd.deleteNamedBody':
    '¿Eliminar el fondo «{name}»? Su saldo de {balance} y sus hitos se van con él. Esto no se puede deshacer.',
  'fnd.openNamedBody': '¿Permitir que los miembros aporten directamente a «{name}»?',
  'fnd.closeNamedBody': '¿Impedir que los miembros aporten directamente a «{name}»?',
  'fnd.deleteMilestoneNamedBody':
    '¿Eliminar el hito «{name}» ({amount})? Esto no se puede deshacer.',
  'fnd.minimumBalanceFor': 'Saldo mínimo de {fund}',
  'fnd.allocationPercentFor': 'Porcentaje de asignación de {fund}',
  'proj.expectedThisYear': 'Previsto este año',
  'proj.collected': 'Recaudado',
  'proj.waived': 'Exonerado',
  'proj.colPaying': 'Pagan',
  'proj.colExpected': 'Previsto',
  'proj.colOutstanding': 'Pendiente',
  'proj.colStanding': 'Situación',
  'proj.colDues': 'Cuotas',
  'proj.colPaid': 'Pagado',
  'proj.stillToCollect': 'Pendiente de cobro',
  'proj.oweSomethingOne': '1 de {total} miembros debe algo',
  'proj.oweSomethingMany': '{paying} de {total} miembros deben algo',
  'proj.percentOfBilled': '{percent}% de lo facturado, exoneraciones incluidas',
  'proj.nothingBilledYet': 'Todavía no se ha facturado nada',
  'proj.waivedCaption': 'Perdonado: liquida la cuota y no es ingreso',
  'proj.everybodyUpToDate': 'Todos están al día',
  'proj.outstandingOne': '1 miembro tiene algo pendiente',
  'proj.outstandingMany': '{n} miembros tienen algo pendiente',
  'proj.pendingSettlement':
    '{amount} está pendiente de liquidación: iniciado y aún sin confirmar. No cuenta como recaudado y no se ha descontado de lo que sigue debiéndose.',
  'proj.thatPartOfTheFamily': 'esa parte de la familia',
  'proj.scopeEmptyNote':
    'Nadie debe esto: ningún miembro de la familia está en {where}. Los miembros eligen su capítulo en su propio perfil, y quien no tenga capítulo queda en Nacional.',
  'proj.fullYear': 'Año completo',
  'proj.leastSettledFirst': 'Menos liquidados primero. Se muestran {shown} de {total}.',
  'ann.deleteNamedBody':
    '¿Eliminar «{title}»? Los miembros ya no lo verán, ni en el tablón ni en sus actualizaciones. Esto no se puede deshacer.',
  'ann.unpinNamedBody':
    '¿Dejar de fijar «{title}»? Se queda en este tablón y deja de aparecer arriba en las Actualizaciones recientes de todos.',
  'ann.pinNamedBody':
    '¿Fijar «{title}» arriba en las Actualizaciones recientes de todos los miembros? Cada uno podrá descartarlo por su cuenta después.',
  'ann.unpin': 'Dejar de fijar',
  'ann.pin': 'Fijar',
  'ann.hideFromMyUpdates': 'Ocultar «{title}» de la parte superior de sus actualizaciones',
  'ann.showInMyUpdates': 'Volver a mostrar «{title}» arriba en sus actualizaciones',
  'ann.unpinForEveryone': 'Dejar de fijar «{title}» para todos',
  'ann.pinForEveryone': 'Fijar «{title}» para todos',
  'org.deleteRegionMovingOne':
    '¿Eliminar la región {name}? Su capítulo pasa a Nacional, y todos sus miembros se quedan exactamente donde están. Esto no se puede deshacer.',
  'org.deleteRegionMovingMany':
    '¿Eliminar la región {name}? Sus {n} capítulos pasan a Nacional, y todos sus miembros se quedan exactamente donde están. Esto no se puede deshacer.',
  'org.deleteRegionBody': '¿Eliminar la región {name}? Esto no se puede deshacer.',
  'org.deleteChapterBody': '¿Eliminar el capítulo {name}? Esto no se puede deshacer.',
  'org.deleteRegionTitleAttr': 'Eliminar la región {name}',
  'org.deleteChapterTitleAttr': 'Eliminar el capítulo {name}',
  'org.underNationalOne': '1 capítulo está en Nacional.',
  'org.underNationalMany': '{n} capítulos están en Nacional.',
  'org.memberPicksChapter': 'Cada miembro elige su capítulo en su propio perfil.',
  'inc.ageProrationHint':
    'Un miembro no debe nada hasta que cumple {age}; después, los meses de ese año posteriores a su cumpleaños, y el importe completo todos los años siguientes. Quien no tenga fecha de nacimiento registrada lo debe completo.',
  'inc.beneficiaryHint':
    'Quien se nombre aquí no puede ver esta colecta en ninguna parte de {app}: ni el objetivo, ni el progreso, ni una sola aportación. Eso vale también para los administradores, así que una colecta puede mantenerse oculta a la persona a la que quiere sorprender. Todos los demás ven a quién va dirigida.',
  'inc.descriptionPlaceholder': 'Para qué es {noun}…',
  'inc.applyEditsDonation': '¿Aplicar sus cambios a «{label}» (objetivo {goal})?',
  'inc.applyEditsDues': '¿Aplicar sus cambios a «{label}» ({amount} {frequency})?',
  'inc.deleteNamedBody':
    '¿Eliminar {noun} «{label}» ({amount} {frequency})? Esto no se puede deshacer.',
  'inc.deleteThisBody': '¿Eliminar {noun}? Esto no se puede deshacer.',
  'inc.deleteNoun': 'Eliminar {noun}',
  'pos.holdersBlockOne': '1 persona ocupa «{name}». Quítesela primero.',
  'pos.holdersBlockMany': '{n} personas ocupan «{name}». Quíteselas primero.',
  'pos.removeNamedLede': '¿Quitar «{name}» de los cargos que mantiene su familia? ',
  'pos.renameAria': 'Cambiar el nombre del cargo {name}',
  'pos.heldBlockTitleOne': '1 persona ocupa esto: quítesela primero',
  'pos.heldBlockTitleMany': '{n} personas ocupan esto: quíteselas primero',
  'pos.cannotRemoveAriaOne': 'No se puede quitar el cargo {name}: 1 persona lo ocupa',
  'pos.cannotRemoveAriaMany': 'No se puede quitar el cargo {name}: {n} personas lo ocupan',
  'pos.removeAria': 'Quitar el cargo {name}',
  'inv.invitedNamed': '{name}, le han invitado a {family}',
  'inv.invitedAnon': 'Le han invitado a {family}',
  'inv.sentToHasAccount':
    'Esta invitación se envió a {email}, que ya tiene una cuenta de {app}. Inicie sesión y volverá directamente aquí para unirse: no necesitará un código de familia, esta invitación es su vía de entrada.',
  'inv.sentToNoAccount':
    'Esta invitación se envió a {email}. Cree una cuenta con esa dirección para aceptarla: no necesitará un código de familia, esta invitación es su vía de entrada. ¿Ya tiene cuenta? Inicie sesión y volverá directamente aquí.',
  'inv.thisAccount': 'esta cuenta',
  'inv.sentToOnlyThatAddress':
    'Se envió a {email}, y solo esa dirección puede aceptarla: eso es lo que impide que un enlace reenviado funcione para otra persona. Usted ha iniciado sesión como {account}.',
  'tasks.waitingOne': '1 tarea le está esperando',
  'tasks.waitingMany': '{n} tareas le están esperando',
  'tasks.needAnotherLookOne': '1 necesita otra revisión',
  'tasks.needAnotherLookMany': '{n} necesitan otra revisión',
  'tasks.wasDue': 'Vencía el {date}',
  'tasks.due': 'Vence el {date}',
  'tasks.sentBackHelpLabel': 'Qué pasa cuando una tarea vuelve',
  'tasks.answerFinal': '{status}: esta respuesta es definitiva.',
  'tasks.yourNote': 'Su nota: {note}',
  'tasks.yourAnswerFor': 'Su respuesta para {task}',
  'gath.shapeContinuous': 'Un bloque continuo',
  'gath.shapeContinuousHint':
    'Una reunión del viernes por la tarde al domingo al mediodía. Se dibuja como una sola barra a lo largo de esos días en el calendario.',
  'gath.shapeSeparate': 'Días separados, la misma reunión',
  'gath.shapeSeparateHint':
    'Una reunión de comité en tres sábados. Cada día se dibuja como su propia entrada, todas con el título de esta reunión.',
  'gath.removeDayAria': 'Quitar el día {n}',
  'gath.everyDayOwnEntry':
    'Cada día de aquí es su propia entrada en el calendario, todas con el nombre de esta reunión.',
  'rel.siblingNeedsSharedParent':
    'Todavía no hay ningún padre o madre registrado para {name}, así que este hermano o '
    + 'hermana no aparecerá en {view}: al árbol se le ha dicho que son hermanos, pero no '
    + 'de quién son hijos. Registre en ambos el progenitor que comparten y los dos '
    + 'aparecerán ahí.',
  'rel.shareParentsQuestion': '¿Comparten los padres de {name}?',
  'rel.whoElseIsParent': '¿Quién más es progenitor de este {relation}?',
  'rel.tickingRecordsParent':
    'Marcar a alguien también registra el vínculo de progenitor, así que esta persona aparece igualmente en su tarjeta, no solo al lado de {name}.',
  'rel.whoIsWhose': '¿Quién es el {relation} de {name}?',
  'rel.dateOfBirth': 'Fecha de nacimiento',
  'rel.dateOfBirthOptional': 'Fecha de nacimiento (opcional)',
  'elec.vote': 'Votar',
  'elec.thisNominee': 'este candidato',
  'elec.voteConfirm': '¿{action} por {nominee} como {position}?',
  'elec.nominationRespondConfirm':
    '¿{action} la nominación para {position}? Esto no se puede cambiar.',
  'elec.theyOpenOn': 'Abren el {date}.',
  'elec.nominationsClosedOnPlain': 'Las nominaciones cerraron el {date}.',
  'elec.votingOpensOnPlain': 'La votación abre el {date}.',
  'elec.votingClosedOnPlain': 'La votación cerró el {date}.',
  'pay.maxItems': 'Se pueden pagar hasta {max} cuotas de una vez. Pague algunas por separado.',
  'pay.nothingLeftOn': 'No queda nada por pagar en {schedule}.',
  'pay.moreThanOwed':
    'Eso es más de lo que se debe. Lo máximo que se puede pagar en {schedule} es {amount}.',
  'pay.feeLineName': 'Comisión por pago con tarjeta',
  'pay.feeLineDesc': 'Para que su familia reciba el importe completo',
  'pay.driveClosed': '{drive} se ha cerrado. Ya no se puede aportar nada más.',
  'pay.maxCharge': 'Un solo pago con tarjeta no puede ser mayor de {amount}. Hágalo en dos.',
  'rep.elecOpenNow': '{n} abiertas ahora · solo publicadas',
  'rep.elecNominations': 'Nominaciones',
  'rep.elecAcrossEvery': 'en todas las elecciones',
  'rep.elecEmptyMessage': 'Todavía no se ha publicado ninguna elección.',
  'rep.elecEmptyHint':
    'Cuando se publique una, esto informa de su participación, sus nominaciones y cualquier cargo al que nadie se presentó.',
  'rep.elecAcceptedOf': '{accepted} de {total} aceptadas',
  'rep.elecNobodyStanding': '{n} sin nadie presentado',
  'rep.elecUnopposedOne': '1 cargo sin oposición',
  'rep.elecUnopposedMany': '{n} cargos sin oposición',
  'rep.elecNotApplicableNote': ' en lugar de 0%: nadie podría haber votado en ella.',
  'pms.noMembersYet': 'Todavía no hay miembros para elegir.',
  'pms.searchMembers': 'Buscar entre {n} miembros…',
  'pms.noMatch': 'Ningún miembro coincide con «{query}».',
  'pms.totalOne': '1 miembro',
  'pms.totalMany': '{n} miembros',
  'pms.shownOfTotal': '{shown} de {total} mostrados',
  'pms.moreKeepTyping': '{n} más: siga escribiendo para reducir la lista',
  'meet.comingUp': 'Próximas',
  'meet.held': 'Celebradas',
  'meet.topicsOne': '1 tema',
  'meet.topicsMany': '{n} temas',
  'meet.stepOf': 'Paso {step} de {total} · {name}',
  'meet.allAdultsInFamily': 'Son todos los {n} adultos de la familia.',
  'meet.nobodyUnderEighteen': 'No se invita a menores de dieciocho a una reunión.',
  'meet.inTheRoomOne': '1 persona en la sala: ver quién',
  'meet.inTheRoomMany': '{n} personas en la sala: ver quiénes',
  'notes.deleteEntryNamedBody':
    '¿Eliminar «{title}»? Todas las notas que contiene también se van, para todos los que ocupen este cargo, ahora y después. Esto no se puede deshacer.',
  'notes.chapterWord': 'capítulo',
  'notes.regionWord': 'región',
  'notes.everyoneHoldingReads':
    '{who} {office} lee este diario, para cualquier {area} que lo ocupe.',
  'notes.thisOffice': 'este cargo',
  'notes.nothingRecordedFor': 'Todavía no hay nada registrado para {office}.',
  'notes.newEntry': 'Nueva entrada',
  'notes.newEntryForOffice': 'Nueva entrada — {office}',
  'bday.noneMatchName': 'Ningún cumpleaños de los próximos {days} días coincide con ese nombre.',
  'bday.inDays': 'en {n} días',
  'bday.shownOfTotal': '{shown} de {total} mostrados',
  'bday.countOne': '1 cumpleaños en los próximos {days} días',
  'bday.countMany': '{n} cumpleaños en los próximos {days} días',
  'bday.discreetNote': '{emoji} sustituye a una edad entre {min} y {max}',
  'pos.chooseWhichChapter': 'Elija qué capítulo',
  'pos.chooseWhichRegion': 'Elija qué región',
  'pos.takeAwayNamedLede': '¿Quitar «{position}» a {name}? ',
  'pos.somebodysPositions': 'Cargos de {name}',
  'pos.takeAwayAria': 'Quitar {position} a {name}',
  'fnd.builtInCannotSwitchOff': '{name} es integrado y no se puede desactivar.',
  'fnd.builtInCannotDelete':
    '{name} es integrado y no se puede eliminar. Todas las donaciones que recibe la familia se guardan aquí.',
  'fnd.allocationsMustTotal': 'Las asignaciones deben sumar 100% (actualmente {percent}%)',
  'fnd.couldNotReadBalance': 'No se pudo leer el saldo de {name}',
  'fnd.holdsTransferLess': '{name} tiene {amount}. Transfiera esa cantidad o menos.',
  'rep.meetings': 'Reuniones',
  'rep.meetRelativesAskedOne': '1 familiar invitado a alguna',
  'rep.meetRelativesAskedMany': '{n} familiares invitados a alguna',
  'rep.minuted': 'Con acta',
  'rep.meetReachedAVote': '{n} llegaron a votación',
  'rep.meetOnePerTopic': 'uno por tema respondido',
  'rep.meetEmptyMessage': 'La familia todavía no ha celebrado ninguna reunión.',
  'rep.meetEmptyHint':
    'Cuando se programe una, esto informa de quién estuvo en la sala, qué se trató y cómo fueron las votaciones.',
  'rep.meetVotedOn': '{n} votados',
  'safety.deleteNamedBody':
    '«{title}» y el registro de quién respondió se eliminarán. Nadie podrá ver a quién se preguntó, quién dijo estar a salvo ni con quién nunca se contactó.',
  'safety.raisedBy': 'iniciado por {name}',
  'safety.askRemaining': 'Preguntar a los {n} restantes',
  'safety.unreachableOne':
    '1 familiar no tiene dirección de correo registrada. Alguien tendrá que llamarle por teléfono.',
  'safety.unreachableMany':
    '{n} familiares no tienen dirección de correo registrada. Alguien tendrá que llamarles por teléfono.',
  'slice.descriptionOne': '{chart} · 1 miembro · {percent}% de la familia',
  'slice.descriptionMany': '{chart} · {n} miembros · {percent}% de la familia',
  'slice.invitedNotEmailed': 'Se invitó a {name}, pero no se pudo enviar el correo. ',
  'slice.invited': 'Se ha invitado a {name}.',
  'slice.birthdayRecorded': 'Fecha de nacimiento de {name} registrada.',
  'pend.waitingOnFamilies':
    'Está esperando a {n} familias. Cada una la revisan sus propios administradores, así que puede que no respondan al mismo tiempo.',
  'pend.sentTo': 'Enviado a {family}',
  'pend.askToLookAgain': 'Pedir a {family} que lo revise de nuevo',
  'pend.meantimeFillIn': 'Mientras tanto puede completar',
  'gal.deleteAlbumWithPhotosOne':
    'Esto elimina el álbum Y la fotografía que contiene, para todos. El archivo de imagen también se borra. Esto no se puede deshacer.',
  'gal.deleteAlbumWithPhotosMany':
    'Esto elimina el álbum Y las {n} fotografías que contiene, para todos. Los archivos de imagen también se borran. Esto no se puede deshacer.',
  'gal.deleteAlbumAndOne': 'Eliminar el álbum y 1 foto',
  'gal.deleteAlbumAndMany': 'Eliminar el álbum y {n} fotos',
  'gal.albumIsASet':
    'Un álbum es un conjunto de fotografías que la familia guarda juntas: una reunión, una boda, un año.',
  'gal.deleteNamedAlbumAria': 'Eliminar el álbum «{name}»',
  'rec.howRelated': 'Cómo está relacionado {name}',
  'rec.formerMarriageNote':
    'Un matrimonio anterior se queda en el árbol junto a {name}: normalmente es de donde vino la mitad de los hijos. Un matrimonio nunca lleva sangre.',
  'rem.nobodyCanOpen':
    'Nadie puede abrirla, unirse a ella ni aceptar una invitación. {nothingDeleted}: cada pago, fotografía, evento y persona está exactamente donde estaba. Solo el soporte de {app} puede recuperarla; escríbales y pídalo.',
  'set.codeSentTo':
    'Enviamos un código de seis dígitos a {email}. Dura {minutes} minutos y se puede usar una vez.',
  'set.codeFailedTo':
    '{note} No ha llegado ningún código a {email}, así que todavía no hay nada que escribir. Inténtelo de nuevo en un momento.',
  'gath.notUsableAnswer': 'Esa no es una respuesta válida para «{task}». {hint}',
  'gath.onlyOrganizerCanSchedule': 'Solo un organizador puede programar desde «{template}»',
  'gath.scheduledStepsFailed':
    'Programada, pero no se pudieron añadir los pasos de {templates}. Un organizador puede añadirlos desde la reunión.',
  'org.theNamedRegion': 'La región {name}',
  'org.theNamedChapter': 'El capítulo {name}',
  'pos.nameTooLong': 'El nombre de un cargo tiene como máximo {max} caracteres',
  'err.regionNeedsName': 'Una región necesita un nombre',
  'err.regionNotFound': 'Región no encontrada',
  'err.chapterNeedsName': 'Un capítulo necesita un nombre',
  'err.chapterNotFound': 'Capítulo no encontrado',
  'err.positionNeedsName': 'Un cargo necesita un nombre',
  'err.chooseCategory': 'Elija una categoría',
  'err.chooseScope': 'Elija un alcance',
  'err.positionNotFound': 'Cargo no encontrado',
  'err.memberNotFound': 'Miembro no encontrado',
  'err.memberNotApproved': 'Ese miembro todavía no ha sido aprobado',
  'err.chooseChapterForPosition': 'Elija el capítulo al que corresponde este cargo',
  'err.chooseRegionForPosition': 'Elija la región a la que corresponde este cargo',
  'err.alreadyHoldsPosition': 'Ya ocupa ese cargo',
  'err.assignmentGone': 'Esa asignación ya no existe',
  'err.notAuthenticated': 'No autenticado',
  'err.noFamilyOnAccount': 'Ninguna familia asociada a la cuenta',
  'err.noSignInAddress': 'Ese miembro no tiene una dirección de inicio de sesión registrada.',
  'err.placeholderEmailNoReset':
    'Este registro tiene una dirección de correo provisional, así que un enlace de restablecimiento no tiene a dónde ir.',
  'err.cannotRemoveSelfFromGroup': 'No puede quitarse a sí mismo del grupo',
  'err.conversationNotFound': 'Conversación no encontrada',
  'err.familyRoomFailed': 'No se pudo encontrar ni crear la sala de la familia',
  'err.groupNameRequired': 'El nombre del grupo es obligatorio',
  'err.groupNotFound': 'Grupo no encontrado',
  'err.invalidMessage': 'Mensaje no válido',
  'err.noFamily': 'Ninguna familia',
  'err.noFamilyCodeOnAccount': 'No se encontró ningún código de familia en su cuenta',
  'err.onlyCreatorCanAdd': 'Solo quien creó el grupo puede añadir miembros',
  'err.onlyCreatorCanRemove': 'Solo quien creó el grupo puede quitar miembros',
  'err.notInYourFamily': 'Ese miembro no está en su familia',
  'err.userNotInFamily': 'Usuario no encontrado en su familia',
  'err.nationalReservedName': '«Nacional» es un nombre reservado',
  'err.noAccountAttachPosition':
    'Ese familiar todavía no tiene cuenta, así que no hay nada a lo que asignar un cargo. Invítele primero desde el árbol familiar.',
  'err.noAccountResetPassword':
    'Este familiar todavía no tiene cuenta, así que no hay contraseña que restablecer. Invítele desde el árbol familiar en su lugar.',
  'reg.alreadyRegistered':
    '{email} ya está registrado en {app}, así que no hay nada que crear. Inicie sesión y volverá directamente a su invitación a',
  'acct.closedDrivesOne': '1 colecta cerrada no se muestra aquí:',
  'acct.closedDrivesMany': '{n} colectas cerradas no se muestran aquí:',
  'acct.seeDonationsForFull': 'para el registro completo.',
  'err.errorReference': 'Referencia del error: {digest}',
  'cal.withheldOne':
    'Este calendario no incluye {list}, así que lo que ve abajo no es el mes completo: esa pantalla no se ha compartido con usted o no se pudo leer en este momento.',
  'cal.withheldMany':
    'Este calendario no incluye {list}, así que lo que ve abajo no es el mes completo: esas pantallas no se han compartido con usted o no se pudieron leer en este momento.',
  'hlp.membershipUndecided':
    'Su membresía de {family} todavía no se ha decidido, así que la mayor parte del producto no está abierta para usted.',
  'hlp.chapterExplainsNext':
    'es el capítulo que explica qué pasa a continuación. Todo lo demás está aquí para leer mientras tanto.',
  'lib.whyNotesStayHelp': 'Por qué las notas se quedan con el cargo',
  'lib.officesRecordedUnder': 'Los cargos se registran en',
  'prof.requestDeclined': '{lede}{family} fue rechazada. Aun así puede mantener su perfil al día.',
  'prof.waitingForApproval':
    '{lede}{family} está esperando aprobación. Rellenar esto les ayuda a reconocerle:',
  'prof.checkTheStatus': 'consultar el estado',
  'rep.offices': 'Cargos',
  'rep.heldInTotalOne': '1 ocupado en total',
  'rep.heldInTotalMany': '{n} ocupados en total',
  'rep.filled': 'Ocupados',
  'rep.boardEmptyHint':
    'Añádalos en Miembros → Organización, y esto informa de quién ocupa cada uno y cuáles están vacíos.',
  'rep.gathStillToCome': '{n} por venir · canceladas excluidas',
  'rep.gathWaitingDecision': '{n} esperando una decisión',
  'rep.gathEmptyHint':
    'Cuando la familia programe una reunión, esto informa de cómo van sus tareas.',
  'stf.familiesTitle': 'Familias',
  'stf.familiesBlurb':
    'Todas las familias, su plan, cuántos miembros tienen y si han sido eliminadas. Restaurar una se hace aquí.',
  'stf.familyOne': 'familia',
  'stf.familyMany': 'familias',
  'stf.active': 'activas',
  'stf.accountsBlurb':
    'Todas las cuentas de inicio de sesión, si su dirección está confirmada, si se ha usado alguna vez y a qué familias pertenece.',
  'set.familyNameTooLong': 'Ese nombre de familia es demasiado largo (máximo {max} caracteres).',
  'set.paidPlanUseBilling':
    '{plan} es un plan de pago. Configúrelo en la sección Facturación de Ajustes: nada de aquí puede pasar una familia a ese plan.',
  'tmpl.nameExists': 'Ya existe una plantilla llamada «{name}»',
  'tmpl.usedCannotDeleteOne':
    '«{name}» se ha usado para crear 1 reunión, así que no se puede eliminar: el registro de dónde salieron esas tareas se iría con ella. Archívela en su lugar, lo que la quita de la lista de plantillas programables y deja todas las reuniones exactamente como están.',
  'tmpl.usedCannotDeleteMany':
    '«{name}» se ha usado para crear {n} reuniones, así que no se puede eliminar: el registro de dónde salieron esas tareas se iría con ella. Archívela en su lugar, lo que la quita de la lista de plantillas programables y deja todas las reuniones exactamente como están.',
  'access.membersOnTemplateOne': '1 miembro está en esta plantilla. Muévalo a otra primero.',
  'access.membersOnTemplateMany': '{n} miembros están en esta plantilla. Muévalos a otra primero.',
  'access.lockoutSubject.manageAccess': 'gestionar el acceso',
  'access.lockoutSubject.changeTemplates': 'cambiar las plantillas de permisos',
  'access.onlyTemplateThatCan':
    'Esta es la única plantilla que puede {subject}. Concédalo primero a otra plantilla.',
  'access.noOtherTemplateHasMembers':
    'Ninguna otra plantilla que pueda {subject} tiene miembros. Ponga a alguien en una primero.',
  'proc.disconnectedStoppedOne':
    'Desconectado, y se detuvo 1 pago recurrente. Se conservan todos los pagos ya registrados.',
  'proc.disconnectedStoppedMany':
    'Desconectado, y se detuvieron {n} pagos recurrentes. Se conservan todos los pagos ya registrados.',
  'usr.chaptersReadFailed': 'No se pudieron leer los capítulos de esta familia: {error}',
  'usr.chapterSavedMovedOne': 'Capítulo guardado. 1 familiar sin cuenta se movió con ellos.',
  'usr.chapterSavedMovedMany':
    'Capítulo guardado. {n} familiares sin cuenta se movieron con ellos.',
  'cht.loadRoomFailed': 'No se pudo cargar la sala: {error}',
  'cht.createRoomFailed': 'No se pudo crear la sala: {error}',
  'cht.enrollFailed': 'No se pudo inscribir a los miembros: {error}',
  'dues.driveVisibleToEveryone':
    'La colecta se creó, pero es VISIBLE PARA TODOS: {reason} Ábrala y establezca a quién va dirigida.',
  'dues.requiredCannotOptOut': '{schedule} es una cuota obligatoria, así que no se puede excluir.',
  'gal.tooManyAtOnce': 'Demasiadas fotografías a la vez: {n} cada vez.',
  'gal.couldNotStartUpload': 'No se pudo iniciar la subida.',
  'gal.uploadDidNotArrive': '{name} no llegó al álbum. Inténtelo de nuevo.',
  'gal.uploadingProgress': 'Subiendo {done} de {n}…',
  'gal.photoCountOne': '1 fotografía',
  'gal.photoCountMany': '{n} fotografías',
  'gal.renameAlbum': 'Cambiar el nombre del álbum',
  'gal.renameAlbumBody':
    'Cambie cómo se llama este álbum y cómo se describe. Las fotografías que contiene no se tocan.',
  'gal.renameNamedAlbumAria': 'Cambiar el nombre del álbum “{name}”',
  'gal.renameFailed': 'No se pudo cambiar el nombre de ese álbum.',
  'rel.inBloodlineQuestion': 'Esta persona pertenece al linaje de la familia',
  'rel.inBloodlineHint': 'Marque esto para un pariente de sangre. Déjelo sin marcar para alguien que se casó con la familia, y para un pariente político, adoptivo o de acogida. Decide quién aparece en {control} en el árbol, y quién debe una cuota restringida al linaje.',
  'rec.inBloodline': '{name} pertenece al linaje de la familia',
  'rec.inBloodlineHint': 'Decide quién aparece en {view} en el árbol, y quién debe una cuota restringida al linaje. Se guarda en cuanto lo marca.',
  'rec.bloodlineFailed': 'No se pudo cambiar eso.',
  'rec.connectionsHint': 'A quién está vinculada esta persona. Un matrimonio se puede renombrar; el resto son las relaciones que alguien registró.',
  'proj.bloodlineEmptyNote': 'Nadie debe esto: su familia no ha marcado a nadie como perteneciente a su linaje, así que no hay a quién cobrar. Marque {control} en el árbol familiar.',
  'gal.fileTooLarge': '{name} pesa más de 10 MB.',
  'gal.albumGoneFilesLeftOne':
    'El álbum se ha ido, pero 1 de sus archivos de imagen no se pudo quitar del almacenamiento. Ya no aparece en ninguna lista; avise a un administrador para que lo limpie.',
  'gal.albumGoneFilesLeftMany':
    'El álbum se ha ido, pero {n} de sus archivos de imagen no se pudieron quitar del almacenamiento. Ya no aparecen en ninguna lista; avise a un administrador para que los limpie.',
  'jrn.firstNoteNotSaved': 'la primera nota no se guardó',
  'jrn.entryCreatedPartial': 'La entrada se creó, pero {what}. Ábrala y añada lo que falta.',
  'meet.secretaryUnderEighteen':
    '{name} tiene menos de dieciocho años. El acta la tiene que tomar un adulto.',
  'meet.guestUnderEighteenOne':
    '{name} tiene menos de dieciocho años. Solo se pueden añadir adultos a una reunión por nombre.',
  'meet.guestUnderEighteenMany':
    '{names} tienen menos de dieciocho años. Solo se pueden añadir adultos a una reunión por nombre.',
  'fam.alreadyBelongTo': 'Ya pertenece a {family}.',
  'fam.requestStillAwaiting': 'Su solicitud para unirse a {family} sigue esperando aprobación.',
  'reg.invitationSentToAddress':
    'Esta invitación se envió a {email}. Regístrese con esa dirección.',
  'safety.requeuedOne': 'Se preguntará de nuevo a 1 familiar',
  'safety.requeuedMany': 'Se preguntará de nuevo a {n} familiares',
  'sms.confirmationBody':
    'Su código de confirmación de {app} es {code}. Caduca en {minutes} minutos.',
  'sms.codeSentToEnding': 'Código enviado al número que termina en {last4}.',
  'stf.noAccountUses':
    'Ninguna cuenta usa {email}. Tiene que registrarse antes de que se le pueda conceder acceso.',
  'stf.reasonTooLong': 'Mantenga el motivo por debajo de {max} caracteres',
  'stf.alreadyHasAccess': '{email} ya tiene acceso de personal. Cambie su acceso en su fila.',
  'drives.pastTheGoal': '{amount} por encima del objetivo',
  'drives.fromYou': '{amount} de su parte',
  'drives.raisedAmount': '{amount} recaudados',
  'plan.nextDuePrefix': 'Próximo vencimiento',
  'fnd.shareOfDues': '{percent} de las cuotas',
  'fnd.ofMinimum': 'de {amount} mínimo',
  'fnd.minimumBalanceIs': ' Saldo mínimo {amount}.',
  'fnd.shareOfDuesPrefix': 'Parte de las cuotas',
  'fnd.paidFromPrefix': 'Pagado desde',
  'drives.giveTo': 'Aportar a {label}',
  'drives.wouldMeetGoal': '{amount} alcanzaría el objetivo: aporte lo que quiera.',
  'plan.paymentsRecordedOne': '1 pago registrado',
  'plan.paymentsRecordedMany': '{n} pagos registrados',
  'access.runMigrations':
    '{lede} Ejecute las migraciones en supabase/migrations. Hasta entonces el acceso recae en la antigua bandera is_admin y nada de lo que se cambie aquí surte efecto.',
  'access.regionsChaptersNational': 'Regiones, capítulos y Nacional',
  'appr.invitedBy': 'Invitado por {name}',
  'appr.expiresOn': 'caduca el {date}',
  'agat.reopenConfirm':
    '¿Reabrir «{task}» en {gathering}? Vuelve a {who}, que podrá cambiar la respuesta y enviarla de nuevo. No se borra nada: su respuesta queda en la tarea como punto de partida y todos los envíos quedan en el registro.',
  'tmpl.noneYet': 'Todavía no hay plantillas de reunión.',
  'agat.noneYet': 'Todavía no hay reuniones.',
  'bill.cardFailingSince':
    'Un pago con tarjeta está fallando desde el {date}. Nada ha cambiado sobre lo que esta familia puede usar. Actualice la tarjeta en {where} y Stripe volverá a intentarlo.',
  'elec.waitingToBeAnswered': '{n} esperando respuesta',
  'elec.votingClosedRange': 'La votación cerró {range}.',
  'elec.snapshotWhileOpen':
    'Una instantánea mientras la votación está abierta: nada de aquí es definitivo hasta que cierre.',
  'pos.noPositionYet': 'Todavía sin cargo.',
  'mpe.saveConfirm': '¿Guardar los cambios en el perfil de {name}? No se le notifica.',
  'mpe.chapterNotSaved': 'El perfil se guardó, pero el capítulo no: {reason}',
  'mpe.chapterCouldNotBeSet': 'no se pudo establecer ese capítulo.',
  'mpe.emailResetLede': '¿Enviar a {name} un enlace para elegir una nueva contraseña? ',
  'login.stillNothing': '¿Todavía nada?',
  'reg.startsOnFreeNote':
    '{lede} Free. No se ha cobrado nada: inicie sesión y {app} le pedirá configurar {plan}.',
  'reg.nothingChargedNow':
    'Ahora no se cobra nada. Cuando su familia exista se le pedirá configurar el pago de {plan}, y puede quedarse en Free en su lugar.',
  'law.addedBy': '· añadido por {name}',
  'law.notADocumentFormat': 'Eso no es {formats}. Elija otro archivo.',
  'cal.nothingInMonth': 'No hay nada en el calendario en {month}.',
  'cal.whatIsOnCaption': 'Qué hay en {month}, una columna por día de la semana.',
  'chat.deleteConversationConfirm':
    '¿Eliminar su conversación con {name}? Los mensajes se quitan y no se pueden recuperar.',
  'chat.selectedOne': '1 miembro seleccionado',
  'chat.selectedMany': '{n} miembros seleccionados',
  'chat.addToGroupConfirm': '¿Añadir a {name} a «{group}»? Podrá leer la conversación.',
  'chat.removeFromGroupConfirm':
    '¿Quitar a {name} de «{group}»? Pierde el acceso a la conversación.',
  'chat.deleteConversationAria': 'Eliminar la conversación con {name}',
  'cns.onlyOwnAccount':
    '{lede} Solo se usan los datos de su propia cuenta, y solo para relacionar esta visita con un anuncio.',
  'dash.chapter.theSelected': 'el capítulo seleccionado',
  'dash.chapter.confirm':
    '¿Establecer su capítulo como {chapter}? Los hijos o hijas menores de 18 años sin cuenta propia se mueven con usted.',
  'drives.moreOpenOne': 'Hay 1 colecta más abierta.',
  'drives.moreOpenMany': 'Hay {n} colectas más abiertas.',
  'dash.link.confirm':
    '¿Vincular el registro de {name} a su cuenta? Su historial pasa a ser el suyo, y esto no se puede deshacer.',
  'dash.finishPayingFor': 'Termine de pagar {plan}',
  'dash.tasksApprovedOne': '{approved} de 1 tarea aprobada',
  'dash.tasksApprovedMany': '{approved} de {total} tareas aprobadas',
  'dash.raisedBy': 'Iniciado por {name}',
  'dist.noDraftToComeBack':
    'Esto se envía por correo de inmediato. No hay borrador al que volver.',
  'docs.deleteNamedBody':
    '¿Eliminar «{name}»? El archivo se quita para todos. Esto no se puede deshacer.',
  'proj.yearFromPrefix': 'Año desde',
  'proj.payingCount': '{n} pagando',
  'proj.helpWhoCounted': 'Ayuda: quién se cuenta en estas cifras',
  'tree.otherChildren': 'Otros hijos',
  'tree.otherChildrenEmpty': 'Aquí aparecen los hijos cuyo otro progenitor no está registrado.',
  'upg.partOfPlan': 'Parte de {plan}',
  'upg.everythingOnComesWith': 'Todo lo de {plan} viene incluido.',
  'upg.noAnnualNoContract': '. Sin plan anual, sin contrato.',
  'upg.notOnSaleYet': ' Todavía no está a la venta; hoy no se cobra nada.',
  'gath.answerInDollars': '{label}, en dólares',
  'gath.answerOnePerLine': '{label}, un elemento por línea',
  'gath.needAnotherLook': '{n} necesitan otra revisión',
  'gath.noTaskMatchesOne': 'Ninguna tarea coincide con lo que busca. Hay 1 tarea en esta reunión.',
  'gath.noTaskMatchesMany':
    'Ninguna tarea coincide con lo que busca. Hay {n} tareas en esta reunión.',
  'gath.dateWithNoTasks': 'Esto será una fecha en el calendario de la familia sin tareas.',
  'gath.allApprovedOne': 'La única tarea está aprobada',
  'gath.allApprovedMany': 'Las {n} tareas aprobadas',
  'hlp.tierBadgeBody':
    'Esto está incluido en el plan {plan}, y su familia está en uno inferior. Todo lo de abajo es exacto: la pantalla simplemente ofrece mejorar en lugar de abrirse.',
  'hlp.permissionBadgeBody':
    'Su plantilla de permisos no incluye esta pantalla, así que al abrirla dirá que no se encuentra la página. Un administrador de su familia puede cambiarlo desde Miembros.',
  'inv.joinOnceApproved': 'Se unirá a {family} cuando un administrador le apruebe.',
  'account.menuFor': 'Menú de cuenta de {name}',
  'switcher.viewingClickToSwitch': 'Viendo {family}: pulse para cambiar de familia',
  'hlp.comingSoonBadgeBody':
    'Esta parte del producto todavía no se ha lanzado. El capítulo describe lo que hará; abrir la pantalla hoy muestra un aviso de Próximamente.',
  'dash.profile.body':
    'Sus familiares le encuentran en el Directorio de miembros, y todavía no hay mucho ahí. Añada {missing}.',
  'idle.warningBody': 'Ha estado inactivo un rato, así que vamos a cerrar su sesión.',
  'idle.signingOutIn': 'Cerrando sesión en',
  'notify.waitingApprovalOne': '1 persona espera aprobación',
  'notify.waitingApprovalMany': '{n} personas esperan aprobación',
  'notes.aFormerOfficer': 'un cargo anterior',
  'notes.startedByOn': 'Iniciado por {name} · {date}',
  'meet.ofInTheRoom': 'de {n} en la sala',
  'meet.voteFinalBody':
    'Su voto sobre «{topic}» queda registrado a su nombre y nadie puede cambiarlo ni retirarlo.',
  'meet.voteChoice': 'Votar {choice}',
  'dir.shownOfTotalOne': '{shown} de 1 miembro',
  'dir.shownOfTotalMany': '{shown} de {total} miembros',
  'rem.familyRemovedHeading': '{family} ha sido eliminada',
  'rem.switchWithMenu': 'Cambie con el menú de familia en la parte superior de la página, o desde',
  'rem.stillOpenToYou': 'sigue abierto para usted, igual que el',
  'rem.manual': 'manual',
  'pend.welcomeBack': '¡Bienvenido de nuevo, {name}!',
  'fam.adminMustApprove':
    'Un administrador de {family} tiene que aprobarle antes de que pueda ver algo dentro. Los datos de su perfil se comparten en todas las familias a las que pertenece.',
  'fam.yesJoin': 'Sí, unirme a {family}',
  'fam.openByDefault': '¿Abrir {family} por defecto al iniciar sesión?',
  'profile.photo.replaceConfirm':
    '¿Reemplazar su foto de perfil con «{name}»? Se quita su foto actual.',
  'profile.photo.setConfirm': '¿Usar «{name}» como su foto de perfil?',
  'profile.selectedChapter': 'seleccionado',
  'profile.confirm.chapterBody':
    '¿Guardar los cambios y pasar al capítulo {chapter}? Los hijos o hijas menores de 18 años sin cuenta propia se mueven con usted.',
  'sec.codeSentExpires': 'Enviamos un código de 8 dígitos a {email}. Caduca en una hora.',
  'rep.nothingToShowAria': '{label}: todavía nada que mostrar',
  'rep.everyUnitCount':
    'Cada recuento de {unit} en este desglose, incluidos los que el gráfico agrupa. ',
  'safety.relativeOne': '1 familiar',
  'safety.relativesMany': '{n} familiares',
  'safety.withNoEmail': ', {n} sin correo',
  'safety.willBeAskedOne': 'Se preguntará a 1 familiar.',
  'safety.willBeAskedMany': 'Se preguntará a {n} familiares.',
  'safety.noEmailPhoneOne':
    '1 de ellos no tiene dirección de correo registrada, así que alguien tendrá que llamarle.',
  'safety.noEmailPhoneMany':
    '{n} de ellos no tienen dirección de correo registrada, así que alguien tendrá que llamarles.',
  'staff.accessForAria': 'Acceso de {name}',
  'staff.revokeAccessAria': 'Revocar el acceso de personal de {name}',
  'staff.neverRegistered':
    '{lede} Nadie lo ha registrado nunca. Si se le invitó, la invitación está abajo.',
  'staff.noAddressMatches': 'Ninguna dirección de esta página contiene «{query}».',
  'staff.never': 'nunca',
  'staff.restoreBody':
    '{code} vuelve a ser accesible de inmediato: sus miembros pueden iniciar sesión, su código de familia funciona y sus invitaciones se resuelven. No se eliminó nada cuando se quitó, así que todos sus registros vuelven con ella.',
  'staff.noFamilyMatches': 'Ninguna familia coincide con «{query}».',
  'cf.confirmWithPassword': 'Confirme con su contraseña',
  'cf.sixDigitsEmailed':
    'Los seis dígitos que enviamos a {email}. Se puede usar una vez, y cinco intentos erróneos lo cancelan.',
  'pp.nobodyElseYet': 'Todavía nadie más en la familia.',
  'pp.moreMatchKeepTyping': '{n} más coinciden: siga escribiendo',
  'time.yourTime': '{time} su hora',
  'upd.announcementsNotIncluded':
    'Esta lista es lo que se le ha enviado. Los avisos de la familia no se incluyen, porque su familia no le ha dado el tablón: consulte',
  'upd.showOlder': 'Mostrar {n} más antiguos',
  'act.relativeHasDied':
    'Ese familiar ha fallecido, así que no hay cumpleaños que celebrar.',
  'gath.daysFromOne': '1 día desde el {date}',
  'gath.daysFromMany': '{n} días desde el {date}',
  'access.membersOnCardOne': '1 miembro',
  'access.membersOnCardMany': '{n} miembros',
  'chat.participantsOne': '1 miembro',
  'chat.participantsMany': '{n} miembros',
  'dues.schedulesOne': '1 plan',
  'dues.schedulesMany': '{n} planes',
  'gath.seriesTwo': '{first} y {second}',
  'gath.seriesOneAndMore': '{first} y {n} más',
  'gath.seriesTwoAndMore': '{first}, {second} y {n} más',
  'dues.requiredWord': 'obligatorio',
  'dues.optionalWord': 'opcional',
  'fnd.balanceWord': 'saldo',
  'col.schedule': 'Plan',
  'col.member': 'Miembro',
  'col.status': 'Estado',
  'col.date': 'Fecha',
  'col.actions': 'Acciones',
  'field.chapterLabel': 'Capítulo',
  'cal.todaySrOnly': ' — hoy',
  'cal.goToMonth': 'Ir a {month}',
  'bill.monthsSuffix': ' · {n} meses',
  'hlp.planBadge': 'plan {plan}',
  'hlp.badgeComingSoon': 'Próximamente',
  'hlp.badgeNotInAccess': 'Fuera de su acceso',
  // ── TIME ZONES ─────────────────────────────────────────────────────────────
  // Keyed on the IANA name, which is what `people.time_zone` stores — see
  // `timezoneLabel` in lib/date-utils.ts. The bracketed abbreviations are the ones
  // a speaker of each language actually uses, so ET is HE in French and stays ET in
  // Spanish; they are not a translation of the letters.
  'tz.America/New_York': 'Hora del Este (ET)',
  'tz.America/Chicago': 'Hora Central (CT)',
  'tz.America/Denver': 'Hora de la Montaña (MT)',
  'tz.America/Phoenix': 'Hora de la Montaña – Arizona (sin horario de verano)',
  'tz.America/Los_Angeles': 'Hora del Pacífico (PT)',
  'tz.America/Anchorage': 'Hora de Alaska (AKT)',
  'tz.Pacific/Honolulu': 'Hora de Hawái (HT)',
  'tz.America/Toronto': 'Este – Canadá',
  'tz.America/Vancouver': 'Pacífico – Canadá',
  'tz.America/Halifax': 'Atlántico – Canadá',
  'tz.America/St_Johns': 'Terranova – Canadá',
  'tz.Europe/London': 'Londres (GMT/BST)',
  'tz.Europe/Paris': 'París (CET/CEST)',
  'tz.Europe/Berlin': 'Berlín (CET/CEST)',
  'tz.Africa/Lagos': 'África Occidental (WAT)',
  'tz.Africa/Johannesburg': 'Sudáfrica (SAST)',
  'tz.Asia/Dubai': 'Hora del Golfo (GST)',
  'tz.Asia/Kolkata': 'India (IST)',
  'tz.Asia/Tokyo': 'Japón (JST)',
  'tz.Asia/Shanghai': 'China (CST)',
  'tz.Australia/Sydney': 'Sídney (AEST/AEDT)',
  'tz.Pacific/Auckland': 'Nueva Zelanda (NZST/NZDT)',

  // ── DOCUMENT TITLES, 2026-08-31 ────────────────────────────────────────────
  // The browser TAB, which is not always the <h1>: a tab has no rail above it to say
  // where it is, so thirteen of these disambiguate against a sibling route. Every other
  // screen's tab reuses its own `page.<route>.title` and so cannot drift from its
  // heading — see `lib/i18n/page-metadata.ts` for why that is one key and not two, and
  // for the measurement that retired the note below.
  'doc./admin/accounting.title': 'Contabilidad — Administración',
  'doc./admin/elections.title': 'Elecciones — Administración',
  'doc./admin/elections/[id].title': 'Elección',
  'doc./admin/gatherings.title': 'Reuniones — Administración',
  'doc./admin/gatherings/[id].title': 'Reunión — Administración',
  'doc./community/elections/[id].title': 'Elección',
  'doc./community/gallery/[id].title': 'Álbum',
  'doc./gatherings/[id].title': 'Reunión',
  'doc./library/meeting-minutes/[id].title': 'Reunión',
  'doc./reporting/board.title': 'Informe de junta y cargos',
  'doc./reporting/elections.title': 'Informe de elecciones',
  'doc./reporting/gatherings.title': 'Informe de reuniones',
  'doc./reporting/meetings.title': 'Informe de reuniones de junta',
  'doc./community/distributions.title': 'Distribuciones',
  'doc./community/gallery.title': 'Galería',
  'doc./community/safety-check-ins.title': 'Comprobaciones de seguridad',
  'doc./library/bylaws.title': 'Estatutos',
  'doc./library/meeting-minutes.title': 'Actas de reuniones',
  'doc./dashboard.title': 'Panel',
  'doc./update-password.title': 'Elija una nueva contraseña',
  'doc./invite.title': 'Invitación',
  // ── THE STAFF CONSOLE'S HEADINGS, 2026-08-31 ───────────────────────────────
  // Four of these were bare JSX literals, which the prose gate cannot see.
  'page./staff.title': 'Consola de personal de {app}',
  'page./staff/access.title': 'Acceso',
  'page./staff/accounts.title': 'Cuentas',
  'page./staff/families.title': 'Familias',
  // ── PAGE HEADINGS ────────────────────────────────────────────────────────────────
  // The same words as the rail for most screens, and kept as separate keys for the reason
  // `en.ts` gives. *Reuniones* / *Juntas* divides here exactly as it does above.
  'page./accounting/dues-and-donations.title': 'Cuotas y donaciones',
  'page./accounting/summary.title': 'Resumen',
  'page./reporting/transactions.title': 'Transacciones',
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
  'page./accounting/payment-history.title': 'Historial de pagos',
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
  'dash.plan.explain':
    '**{pay}** lo lleva a Stripe para pagar cada mes, empezando por lo que resta de este mes. '
    + '**{cancel}** descarta el plan y deja a su familia en Gratis: no se cobra nada en ningún '
    + 'caso, y puede contratarlo después. ',
  'dash.safety.titleMany': 'Su familia pregunta si está a salvo ({n} avisos)',
  'dash.tree.manyLeaves':
    '{n} hojas sueltas: miembros que aún no están conectados con nadie en el árbol.',

  // ── FORM FIELD LABELS, SHARED ACROSS EVERY FORM ──────────────────────────────────
  // See `en.ts`. Two notes on the choices below:
  //
  //   *Apellido*, singular, for `field.lastName`. Latin American forms usually ask for one
  //   surname box even where two surnames are normal, and this product has one column.
  //
  //   *Correo electrónico* rather than *Email* on the LABEL, and *Email* would also be
  //   understood — the label is the formal one because it sits beside *Teléfono*.
  'field.prefix': 'Título',
  'field.firstName': 'Nombre',
  'field.middleName': 'Segundo nombre',
  'field.lastName': 'Apellido',
  'field.nickname': 'Apodo',
  'field.suffix': 'Sufijo',
  'field.email': 'Correo electrónico',
  'field.phone': 'Teléfono',
  'field.gender': 'Género',
  'field.country': 'País',
  'field.street': 'Dirección',
  'field.apartment': 'Departamento / Suite',
  'field.city': 'Ciudad',
  'field.state': 'Estado',
  'field.province': 'Provincia',
  'field.stateProvince': 'Estado / Provincia',
  'field.zip': 'Código postal',
  'field.dob': 'Fecha de nacimiento',
  'field.sunset': 'Fecha de fallecimiento',
  'field.chapter': 'Capítulo',
  'field.timeZone': 'Zona horaria',
  'field.language': 'Idioma',
  'field.tshirt': 'Camiseta',
  'field.tshirtCategory': 'Categoría de camiseta',
  'field.tshirtSize': 'Talla de camiseta',
  'field.ph.nickname': 'p. ej. Miguelón',
  'field.ph.email': 'usted@ejemplo.com',
  'field.ph.phone': '(555) 000-0000',
  'field.ph.street': 'Av. Principal 123',
  'field.ph.apartment': 'Depto. 4B',
  'field.ph.city': 'Monterrey',
  'field.ph.zip': '64000',
  'action.cancel': 'Cancelar',
  'action.edit': 'Editar',
  'action.saving': 'Guardando…',
  'action.saveChanges': 'Guardar cambios',
  'action.notSet': 'Sin definir',
  'profile.section.general': 'General',
  'profile.section.address': 'Dirección',
  'profile.section.additional': 'Información adicional',
  'profile.section.notifications': 'Notificaciones',
  'profile.section.security': 'Inicio de sesión y seguridad',
  'profile.rail': 'Secciones de mi perfil',
  'profile.editSection': 'Editar {section}',
  'profile.photo.upload': 'Subir foto de perfil',
  'profile.photo.replaceLong': 'Cambiar la foto de perfil',
  'profile.photo.setLong': 'Poner una foto de perfil',
  'profile.photo.replace': 'Cambiar la foto',
  'profile.photo.set': 'Poner una foto',
  'profile.photo.failed': 'No se pudo usar esa foto',
  'profile.living': 'Con vida',
  'profile.sunsetHint': 'Déjelo en blanco si la persona vive.',
  'profile.sizeFirst': 'Elija primero una categoría.',
  'profile.noChapters': 'Esta familia no tiene capítulos, así que no hay nada que elegir.',
  'profile.inThisFamily': 'En esta familia',
  'profile.firstNameRequired': 'El nombre es obligatorio',
  'profile.lastNameRequired': 'El apellido es obligatorio',
  'profile.wentWrong': 'Algo salió mal',
  'profile.chapterNotChanged': 'Sus datos se guardaron, pero no se pudo cambiar el capítulo.',
  'profile.confirm.general': 'Guardar la información general',
  'profile.confirm.generalBody': '¿Guardar los cambios en su información general?',
  'profile.confirm.address': 'Guardar la dirección',
  'profile.confirm.addressBody': '¿Guardar los cambios en su dirección?',
  'profile.confirm.additional': 'Guardar la información adicional',
  'profile.confirm.additionalBody': '¿Guardar los cambios en su información adicional?',
  'action.save': 'Guardar',
  'profile.inFamily': 'En {family}',

  // ── NOTIFICATIONS AND SIGN-IN & SECURITY ─────────────────────────────────────────
  // *Aviso de seguridad* for the safety check row, matching `dash.safety.*` and the mail: never
  // *alerta*, because the product does not claim anything is happening — a relative asked.
  'notify.channel.email': 'Correo',
  'notify.channel.sms': 'SMS',
  'notify.channel.push': 'Notificación push',
  'notify.type.safety_check.label': 'Aviso de seguridad',
  'notify.type.safety_check.description':
    'Su familia levanta un aviso durante una tormenta, una evacuación o una emergencia, y '
    + 'pregunta si está a salvo.',
  'notify.colNotification': 'Notificación',
  'notify.notBuilt': 'Próximamente',
  'notify.stopped': 'Detenido',
  'notify.on': 'Activado',
  'notify.off': 'Desactivado',
  'notify.toggleLabel': '{channel} para {notification}',
  'notify.noneOnFile': 'No hay ninguno registrado',
  'notify.placeholderAddress': 'Una dirección generada: nada puede llegar ahí',
  'notify.fromGeneral':
    'Estos vienen de sus datos **generales**: cámbielos ahí y todas las notificaciones lo '
    + 'siguen.',
  'notify.failed': 'Eso no funcionó',
  'notify.noEmail':
    'No tenemos ninguna dirección de correo que pueda alcanzarlo, así que nada marcado para '
    + 'Correo va a llegar. Agregue una en **General**.',
  'notify.stoppedNote':
    'Respondió **STOP** a uno de nuestros mensajes de texto, así que no podemos volver a '
    + 'escribir a ese número, y no podemos reactivarlo desde aquí: es una regla que impone su '
    + 'operadora, no un ajuste que tengamos. Escriba **START** al número que le mandó el mensaje '
    + 'si quiere recibirlos de nuevo.',
  'notify.smsNotOn':
    'Los mensajes de texto todavía no están activados. Puede registrar su preferencia ahora y '
    + 'la usaremos en cuanto lo estén.',
  'notify.noMobile':
    'No tenemos su número de celular, así que nada marcado para SMS va a llegar. Agregue uno en '
    + '**General**.',
  'notify.willConfirm':
    'Confirmaremos su número de celular con un código antes de enviarle cualquier mensaje.',
  'security.email.title': 'Correo de inicio de sesión',
  'security.email.lede':
    'La dirección con la que inicia sesión. Es distinta del correo de contacto de su perfil: '
    + 'cambiar una no cambia la otra.',
  'security.currently': 'Actualmente ',
  'security.newEmail': 'Nueva dirección de correo',
  'security.sending': 'Enviando…',
  'security.sendConfirmation': 'Enviar confirmación',
  'security.badEmail': 'Escriba una dirección de correo válida',
  'security.sameEmail': 'Esa ya es su dirección de inicio de sesión',
  'security.password.title': 'Contraseña',
  'security.password.lede':
    'Para cambiarla hacen falta su contraseña actual y un código corto que le enviamos por '
    + 'correo. Sus otros dispositivos quedan desconectados después.',
  'security.sendingCode': 'Enviando el código…',
  'security.changePassword': 'Cambiar la contraseña',
  'security.code': 'Código de su correo',
  'security.currentPassword': 'Contraseña actual',
  'security.newPassword': 'Contraseña nueva',
  'security.confirmPassword': 'Confirme la contraseña nueva',
  'security.savePassword': 'Guardar la contraseña nueva',
  'security.needCode': 'Escriba el código de su correo',
  'security.needCurrent': 'Escriba su contraseña actual',
  'security.tooShort': 'La contraseña nueva debe tener al menos 8 caracteres',
  'security.noMatch': 'Las contraseñas nuevas no coinciden',
  'security.samePassword': 'Esa ya es su contraseña. Elija otra.',
  'security.wrongCurrent': 'Esa no es su contraseña actual.',
  'security.ph.minChars': 'Mín. 8 caracteres',

  // ── THE MEMBER'S MONEY SCREENS ───────────────────────────────────────────────────
  // *Cuota* for a due and *abono* for an installment, which is the distinction §7c needs: a
  // *cuota* is what is owed and an *abono* is one payment against it. *Pago* is kept for the
  // act of paying.
  'money.amount': 'Monto',
  'money.total': 'Total',
  'money.remaining': 'Restante',
  'money.paid': 'Pagado',
  'money.status': 'Estado',
  'money.method': 'Método',
  'money.date': 'Fecha',
  'money.schedule': 'Programa',
  'money.actions': 'Acciones',
  'money.member': 'Integrante',
  'money.fund': 'Fondo',
  'money.fromTo': 'De',
  'money.pastDue': 'Vencida',
  'money.dueNow': 'A pagar ahora',
  'money.notYetDue': 'Aún no vence',
  'money.declined': 'Rechazada',
  'money.income': 'Ingresos',
  'money.expenses': 'Gastos',
  'money.donation': 'Donación',
  'money.close': 'Cerrar',
  'money.opening': 'Abriendo…',
  'pnl.lede': 'Desde el inicio · cada movimiento que la familia ha registrado',
  'pnl.duesAndDonations': 'Cuotas y donaciones',
  'pnl.direct': 'Aportaciones directas',
  'pnl.netLine': 'Ingresos menos gastos',
  'pnl.routedHeading': 'Ingresos asignados a fondos',
  'pnl.nothingRouted': 'Todavía no se ha asignado nada a los fondos.',
  'pnl.balancesToday': 'Saldos de los fondos hoy',
  'pnl.nothingPaidOut': 'Todavía no se ha pagado nada',
  'pnl.disbursed': 'Pagado desde los fondos de la familia',
  'pnl.disbursements': 'Pagos',
  'pnl.processingFees': 'Comisiones por tarjeta',
  'pnl.surplus': 'Superávit neto',
  'pnl.deficit': 'Déficit neto',
  'pnl.routedBeyond': 'Asignado más allá de los ingresos por cuotas',
  'pnl.notYetRouted': 'Recaudado, aún sin asignar a un fondo',
  'pnl.allRouted': 'Cada pago de cuotas se ha asignado a un fondo.',
  'pnl.overRouted':
    'Ha entrado más a los fondos de lo que trajeron las cuotas: las aportaciones directas '
    + 'cubren la diferencia.',
  'pnl.unrouted':
    'Las cuotas cobradas con un programa sin regla de asignación se quedan aquí hasta que se '
    + 'configure una en Contabilidad.',
  'drives.goalMet': 'Meta cumplida',
  'drives.closed': 'Cerrada',
  'drives.noGoal': 'Sin meta: dé lo que quiera.',
  'drives.none': 'Su familia no tiene ninguna campaña de donación en este momento.',
  'drives.rail': 'Cuotas y donaciones',
  'drives.give': 'Donar',
  'drives.giveByCard': 'Donar con tarjeta',
  'drives.giveHint':
    'Se paga con tarjeta directamente a su familia. Entra en sus libros en cuanto se '
    + 'acredita.',
  'drives.giveAnything': 'Dé lo que quiera. No hay una cantidad fija.',
  'drives.needAmount': 'Escriba una cantidad para donar.',
  'plan.noSchedules':
    'No está en ningún programa de cuotas: su familia no ha configurado ninguno para usted.',
  'plan.required': 'Cuotas obligatorias',
  'plan.optional': 'Cuotas opcionales',
  'plan.nextPayment': 'Próximo pago',
  'plan.nextDue': 'Próximo vencimiento',
  'plan.thisDue': 'Esta cuota',
  'plan.whatYouPayNow': 'Lo que paga ahora',
  'plan.payCadence': 'Plan de pago',
  'plan.changeCadence': 'Cambiar la frecuencia de pago',
  'plan.pickCadence': 'Elija una frecuencia de pago para configurar los pagos automáticos.',
  'plan.setUpAuto': 'Configurar pagos automáticos',
  'plan.stopAuto': 'Detener los pagos automáticos',
  'plan.stopAutoConfirm': '¿Detener los pagos automáticos?',
  'plan.stopPayments': 'Detener los pagos',
  'plan.cadenceFailed': 'No se pudo cambiar la frecuencia',
  'plan.changeFailed': 'No se pudo cambiar eso',
  'plan.optOut': 'Rechazar',
  'plan.optBackIn': 'Volver a aceptar',
  'plan.optionalHint':
    'Esta cuota es opcional, así que puede rechazarla. Dejará de contar en lo que debe, y '
    + 'puede volver a aceptarla cuando quiera.',
  'plan.allSettled': 'No hay nada pendiente: cada cuota está pagada o rechazada.',
  'plan.calendarAsked': 'Lo que el calendario ha pedido, incluido lo que falta por poner al día.',
  'plan.needAmount': 'Escriba una cantidad para pagar.',
  'plan.pay': 'Pagar',
  'plan.payByCard': 'Pagar con tarjeta',
  'plan.oneAcross':
    'Un solo pago para todas las cuotas de abajo. Ponga una en cero para dejarla fuera.',
  'plan.straightToFamily':
    'Se paga directamente a su familia. Entra en sus libros en cuanto se acredita.',
  'plan.whyDiffers': 'Por qué el próximo pago puede ser distinto del abono',
  'funds.title': 'Fondos de la familia',
  'funds.manage': 'Administrar los fondos',
  'funds.none': 'Todavía no hay fondos configurados.',
  'cards.noUpcoming': 'No hay cuotas próximas',
  'cards.paidThisYear': 'Pagado este año',
  'cards.generalPayment': 'Pago general',
  'cards.noPayments': 'No hay pagos registrados',
  'cards.remainingBalance': 'Saldo pendiente',
  'cards.noSchedules': 'No hay programas de cuotas configurados.',
  'cards.viewDues': 'Ver las cuotas',
  'cards.requiredPaid': 'Todas las cuotas obligatorias pagadas',
  'cards.allPaid': 'Todas las cuotas pagadas. ¡Gracias!',
  'history.none': 'Todavía no hay historial de pagos.',
  'history.noMatches': 'No hay pagos que coincidan.',
  'history.filter': 'Filtrar el historial de pagos',
  'history.filterPh': 'Filtrar…',
  'history.duesPayment': 'Pago de cuotas',
  'history.donationPayment': 'Pago de donación',
  'history.paymentMethod': 'Método de pago',
  'history.processingFee': 'Comisión por procesamiento de tarjeta',
  'history.reference': 'N.º de cheque / Referencia',
  'history.recorded': 'Registrado',
  'history.reversed': 'Revertido',
  'history.reversedYes': 'Sí: un movimiento de corrección cancela este pago',
  'history.corrects': 'Corrige',
  'history.correctsWhat': 'Un pago anterior de este historial',
  'history.notes': 'Notas',
  'history.correctingEntry': '{kind}: movimiento de corrección',
  'payStatus.paid': 'Pagado',
  'payStatus.waived': 'Exonerado',
  'payStatus.pending': 'Pendiente',

  // ── SHARED CONTROLS AND THE LIBRARY SECTION ──────────────────────────────────────
  // *Acta* is a meeting's minutes and *nota* is one entry in an officer's notebook — the two
  // must not swap, because the section holds both.
  'action.delete': 'Eliminar',
  'action.post': 'Publicar',
  'action.close': 'Cerrar',
  'action.rename': 'Cambiar el nombre',
  'action.download': 'Descargar',
  'action.upload': 'Subir',
  'action.uploading': 'Subiendo…',
  'action.search': 'Buscar',
  'action.clear': 'Limpiar',
  'action.chooseFile': 'Elija un archivo',
  'action.posting': 'Publicando…',
  'action.loading': 'Cargando…',
  'field.title': 'Título',
  'field.name': 'Nombre',
  'field.message': 'Mensaje',
  'field.descriptionOptional': 'Descripción (opcional)',
  'field.audience': 'Destinatarios',
  'common.category': 'Categoría',
  'common.all': 'Todas',
  'common.size': 'Tamaño',
  'common.day': 'Día',
  'common.today': 'Hoy',
  'common.tomorrow': 'Mañana',
  'common.yesterday': 'Ayer',
  'common.nothingMatches': 'No hay coincidencias',
  'ann.pane.general': 'General',
  'ann.pane.updates': 'Novedades',
  'ann.pane.birthdays': 'Cumpleaños',
  'ann.rail': 'Áreas de anuncios',
  'ann.lede.general':
    'Noticias de toda su familia. Las publicaciones fijadas van arriba en las Novedades de '
    + 'todos hasta que cada persona las descarta.',
  'ann.lede.birthdays':
    'Solo se muestran los próximos {days} días, primero los más cercanos: un cumpleaños más '
    + 'lejano aparece aquí en cuanto entra en los {days} días.',
  'ann.none': 'Todavía no hay anuncios.',
  'ann.deleteTitle': 'Eliminar el anuncio',
  'ann.deleteFailed': 'No se pudo eliminar ese anuncio.',
  'ann.unpinAll': 'Dejar de fijarlo para todos',
  'ann.pinAll': 'Fijarlo para todos',
  'ann.pinFailed': 'No se pudo cambiar eso.',
  'ann.pinnedRides': 'Fijado para la familia: va arriba en sus novedades.',
  'ann.pinnedHidden':
    'Fijado para la familia: usted lo ha ocultado de la parte superior de sus novedades.',
  'ann.openElection': 'Abrir esta elección',
  'ann.new.prompt': 'Comparta un anuncio con su familia…',
  'ann.new.heading': 'Nuevo anuncio',
  'ann.new.titlePh': 'Novedades de la reunión',
  'ann.new.bodyPh': '¿Qué le gustaría compartir?',
  'ann.new.pin': 'Fijarlo arriba en las Novedades de todos',
  'ann.new.unpinOn': 'Dejar de fijarlo el',
  'ann.new.wholeFamily': 'Toda la familia',
  'ann.new.wholeFamilyHint': 'Todos en la familia lo verán',
  'ann.new.region': 'Región',
  'ann.new.regionHint': 'Se muestra a su región',
  'ann.new.chapterHint': 'Se muestra a un capítulo concreto',
  'ann.new.needBoth': 'Agregue un título y un mensaje.',
  'ann.new.needChapter': 'Elija a qué capítulo avisar.',
  'ann.new.failed': 'No se pudo publicar',
  'ann.new.submit': 'Publicar el anuncio',
  'bday.countdown': 'Faltan',
  'bday.turning': 'Cumple',
  'bday.searchLabel': 'Buscar cumpleaños por nombre',
  'bday.searchPh': 'Buscar por nombre…',
  'upd.searchPh': 'Buscar en títulos y mensajes…',
  'upd.searchLabel': 'Buscar novedades',
  'upd.unread': 'Sin leer',
  'upd.wholeWords': 'Palabras completas, en cualquier orden: se busca',
  'upd.readFailed':
    'Algo salió mal al leer sus novedades, así que esta lista puede estar incompleta. '
    + 'Inténtelo de nuevo en un momento.',
  'upd.empty':
    'Todavía nada. Los anuncios que publique su familia y todo lo que se le envíe aparecerán '
    + 'aquí.',
  'upd.kindAnnouncement': 'Anuncio',
  'upd.kindSentToYou': 'Enviado a usted',
  'notes.new': 'Nuevo tema',
  'notes.journalFor': 'El cuaderno de',
  'notes.everyoneHolding': 'Todos los que ocupan',
  'notes.staysWithOffice':
    'Lo que escriba aquí se queda con el cargo. Quien lo ocupe después lo leerá.',
  'notes.titleHint': 'Lo que muestra la lista. Todo lo demás va en notas debajo.',
  'notes.titlePh': 'Cómo se hace la conciliación bancaria',
  'notes.firstNote': 'Primera nota',
  'notes.firstNotePh': 'Opcional: puede agregar notas a este tema más adelante.',
  'notes.moreLater': 'Puede agregar más notas a este tema cuando haya algo que agregar.',
  'notes.note': 'Nota',
  'notes.nothingUnder': 'Todavía no hay nada escrito aquí.',
  'notes.addNote': 'Agregar una nota',
  'notes.addNoteAction': 'Agregar la nota',
  'notes.officesRail': 'Cargos que ocupa',
  'notes.needTitle': 'Póngale un título al tema.',
  'notes.saveFailed': 'No se pudo guardar ese tema.',
  'notes.deleteEntryTitle': 'Eliminar este tema',
  'notes.deleteEntry': 'Eliminar el tema',
  'notes.deleteEntryFailed': 'No se pudo eliminar ese tema.',
  'notes.writeFirst': 'Escriba algo primero.',
  'notes.noteSaveFailed': 'No se pudo guardar esa nota.',
  'notes.deleteNoteBody':
    '¿Eliminar esta nota? El resto del tema se queda. Esto no se puede deshacer.',
  'notes.deleteNote': 'Eliminar la nota',
  'notes.deleteNoteFailed': 'No se pudo eliminar esa nota.',
  'notes.renameEntry': 'Cambiar el título del tema',
  'notes.onlyYouRecorded':
    'Solo usted puede cambiar lo que registró, y solo mientras ocupe este cargo.',
  'notes.onlyYouWrote':
    'Solo usted puede cambiar lo que escribió, y solo mientras ocupe este cargo.',
  'notes.staysWithOfficeShort': 'Esto se queda con el cargo. Quien lo ocupe después lo leerá.',
  'notes.addEntry': 'Agregar el tema',
  'notes.editNote': 'Editar la nota',
  'notes.editThisNote': 'Editar esta nota',
  'notes.deleteThisNote': 'Eliminar esta nota',
  'notes.atTheEnd': 'Va al final de este tema, con su nombre.',
  'bylaws.heading': 'Estatutos',
  'bylaws.addArticle': 'Agregar un artículo',
  'bylaws.addArticleAction': 'Agregar el artículo',
  'bylaws.searchLabel': 'Buscar en los estatutos',
  'bylaws.searchPh': 'quórum, “asamblea anual”, cuotas -poder',
  'bylaws.indexedFull': 'Se puede buscar en todo el texto',
  'bylaws.typedIn': 'Escrito a mano: se puede buscar en todo el texto',
  'bylaws.titleOnly': 'Solo el título y el resumen: no se ha leído el texto del archivo',
  'bylaws.articleOptional': 'Artículo (opcional)',
  'bylaws.summaryOptional': 'Resumen (opcional)',
  'bylaws.textOptional': 'El texto (opcional)',
  'bylaws.documentOptional': 'Documento (opcional)',
  'bylaws.eitherHint': 'Escriba el texto para poder buscarlo, suba el documento, o ambas cosas.',
  'bylaws.articlePh': 'Artículo IV',
  'bylaws.titlePh': 'Asambleas y quórum',
  'bylaws.summaryPh': 'De qué trata este artículo',
  'bylaws.textPh': 'Pegue el artículo aquí y cada palabra se podrá buscar.',
  'bylaws.deleteWithFile':
    'El artículo y su archivo se eliminan para todos. Esto no se puede deshacer.',
  'bylaws.deleteNoFile': 'El artículo se elimina para todos. Esto no se puede deshacer.',
  'bylaws.deleteFailed': 'No se pudo eliminar eso.',
  'bylaws.openFailed': 'No se pudo abrir ese archivo.',
  'bylaws.noMatches': 'No hay nada que coincida.',
  'bylaws.none': 'Todavía no hay estatutos registrados.',
  'bylaws.tryAnother':
    'Pruebe con otra palabra. Un PDF que no se ha leído solo coincide por su título y su '
    + 'resumen.',
  'bylaws.addEachHint':
    'Agregue cada artículo con su texto, o suba el documento. Pegar el texto es lo que hoy '
    + 'permite buscarlo.',
  'bylaws.needTitle': 'Póngale un título al artículo',
  'bylaws.addFailed': 'No se pudo agregar eso.',
  'docs.upload': 'Subir un documento',
  'docs.document': 'Documento',
  'docs.filed': 'Archivado',
  'docs.searchPh': 'Nombre o descripción…',
  'docs.namePh': 'Formulario de membresía 2026',
  'docs.descriptionPh': 'Qué es y quién lo necesita',
  'docs.deleteTitle': 'Eliminar el documento',
  'docs.deleteFailed': 'No se pudo eliminar eso.',
  'docs.openFailed': 'No se pudo abrir ese archivo.',
  'docs.none': 'Todavía no hay documentos archivados.',
  'docs.noMatches': 'No hay documentos que coincidan.',
  'docs.needName': 'Póngale un nombre al documento',
  'docs.uploadFailed': 'La subida falló',
  'common.daysAgo': 'hace {n} días',

  // ── GATHERINGS ───────────────────────────────────────────────────────────────────
  // *Reunión* throughout, never *junta* — see the rail's own note. A *junta* is what
  // `meet.*` is about.
  'gath.rail': 'Áreas de reuniones',
  'gath.pane.gatherings': 'Reuniones',
  'gath.pane.myTasks': 'Mis tareas',
  'gath.pane.myTasksN': 'Mis tareas ({n})',
  'gath.schedule': 'Programar una reunión',
  'gath.scheduleAction': 'Programar la reunión',
  'gath.scheduling': 'Programando…',
  'gath.authorTemplate': 'Crear una plantilla',
  'gath.builtFrom': 'Basada en',
  'gath.where': 'Dónde',
  'gath.whatItIs': 'De qué se trata',
  'gath.open': 'Abrir la reunión',
  'gath.premier': 'Destacada',
  'gath.happeningNow': 'Está ocurriendo ahora',
  'gath.titlePh': 'p. ej. Reunión familiar Allen 2027',
  'gath.wherePh': 'p. ej. Parque Memorial, Houston',
  'gath.descPh': 'Opcional: una frase para la familia',
  'gath.needTitle': 'Póngale un título a la reunión',
  'gath.scheduleFailed': 'No se pudo programar la reunión',
  'gath.sayWhenWhereAndTemplate': 'Diga cuándo y dónde, y elija en qué se basa.',
  'gath.sayWhenWhere': 'Diga cuándo y dónde.',
  'gath.noTasks': 'Todavía no hay tareas',
  'gath.tasks': 'Tareas',
  'gath.findTask': 'Buscar una tarea',
  'gath.findTaskPh': 'Tarea o nombre',
  'gath.showing': 'Se muestran',
  'gath.everyTask': 'Todas las tareas',
  'gath.task': 'Tarea',
  'gath.assignedTo': 'Asignada a',
  'gath.due': 'Vence',
  'gath.answer': 'Respuesta',
  'gath.nobodyYet': 'Nadie todavía',
  'gath.nothingAdded': 'Todavía no se ha agregado nada a esta reunión.',
  'gath.notFromTemplate': 'Sin plantilla',
  'tasks.whatAsked': 'Lo que pidió el organizador',
  'tasks.backNoNotes': 'Esto volvió sin notas. Pregúntele a un organizador qué hay que cambiar.',
  'tasks.askReopen': 'Pídale a un organizador que la reabra si hay que cambiarla.',
  'tasks.yourAnswer': 'Su respuesta',
  'tasks.anythingToTell': '¿Algo que decirle al organizador?',
  'tasks.reviewNote': 'Un organizador la revisa y puede devolverla con notas.',
  'tasks.allIn': 'No hay nada pendiente: todo lo que se le pidió ya está.',
  'tasks.fillFirst': 'Todavía no hay nada que enviar: complete esto primero.',
  'tasks.sendFailed': 'No se pudo enviar eso. Inténtelo de nuevo.',
  'tasks.optional': 'Opcional',
  'tasks.onePerLine': 'Un elemento por línea',
  'tasks.wherePh': 'Dónde es: un lugar, una dirección, una sala',
  'budget.heading': 'Presupuesto',
  'budget.drawnOn': 'Se toma de',
  'budget.budgeted': 'Presupuestado',
  'budget.claimed': 'Comprometido por tareas',
  'budget.inTheFund': 'En el fondo',
  'budget.noFund': 'Todavía no hay un fondo asociado',
  'budget.plansToSpend': 'Lo que esta reunión planea gastar',
  'budget.notSet': 'Nadie ha fijado un presupuesto',
  'budget.noLines': 'Ninguna tarea tiene una partida',
  'budget.over': 'Por encima del presupuesto',
  'budget.unallocated': 'Sin asignar',
  'budget.setToSee': 'Fije un presupuesto para ver lo que queda',
  'budget.linesExceed': 'Las partidas de las tareas piden más que el presupuesto',
  'budget.stillToHandOut': 'Falta repartir a alguna tarea',
  'budget.nothingElse': 'Nada más lo está pidiendo',
  'budget.balanceUnavailable': 'El saldo no estaba disponible',
  'budget.help': 'Cómo funciona el presupuesto de una reunión',

  // ── MEETING MINUTES ──────────────────────────────────────────────────────────────
  // *Junta* for the proceeding and *acta* for its minutes — never *reunión*, which is
  // `gath.*`.
  'meet.heading': 'Actas de juntas',
  'meet.schedule': 'Programar una junta',
  'meet.scheduleAction': 'Programar la junta',
  'meet.scheduling': 'Programando…',
  'meet.none': 'Todavía no hay juntas.',
  'meet.minuted': 'Con acta',
  'meet.everybodyTold': 'Se avisa a todos los presentes y les aparece en su calendario.',
  'meet.step.basics': 'Lo básico',
  'meet.step.whoIsComing': 'Quién asiste',
  'meet.step.anybodyElse': 'Alguien más',
  'meet.titlePh': 'Junta trimestral de la directiva',
  'meet.startTime': 'Hora de inicio',
  'meet.endTime': 'Hora de término',
  'meet.timezone': 'Zona horaria',
  'meet.chooseTimezone': 'Elija una zona horaria…',
  'meet.optional': 'Opcional.',
  'meet.startFirst': 'Primero indique una hora de inicio.',
  'meet.secretaryLabel': '¿Quién levanta el acta?',
  'meet.secretaryHint':
    'Un adulto, y usted por defecto. Solo esa persona puede escribir en esta junta, y solo '
    + 'hasta que se cierre.',
  'meet.noAdults': 'Esta familia todavía no tiene integrantes adultos registrados.',
  'meet.kindQuestion': '¿Qué tipo de junta es?',
  'meet.kind.family': 'Todos los adultos de la familia.',
  'meet.kind.chapter': 'Todos los de un capítulo, tengan cargo o no.',
  'meet.kind.board':
    'Todos los que ocupan un cargo en una directiva: nacional, de una región o de un '
    + 'capítulo.',
  'meet.kind.position':
    'Un mismo cargo en todas las áreas que lo tienen: por ejemplo, cada presidente de '
    + 'capítulo.',
  'meet.kind.named': 'Solo las personas que yo indique',
  'meet.kind.namedHint': 'Nadie al principio. Los agrega en el siguiente paso.',
  'meet.boardHint': 'Todos los que ocupan un cargo ahí, tal como está hoy.',
  'meet.positionHint': 'Se toma de todas las regiones o capítulos que lo tienen.',
  'meet.chapterHint':
    'Todos los adultos registrados en él. Es el capítulo entero, no su directiva.',
  'meet.anybodyElse': 'Alguien más (opcional)',
  'meet.anybodyElseHint':
    'Solo adultos. Se avisa a todos los presentes, les aparece en su calendario y pueden '
    + 'votar sus temas.',
  'meet.nobodyYetNextStep': 'Todavía no hay nadie. Agréguelos por nombre en el siguiente paso.',
  'meet.nobodyYet': 'Todavía no hay nadie.',
  'meet.oneAdult': 'Es 1 adulto.',
  'meet.needTitle': 'Póngale un título a la junta',
  'meet.needDate': 'Elija una fecha',
  'meet.needStart': 'Indique también una hora de inicio, o deje vacía la hora de término',
  'meet.endAfterStart': 'La hora de término tiene que ser después de la de inicio',
  'meet.needZone': 'Elija la zona horaria a la que se refiere la hora',
  'meet.needSecretary': 'Elija quién levanta el acta',
  'meet.needKind': 'Elija qué tipo de junta es',
  'meet.needBoard': 'Elija al menos una directiva',
  'meet.needPosition': 'Elija al menos un cargo',
  'meet.needChapter': 'Elija al menos un capítulo',
  'meet.scheduleFailed': 'No se pudo programar esa junta.',
  'meet.noBoards':
    'Todavía nadie ocupa un cargo en la directiva: configure los cargos en Miembros → '
    + 'Organización.',
  'meet.noPositions':
    'Todavía no hay ningún cargo ocupado: configúrelos en Miembros → Organización.',
  'meet.noChapters': 'Ningún capítulo tiene todavía a nadie registrado.',
  'meet.minutesBy': 'Acta a cargo de',
  'meet.closeMinutes': 'Cerrar el acta',
  'meet.reopen': 'Reabrir',
  'meet.nobodyOnList': 'No hay nadie en la lista.',
  'meet.topics': 'Temas',
  'meet.addTopic': 'Agregar un tema',
  'meet.addTopicAction': 'Agregar el tema',
  'meet.whatTopic': '¿Cuál es el tema?',
  'meet.topicPh': 'Aprobar el presupuesto de la reunión',
  'meet.topicTitleLabel': 'Título del tema',
  'meet.notePh': 'Lo que se dijo y lo que se acordó',
  'meet.renameTopic': 'Cambiar el título de este tema',
  'meet.deleteTopicTitle': 'Eliminar este tema',
  'meet.deleteTopic': 'Eliminar el tema',
  'meet.voteFinal': 'Su voto es definitivo una vez emitido: no se puede cambiar ni retirar.',
  'meet.onlyAttendees': 'Solo las personas en la lista de asistentes pueden votar en esta junta.',
  'meet.vote.for': 'A favor',
  'meet.vote.against': 'En contra',
  'meet.vote.abstain': 'Abstención',
  'meet.theVote': 'La votación',
  'meet.noVote': 'Sin votación',
  'meet.closeVote': 'Cerrar la votación',
  'meet.callVote': 'Convocar una votación',
  'meet.callVoteHint':
    'Convoque una votación y todos los presentes pueden responder. Un voto no se puede '
    + 'cambiar una vez emitido.',
  'meet.noVoteCalled': 'El secretario no ha convocado una votación sobre este tema.',
  'meet.voteOpen': 'Votación abierta',
  'meet.voteClosed': 'Votación cerrada',
  'meet.closeConfirmTitle': 'Cerrar esta acta',
  'meet.reopenConfirmTitle': 'Reabrir esta acta',
  'meet.closeConfirmBody':
    'Nada de esta junta cambia después de cerrarla: no más temas, no más notas y no más '
    + 'votos. Se puede reabrir.',
  'meet.reopenConfirmBody':
    'Reabrirla permite al secretario escribir de nuevo. Los votos ya emitidos quedan '
    + 'exactamente como están; nadie puede cambiarlos.',
  'meet.deleteMeetingBody':
    'La junta entera se va: sus temas, su acta y cada voto emitido en ella. Esto no se puede '
    + 'deshacer.',
  'meet.deleteMeeting': 'Eliminar la junta',
  'meet.deleteTopicBody': 'Esto elimina el tema y sus notas. Esto no se puede deshacer.',
  'meet.nothingMinuted': 'Todavía no hay nada en el acta. Agregue un tema y escriba notas debajo.',
  'meet.nothingMinutedShort': 'Todavía no hay nada en el acta.',
  'meet.noLongerInFamily': 'Alguien que ya no está en esta familia',
  'meet.deleteFailed': 'No se pudo eliminar eso.',
  'meet.addFailed': 'No se pudo agregar eso.',
  'meet.renameFailed': 'No se pudo cambiar el título.',
  'meet.saveFailed': 'No se pudo guardar eso.',
  'meet.needTopicTitle': 'Póngale un título al tema',
  'meet.wentWrong': 'Algo salió mal.',
  'meet.back': 'Atrás',
  'meet.next': 'Siguiente',
  'meet.deleteTopicVotesOne':
    'Esto elimina el tema, sus notas y el único voto emitido sobre él. Eliminar la pregunta '
    + 'es la única forma de quitar una votación. Esto no se puede deshacer.',
  'meet.deleteTopicVotesMany':
    'Esto elimina el tema, sus notas y los {n} votos emitidos sobre él. Eliminar la pregunta '
    + 'es la única forma de quitar una votación. Esto no se puede deshacer.',
  'meet.kind.familyLabel': 'Una junta general de la familia',
  'meet.kind.chapterLabel': 'Una junta de capítulo',
  'meet.kind.boardLabel': 'Una junta de directiva',
  'meet.kind.positionLabel': 'Una junta por cargo',

  // ── THE COMMUNITY SECTION ────────────────────────────────────────────────────────
  // *Ficha* for a record — a card kept about somebody — rather than *registro*, which reads as
  // a database row. *Capítulo* stays the chapter, as everywhere else.
  'action.remove': 'Quitar',
  'action.done': 'Listo',
  'action.continue': 'Continuar',
  'action.back': 'Atrás',
  'action.copied': 'Copiado',
  'action.wentWrong': 'Algo salió mal',
  'action.creating': 'Creando…',
  'common.notStated': 'Sin especificar',
  'common.national': 'Nacional',
  'common.noChapter': 'Sin capítulo',
  'field.firstNameLower': 'Nombre',
  'field.lastNameLower': 'Apellido',
  'field.emailAddress': 'Dirección de correo',
  'field.dobLower': 'Fecha de nacimiento',
  'field.ph.firstName': 'Ana',
  'field.ph.lastName': 'Okonkwo',
  'field.ph.cousinEmail': 'primo@ejemplo.com',
  'field.ph.theirEmail': 'destinatario@ejemplo.com',
  'common.optional': 'Opcional',
  'gal.heading': 'Galería',
  'gal.rail': 'Secciones de la galería',
  'gal.pane.albums': 'Álbumes',
  'gal.pane.search': 'Buscar',
  'gal.newAlbum': 'Álbum nuevo',
  'gal.createAlbum': 'Crear el álbum',
  'gal.looking': 'Buscando los álbumes…',
  'gal.noAlbums': 'Todavía no hay álbumes.',
  'gal.pressNew': 'Pulse Álbum nuevo para crear uno.',
  'gal.somebodyCan': 'Alguien con permiso para agregar a la galería puede crear uno.',
  'gal.albumIs': 'Un conjunto de fotografías que la familia guarda junto.',
  'gal.albumNamePh': 'Reunión de verano 2026',
  'gal.albumDescPh': 'Tres días en el lago',
  'gal.needName': 'Póngale un nombre al álbum',
  'gal.createFailed': 'No se pudo crear ese álbum.',
  'gal.deleteAlbum': 'Eliminar el álbum',
  'gal.deleteAlbumBody': 'Esto elimina el álbum. No tiene fotografías.',
  'gal.deleteAlbumFailed': 'No se pudo eliminar ese álbum.',
  'gal.grid': 'Cuadrícula',
  'gal.list': 'Lista',
  'gal.howToShow': 'Cómo mostrar las fotografías',
  'gal.searchCaptions': 'Buscar en los pies de foto',
  'gal.searchCaptionsPh': 'lago, reunión, 90 años…',
  'gal.whoIsInIt': 'Quién aparece',
  'gal.whoHint':
    'Elija a cualquiera etiquetado en este álbum. Una fotografía aparece si sale CUALQUIERA '
    + 'de ellos: elegir tres amplía el resultado en vez de reducirlo.',
  'gal.nobodyTagged': 'Todavía nadie está etiquetado en una fotografía aquí.',
  'gal.addPhotos': 'Agregar fotografías',
  'gal.clearFilters': 'Limpiar los filtros',
  'gal.noneInAlbum': 'Todavía no hay fotografías en este álbum.',
  'gal.noneMatch': 'Ninguna fotografía de aquí coincide con el filtro.',
  'gal.chooseFiles': 'Elija archivos',
  'gal.batchCaption': 'Pie de foto para todas (opcional)',
  'gal.batchCaptionHint':
    'Un pie de foto para el lote. Después puede cambiar uno por uno en la vista de lista.',
  'gal.captionPh': 'El sábado, en el lago',
  'gal.noCaption': 'Sin pie de foto',
  'gal.caption': 'Pie de foto',
  'gal.changeCaption': 'Cambiar este pie de foto',
  'gal.tagSomebody': 'Etiquetar a alguien',
  'gal.searchFamily': 'Buscar en la familia…',
  'gal.searchToTag': 'Buscar a alguien para etiquetar',
  'gal.nobodyMatches': 'Nadie coincide.',
  'gal.closePhoto': 'Cerrar la fotografía',
  'gal.openPhotographIn': 'Abrir la fotografía: {what}',
  'gal.nOfTotal': '{n} de {total}',
  'gal.searchAllLabel': 'Buscar en todos los álbumes',
  'gal.searchAllPh': 'lago, reunión, los 90 de la abuela',
  'gal.searchAllHint': 'Palabras de una descripción, y cualquiera etiquetado. Ambos filtros se combinan.',
  'gal.searchWhoIsIn': 'Quién aparece (opcional)',
  'gal.searchWhoIsInHint': 'Solo las fotografías etiquetadas con todas las personas elegidas aquí.',
  'gal.searchFoundOne': '1 fotografía coincide.',
  'gal.searchFoundMany': '{n} fotografías coinciden.',
  'gal.searchMoreNotShown': 'No se muestran {n} más: acote la búsqueda.',
  'gal.searchNoMatches': 'Ninguna fotografía coincide con eso.',
  'gal.searchRefused': 'No se pudieron buscar las fotografías.',
  'gal.prevPhoto': 'Fotografía anterior',
  'gal.nextPhoto': 'Fotografía siguiente',
  'gal.openPhoto': 'Abrir esta fotografía',
  'gal.deletePhoto': 'Eliminar la fotografía',
  'gal.deletePhotoBody':
    '¿Eliminar esta fotografía? Se quita para todos, junto con sus etiquetas, y el archivo de '
    + 'imagen también. Esto no se puede deshacer.',
  'gal.deletePhotoFailed': 'No se pudo eliminar eso.',
  'gal.chooseImage': 'Elija al menos una imagen.',
  'gal.nothingUploaded': 'No se subió nada.',
  'gal.captionFailed': 'No se pudo guardar ese pie de foto.',
  'gal.tagFailed': 'No se pudo agregar esa etiqueta.',
  'gal.removeTag': 'Quitar la etiqueta',
  'gal.removeTagFailed': 'No se pudo quitar esa etiqueta.',
  'gal.addedByGone': 'Agregada por alguien que ya no está en esta familia',
  'tree.nobodyToBuild': 'Todavía no hay nadie en esta familia con quien construir un árbol.',
  'tree.centreOnMe': 'Centrar en mí',
  'tree.children': 'Hijos',
  'tree.notOnTree': 'Todavía no está en el árbol',
  'tree.everyone': 'Todos en esta familia',
  'tree.recordOnly': 'Solo ficha',
  'tree.invited': 'Invitado',
  'tree.noEmail': 'Sin correo',
  'tree.inBloodline': 'En la línea de sangre',
  'tree.marksBlood': 'Señala a un familiar de sangre',
  'tree.mode': 'Modo del árbol',
  'tree.whichRelatives': 'Qué familiares mostrar',
  'tree.bloodlineHelp': 'Ayuda: el filtro Línea de sangre',
  'tree.editOrInvite': 'Editar esta ficha, o invitarlos',
  'tree.removeConnection': 'Quitar esta conexión',
  'tree.removeConnectionAction': 'Quitar la conexión',
  'tree.removeConnectionFailed': 'No se pudo quitar esa conexión.',
  'tree.fullFamily': 'Toda la familia',
  'tree.bloodline': 'Línea de sangre',
  'tree.father': 'Padre',
  'tree.mother': 'Madre',
  'tree.thisAndMarriages': 'Esta persona y sus matrimonios',
  'tree.thisAndSpouse': 'Esta persona y su cónyuge',
  'tree.thisPerson': 'Esta persona',
  'tree.siblings': 'Hermanos y hermanas',
  'tree.thisPersonIs': 'Esta persona es',
  'tree.thesePeopleAre': 'Estas personas son',
  'rel.how': 'Cómo',
  'rel.chooseHow': 'Elija cómo se suma esta persona al árbol.',
  'rel.alreadyHere': 'Alguien que ya está aquí',
  'rel.alreadyHereHint': 'Vincule a un familiar que ya está en su familia.',
  'rel.inviteThem': 'Invitarlos',
  'rel.inviteHint':
    'Enviamos una invitación por correo. Se suman cuando un administrador los aprueba.',
  'rel.noEmail': 'Sin dirección de correo',
  'rel.noEmailHint': 'Regístrelos sin ella: para familiares que han fallecido, mayores y niños.',
  'rel.noEmailChildHint':
    'Regístrelos sin ella: para un niño demasiado pequeño para tener cuenta. Pedimos su fecha '
    + 'de nacimiento porque las cuotas pueden empezar a cierta edad.',
  'rel.whyNoEmail': '¿Por qué no hay correo?',
  'rel.generated':
    'Generamos una dirección para que la ficha pudiera existir. Nunca se le envía nada.',
  'rel.addedToTree': 'Agregado al árbol',
  'rel.adding': 'Agregando…',
  'rel.everyoneAttached':
    'Todos en la familia ya están conectados aquí. Invite a alguien, o regístrelos sin '
    + 'correo.',
  'rel.whatRecordIs': 'Qué es una ficha y cómo obtienen una cuenta después',
  'rel.tooYoung': 'Demasiado pequeño para una cuenta · Todavía sin correo',
  'rel.reasonExamples':
    'Falleció en 1998 · Sin correo, solo teléfono · Demasiado pequeño para una cuenta',
  'rel.emailedInvite':
    'Les enviamos una invitación por correo. Cuando la acepten, su cuenta se une a esta '
    + 'ficha.',
  'rel.inviteNotEmailed':
    'La invitación se creó pero no pudimos enviarla por correo. Reenvíela desde '
    + 'Administración › Miembros › Aprobaciones pendientes.',
  'rel.onTreeNoInvite':
    'Están en el árbol, pero no pudimos crear una invitación: casi siempre porque esa '
    + 'dirección ya está en su familia. Vincule a la persona existente en su lugar.',
  'rec.saved': 'Guardado.',
  'rec.savedShort': 'Guardado',
  'rec.connectionFailed': 'No se pudo cambiar esa conexión.',
  'rec.needNames': 'Escriba un nombre y un apellido',
  'rec.saveFailed': 'No se pudo guardar eso.',
  'rec.inviteFailed': 'No se pudo invitarlos.',
  'rec.theirOwnProfile':
    'Esa persona administra su propio perfil, así que solo la conexión es suya para cambiar.',
  'rec.noAccountAnyone':
    'No tiene cuenta, así que cualquiera en la familia puede mantener esta ficha al día.',
  'rec.saveDetails': 'Guardar los datos',
  'rec.inviting': 'Invitando…',
  'rec.sendInvitation': 'Enviar la invitación',
  'chat.messages': 'Mensajes',
  'chat.newDm': 'Mensaje nuevo',
  'chat.new': 'Nuevo',
  'chat.noGroups': 'Todavía no hay grupos.',
  'chat.directMessages': 'Mensajes directos',
  'chat.groupMessages': 'Mensajes de grupo',
  'chat.unread': 'Mensajes sin leer',
  'chat.familyChat': 'Chat de la familia',
  'chat.directMessage': 'Mensaje directo',
  'chat.familyMember': 'Integrante de la familia',
  'chat.selectConversation': 'Elija una conversación para empezar a escribir.',
  'chat.deleteConversation': 'Eliminar la conversación',
  'chat.groupName': 'Nombre del grupo',
  'chat.members': 'Integrantes',
  'chat.newGroup': 'Grupo nuevo',
  'chat.newGroupHint': 'Póngale un nombre al grupo y elija a quién incluir.',
  'chat.groupNamePh': 'p. ej. Organización de la reunión de verano',
  'chat.needGroupName': 'El nombre del grupo es obligatorio',
  'chat.createGroup': 'Crear el grupo',
  'chat.newDmTitle': 'Mensaje directo nuevo',
  'chat.newDmHint': 'Elija a un integrante de la familia para empezar una conversación privada.',
  'chat.noOthers': 'Todavía no hay otros integrantes con cuenta.',
  'chat.starting': 'Empezando…',
  'chat.startConversation': 'Empezar la conversación',
  'chat.manageMembers': 'Administrar los integrantes',
  'chat.addMembers': 'Agregar integrantes:',
  'chat.typeMessage': 'Escriba un mensaje… (Enter para enviar, Shift+Enter para una línea nueva)',
  'chat.send': 'Enviar',
  'chat.noMessages': 'Todavía no hay mensajes. ¡Salude!',
  'chat.sendFailed': 'No se pudo enviar',
  'chat.addToGroup': 'Agregar al grupo',
  'chat.addFailed': 'No se pudo agregar al integrante',
  'chat.removeFromGroup': 'Quitar del grupo',
  'chat.removeFailed': 'No se pudo quitar al integrante',
  'chat.ended': 'Esta conversación terminó.',
  'chat.youWereRemoved': 'Lo quitaron de este grupo.',
  'dir.allChapters': 'Todos los capítulos',
  'dir.noMatches': 'Ningún integrante coincide con su búsqueda.',
  'dir.minor': 'Menor de edad',
  'dir.notRegistered': 'Todavía sin registrarse',
  'dir.filterByChapter': 'Filtrar por capítulo',
  'dir.position': 'Cargo',
  'dir.group': 'Grupo',
  'dir.preferredName': 'Nombre preferido',
  'dir.account': 'Cuenta',
  'dir.registered': 'Registrado',
  'dir.editProfile': 'Editar el perfil',
  'dir.cityState': 'Ciudad, estado',
  'dir.region': 'Región',
  'elec.nominated': '¡Lo han nominado!',
  'elec.accept': 'Aceptar',
  'elec.decline': 'Rechazar',
  'elec.acceptNomination': 'Aceptar la nominación',
  'elec.declineNomination': 'Rechazar la nominación',
  'elec.answerFailed': 'No se pudo registrar su respuesta.',
  'elec.castYourVote': 'Emita su voto',
  'elec.castVote': 'Emitir el voto',
  'elec.changeVote': 'Cambiar el voto',
  'elec.changeYourVote': 'Cambiar su voto',
  'elec.castYourVoteAction': 'Emitir su voto',
  'elec.voteFailed': 'El voto no se registró',
  'elec.noCandidates': 'No hay candidatos para este cargo.',
  'elec.nominationsNotOpen': 'Las nominaciones todavía no están abiertas.',
  'elec.notPublished': 'Esta elección todavía no se ha publicado.',
  'elec.position': 'Cargo',
  'elec.nominations': 'Nominaciones',
  'elec.noOffices': 'Esta elección todavía no tiene cargos.',
  'elec.nominate': 'Nominar',
  'elec.noNominations': 'Todavía no hay nominaciones para este cargo.',
  'elec.putMyselfForward': 'Postularme',
  'elec.whoNominating': '¿A quién nomina?',
  'elec.nominateFailed': 'No se pudo enviar esa nominación.',
  'elec.withdrawYours': 'Retirar su nominación',
  'elec.takeNameOff': 'Quitar su nombre de esta nominación',
  'elec.withdraw': 'Retirar',
  'elec.takeMyNameOff': 'Quitar mi nombre',
  'elec.withdrawFailed': 'No se pudo retirar esa nominación.',
  'elec.nobodyNominated': 'Todavía nadie ha sido nominado',
  'elec.accepted': 'Aceptada',
  'elec.waitingAnswer': 'Esperando su respuesta',
  'elec.anybodyMayBe': 'Cualquiera en la familia puede ser nominado.',
  'cal.thisMonth': 'Este mes',
  'cal.nothingToday': 'Nada para hoy.',
  'cal.prevMonth': 'Mes anterior',
  'cal.nextMonth': 'Mes siguiente',
  'cal.kind.premier': 'Reunión destacada',
  'cal.kind.gathering': 'Reunión',
  'cal.kind.meeting': 'Junta',
  'cal.kind.nominations': 'Nominaciones abiertas',
  'cal.kind.voting': 'Votación abierta',

  // ── SAFETY, MEMBERSHIP, INVITATIONS AND THE MEMBERSHIP REPORT ────────────────────
  // *Aviso* throughout, never *alerta*. See `en.ts`.
  'safety.heading': 'Avisos de seguridad',
  'safety.lede':
    'Pregunte a los familiares de un área si están a salvo, y vea llegar las respuestas.',
  'safety.raise': 'Levantar un aviso',
  'safety.askingAboutYou': 'Su familia está preguntando por usted',
  'safety.listFailed':
    'La lista de avisos no se pudo cargar ahora. Recargue la página para intentarlo de nuevo.',
  'safety.open': 'Abiertos',
  'safety.closed': 'Cerrados',
  'safety.nothingOpen': 'No hay nada abierto. Cuando alguien levante un aviso, aparecerá aquí.',
  'safety.notShownToYou': 'Puede ver que se levantó este aviso. Quién respondió no se le muestra.',
  'safety.retryFailed': 'Reintentar los que fallaron',
  'safety.close': 'Cerrar el aviso',
  'safety.loadingRoster': 'Cargando a quién se le preguntó…',
  'safety.safe': 'A salvo',
  'safety.needHelp': 'Necesita ayuda',
  'safety.waiting': 'Esperando',
  'safety.notReached': 'No alcanzado',
  'safety.notAddressed': 'Sin destinatario',
  'safety.askFailed': 'No se pudo preguntar a todos',
  'safety.didNotWork': 'Eso no funcionó',
  'safety.deleteConfirm': '¿Eliminar este aviso?',
  'safety.deleteFailed': 'No se pudo eliminar el aviso',
  'safety.deleted': 'Aviso eliminado',
  'safety.everyone': 'Todos en la familia',
  'safety.handPicked': 'Familiares elegidos uno por uno',
  'safety.oneArea': 'Un área',
  'safety.asking': 'Preguntando…',
  'safety.hideRoster': 'Ocultar a quién se le preguntó',
  'safety.seeRoster': 'Ver a quién se le preguntó',
  'safety.iAmSafe': 'Estoy a salvo',
  'safety.iNeedHelp': 'Necesito ayuda',
  'safety.anythingToKnow': '¿Algo que su familia deba saber? (opcional)',
  'safety.notePh': 'Dónde está, qué necesita, o nada.',
  'safety.saveNote': 'Guardar la nota',
  'safety.saved': 'Guardado',
  'safety.answerFailed': 'No se pudo registrar su respuesta',
  'safety.toldSafe': 'Le dijo a su familia que está a salvo.',
  'safety.toldHelp': 'Le dijo a su familia que necesita ayuda.',
  'safety.actuallyHelp': 'En realidad, necesito ayuda',
  'safety.nobodyOn': 'No hay nadie en este aviso.',
  'safety.relative': 'Familiar',
  'safety.answer': 'Respuesta',
  'safety.howAsked': 'Cómo se les preguntó',
  'safety.answered': 'Respondió',
  'safety.needsHelp': 'Necesita ayuda',
  'safety.noEmailPhone': 'No hay correo registrado: hace falta una llamada',
  'safety.emailFailed': 'El correo no llegó',
  'safety.notAsked': 'Todavía sin preguntar',
  'safety.askedByEmail': 'Se preguntó por correo',
  'safety.sending': 'Enviando',
  'safety.whatHappening': 'Qué está pasando',
  'safety.subjectHint':
    'Este es el asunto del correo que reciben sus familiares. Que sea reconocible.',
  'safety.anythingElse': 'Algo más que decirles (opcional)',
  'safety.whoToAsk': 'A quién preguntar',
  'safety.justNamed': 'Solo los familiares que yo indique',
  'safety.nobodySelected': 'Todavía no hay nadie seleccionado, así que no se enviará nada.',
  'safety.askIfSafe': 'Preguntar si están a salvo',
  'safety.oneQuestion':
    'A todos los que elija se les hace una sola pregunta, y responden con un toque.',
  'safety.titlePh': 'Huracán Delia',
  'safety.detailPh': 'A dónde ir, a quién llamar, lo que sabe.',
  'safety.relativesToAsk': 'Familiares a los que preguntar',
  'safety.emailedOne':
    'A todos los que elija se les envía una pregunta por correo y pueden responder con un '
    + 'toque.',
  'safety.noRelatives': 'Todavía no hay familiares para elegir.',
  'safety.sayWhat': 'Diga qué está pasando, para que los familiares sepan de qué se les pregunta',
  'safety.chooseOne': 'Elija al menos un familiar al que preguntar',
  'safety.raiseFailed': 'No se pudo levantar el aviso',
  'safety.askThem': 'Preguntarles',
  'fam.heading': 'Mis familias',
  'fam.pending': 'Pendiente',
  'fam.removed': 'Eliminada',
  'fam.declined': 'Rechazada',
  'fam.viewing': 'Está viendo',
  'fam.default': 'Predeterminada',
  'fam.familyCode': 'Código familiar:',
  'fam.changeDefault': 'Cambiar la familia predeterminada',
  'fam.makeDefault': 'Hacer predeterminada',
  'fam.inviteMember': 'Invitar a alguien',
  'fam.copyCode': 'Copiar el código',
  'fam.join': 'Unirse a otra familia',
  'fam.codeLabel': 'Código familiar',
  'fam.codePh': 'ABC234',
  'fam.askSomeone': 'Pídale a alguien de la familia su código familiar.',
  'fam.isThisRight': '¿Es esta la familia correcta?',
  'fam.checking': 'Comprobando…',
  'fam.joining': 'Uniéndose…',
  'fam.requestSent': 'Solicitud enviada',
  'fam.yourRequestTo': 'Su solicitud para unirse a',
  'rem.nothingDeleted': 'No se ha borrado nada',
  'rem.otherFamily': 'Su otra familia',
  'rem.otherFamilies': 'Sus otras familias',
  'pend.waiting': 'Esperando aprobación',
  'pend.declined': 'Solicitud rechazada',
  'pend.switchedOff': 'Acceso desactivado',
  'pend.yourRequests': 'Sus solicitudes de familia',
  'pend.adminOf': 'Un administrador de',
  'pend.pending': 'Pendiente',
  'pend.mistake': '¿Cree que fue un error?',
  'pend.lookAgain': 'Pídales que lo revisen de nuevo',
  'pend.confirmEmail': 'Confirme su dirección de correo',
  'pend.appealPh':
    'Soy el menor de Marta: mi madre nació en Bastrop y mi prima Ana ya es integrante.',
  'pend.withAdmins': 'Con sus administradores para que la revisen.',
  'pend.wasDeclined': 'Un administrador rechazó su solicitud para unirse.',
  'pend.wasSwitchedOff': 'Un administrador desactivó su acceso.',
  'pend.sentCheckInbox': 'Enviado. Revise su bandeja de entrada.',
  'pend.declinedShort': 'Rechazada',
  'pend.switchedOffShort': 'Desactivado',
  'pend.sendToAdmins': 'Enviar a los administradores',
  'pend.sendAgain': 'Enviarlo de nuevo',
  'pend.member': 'Integrante',
  'inv.title': 'Invitar a alguien',
  'inv.sent': 'Invitación enviada',
  'inv.created': 'Invitación creada',
  'inv.emailedTo': 'Enviamos una invitación por correo a',
  'inv.anInvitationFor': 'Una invitación para',
  'inv.sendThisLink': 'Envíeles este enlace',
  'inv.noSecondApproval': 'Se les admitirá en cuanto acepten, sin una segunda aprobación.',
  'inv.needsApproval': 'Todavía necesitarán que un administrador los apruebe.',
  'inv.create': 'Crear la invitación',
  'inv.admittedAtOnce':
    'Se les admitirá en el momento en que acepten: no aparecerán en la cola de aprobaciones.',
  'inv.willAppearInQueue':
    'Cuando acepten aparecerán en Aprobaciones de integrantes, esperando a un administrador.',
  'inv.signOutFailed':
    'No pudimos cerrar su sesión ahora. Su enlace de invitación sigue en la barra de '
    + 'direcciones: inténtelo de nuevo, o ábralo en una ventana privada.',
  'inv.copyFailed': 'No pudimos copiarlo. El enlace está en su barra de direcciones.',
  'inv.signingOut': 'Cerrando sesión…',
  'inv.signOutContinue': 'Cerrar sesión y continuar',
  'inv.linkCopied': 'Enlace copiado',
  'inv.copyLink': 'Copiar el enlace de invitación',
  'consent.decline': 'Rechazar',
  'consent.allow': 'Permitir',
  'consent.label': 'Elección sobre la medición publicitaria',
  'soon.heading': 'Muy pronto',
  'soon.availableNow': 'Disponible ahora',
  'soon.back': 'Volver al panel',
  'upg.familyIsOn': 'Su familia tiene el plan',
  'upg.changePlan': 'Cambiar de plan',
  'upg.askAdmin': 'Pídale a un administrador de su familia que cambie el plan.',
  'rep.group': 'Grupo',
  'rep.members': 'Integrantes',
  'rep.share': 'Proporción',
  'rep.pressRow': 'Pulse una fila para ver quién está en ella.',
  'rep.nationally': 'A nivel nacional',
  'rep.regions': 'Regiones',
  'rep.chapters': 'Capítulos',
  'rep.canSignIn': 'Puede iniciar sesión',
  'rep.neverInvited': 'Nunca invitado',
  'rep.byRegion': 'Por región',
  'rep.byRegionHint':
    'Dónde está la familia, un nivel arriba de sus capítulos. Un integrante sin capítulo, o '
    + 'en un capítulo que no está bajo ninguna región, queda bajo Nacional, que es la ausencia '
    + 'de una región y no un lugar propio.',
  'rep.byChapter': 'Por capítulo',
  'rep.byChapterHint':
    'Cada capítulo que la familia ha creado, incluidos los que nadie ha usado. Un capítulo en '
    + 'cero es el primero que hay que mirar.',
  'rep.invitations': 'Invitaciones',
  'rep.invitationsHint':
    'Activo significa que la persona tiene cuenta y puede iniciar sesión. Invitado significa '
    + 'que hay una invitación abierta sin responder. Invitación pendiente significa que nadie '
    + 'se lo ha pedido todavía: están en el padrón y deben cuotas como los demás.',
  'rep.adultsMinors': 'Adultos y menores',
  'rep.adultsMinorsHint':
    'Se calcula a partir de la fecha de nacimiento de cada integrante cada vez que se carga '
    + 'esta página; nunca se guarda. Un cumpleaños que nadie ha registrado no se cuenta en '
    + 'ninguno de los dos grupos en vez de adivinarse: los programas de cuotas con edad de '
    + 'inicio cobran desde la fecha registrada, así que una fecha vacía es dinero que nadie '
    + 'está pidiendo.',
  'slice.filterPh': 'Filtrar a estos integrantes por nombre…',
  'slice.noMatch': 'Nadie de este grupo coincide con ese filtro.',
  'slice.nobodyIn': 'No hay nadie en este grupo.',
  'slice.needChapterPerm':
    'Asignar a alguien a un capítulo requiere permiso para editar integrantes, que no se le '
    + 'ha dado.',
  'slice.needInvitePerm':
    'Enviar una invitación requiere permiso para editar el árbol familiar, que no se le ha '
    + 'dado.',
  'slice.needBirthdayPerm':
    'Registrar una fecha de nacimiento requiere permiso para editar integrantes, que no se le '
    + 'ha dado.',
  'slice.placeholderAddress':
    'Su ficha tiene una dirección generada, así que la invitación necesita una real.',
  'slice.needEmail': 'Escriba una dirección de correo a la que enviar la invitación',
  'slice.needDob': 'Escriba una fecha de nacimiento',
  'slice.chapterFailed': 'No se pudo guardar ese capítulo.',
  'slice.inviteFailed': 'No se pudo enviar esa invitación.',
  'slice.canResend': 'Integrantes y accesos puede reenviarla.',
  'slice.dateFailed': 'No se pudo guardar esa fecha.',
  'slice.noAccount': 'Sin cuenta',
  'slice.inviteOpen': 'Invitación abierta',
  'slice.setChapter': 'Asignar capítulo',
  'slice.saveChapter': 'Guardar el capítulo',
  'slice.invite': 'Invitar',
  'slice.sendInvitation': 'Enviar la invitación',
  'slice.addBirthday': 'Agregar fecha de nacimiento',
  'slice.saveDate': 'Guardar la fecha',
  'fam.create': 'Crear una familia nueva',
  'fam.createAction': 'Crear la familia',
  'fam.nameLabel': 'Nombre de la familia',
  'fam.namePh': 'La familia Okonkwo',
  'fam.created': 'Familia creada',
  'fam.codeHeading': 'Código familiar',
  'fam.firstAdmin': 'Usted será su primer administrador. Su perfil se conserva.',

  // ── THE ADMIN CONSOLE ────────────────────────────────────────────────────────────
  // *Plantilla de permisos* for the grid and *plantilla de reunión* for the list of steps —
  // never bare *plantilla* where both could be meant. *Cargo* is the office throughout.
  'action.adding': 'Agregando…',
  'action.working': 'Trabajando…',
  'action.change': 'Cambiar',
  'action.failed': 'Falló',
  'common.required': 'Obligatorio',
  'common.description': 'Descripción',
  'common.scope': 'Alcance',
  'common.amount': 'Monto',
  'acct.rail': 'Áreas de contabilidad',
  'acct.section.income': 'Ingresos',
  'acct.section.donations': 'Donaciones',
  'acct.section.routing': 'Asignación',
  'acct.section.milestones': 'Logros',
  'acct.section.processing': 'Cobros',
  'acct.section.bank': 'Datos bancarios',
  'acct.section.settings': 'Configuración',
  'acct.heading': 'Contabilidad',
  'acct.newDues': 'Cuota nueva',
  'acct.newDonation': 'Donación nueva',
  'acct.newFund': 'Fondo nuevo',
  'acct.newMilestone': 'Logro nuevo',
  'acct.noBank': 'No hay cuenta bancaria registrada',
  'rg.general': 'General',
  'rg.personal': 'Personal',
  'rg.community': 'Comunidad',
  'rg.library': 'Biblioteca',
  'rg.gatherings': 'Reuniones',
  'rg.accounting': 'Contabilidad',
  'rg.resources': 'Recursos',
  'rg.administration': 'Administración',
  'set.rail': 'Secciones de configuración',
  'set.pane.family': 'Familia',
  'set.pane.billing': 'Facturación',
  'set.pane.plan': 'Plan',
  'set.familyName': 'Nombre de la familia',
  'set.timezone': 'Zona horaria',
  'set.saveName': 'Guardar el nombre',
  'set.familyCode': 'Código familiar',
  'set.removed': 'Esta familia fue eliminada',
  'set.remove': 'Eliminar esta familia',
  'set.nothingDeleted': 'No se borra nada.',
  'set.sendAnotherCode': 'Enviar otro código',
  'set.emailMeCode': 'Enviarme por correo un código de eliminación',
  'set.enterCode': 'Escriba los seis dígitos del correo.',
  'set.codeFailed': 'No pudimos enviar el correo ahora.',
  'set.enterAndRemove': 'Escriba el código y elimine',
  'set.howPlanWorks': 'Qué hace cambiar el plan',
  'set.howPayingWorks': 'Cómo funciona el pago de un plan',
  'set.howRemovalWorks': 'Qué hace eliminar una familia',
  'appr.thisPerson': 'Esta persona',
  'appr.lookAgain': 'Le pidieron que lo revise de nuevo:',
  'appr.immediate':
    'Tendrán acceso inmediato a todo lo que su familia haya hecho visible para los '
    + 'integrantes.',
  'appr.approve': 'Aprobar',
  'appr.wasDeclinedBefore':
    'Ya se les rechazó antes. Admitirlos ahora les da acceso inmediato a todo lo que su '
    + 'familia haya hecho visible para los integrantes, y se les avisará.',
  'appr.nobodyWaiting':
    'No hay nadie esperando. Las solicitudes aparecen aquí cuando alguien se une con su '
    + 'código familiar.',
  'appr.checkRecognise': 'Compruebe que reconoce a la persona antes de admitirla.',
  'appr.declineRequest': 'Rechazar la solicitud',
  'appr.declineBody':
    'Se les avisará, y se les puede dar un motivo. Su ficha se conserva en vez de borrarse.',
  'appr.reason': 'Motivo (opcional: se les muestra)',
  'appr.invitationsSent': 'Invitaciones enviadas',
  'appr.preApproved': 'Preaprobado',
  'appr.resendNote': 'El enlace anterior dejó de funcionar: un reenvío siempre emite uno nuevo.',
  'appr.keptNote': 'Se conserva en vez de borrarse, para que quede el registro de la decisión.',
  'appr.invited': 'Invitado',
  'appr.resend': 'Reenviar',
  'appr.cancelling': 'Cancelando…',
  'appr.admitAfterAll': 'Admitir después de todo',
  'pos.add': 'Agregar un cargo',
  'pos.addTitle': 'Agregar un cargo de la directiva',
  'pos.addHint': 'Un cargo que su familia mantiene. Después elige quién lo ocupa.',
  'pos.namePh': 'p. ej. Tesorero de la reunión',
  'pos.position': 'Cargo',
  'pos.regional': 'Regional',
  'pos.president': 'Presidente',
  'pos.addFailed': 'No se pudo agregar ese cargo',
  'pos.renameFailed': 'No se pudo cambiar el nombre de ese cargo',
  'pos.remove': 'Quitar el cargo',
  'pos.removeBody': 'Nada más de la familia cambia.',
  'pos.removeFailed': 'No se pudo quitar ese cargo',
  'pos.none':
    'Todavía no hay cargos. Agregue los que su familia mantiene: presidente, tesorero, un '
    + 'encargado de la reunión, lo que de verdad tengan.',
  'pos.noneShort': 'Su familia todavía no ha creado cargos de la directiva.',
  'pos.escape': 'Escape',
  'pos.holdsNow': 'Ocupa ahora',
  'pos.give': 'Dar un cargo',
  'pos.chooseOne': 'Elija uno…',
  'pos.oneOrMore':
    'Un cargo se ocupa a nivel nacional, o para una región, o para un capítulo. Alguien puede '
    + 'ocupar más de uno.',
  'pos.choose': 'Elija un cargo',
  'pos.giveFailed': 'No se les pudo dar ese cargo',
  'pos.takeAway': 'Quitar el cargo',
  'pos.takeAwayBody': 'Siguen siendo integrantes de la familia, y nada más sobre ellos cambia.',
  'pos.takeItAway': 'Quitarlo',
  'pos.takeAwayFailed': 'No se pudo quitar ese cargo',
  'pos.giveOneBelow': 'Déles uno abajo.',
  'pos.somebodyElse': 'Alguien que pueda editar cargos tiene que darles uno.',
  'pos.givePosition': 'Dar el cargo',
  'org.regions': 'Regiones',
  'org.addRegion': 'Agregar una región',
  'org.addRegionTitle': 'Agregar una región',
  'org.addRegionHint':
    'Un grupo de capítulos. Una familia puede funcionar solo con capítulos, o sin ninguno de '
    + 'los dos.',
  'org.regionPh': 'p. ej. Nuevo León',
  'org.noRegions':
    'Todavía no hay regiones. Cada capítulo queda bajo Nacional hasta que agregue una.',
  'org.attached': 'Asociados',
  'org.addChapter': 'Agregar un capítulo',
  'org.addChapterTitle': 'Agregar un capítulo',
  'org.addChapterHint': 'Donde un integrante realmente pertenece. Lo eligen en su propio perfil.',
  'org.chapterPh': 'p. ej. Monterrey',
  'org.underNational': 'Cada capítulo que no ponga en una región queda bajo',
  'org.inRegion': 'En la región',
  'org.addRegionFailed': 'No se pudo agregar esa región',
  'org.deleteRegion': 'Eliminar la región',
  'org.deleteRegionFailed': 'No se pudo eliminar esa región',
  'org.addChapterFailed': 'No se pudo agregar ese capítulo',
  'org.deleteChapter': 'Eliminar el capítulo',
  'org.deleteChapterFailed': 'No se pudo eliminar ese capítulo',
  'org.moveChapterFailed': 'No se pudo mover ese capítulo',
  'org.nothingNational': 'No hay nada bajo Nacional.',
  'bill.paidPlan': 'Plan pagado',
  'bill.paidThrough': 'Pagado hasta',
  'bill.howRenews': 'Cómo se renueva',
  'bill.movingTo': 'Cambiando a',
  'bill.cardsReceipts': 'Tarjetas y recibos',
  'bill.whatCharged': 'Lo que GENORRA ha cobrado',
  'bill.neverCharged': 'Todavía nada: nunca se le ha cobrado a esta familia.',
  'bill.covers': 'Cubre',
  'bill.onFree': 'Ninguno: está en el plan gratuito',
  'bill.nextPayment': 'Próximo pago',
  'bill.nextPaymentDue': 'Próximo pago con vencimiento',
  'bill.stopping': 'Mensual: se detiene al final de este período',
  'bill.monthlyAuto': 'Mensual, automáticamente',
  'bill.inAdvance': 'Pagado por adelantado: nada lo renueva',

  'bill.perMonth': '{amount} al mes',
  'bill.perMonthParen': '({amount} al mes)',
  'bill.rateSentence': 'El plan {tier} cuesta {amount} al mes, mes a mes.',
  'bill.perMonthSlash': '{amount}/mes',

  'auth.meta.loginTitle': 'Inicie sesión en el portal de su familia',
  'auth.meta.loginDescription':
    'Inicie sesión en el portal familiar de {app} para organizar reencuentros, gestionar '
    + 'cuotas, compartir fotos y mantener conectada a su familia.',
  'auth.meta.loginGraphName': 'Bienvenido de nuevo',
  'auth.meta.registerTitle': 'Cree su cuenta familiar gratuita',
  'auth.meta.registerDescription':
    'Cree una cuenta gratuita de {app} para unirse al sitio privado de su familia o crearlo: '
    + 'reencuentros, cuotas, fotografías y el árbol genealógico, todo en un solo lugar.',
  'auth.meta.registerGraphName': 'Cree su cuenta',
  'auth.meta.inviteTitle': 'Acepte su invitación',
  'auth.meta.forgotTitle': 'Restablezca la contraseña del portal de su familia',
  'auth.meta.forgotDescription':
    '¿Olvidó su contraseña de {app}? Escriba la dirección de correo de la cuenta de su '
    + 'familia y le enviaremos un enlace para elegir una nueva.',

  'guard.sessionUnverified':
    'No se pudo verificar su sesión. Vuelva a cargar la página e inténtelo de nuevo.',
  'guard.signedOut': 'Su sesión está cerrada. Inicie sesión e inténtelo de nuevo.',
  'guard.notAuthorized': 'No autorizado',
  'guard.awaitingApproval': 'Su membresía está pendiente de aprobación',

  'auth.signInToYour': 'Inicie sesión en su cuenta de {app}',
  'reg.invitedToJoin': 'Le han invitado a unirse a',
  'reg.joinOn': 'Únase a su familia en {app}',
  'reg.startOn': 'Cree una familia nueva en {app}',

  'auth.aside.loginHeading': '¿Es nuevo aquí o no puede entrar?',
  'auth.aside.whatItIs':
    '{app} es un sitio privado para una sola familia extensa, donde todas las generaciones '
    + 'tienen su lugar. Sus miembros organizan juntos reencuentros y reuniones, llevan el '
    + 'control de las cuotas y las aportaciones, comparten fotografías y construyen el árbol '
    + 'genealógico en un espacio que solo la familia puede ver. No hay perfil público, y '
    + 'ninguna familia puede ver las páginas de otra.',

  'auth.aside.forgotTerm': '¿Olvidó su contraseña?',
  'auth.aside.forgotLink': 'Pida un enlace para restablecerla',
  'auth.aside.forgotTail': 'y elija una nueva.',
  'auth.aside.unconfirmedTerm': '¿Nunca confirmó su correo?',
  'auth.aside.unconfirmedBody':
    'Al registrarse se envía un enlace de confirmación, y la cuenta permanece inactiva hasta '
    + 'que se abre. Revise primero su carpeta de correo no deseado; después inicie sesión '
    + 'arriba y el formulario le ofrecerá enviarle el enlace de nuevo.',
  'auth.aside.codeTerm': '¿Se unió con un código de familia?',
  'auth.aside.codeBody':
    'Un administrador de esa familia admite a los nuevos miembros. Puede iniciar sesión '
    + 'mientras espera: verá una pantalla de espera hasta que lo hagan.',
  'auth.aside.invitedTerm': '¿Recibió una invitación por correo?',
  'auth.aside.invitedBody':
    'Abra el enlace de la invitación en lugar de iniciar sesión aquí. Ese enlace sabe a qué '
    + 'familia se está uniendo y lo devolverá a la invitación una vez que haya iniciado sesión.',
  'auth.aside.wrongFamilyTerm': '¿Está en la familia equivocada?',
  'auth.aside.wrongFamilyBody':
    'Una cuenta puede pertenecer a más de una: el matrimonio pone a casi todo el mundo en '
    + 'dos. Inicie sesión con ella como siempre y cambie de familia desde la cabecera.',

  'auth.aside.noAccountLead': '¿Aún no tiene cuenta?',
  'auth.aside.createFree': 'Cree una gratis',
  'auth.aside.orSep': ', o',
  'auth.aside.readWhatApp': 'lea qué hace {app}',
  'auth.aside.ifUnsure': 'si le enviaron aquí y no sabe bien qué es esto.',

  'auth.aside.joiningHeading': 'Unirse a {app}',
  'auth.aside.joiningLede':
    '{app} le da a una familia extensa un lugar propio y privado, donde todas las '
    + 'generaciones tienen su lugar. No hay perfil público y nada se comparte fuera de la '
    + 'familia a la que se une. Sus miembros pueden:',
  'auth.aside.can1':
    'Organizar reencuentros y reuniones: quién hace qué, y si ya está hecho.',
  'auth.aside.can2':
    'Llevar el control de cuotas y aportaciones, para que nadie ande persiguiendo recibos.',
  'auth.aside.can3':
    'Compartir fotografías en colecciones a las que toda la familia puede añadir.',
  'auth.aside.can4':
    'Construir el árbol genealógico y conservar el registro de quién pertenece a quién.',
  'auth.aside.nextHeading': 'Qué sucede después',
  'auth.aside.confirmTerm': 'Confirme su correo electrónico.',
  'auth.aside.confirmBody':
    'Enviamos un enlace en cuanto se registra, y la cuenta permanece inactiva hasta que lo '
    + 'abre.',
  'auth.aside.joiningTerm': '¿Se une a una familia que ya existe?',
  'auth.aside.joiningBody':
    'Necesita su código de familia; pídalo a quien lo invitó. Su solicitud queda entonces a '
    + 'la espera de que uno de los administradores de esa familia lo admita, y puede iniciar '
    + 'sesión mientras tanto.',
  'auth.aside.startingTerm': '¿Empieza una nueva?',
  'auth.aside.startingBody':
    'Usted es su primer miembro y recibe un código de familia de seis caracteres para '
    + 'repartir. Cualquiera que lo tenga puede pedir unirse, y usted decide quién entra.',
  'auth.aside.freeForever':
    'La cuenta gratuita es gratis para siempre: sin tarjeta, sin reloj de prueba y sin cargo '
    + 'por familiar, sean los que sean.',
  'auth.aside.seeTiers': 'Vea qué incluye cada plan',
  'auth.aside.readHow': 'lea cómo funciona',
  'auth.aside.first': 'primero.',

  'auth.forgotNoAccount':
    'Use la dirección con la que se registró. Si nunca terminó de crear una cuenta, no hay '
    + 'nada que restablecer:',
  'auth.forgotSignUp': 'regístrese',
  'auth.forgotAskCode':
    'y pida a su familia su código si se está uniendo a una familia que ya existe.',

  'gath.upsell.inlineHave':
    'Con el plan {plan}, una reunión es una fecha, un lugar y una descripción.',
  'gath.upsell.inlineAdds':
    'añade listas de tareas, tareas asignadas a familiares por su nombre y un presupuesto '
    + 'tomado de un fondo.',
  'gath.upsell.title': 'Organice esta reunión con el plan {plan}',
  'gath.upsell.lede':
    'Su reunión ya está en el calendario y todos sus familiares pueden ver cuándo y dónde '
    + 'es. Con el plan {plan} se convierte en un plan.',
  'gath.upsell.checklistsLead': 'Listas que escribe una sola vez.',
  'gath.upsell.checklistsBody':
    'Un reencuentro es la Bienvenida, el Picnic y la Despedida: cree cada uno como una '
    + 'plantilla y prográmelo desde ahí todos los años.',
  'gath.upsell.jobsLead': 'Tareas con nombre y apellido.',
  'gath.upsell.jobsBody':
    'Cada paso se convierte en una tarea a cargo de un familiar, que la responde y recibe '
    + 'su aprobación o la devolución con comentarios. Nadie tiene que recordar quién dijo '
    + 'que traería las mesas.',
  'gath.upsell.budgetLead': 'Un presupuesto tomado de un fondo.',
  'gath.upsell.budgetBody':
    'Cuánto puede gastar la reunión, cuánto reclama cada parte de ella y si eso cabe en lo '
    + 'que la familia realmente tiene.',
  'gath.upsell.cta': 'Ver el plan {plan}',
  'plan.whatIncludes': 'Qué incluye cada plan',
  'plan.current': 'Actual',
  'plan.currentPlan': 'Plan actual',
  'plan.comingSoon': 'Muy pronto',
  'plan.features': 'Funciones',
  'plan.passwordHint':
    'Su contraseña de inicio de sesión, para que un plan no se baje por accidente.',
  'plan.notOnDeployment': 'No está disponible en esta instalación',
  'plan.billingFailed': 'No se pudo cargar la facturación',
  'plan.whatYouLose': 'Qué pierde',
  'plan.yoursToday': 'Este es el plan de su familia hoy. Todo lo de aquí está activado.',
  'chk.monthly': 'Mensual',
  'chk.inAdvance': 'Por adelantado',
  'chk.months': 'Meses',
  'chk.howFar': 'Cuánto pagar por adelantado',
  'chk.dueNow': 'A pagar ahora',
  'chk.leftOver': 'Sobrante, retenido como crédito en Stripe',
  'chk.sameOverall':
    'Las dos opciones cuestan lo mismo en total; la segunda solo liquida hoy el mes que '
    + 'viene.',
  'chk.payNothing': 'No pagar nada ahora',
  'chk.coverNext': 'Cubrir también el mes que viene: no hay nada que pagar',
  'chk.thisAndNext': 'Este mes y el siguiente',
  'chk.restOfMonth': 'El resto de este mes',
  'proc.loadFailed': 'No se pudo cargar la configuración de pagos',
  'proc.notOn': 'Los pagos en línea todavía no están activados',
  'proc.stripeAccount': 'Cuenta de Stripe',
  'proc.payingAuto': 'Integrantes que pagan automáticamente',
  'proc.feeHeading': 'Comisiones por pago con tarjeta',
  'proc.feeBlurb': 'Stripe cobra una comisión por cada pago con tarjeta. Sale del lado de su familia, y esto decide si la asume la familia o la cubre el integrante.',
  'proc.feeWhoPays': 'Quién paga la comisión',
  'proc.feePayerFamily': 'La familia la asume',
  'proc.feePayerMember': 'La cubre el integrante',
  'proc.feePercent': 'Porcentaje (%)',
  'proc.feeFixed': 'Importe fijo por pago ($)',
  'proc.feeExplainFamily': 'A un integrante que debe $40.00 se le cobran $40.00, y su cuota baja $40.00. Su familia recibe lo que queda después de la comisión de Stripe.',
  'proc.feeExplainMember': 'A un integrante que debe {owed} se le cobran {charged}, así que su familia recibe los {owed} completos y su cuota baja {owed}. El importe adicional se muestra en una línea aparte antes de pagar.',
  'proc.feeRateUnusable': 'Esa tasa no se puede añadir a un pago. Reduzca el porcentaje.',
  'proc.feesRecordedSoFar': 'GENORRA ha registrado {amount} en comisiones de tarjeta sobre los pagos que registró.',
  'proc.billShowTotal': 'Mostrar el total propio de Stripe para esta cuenta',
  'proc.billAsking': 'Consultando a Stripe…',
  'proc.billTotal': 'El total propio de Stripe para esta cuenta es {amount}, en {n} transacciones.',
  'proc.billTotalAtLeast':
    'El total propio de Stripe es de al menos {amount}: las primeras {n} transacciones. '
    + 'El historial es más largo de lo que se puede leer de una vez, así que tómelo como un mínimo.',
  'proc.billDifference':
    'La diferencia de {amount} son comisiones de cargos que GENORRA no registró, más lo '
    + 'que Stripe cobre a la cuenta en sí. Eso no está en el estado de resultados, a propósito.',
  'proc.billBelowRecorded':
    'El total de Stripe es {amount} MENOR que lo registrado aquí, lo cual no debería ocurrir: '
    + 'el estado de resultados podría estar exagerando las comisiones de esta familia.',
  'proc.billNoAccount': 'No hay ninguna cuenta de Stripe conectada que totalizar.',
  'proc.billUnavailable': 'No se pudo contactar con Stripe. La cifra registrada arriba no se ve afectada.',
  'proc.feePolicySaved': 'Guardado',
  'proc.continueStripe': 'Continuar en Stripe',
  'proc.checkStripe': 'Comprobar con Stripe',
  'proc.disconnect': 'Desconectar',
  'proc.passwordHint':
    'Su contraseña de inicio de sesión. Después le enviaremos un código por correo para '
    + 'terminar.',
  'proc.linkExpired':
    'Ese enlace de Stripe venció antes de terminarse. No se perdió nada: pulse Continuar en '
    + 'Stripe para seguir donde se quedó la familia.',
  'proc.disconnectConfirm': '¿Desconectar Stripe?',
  'proc.codeFailed': 'No pudimos enviar el código. Nada ha cambiado; inténtelo de nuevo.',
  'proc.enterCode': 'Escriba el código que le enviamos por correo',
  'proc.disconnectStripe': 'Desconectar Stripe',
  'proc.disconnected': 'Stripe está desconectado',
  'proc.noProcessor': 'No hay procesador de pagos conectado',
  'proc.cannotPay':
    'Los integrantes no pueden pagar sus cuotas con tarjeta mientras esto esté desconectado. '
    + 'Al reconectar vuelve la misma cuenta de Stripe, con su historial y sus datos bancarios '
    + 'exactamente como estaban.',
  'proc.connectHint':
    'Conecte la cuenta de Stripe de esta familia y los integrantes podrán pagar sus cuotas '
    + 'con tarjeta. Los pagos entran en los libros y se asignan a los fondos por su cuenta, '
    + 'igual que un pago capturado a mano.',
  'proc.opening': 'Abriendo Stripe…',
  'proc.reconnect': 'Reconectar Stripe',
  'proc.connect': 'Conectar una cuenta de Stripe',
  'proc.cardsOn': 'Los pagos con tarjeta están activados',
  'proc.stripeNeeds': 'Stripe todavía necesita algo de esta familia',
  'proc.stripeReviewing': 'Stripe está revisando esta cuenta',
  'proc.membersSeeButton':
    'Los integrantes ven un botón Pagar en línea junto a cada cuota que deben.',
  'proc.finishFirst':
    'Los integrantes no pueden pagar en línea hasta que esto se termine. Continúe en Stripe '
    + 'para completarlo.',
  'proc.nothingMore':
    'No se necesita nada más de la familia. Los integrantes no pueden pagar en línea hasta '
    + 'que Stripe termine.',
  'esum.noOffices': 'Esta elección no tiene cargos.',
  'esum.nobodyStanding': 'Nadie se postula para este cargo.',
  'esum.electionIs': 'Esta elección es',
  'esum.canVote': 'Pueden votar',
  'esum.canVoteHint':
    'Integrantes aprobados de la parte de la familia de esta elección, con cuenta',
  'esum.haveVoted': 'Han votado',
  'esum.haveNot': 'No han votado',
  'esum.chaseFromDirectory': 'No se nombra a nadie: siga desde el Directorio',
  'esum.onBallot': 'En la boleta',
  'esum.onBallotHint': 'Nominaciones que han sido aceptadas',
  'esum.results': 'Resultados',
  'esum.whereVotingStands': 'Cómo va la votación',
  'ms.clear': 'Limpiar la búsqueda',
  'ms.prevPage': 'Página anterior',
  'ms.nextPage': 'Página siguiente',
  'org.attached.memberOne': '1 integrante',
  'org.attached.memberMany': '{n} integrantes',
  'org.attached.dueOne': '1 cuota',
  'org.attached.dueMany': '{n} cuotas',
  'org.attached.announcementOne': '1 anuncio',
  'org.attached.announcementMany': '{n} anuncios',
  'org.attached.positionOne': '1 cargo',
  'org.attached.positionMany': '{n} cargos',
  'org.deleteRegionAria': 'Eliminar la región {name}',
  'org.deleteChapterAria': 'Eliminar el capítulo {name}',
  'org.regionForAria': 'Región del capítulo {name}',
  'plan.upgradeTo': 'Cambiar a {plan}',
  'plan.downgradeTo': 'Bajar a {plan}',
  'plan.downgradeBilledWithDate':
    'Nada cambia hoy. {current} sigue abierto hasta el final del período que ya pagó, y '
    + '{next} empieza el {date}. No hay reembolso por el resto de este período: eso es lo que '
    + 'mantiene las pantallas abiertas hasta que termine. No se borra nada entonces, y lo que '
    + 'el plan más barato no incluye se conserva sesenta días después.',
  'plan.downgradeBilled':
    'Nada cambia hoy. {current} sigue abierto hasta el final del período que ya pagó. No hay '
    + 'reembolso por el resto de este período: eso es lo que mantiene las pantallas abiertas '
    + 'hasta que termine. No se borra nada entonces, y lo que el plan más barato no incluye se '
    + 'conserva sesenta días después.',
  'plan.downgradeUnbilled':
    'Las pantallas que forman parte de {current} dejan de abrirse. No se borra nada hoy: cada '
    + 'registro queda exactamente donde está durante sesenta días, y si vuelve a subir dentro de '
    + 'esos sesenta días las pantallas regresan con sus datos intactos. Después de sesenta días '
    + 'se elimina, con cuatro recordatorios antes.',
  'proc.consequenceBase':
    'Los integrantes ya no podrán pagar en línea. Todos los pagos ya registrados se '
    + 'conservan, y la cuenta de Stripe de la familia queda intacta.',
  'proc.consequenceNone': 'Puede reconectar la misma cuenta en cualquier momento.',
  'proc.consequenceOne':
    '1 familiar paga sus cuotas automáticamente, y ese cobro se cancela en Stripe. Al '
    + 'reconectar vuelve la cuenta pero NO los cobros: ese familiar tendría que configurarlo de '
    + 'nuevo.',
  'proc.consequenceMany':
    '{n} familiares pagan sus cuotas automáticamente, y esos cobros se cancelan en Stripe. Al '
    + 'reconectar vuelve la cuenta pero NO los cobros: cada uno tendría que configurarlo de '
    + 'nuevo.',
  'set.removeBody':
    'Nadie podrá abrir esta familia, unirse a ella ni aceptar una invitación. No se borra '
    + 'nada: cada registro queda exactamente donde está, y solo el equipo de GENORRA puede '
    + 'restaurar la familia.',
  'org.attached.electionOne': '1 elección',
  'org.attached.electionMany': '{n} elecciones',
  'org.stillAttached': '{name} todavía tiene {what} asociados, así que no se puede eliminar.',
  'acct.section.dues': 'Cuotas',
  'acct.section.funds': 'Fondos',
  'pos.cat.executive_officer': 'Directivo',
  'pos.cat.appointed_position': 'Cargo designado',
  'pos.scope.national': 'Nacional',
  'pos.scope.regional': 'Regional',
  'pos.scope.chapter': 'Capítulo',
  'pos.scopedName': '{name} {scope}',
  'pos.duplicateAtScope':
    'Su familia ya tiene un cargo {scope} llamado «{name}». El mismo título puede existir una '
    + 'vez en cada alcance.',

  // ── THE ADMIN SCREENS ────────────────────────────────────────────────────────────
  'access.rail': 'Integrantes y accesos',
  'access.tab.members': 'Miembros',
  'access.tab.organization': 'Organización',
  'access.tab.approvals': 'Aprobaciones pendientes',
  'access.tab.templates': 'Plantillas de permisos',
  'access.noTables': 'No se encontraron las tablas de permisos.',
  'access.readOnlyMembers':
    'Puede ver la lista de integrantes pero no cambiar quién está en qué plantilla.',
  'access.readOnlyTemplates': 'Puede ver qué otorga cada plantilla pero no cambiarla.',
  'access.readOnlyOrg': 'Puede ver cómo está organizada la familia pero no cambiarla.',
  'access.officesKept': 'Los cargos que su familia mantiene. Un',
  'access.whoHoldsWhat': 'Quién ocupa qué se define en la pestaña Integrantes',
  'access.permissions': 'Permisos',
  'access.noTemplates': 'Todavía no hay plantillas.',
  'access.profile': 'Perfil',
  'access.reviewInApprovals': 'Revisar en Aprobaciones pendientes',
  'access.cannotDisableSelf': 'No puede desactivar su propio acceso.',
  'access.enableMember': 'Activar al integrante',
  'access.disableMember': 'Desactivar al integrante',
  'access.enable': 'Activar',
  'access.disable': 'Desactivar',
  'access.templates': 'Plantillas',
  'access.startFrom': 'Partir de',
  'access.blank': 'En blanco',
  'access.copyOf': 'Una copia de…',
  'access.create': 'Crear',
  'access.all': 'Todo',
  'access.own': 'Propios',
  'access.nothing': 'Nada',
  'access.selectTemplate': 'Elija una plantilla para editar lo que otorga.',
  'access.filterPh': 'Filtrar integrantes por nombre o correo…',
  'access.templatesHelp': 'Ayuda: plantillas de permisos',
  'access.newTemplate': 'Plantilla nueva',
  'access.templateNamePh': 'Comité de la reunión',
  'access.templateToCopy': 'Plantilla a copiar',
  'access.templateName': 'Nombre de la plantilla',
  'access.awaiting': 'Esperando aprobación',
  'access.disabled': 'Desactivado',
  'access.approved': 'Aprobado',
  'access.disabledNoAccess': 'Desactivado: sin acceso a esta familia',
  'access.noMatch': 'Ningún integrante coincide con ese filtro.',
  'access.cannotDeleteAccount':
    'Esta persona tiene una cuenta, así que su ficha no se puede eliminar aquí. Desactívela en su lugar, desde el menú de su fila.',
  'access.thisRecord': 'esta ficha',
  'access.viewAccounts': 'Con cuenta',
  'access.viewRecords': 'Fichas',
  'access.whichPeople': 'Qué personas listar',
  'access.recordsLede':
    'Parientes que alguien anotó en el árbol familiar y que nunca han tenido cuenta. No tienen permisos, y la mayoría tiene una dirección que el producto generó para ellos.',
  'access.noRecords': 'Nadie de esta familia se ha anotado sin cuenta.',
  'access.noRecordMatch': 'Ninguna ficha coincide con eso.',
  'access.generatedEmail': 'Dirección generada',
  'access.editProfileFor': 'Editar el perfil de {name}',
  'access.deleteRecord': 'Eliminar ficha',
  'access.deleteRecordNamedAria': 'Eliminar la ficha de {name}',
  'access.deleteRecordTitle': '¿Eliminar esta ficha?',
  'access.deleteRecordBody':
    'Esto elimina permanentemente a {name} y todo lo anotado sobre esta persona: su lugar en el árbol familiar, cualquier etiqueta de fotografía que la nombre, y cualquier junta o comprobación en la que estuviera incluida. No se puede deshacer. Nadie más se ve afectado.',
  'access.noAccounts': 'Todavía no hay integrantes con cuenta en esta familia.',
  'access.noTemplate': 'Sin plantilla',
  'access.applyTemplate': 'Aplicar la plantilla de permisos',
  'access.applyTemplateAction': 'Aplicar la plantilla',
  'access.givePosition': 'Dar un cargo de la directiva',
  'access.changePosition': 'Cambiar el cargo de la directiva',
  'access.boardPositions': 'Cargos de la directiva',
  'access.saveTemplate': 'Guardar la plantilla',
  'access.deleteTemplate': 'Eliminar la plantilla',
  'access.whatMayDo': 'Lo que pueden hacer los integrantes con esta plantilla.',
  'access.expandAll': 'Expandir todo',
  'access.collapseAll': 'Contraer todo',
  'access.changeGrants': 'Cambiar lo que otorga esta plantilla',
  'ael.new': 'Elección nueva',
  'ael.newLower': 'Elección nueva',
  'ael.whoVotes': 'Quién vota',
  'ael.noAreas':
    'Esta familia todavía no tiene regiones ni capítulos, así que toda elección es Nacional.',
  'ael.opens': 'Se abre',
  'ael.closesAfter': 'Se cierra después de',
  'ael.voting': 'Votación',
  'ael.positions': 'Cargos',
  'ael.winners': 'Ganadores',
  'ael.none': 'Todavía no hay elecciones.',
  'ael.announce': 'Anunciar',
  'ael.publish': 'Publicar',
  'ael.returnToDraft': 'Volver a borrador',
  'ael.titlePh': 'Elecciones de la directiva 2027',
  'ael.whichPart': 'Para qué parte de la familia es esta elección',
  'ael.wholeFamily': 'Toda la familia (Nacional)',
  'ael.oneRegion': 'Una región',
  'ael.oneChapter': 'Un capítulo',
  'ael.needTitle': 'Póngale un título a la elección.',
  'ael.needRegion': 'Elija qué región.',
  'ael.needChapter': 'Elija qué capítulo.',
  'ael.saveFailed': 'No se pudo guardar la elección.',
  'ael.needPosition':
    'Agregue al menos un cargo antes de publicar: una boleta sin cargos no tiene nada que '
    + 'votar.',
  'ael.publishConfirm': 'Publicar esta elección',
  'ael.publishFailed': 'No se pudo publicar.',
  'ael.draftFailed': 'No se pudo volver a borrador.',
  'ael.delete': 'Eliminar la elección',
  'ael.deleteFailed': 'No se pudo eliminar.',
  'ael.editDraft': 'Editar el borrador',
  'ael.onlyDraft':
    'Solo se puede editar un borrador. Una vez publicada, sus fechas son lo que se le dijo a '
    + 'la familia.',
  'ael.savedDraft': 'Guardada como borrador: nadie la ve hasta que la publique.',
  'ael.saveDraft': 'Guardar el borrador',
  'ael.createDraft': 'Crear el borrador',
  'fnd.none': 'Todavía no hay fondos.',
  'fnd.minBalance': 'Saldo mínimo ($, opcional)',
  'fnd.openToMembers': 'Abierto a aportaciones de los integrantes',
  'fnd.fund': 'Fondo',
  'fnd.balance': 'Saldo',
  'fnd.collected': 'Recaudado',
  'fnd.disbursed': 'Pagado',
  'fnd.transferred': 'Transferido',
  'fnd.minimum': 'Mínimo',
  'fnd.builtIn': 'Integrado',
  'fnd.open': 'Abierto',
  'fnd.createFirst': 'Cree primero un fondo: un logro se paga de uno.',
  'fnd.noMilestones': 'Todavía no hay logros.',
  'fnd.milestoneName': 'Nombre del logro',
  'fnd.awardAmount': 'Monto del premio ($)',
  'fnd.milestone': 'Logro',
  'fnd.award': 'Premio',
  'fnd.duesRouting': 'Asignación de cuotas',
  'fnd.createFirstRouting': 'Cree primero un fondo para configurar la asignación.',
  'fnd.allocation': 'Asignación',
  'fnd.priority': 'Prioridad',
  'fnd.allocationPct': 'Asignación %',
  'fnd.minimumDollars': 'Mínimo $',
  'fnd.minimumDollarsPlain': 'Mínimo $',
  'fnd.newFundHint': 'Una bolsa a la que se asignan las cuotas y de la que salen los pagos.',
  'fnd.namePh': 'Fondo universitario',
  'fnd.minPh': '5000.00',
  'fnd.descPh': 'Para los que se gradúan…',
  'fnd.donationsFundHint':
    'Se crea automáticamente. Guarda cada donación que recibe la familia, puede recibir una '
    + 'parte de las cuotas como cualquier otro fondo, y no se puede eliminar ni desactivar.',
  'fnd.newMilestoneHint':
    'Un premio que se le puede pagar a un integrante de un fondo cuando lo alcanza.',
  'fnd.milestonePh': 'Terminar la preparatoria',
  'fnd.awardPh': '250.00',
  'fnd.milestoneDescPh': 'Certificado de preparatoria o equivalente',
  'fnd.moveUp': 'Subir',
  'fnd.moveDown': 'Bajar',
  'fnd.routingOff':
    'La asignación está apagada. Las aportaciones se quedan en el fondo al que se dieron '
    + 'hasta que estas sumen 100 %.',
  'fnd.saveRouting': 'Guardar la asignación',
  'fnd.saveRoutingConfirm':
    '¿Guardar esta configuración de asignación? Los pagos de cuotas futuros se repartirán '
    + 'entre los fondos con estos porcentajes y prioridades.',
  'fnd.routingSaved': 'Asignación guardada.',
  'fnd.saveFailed': 'No se pudo guardar',
  'fnd.nameRequired': 'El nombre es obligatorio',
  'fnd.delete': 'Eliminar el fondo',
  'fnd.deleteBody': '¿Eliminar este fondo y sus logros? Esto no se puede deshacer.',
  'fnd.openToContrib': 'Abrir el fondo a aportaciones',
  'fnd.closeToContrib': 'Cerrar el fondo a aportaciones',
  'fnd.openFund': 'Abrir el fondo',
  'fnd.closeFund': 'Cerrar el fondo',
  'fnd.needAll': 'Se requieren fondo, nombre y monto',
  'fnd.deleteMilestone': 'Eliminar el logro',
  'fnd.deleteMilestoneBody': '¿Eliminar este logro? Esto no se puede deshacer.',
  'fnd.addFund': 'Agregar el fondo',
  'fnd.openToMembersShort': 'Abierto a los integrantes',
  'fnd.makeOpen': 'Abrirlo',
  'fnd.addMilestone': 'Agregar el logro',
  'fnd.saveRoutingAction': 'Guardar la asignación',
  'agat.rail': 'Áreas de gestión de reuniones',
  'agat.pane.gatherings': 'Reuniones',
  'agat.pane.queue': 'Cola de revisión',
  'agat.pane.templates': 'Plantillas',
  'agat.management': 'Gestión de reuniones',
  'agat.memberView': 'Vista de integrante',
  'agat.details': 'Detalles',
  'agat.location': 'Lugar',
  'agat.summary': 'Resumen',
  'agat.delete': 'Eliminar la reunión',
  'agat.readOnly': 'Puede ver el plan de esta reunión pero no cambiarlo.',
  'agat.dashboardBand': 'Banda del panel',
  'agat.showAcrossTop': 'Mostrar esto en la parte superior del panel',
  'agat.bandPhoto': 'Foto de la banda',
  'agat.removePhoto': 'Quitar la foto',
  'agat.fundAndBudget': 'Fondo y presupuesto',
  'agat.segments': 'Segmentos',
  'agat.noSegments':
    'No hay plantillas vinculadas a esta reunión, así que todavía no tiene segmentos.',
  'agat.segment': 'Segmento',
  'agat.day': 'Día',
  'agat.place': 'Lugar',
  'agat.addSegment': 'Agregar otro segmento',
  'agat.createOneUnder': 'Cree uno en',
  'agat.somebodyAccounting':
    'Alguien que lleve la Contabilidad de la familia tiene que crear uno, y queda disponible '
    + 'aquí.',
  'agat.severalMayDraw':
    'Varias reuniones pueden tomar de un mismo fondo. Quitar el fondo quita el presupuesto '
    + 'con él.',
  'agat.budgetDollars': 'Presupuesto ($)',
  'agat.taskReadOnly': 'Puede leer esta tarea pero no asignarla ni resolverla.',
  'agat.leaveUnassigned': 'Dejarla sin asignar',
  'agat.budgetLine': 'Partida ($)',
  'agat.review': 'Revisar',
  'agat.whatNeedsChange': 'Qué hay que cambiar',
  'agat.sendBack': 'Devolver…',
  'agat.approvedAnswer': 'Esta respuesta está aprobada',
  'agat.whyOptional': 'Por qué, si quiere decirlo (opcional)',
  'agat.reopenEllipsis': 'Reabrir…',
  'agat.fundHelp': 'Cómo funcionan el fondo y el presupuesto de una reunión',
  'agat.usualPlace': 'El lugar habitual de la plantilla',
  'agat.notStated': 'Sin especificar',
  'agat.assigneeHint':
    'Cualquiera que la familia haya aprobado, tenga cuenta o no: a un familiar sin acceso '
    + 'también se le puede pedir que lleve las fotografías.',
  'agat.nobodyApproved': 'Todavía no se ha aprobado a nadie en esta familia.',
  'agat.nothingSet': 'Sin definir',
  'agat.notePh1': 'El servicio de banquetes necesita un teléfono además del nombre.',
  'agat.notePh2': 'El salón cambió la reserva, así que hay que rehacer el horario.',
  'agat.saveFailed': 'No se pudo guardar esa reunión',
  'agat.changeFailed': 'No se pudo cambiar eso',
  'agat.uploadFailed': 'No se pudo subir esa foto',
  'agat.removePhotoFailed': 'No se pudo quitar esa foto',
  'agat.addTemplateFailed': 'No se pudo agregar esa plantilla',
  'agat.removeTemplate': 'Quitar la plantilla',
  'agat.removeTemplateFailed': 'No se pudo quitar esa plantilla',
  'agat.deleteFailed': 'No se pudo eliminar esa reunión',
  'agat.noDates': 'Todavía sin fechas',
  'agat.addSteps': 'Agregar sus pasos',
  'agat.noTasksAddTemplate':
    'Todavía no hay tareas. Agregue una plantilla arriba y sus pasos se convierten en tareas '
    + 'aquí.',
  'agat.manage': 'Administrar',
  'agat.segmentFailed': 'No se pudo guardar ese segmento',
  'agat.template': 'Plantilla',
  'agat.noTasksFromThis': 'No hay tareas de esta',
  'agat.budgetFailed': 'No se pudo guardar ese presupuesto',
  'agat.noBudgetSet': 'Sin presupuesto',
  'agat.chooseFundFirst': 'Elija primero un fondo',
  'agat.saveBudget': 'Guardar el presupuesto',
  'agat.saveThatFailed': 'No se pudo guardar eso',
  'agat.budgetLineFailed': 'No se pudo guardar esa partida',
  'agat.approveThis': 'Aprobar esta respuesta',
  'agat.approve': 'Aprobar',
  'agat.approveFailed': 'No se pudo aprobar esa respuesta',
  'agat.sayWhatChanges':
    'Diga qué hay que cambiar: esto es lo que leen antes de intentarlo de nuevo.',
  'agat.sayWhatChangesMember':
    'Diga qué hay que cambiar: esto es lo que lee el integrante antes de intentarlo de nuevo.',
  'agat.sendBackFailed': 'No se pudo devolver esa tarea',
  'agat.reopenThis': 'Reabrir esta tarea',
  'agat.reopen': 'Reabrir',
  'agat.reopenFailed': 'No se pudo reabrir esa tarea',
  'agat.approvedAnswerLabel': 'La respuesta aprobada',
  'agat.theirAnswer': 'Su respuesta',
  'agat.approved': 'Aprobada',
  'agat.sentBack': 'Devuelta',
  'agat.saveWhoWhen': 'Guardar quién y cuándo',
  'agat.saveBudgetLine': 'Guardar la partida',
  'agat.sendBackWithNotes': 'Devolver con notas',
  'agat.reopening': 'Reabriendo…',
  'agat.new': 'Reunión nueva',
  'agat.when': 'Cuándo',
  'agat.budgetUnavailable': 'Presupuesto no disponible',
  'agat.unavailable': 'No disponible',
  'agat.open': 'Abiertas',
  'agat.noBudget': 'Sin presupuesto',
  'agat.queueReadOnly': 'Puede ver lo que está esperando pero no resolverlo.',
  'agat.nothingRecorded': 'No se registró nada con este envío.',
  'agat.theirNote': 'Su nota',
  'agat.addOneIn': 'Agregue una en',
  'agat.starts': 'Empieza',
  'agat.ends': 'Termina',
  'agat.singleDay': 'Déjelo vacío para un solo día.',
  'agat.openGathering': 'Abrir la reunión',
  'agat.premierHint':
    'Marcada para el panel. Se pueden marcar varias reuniones; se muestra la más próxima.',
  'agat.pickTemplates': 'Elija las plantillas en las que se basa, y luego diga cuándo y dónde.',
  'agat.summaryPh': 'Qué es esta reunión, para las personas a las que se les pide ayuda.',
  'agat.pressNew': 'Pulse Reunión nueva y elija las plantillas en las que debe basarse.',
  'agat.somebodySchedule': 'Alguien que pueda programar reuniones tiene que crear la primera.',
  'agat.noFund': 'Sin fondo',
  'agat.createFailed': 'No se pudo crear esa reunión',
  'agat.everyStep':
    'Cada paso de las plantillas que elija se convierte en una tarea que puede repartir. No '
    + 'elija ninguna y esto es una fecha sin tareas.',
  'agat.create': 'Crear la reunión',
  'tmpl.name': 'Nombre de la plantilla',
  'tmpl.whoCanSchedule': 'Quién puede programar desde esta',
  'tmpl.whoCanScheduleShort': 'Quién puede programar',
  'tmpl.step': 'Paso',
  'tmpl.whatItAsks': 'Qué pide',
  'tmpl.templateToInclude': 'Plantilla a incluir',
  'tmpl.pickTemplate': 'Elija una plantilla…',
  'tmpl.helpText': 'Texto de ayuda',
  'tmpl.suggestedBudget': 'Presupuesto sugerido ($)',
  'tmpl.suggestedBudgetShort': 'Presupuesto sugerido',
  'tmpl.add': 'Agregar la plantilla',
  'tmpl.readOnly': 'Puede ver esta plantilla pero no cambiarla.',
  'tmpl.archiveInstead': 'Archívela en su lugar',
  'tmpl.steps': 'Pasos',
  'tmpl.addStep': 'Agregar un paso',
  'tmpl.noSteps': 'Todavía no hay pasos. Una plantilla sin pasos crea una reunión sin trabajo.',
  'tmpl.asksFor': 'Pide',
  'tmpl.namePh': 'p. ej. Reunión familiar',
  'tmpl.descPh':
    'Para qué es esta plantilla, y lo que un organizador deba saber antes de programar con '
    + 'ella.',
  'tmpl.stepsHint':
    'Un paso por cada cosa que alguien tiene que hacer o decidir. Los pasos se copian en las '
    + 'tareas de cada reunión programada con esta plantilla, así que editar uno nunca cambia '
    + 'una reunión que ya está en marcha.',
  'tmpl.stepPh': 'p. ej. Reservar el salón',
  'tmpl.helpPh':
    'Lo que la persona asignada debe saber: a quién llamar, qué cuenta como terminado.',
  'tmpl.adminsOnly': 'Solo administradores',
  'tmpl.anyMember': 'Cualquier integrante',
  'tmpl.adminsOnlyHint':
    'Solo alguien que pueda administrar reuniones puede iniciar una con esta plantilla.',
  'tmpl.anyMemberHint':
    'Cualquier integrante que pueda programar una reunión puede iniciar una con esta '
    + 'plantilla. Aun así no puede editar la plantilla.',
  'tmpl.notUsed': 'Todavía no la usa ninguna reunión',
  'tmpl.addFailed': 'No se pudo agregar esa plantilla',
  'tmpl.saveFailed': 'No se pudo guardar esa plantilla',
  'tmpl.addATemplate': 'Agregar una plantilla',
  'tmpl.nameItHint':
    'Póngale el nombre de la ocasión: «Reunión familiar», «Servicio conmemorativo», «Cena de '
    + 'becas». Sus pasos se agregan en la tarjeta una vez que está en la lista.',
  'tmpl.neverChanges':
    'Cambiar una plantilla nunca cambia una reunión ya construida con ella: cada tarea '
    + 'conserva su propia copia de lo que pedía.',
  'tmpl.pickStepTemplate': 'Elija la plantilla que incluye este paso',
  'tmpl.addStepFailed': 'No se pudo agregar ese paso',
  'tmpl.saveStepFailed': 'No se pudo guardar ese paso',
  'tmpl.requiredHint': 'La reunión no está terminada hasta que esta se responda y se apruebe.',
  'tmpl.optionalHint': 'Útil pero opcional: la reunión se puede completar sin ella.',
  'tmpl.addOneThen': 'Agregue una, y luego déle un paso por cada cosa que alguien tenga que hacer.',
  'tmpl.somebodyCan': 'Alguien que pueda agregar plantillas tiene que crear la primera.',
  'tmpl.archiveFailed': 'No se pudo archivar esa plantilla',
  'tmpl.restoreFailed': 'No se pudo restaurar esa plantilla',
  'tmpl.delete': 'Eliminar la plantilla',
  'tmpl.deleteFailed': 'No se pudo eliminar esa plantilla',
  'tmpl.moveStepFailed': 'No se pudo mover ese paso',
  'tmpl.deleteStep': 'Eliminar el paso',
  'tmpl.deleteStepFailed': 'No se pudo eliminar ese paso',
  'tmpl.restore': 'Restaurar',
  'tmpl.archive': 'Archivar',
  'inc.goalAmount': 'Monto de la meta',
  'inc.dueAmount': 'Monto de la cuota',
  'inc.frequency': 'Frecuencia',
  'inc.startAge': 'Los integrantes empiezan a pagar a la edad de (opcional)',
  'inc.noBloodline': 'Todavía no se ha marcado a nadie como perteneciente al linaje de su familia, así que una cuota restringida a él no la debería nadie. Marque {control} en el árbol familiar primero.',
  'inc.owedBy': 'Lo deben',
  'inc.nationalWhole': 'Nacional: toda la familia',
  'inc.goal': 'Meta',
  'inc.payment': 'Pago',
  'inc.startDate': 'Fecha de inicio',
  'inc.endDate': 'Fecha de término',
  'inc.driveFor': 'Esta campaña es para (opcional)',
  'inc.newDues': 'Cuota nueva',
  'inc.editDues': 'Editar la cuota',
  'inc.duesHint': 'Cuotas que cada integrante de la familia debe con esta frecuencia.',
  'inc.noDues': 'Todavía no hay cuotas.',
  'inc.annualDues': 'Cuota anual',
  'inc.newDonation': 'Donación nueva',
  'inc.editDonation': 'Editar la donación',
  'inc.noDonations': 'Todavía no hay donaciones.',
  'inc.scholarshipDrive': 'Campaña de becas',
  'inc.cannotDecline': 'Cada integrante debe esto y no puede rechazarlo.',
  'inc.canOptOut':
    'Los integrantes pueden rechazar esto desde su Resumen, y no contará en lo que deben.',
  'inc.blankAge': 'Déjelo en blanco y cada integrante debe esto, sea cual sea su edad.',
  'inc.bloodlineHint': 'Solo los miembros marcados como pertenecientes al linaje de la familia deben esto. Quien se casó con la familia, y quien la familia no haya marcado, no debe nada y no lo verá en su pantalla de Cuotas.',
  'inc.whoOwesIt': 'Quién la debe',
  'inc.scopeAllMembers': 'Todos los integrantes',
  'inc.scopeBloodline': 'Solo el linaje',
  'inc.scopeNonBloodline': 'Solo los familiares que se casaron con la familia',
  'inc.nonBloodlineHint':
    'Solo la deben los familiares que NO están marcados como parte del linaje. '
    + 'Alguien del linaje nunca la deberá.',
  'inc.whereItLands': 'Dónde llega un pago',
  'inc.fundWaterfall': 'Repartir entre los fondos (Encaminamiento)',
  'inc.fundWaterfallHint': 'Los pagos se reparten entre los fondos de la familia según la tabla de Encaminamiento.',
  'inc.fundDirectHint': 'El pago completo va a este único fondo. Se omite el encaminamiento.',
  'inc.straightToFund': 'Directo a {fund}',
  'inc.aDeletedFund': 'un fondo',
  'dues.onlyMembersWhoMarriedIn': 'Solo la deben los familiares que no están en el linaje',
  'act.donationsGoToDonationsFund':
    'Una campaña de donaciones siempre va al fondo de Donaciones de la familia '
    + 'y no puede indicar otro.',
  'inc.howeverCame': 'Cada integrante debe esto, sin importar cómo entró en la familia.',
  'inc.everyMember': 'Cada integrante de la familia debe esto.',
  'inc.regionHint':
    'Solo los integrantes cuyo capítulo está en esa región deben esto. Un integrante sin '
    + 'capítulo queda bajo Nacional y no debe nada regional.',
  'inc.chapterHint':
    'Solo los integrantes de ese capítulo deben esto. Un integrante sin capítulo queda bajo '
    + 'Nacional y no debe nada delimitado.',
  'inc.fixedTerms':
    'Se han registrado pagos contra esta cuota, así que su fecha de inicio, monto, '
    + 'frecuencia, edad de inicio, ajuste de línea de sangre y quién la debe quedan fijos: cada '
    + 'uno de esos pagos se hizo bajo estos términos. La fecha de término aún puede cambiar.',
  'inc.donationFixed': 'Esta donación ha recibido fondos, así que su fecha de inicio queda fija.',
  'inc.amountRequired': 'El monto es obligatorio',
  'inc.endInPast': 'La fecha de término no puede estar en el pasado.',
  'mpe.loading': 'Cargando el perfil de este integrante…',
  'mpe.nationalNoChapter': 'Nacional: sin capítulo',
  'mpe.signIn': 'Inicio de sesión',
  'mpe.general': 'General',
  'mpe.address': 'Dirección',
  'mpe.additional': 'Información adicional',
  'mpe.relativesMove': 'Los familiares sin cuenta propia se mueven con ellos.',
  'mpe.loadFailed': 'No se pudo cargar a ese integrante.',
  'mpe.bothRequired': 'El nombre y el apellido son obligatorios.',
  'mpe.saveThis': 'Guardar el perfil de este integrante',
  'mpe.saveFailed': 'No se pudieron guardar esos cambios.',
  'mpe.sendReset': 'Enviar un restablecimiento de contraseña',
  'mpe.currentKeeps': 'Su contraseña actual sigue funcionando hasta que lo use.',
  'mpe.sendLink': 'Enviar el enlace',
  'mpe.linkFailed': 'No se pudo enviar ese enlace.',
  'mpe.signInNotEditable': 'Su correo de inicio de sesión y su contraseña no se editan aquí.',
  'mpe.onlyMember': 'Solo el integrante puede cambiar su propia dirección de inicio de sesión.',
  'mpe.chooseCountry': 'Elija primero un país.',
  'agat.progress': '{done} de {total} aprobadas',
  'agat.waiting': '{n} en espera',
  'tmpl.usedByOne': 'La usa 1 reunión',
  'tmpl.usedByMany': 'La usan {n} reuniones',
  'inc.namedRegion': 'región {name}',
  'inc.namedChapter': 'capítulo {name}',
  'tmpl.deleteOneStep':
    '¿Eliminar «{name}» y su paso? Ninguna reunión ya construida con ella cambia: cada tarea '
    + 'conserva su propia copia de lo que pedía y de lo que se respondió. Esto no se puede '
    + 'deshacer.',
  'tmpl.deleteManySteps':
    '¿Eliminar «{name}» y sus {n} pasos? Ninguna reunión ya construida con ella cambia: cada '
    + 'tarea conserva su propia copia de lo que pedía y de lo que se respondió. Esto no se '
    + 'puede deshacer.',

  // ── SIGNING IN, REGISTERING, AND THE STAFF CONSOLE ───────────────────────────────
  'auth.login': 'Iniciar sesión',
  'auth.getStarted': 'Empezar',
  'auth.welcomeBack': 'Bienvenido de nuevo',
  'auth.password': 'Contraseña',
  'auth.forgot': '¿Olvidó su contraseña?',
  'auth.forgotTitle': '¿Olvidó su contraseña?',
  'auth.forgotLede': 'Escriba su correo y le enviaremos un enlace para restablecerla.',
  'auth.confirmEmail': 'Confirme su dirección de correo',
  'auth.createAccount': 'Crear una cuenta',
  'auth.noAccount': '¿No tiene cuenta? ',
  'auth.createOne': 'Cree una',
  'auth.badEmail': 'Escriba una dirección de correo válida',
  'auth.needPassword': 'La contraseña es obligatoria',
  'auth.signingIn': 'Iniciando sesión…',
  'auth.signIn': 'Iniciar sesión',
  'auth.sendLinkAgain': 'Enviar el enlace de nuevo',
  'auth.emailSent': 'Correo enviado',
  'auth.resetSent':
    'Si esa dirección está en nuestro sistema, recibirá en breve un enlace para restablecer '
    + 'la contraseña.',
  'auth.nothingArrived': '¿No llegó nada?',
  'auth.backToSignIn': 'Volver a iniciar sesión',
  'auth.sendReset': 'Enviar el enlace',
  'auth.signOut': 'Cerrar sesión',
  'auth.chooseNew': 'Elija una contraseña nueva',
  'auth.expiredLink': 'Ese enlace para restablecer venció. Pida uno nuevo e inténtelo otra vez.',
  'auth.tooShort': 'La contraseña debe tener al menos 8 caracteres',
  'auth.noMatch': 'Las contraseñas no coinciden',
  'reg.familyCreated': '¡Familia creada!',
  'reg.shareCode': 'Comparta este código con sus familiares para que puedan unirse.',
  'reg.yourCode': 'Su código familiar',
  'reg.writeDown': 'Anótelo: lo necesitará para invitar a sus familiares.',
  'reg.alsoSent': 'También le enviamos un enlace de confirmación. Púlselo para activar su cuenta.',
  'reg.startsOn': 'Su familia empieza en',
  'reg.goToDashboard': 'Ir al panel →',
  'reg.checkEmail': 'Revise su correo',
  'reg.confirmSent':
    'Le enviamos un enlace de confirmación. Púlselo para activar su cuenta y luego inicie '
    + 'sesión.',
  'reg.createYours': 'Cree su cuenta',
  'reg.joinFamily': 'Unirse a una familia',
  'reg.startFamily': 'Crear una familia nueva',
  'reg.invitedAddress': 'La dirección a la que se envió su invitación.',
  'reg.confirmPassword': 'Confirme la contraseña',
  'reg.codeShared': 'Escriba el código que le compartió su familia.',
  'reg.codeGenerated': 'Se generará un código familiar único para que lo comparta.',
  'reg.haveAccount': '¿Ya tiene cuenta? ',
  'reg.needFirstName': 'El nombre es obligatorio',
  'reg.needLastName': 'El apellido es obligatorio',
  'reg.needCode': 'El código familiar es obligatorio',
  'reg.needFamilyName': 'El nombre de la familia es obligatorio',
  'reg.freeForever': 'Gratis para siempre',
  'reg.canMove': 'Puede pasar a un plan pagado cuando quiera desde la configuración de la familia.',
  'reg.joining': 'Uniéndose…',
  'reg.creatingFamily': 'Creando la familia…',
  'reg.joinAction': 'Unirse a la familia',
  'reg.createAction': 'Crear la familia',
  'reg.firstNamePh': 'Ana',
  'reg.lastNamePh': 'García',
  'reg.codePh': 'p. ej. ABC123',
  'reg.familyNamePh': 'p. ej. Los García',
  'staff.nav': 'Consola de personal',
  'staff.overview': 'Resumen',
  'staff.families': 'Familias',
  'staff.accounts': 'Cuentas',
  'staff.access': 'Accesos',
  'staff.whoHasAccess': 'Quién tiene acceso',
  'staff.account': 'Cuenta',
  'staff.why': 'Por qué',
  'staff.granted': 'Otorgado',
  'staff.grantAccess': 'Otorgar acceso',
  'staff.kindOfAccess': 'Tipo de acceso',
  'staff.choose': 'Elija…',
  'staff.whyNeeded': 'Por qué lo necesita',
  'staff.you': 'Usted',
  'staff.addressUnknown': 'La dirección no se conoce desde aquí.',
  'staff.revoke': 'Revocar',
  'staff.emailPh': 'nombre@ejemplo.com',
  'staff.whyPh':
    'p. ej. En la rotación de soporte desde agosto. Escalamientos de tickets de facturación.',
  'staff.support': 'Soporte',
  'staff.engineer': 'Ingeniería',
  'staff.grantFailed': 'Eso no se completó. Inténtelo de nuevo.',
  'staff.granting': 'Otorgando…',
  'staff.ownAccess':
    'Su propio acceso. Otro propietario tiene que cambiarlo: eso es lo que evita que un clic '
    + 'bloquee la consola.',
  'staff.lastOwner':
    'El último propietario. Haga propietario a alguien más primero, o nadie podrá otorgar '
    + 'acceso de personal.',
  'staff.makeOwner': 'Hacer propietario',
  'staff.removeAccess': 'Quitar el acceso',
  'staff.lookUpOne': 'Buscar una dirección',
  'staff.noAccount': 'No existe ninguna cuenta con esta dirección.',
  'staff.accountExists': 'Existe una cuenta.',
  'staff.inTheseFamilies': 'En estas familias',
  'staff.allAccounts': 'Todas las cuentas',
  'staff.lastSignIn': 'Último inicio de sesión',
  'staff.created': 'Creada',
  'staff.inNoFamily': 'En ninguna familia',
  'staff.lookupPh': 'alguien@ejemplo.com',
  'staff.filterAddress': 'Filtrar por cualquier parte de una dirección…',
  'staff.enterFromTicket': 'Escriba la dirección del ticket.',
  'staff.confirmed': 'La dirección está confirmada.',
  'staff.hasSignedIn':
    'Ya se ha iniciado sesión con ella, así que la contraseña funcionaba en algún momento.',
  'staff.neverSignedIn':
    'Nunca se ha iniciado sesión con ella. Una contraseña olvidada es tan probable como '
    + 'cualquier otra cosa.',
  'staff.noAccounts': 'Todavía no hay cuentas en esta plataforma.',
  'staff.confirmedShort': 'Confirmada',
  'staff.notConfirmed': 'Sin confirmar',
  'staff.family': 'Familia',
  'staff.restore': 'Restaurar',
  'staff.restoreFamily': 'Restaurar la familia',
  'staff.filterFamily': 'Filtrar por nombre de familia o código…',
  'staff.noFamilies': 'Todavía no hay familias en esta plataforma.',
  'staff.removed': 'Eliminada',
  'staff.active': 'Activa',
  'staff.owner': 'Propietario',
  'staff.hint.support':
    'Puede abrir la consola y leer cada familia y cada cuenta de la plataforma, y restaurar '
    + 'una familia eliminada. No puede ver ni cambiar quién tiene acceso.',
  'staff.hint.engineer':
    'Exactamente el mismo acceso que Soporte hoy: nada en la consola los distingue. Es una '
    + 'etiqueta para sus propios registros, no un nivel.',
  'staff.hint.owner':
    'Todo lo anterior, más esta pantalla: puede otorgar acceso de personal, cambiar de qué '
    + 'tipo lo tiene cada quien, y quitarlo, incluido el suyo.',
  'inc.rangeBoth': '{from} – {to}',
  'inc.rangeFrom': 'desde el {from}',
  'inc.rangeUntil': 'hasta el {to}',

  // ──── THE FOUR PLAN TAGLINES — read by /admin/settings, /upgrade and /register ────
  'tier.tagline.free': 'Reúna a toda su familia en un solo lugar. A toda.',
  'tier.tagline.standard': 'Dirija la familia: el árbol, el dinero y quién hace qué.',
  'tier.tagline.plus': 'Para familias que cobran pagos de verdad y responden ante una directiva.',
  'tier.tagline.premium': 'En el bolsillo de cada familiar, y fuera en el mundo.',

  // ──── THE UPGRADE SCREEN’S SENTENCES ────────────────────────────────────────────
  // THE TAGLINE IS INTERPOLATED WHOLE AND NOT LOWERCASED. `UpgradeScreen` used to call
  // .toLowerCase() on it so it read as a mid-sentence clause — an English
  // typographic move that does not travel, since a tagline here can open on a
  // proper noun. So the join is part of this string and each language writes
  // the one it needs.
  'upg.forFamilies': 'El plan {tier} es para familias que necesitan más: {tagline}',
  'upg.alsoOn': 'También en {tier}',
  'upg.whatIncludes': 'Qué incluye {tier}',

  // ──── THE IN-PRODUCT PLAN LIST — 30 claims, keyed on their own id ───────────────
  'plan.adds.free/every-relative-free.label': 'Todos los familiares, sin cargo',
  'plan.adds.free/every-relative-free.detail': 'Integrantes ilimitados, sin comisión por persona.',
  'plan.adds.free/directory.label': 'Un directorio de toda la familia',
  'plan.adds.free/directory.detail': 'Quién es quién, y cómo contactarlos.',
  'plan.adds.free/shared-calendar.label': 'La reunión en un calendario compartido',
  'plan.adds.free/shared-calendar.detail':
    'La fecha, el lugar y los detalles, en una página que todos pueden ver.',
  'plan.adds.free/announcements.label': 'Anuncios que ve toda la familia',
  'plan.adds.free/announcements.detail':
    'Noticias de la familia en el panel de todo el mundo en vez de enterradas en un grupo '
    + 'de mensajes.',
  'plan.adds.free/chat.label': 'Chat, para toda la familia y privado',
  'plan.adds.free/chat.detail': 'Sigan hablando entre reuniones.',
  'plan.adds.free/one-account-many-families.label': 'Una cuenta, cuantas familias sean',
  'plan.adds.free/one-account-many-families.detail':
    'Pertenezca a las dos ramas, y cambie entre ellas sin un segundo acceso.',
  'plan.adds.free/nothing-scrolls-away.label': 'Nada se pierde cuando se va de la pantalla',
  'plan.adds.free/nothing-scrolls-away.detail':
    'Todos los anuncios, y todo lo que se le ha enviado, con búsqueda mucho después.',
  'plan.adds.free/manual.label': 'Un manual que sus familiares de verdad usarán',
  'plan.adds.free/manual.detail':
    'Cada pantalla explicada por su nombre, a la que se llega desde la esquina de la '
    + 'pantalla en la que están.',
  'plan.adds.standard/family-tree.label': 'El árbol familiar, trazado hacia atrás',
  'plan.adds.standard/family-tree.detail':
    'Cómo está relacionado cada uno, generación por generación, distinguiendo la sangre del '
    + 'matrimonio.',
  'plan.adds.standard/ledger.label': 'Un libro de verdad para el dinero que recauda',
  'plan.adds.standard/ledger.detail':
    'Planes de cuotas y un libro de aportaciones para el efectivo, registrado en vez de '
    + 'recordado.',
  'plan.adds.standard/gathering-budget.label': 'Organice la reunión, no solo la fecha',
  'plan.adds.standard/gathering-budget.detail':
    'Listas de comprobación a partir de las que se construye una reunión, y un presupuesto '
    + 'sacado de uno de sus fondos.',
  'plan.adds.standard/duties.label': 'Cada uno conoce sus tareas',
  'plan.adds.standard/duties.detail':
    'Cada paso entregado a un familiar con nombre, con lo que volvió y si se aceptó.',
  'plan.adds.standard/separation-of-duties.label': 'Separación de funciones',
  'plan.adds.standard/separation-of-duties.detail':
    'Permisos por función, para que registrar cuotas no sea lo mismo que pagar dinero.',
  'plan.adds.standard/profile-pictures.label': 'Una cara para cada nombre',
  'plan.adds.standard/profile-pictures.detail':
    'Fotos de perfil, en el directorio, en el árbol y en todas partes donde aparezca un '
    + 'integrante.',
  'plan.adds.plus/card-payments.label': 'Cobre como paga su familia',
  'plan.adds.plus/card-payments.detail':
    'Tarjeta, débito, PayPal, Apple Pay, Google Pay y Cash App, con fondos detrás.',
  'plan.adds.plus/dues-projections.label':
    'Sepa qué se sigue debiendo, antes de tener que preguntar',
  'plan.adds.plus/dues-projections.detail':
    'Todos los familiares que deben este año, lo que ha entrado, y quién tiene todavía que '
    + 'pagar.',
  'plan.adds.plus/pnl.label': 'Un estado de resultados para su tesorero',
  'plan.adds.plus/pnl.detail':
    'El estado que pide la directiva, más los traspasos entre sus fondos.',
  'plan.adds.plus/membership-report.label': 'Las cifras que pide la directiva',
  'plan.adds.plus/membership-report.detail':
    'Cuotas recaudadas frente a pendientes, y su membresía por región y capítulo.',
  'plan.adds.plus/activity-reports.label': 'Informes de algo más que el dinero',
  'plan.adds.plus/activity-reports.detail':
    'Trabajo de la reunión devuelto, participación en las elecciones, juntas celebradas, y '
    + 'los cargos que nadie ocupa.',
  'plan.adds.plus/elections.label': 'Elija a sus cargos como es debido',
  'plan.adds.plus/elections.detail':
    'Nominar, aceptar o rechazar, y luego votar: en toda la familia, o en una región o un '
    + 'capítulo.',
  'plan.adds.plus/library.label': 'El papeleo, y la estructura que le corresponde',
  'plan.adds.plus/library.detail':
    'Estatutos con búsqueda, actas que registran cómo votó la sala, y regiones y capítulos '
    + 'con sus propios cargos.',
  'plan.adds.plus/officer-notes.label': 'Cada cargo lleva su propio cuaderno',
  'plan.adds.plus/officer-notes.detail':
    'Notas que se quedan con el cargo y no con la persona, leídas solo por quien lo ocupa.',
  'plan.adds.plus/gallery.label': 'Fotografías que se pueden encontrar',
  'plan.adds.plus/gallery.detail': 'Colecciones por reunión, con etiquetado.',
  'plan.adds.premium/dues-reminders.label': 'Deje de perseguir a sus familiares por las cuotas',
  'plan.adds.premium/dues-reminders.detail':
    'Los recordatorios salen cuando vence cada plazo, y se detienen cuando se paga.',
  'plan.adds.premium/notifications.label':
    'Noticias que llegan en vez de esperar a que las encuentren',
  'plan.adds.premium/notifications.detail':
    'Notificaciones en el teléfono y en el navegador, para los anuncios, los mensajes y las '
    + 'tareas que le han dado.',
  'plan.adds.premium/mobile-apps.label': 'La familia en el bolsillo de todos',
  'plan.adds.premium/mobile-apps.detail':
    'Aplicaciones para iPhone y Android, en la misma cuenta familiar.',
  'plan.adds.premium/email-distributions.label':
    'Envíe un correo a toda la familia sin construir una lista',
  'plan.adds.premium/email-distributions.detail':
    'Envíos sacados directamente de su lista de integrantes.',
  'plan.adds.premium/safety-check-ins.label':
    'Compruebe que todos están a salvo, con un toque cada uno',
  'plan.adds.premium/safety-check-ins.detail':
    'Pregunte a los familiares de una zona si están a salvo, y vea quién no ha respondido.',
  'plan.adds.premium/family-website.label':
    'El sitio web de su propia familia, manteniéndose al día solo',
  'plan.adds.premium/family-website.detail':
    'Se construye solo a partir de su próxima reunión, sus fotografías más nuevas y su '
    + 'último anuncio.',
  'plan.adds.premium/custom-domain.label': 'Una dirección como es debido, lista para usar',
  'plan.adds.premium/custom-domain.detail':
    'Sin factura de alojamiento, sin complementos, y sin nadie de la familia manteniéndolo.',

  // Los 395 rechazos que puede devolver una acción de servidor. Véase la versión inglesa
  // para el razonamiento; aquí solo están las traducciones.
  'act.budgetCannotNegative': 'Un presupuesto no puede ser negativo',
  'act.budgetLineCannotNegative': 'Una partida del presupuesto no puede ser negativa',
  'act.budgetLineMustWholeNumber': 
    'Una partida del presupuesto debe ser un número entero de centavos y no '
    + 'puede ser negativa',
  'act.budgetMustWholeNumberCents': 
    'Un presupuesto debe ser un número entero de centavos y no puede ser '
    + 'negativo',
  'act.donationNeedsGoalWorkToward': 'Una recaudación necesita una meta a la que apuntar',
  'act.duesScheduleRequired': 'Se requiere un plan de cuotas',
  'act.gatheringNeedsTitle': 'La reunión necesita un título',
  'act.publishedElectionCannotEditedReturn': 
    'Una elección publicada no se puede editar. Devuélvala primero a '
    + 'borrador, lo cual solo es posible mientras nadie haya sido nominado y no '
    + 'se haya emitido ningún voto.',
  'act.resetLinkBeenRequestedMember': 
    'Se ha solicitado un enlace de restablecimiento para ese miembro. Lo '
    + 'recibirá si su dirección es accesible.',
  'act.stepNeedsLabel': 'El paso necesita una etiqueta',
  'act.suggestedBudgetMustWholeNumber': 
    'Un presupuesto sugerido debe ser un número entero de centavos y no puede '
    + 'ser negativo',
  'act.templateCannotIncludeItself': 'Una plantilla no puede incluirse a sí misma',
  'act.templateNeedsName': 'La plantilla necesita un nombre',
  'act.templateNameAlreadyExists': 'Ya existe una plantilla con ese nombre.',
  'act.addMobileNumberFirst': 'Añada primero un número de móvil',
  'act.addLeastOnePositionBefore': 
    'Añada al menos un cargo antes de publicar: una papeleta sin cargos no '
    + 'tiene nada que votar.',
  'act.addTheirDateBirthWhat': 
    'Añada su fecha de nacimiento. Es lo que decide cuándo empieza a deber '
    + 'cuotas.',
  'act.administratorsGeneralBuiltCannotDeleted': 
    'Administradores y General vienen incorporados y no se pueden eliminar. '
    + 'Edite lo que conceden en su lugar.',
  'act.albumNotFound': 'Álbum no encontrado',
  'act.announcementNotFound': 'Aviso no encontrado',
  'act.archivedMustYesNo': 'Archivado debe ser sí o no',
  'act.automaticPaymentsAlreadySetUp': 'Los pagos automáticos ya están configurados para esta cuota.',
  'act.automaticPaymentsBeenStoppedEvery': 'Se han detenido los pagos automáticos. Se conserva cada pago ya realizado.',
  'act.chapterNotFound': 'Capítulo no encontrado',
  'act.chapterSavedButTheirChildren': 
    'Se guardó el capítulo, pero no se pudo trasladar con esta persona a sus '
    + 'hijos menores de 18 años sin cuenta propia. Inténtelo de nuevo o asigne '
    + 'cada capítulo por separado.',
  'act.checkClosed': 'Consulta cerrada',
  'act.checkDeleted': 'Consulta eliminada',
  'act.checkNotFound': 'Consulta no encontrada',
  'act.chooseApproveSendBack': 'Elija Aprobar o Devolver',
  'act.chooseJpegPngWebpImage': 'Elija una imagen JPEG, PNG o WebP',
  'act.chooseJpegPngWebpGif': 'Elija una imagen JPEG, PNG, WebP o GIF',
  'act.chooseChapter': 'Elija un capítulo',
  'act.chooseDateMeeting': 'Elija una fecha para la reunión',
  'act.chooseFile': 'Elija un archivo',
  'act.choosePhotoUpload': 'Elija una fotografía para subir',
  'act.chooseRegion': 'Elija una región',
  'act.chooseTimezone': 'Elija una zona horaria',
  'act.chooseLeastOneDuePay': 'Elija al menos una cuota que pagar.',
  'act.chooseLeastOneRelativeAsk': 'Elija al menos un familiar al que preguntar',
  'act.chooseSomebodyFromYourFamily': 'Elija a alguien de su familia',
  'act.chooseDateGatheringStarts': 'Elija la fecha en que empieza la reunión',
  'act.chooseFundBudgetDrawn': 'Elija el fondo del que se toma este presupuesto',
  'act.chooseTwoDifferentFunds': 'Elija dos fondos distintos',
  'act.chooseWhatKindAccessGive': 'Elija qué tipo de acceso darle',
  'act.chooseWhatKindAccessGrant': 'Elija qué tipo de acceso conceder',
  'act.chooseWhatStepAsks': 'Elija qué pide el paso',
  'act.chooseWhetherPayMonthlyAdvance': 'Elija si desea pagar cada mes o por adelantado.',
  'act.chooseWhetherYouSafe': 'Indique si está a salvo',
  'act.chooseWhichChapterGoing': 'Elija a qué capítulo va esto',
  'act.chooseWhichFirstPaymentMake': 'Elija qué primer pago realizar.',
  'act.chooseWhichRegionGoing': 'Elija a qué región va esto',
  'act.chooseWhoTakingMinutes': 'Elija quién levanta el acta',
  'act.chooseWhoMayScheduleFrom': 'Elija quién puede programar a partir de esta plantilla',
  'act.chooseWhoGoing': 'Elija a quién va esto',
  'act.chooseWhoAsk': 'Elija a quién preguntar',
  'act.contributorNotFoundFamily': 'No se encontró a ese contribuyente en esta familia',
  'act.couldNotAcceptInvitationPlease': 'No se pudo aceptar esa invitación. Inténtelo de nuevo.',
  'act.couldNotAddStepTry': 'No se pudo añadir ese paso. Inténtelo de nuevo.',
  'act.couldNotApplyTemplatePlease': 'No se pudo aplicar esa plantilla. Inténtelo de nuevo.',
  'act.couldNotBuildRosterSo': 'No se pudo elaborar la lista, así que no se ha enviado nada',
  'act.couldNotCancelInvitation': 'No se pudo cancelar esa invitación.',
  'act.couldNotChangeMemberPlease': 'No se pudo modificar a ese miembro. Inténtelo de nuevo.',
  'act.couldNotChangeLanguagePlease': 'No se pudo cambiar el idioma. Inténtelo de nuevo.',
  'act.couldNotChangePlanPlease': 'No se pudo cambiar el plan. Inténtelo de nuevo.',
  'act.couldNotChangeTimezonePlease': 'No se pudo cambiar la zona horaria. Inténtelo de nuevo.',
  'act.couldNotChangeTheirAccess': 'No se pudo cambiar su acceso en este momento. Inténtelo de nuevo.',
  'act.couldNotCheckRecurringPayments': 'No se pudo comprobar si hay pagos recurrentes. Inténtelo de nuevo.',
  'act.couldNotCheckCodePlease': 'No se pudo comprobar ese código. Inténtelo de nuevo.',
  'act.couldNotCheckPersonS': 'No se pudo comprobar la membresía de esa persona',
  'act.couldNotCheckOwnerList': 
    'No se pudo consultar la lista de propietarios en este momento. Inténtelo '
    + 'de nuevo.',
  'act.couldNotCheckWhatWork': 'No se pudo comprobar qué trabajo se ha respondido en esta reunión',
  'act.couldNotCheckWhetherAny': 
    'No se pudo comprobar si alguna reunión se creó a partir de esta '
    + 'plantilla, así que no se ha eliminado nada. Inténtelo de nuevo.',
  'act.couldNotCheckWhoAdult': 'No se pudo comprobar quién es adulto en este momento. No se guardó nada.',
  'act.couldNotCheckYourText': 
    'No se pudo comprobar su consentimiento para mensajes de texto. Inténtelo '
    + 'de nuevo.',
  'act.couldNotClaimNextBatch': 'No se pudo reclamar el siguiente lote',
  'act.couldNotCloseCheck': 'No se pudo cerrar la consulta',
  'act.couldNotConfirmCodePlease': 'No se pudo confirmar ese código. Inténtelo de nuevo.',
  'act.couldNotConfirmNumber': 'No se pudo confirmar ese número',
  'act.couldNotCreateFamilyPlease': 'No se pudo crear esa familia. Inténtelo de nuevo.',
  'act.couldNotCreateInvitationPlease': 'No se pudo crear esa invitación. Inténtelo de nuevo.',
  'act.couldNotCreateTemplate': 'No se pudo crear la plantilla.',
  'act.couldNotDeleteCheck': 'No se pudo eliminar la consulta',
  'act.couldNotDeleteTemplate': 'No se pudo eliminar la plantilla.',
  'act.couldNotDisconnectPleaseTry': 'No se pudo desconectar. Inténtelo de nuevo.',
  'act.couldNotDismissAnnouncement': 'No se pudo descartar ese aviso.',
  'act.couldNotFindYourCurrent': 'No se encontró su registro de perfil actual.',
  'act.couldNotGenerateUniqueFamily': 'No se pudo generar un código de familia único. Inténtelo de nuevo.',
  'act.couldNotGrantAccessJust': 'No se pudo conceder el acceso en este momento. Inténtelo de nuevo.',
  'act.couldNotJoinFamilyPlease': 'No se pudo unir a esa familia. Inténtelo de nuevo.',
  'act.couldNotLookUpCode': 'No se pudo consultar ese código. Inténtelo de nuevo.',
  'act.couldNotMoveStepTry': 'No se pudo mover ese paso. Inténtelo de nuevo.',
  'act.couldNotOpenStripeOnboarding': 'No se pudo abrir el registro de Stripe. Inténtelo de nuevo.',
  'act.couldNotOpenBillingPortal': 'No se pudo abrir el portal de facturación. Inténtelo de nuevo.',
  'act.couldNotPinAnnouncement': 'No se pudo fijar ese aviso.',
  'act.couldNotQueueThoseAsks': 'No se pudieron volver a poner en cola esas preguntas',
  'act.couldNotRaiseCheck': 'No se pudo abrir la consulta',
  'act.couldNotReachStripePlease': 'No se pudo contactar con Stripe. Inténtelo de nuevo.',
  'act.couldNotReachAccountService': 
    'No se pudo contactar con el servicio de cuentas en este momento. '
    + 'Inténtelo de nuevo.',
  'act.couldNotReadConnection': 'No se pudo leer esa conexión',
  'act.couldNotReadGathering': 'No se pudo leer esa reunión',
  'act.couldNotReadRecord': 'No se pudo leer ese registro',
  'act.couldNotReadStaffMember': 
    'No se pudo leer los datos de ese miembro del personal en este momento. '
    + 'Inténtelo de nuevo.',
  'act.couldNotReadStepTry': 'No se pudo leer ese paso. Inténtelo de nuevo.',
  'act.couldNotReadTask': 'No se pudo leer esa tarea',
  'act.couldNotReadTemplateTry': 'No se pudo leer esa plantilla. Inténtelo de nuevo.',
  'act.couldNotReadAlbumNothing': 'No se pudo leer el álbum. No se eliminó nada.',
  'act.couldNotReadCurrentPlan': 'No se pudo leer el plan actual en Stripe. Inténtelo de nuevo.',
  'act.couldNotReadFamilyRoster': 
    'No se pudo leer la lista de la familia en este momento, así que no se ha '
    + 'enviado nada. Inténtelo de nuevo.',
  'act.couldNotReadRelationshipTypes': 'No se pudieron leer los tipos de parentesco',
  'act.couldNotReadSubmission': 'No se pudo leer la respuesta enviada',
  'act.couldNotReadTasksFrom': 'No se pudieron leer las tareas de esta plantilla',
  'act.couldNotReadTemplateCopy': 'No se pudo leer la plantilla a copiar.',
  'act.couldNotReadTemplates': 'No se pudieron leer las plantillas',
  'act.couldNotReadGatheringS': 'No se pudieron leer las plantillas de esta reunión',
  'act.couldNotRecordDecisionPlease': 'No se pudo registrar esa decisión. Inténtelo de nuevo.',
  'act.couldNotRecordChangePlease': 'No se pudo registrar el cambio. Inténtelo de nuevo.',
  'act.couldNotRecordDecision': 'No se pudo registrar la decisión',
  'act.couldNotRecordYourAnswer': 'No se pudo registrar su respuesta',
  'act.couldNotRecordYourAnswer2': 'No se pudo registrar su respuesta; inténtelo de nuevo',
  'act.couldNotRecordYourChoice': 'No se pudo registrar su elección. Inténtelo de nuevo.',
  'act.couldNotRemoveNumber': 'No se pudo eliminar ese número',
  'act.couldNotRemoveFamilyPlease': 'No se pudo eliminar la familia. Inténtelo de nuevo.',
  'act.couldNotRemoveTheirAccess': 'No se pudo retirar su acceso en este momento. Inténtelo de nuevo.',
  'act.couldNotRenameFamilyPlease': 'No se pudo cambiar el nombre de la familia. Inténtelo de nuevo.',
  'act.couldNotRenameTemplate': 'No se pudo cambiar el nombre de la plantilla.',
  'act.couldNotResendInvitation': 'No se pudo reenviar esa invitación.',
  'act.couldNotResolveAddressUnambiguously': 
    'No se pudo identificar esa dirección sin ambigüedad: escríbala '
    + 'exactamente e inténtelo de nuevo.',
  'act.couldNotRestoreFamilyPlease': 'No se pudo restaurar esa familia. Inténtelo de nuevo.',
  'act.couldNotSave': 'No se pudo guardar eso',
  'act.couldNotSaveNumber': 'No se pudo guardar ese número',
  'act.couldNotSaveSegmentJust': 'No se pudo guardar ese tramo en este momento. Inténtelo de nuevo.',
  'act.couldNotSavePleaseTry': 'No se pudo guardar eso. Inténtelo de nuevo.',
  'act.couldNotSavePermission': 'No se pudo guardar el permiso.',
  'act.couldNotSaveWhatStripe': 'No se pudo registrar lo que nos indicó Stripe. Inténtelo de nuevo.',
  'act.couldNotSendCodeJust': 'No se pudo enviar un código en este momento',
  'act.couldNotSendCodeJust2': 'No se pudo enviar un código en este momento. Inténtelo de nuevo.',
  'act.couldNotSendJustNow': 'No se pudo enviar eso en este momento. Inténtelo de nuevo.',
  'act.couldNotSetUpAutomatic': 'No se pudieron configurar los pagos automáticos. Inténtelo de nuevo.',
  'act.couldNotStartSettingUp': 'No se pudo empezar a configurar los pagos. Inténtelo de nuevo.',
  'act.couldNotStartPaymentPlease': 'No se pudo iniciar el pago. Inténtelo de nuevo.',
  'act.couldNotStartSetupPlease': 'No se pudo iniciar la configuración. Inténtelo de nuevo.',
  'act.couldNotStopAutomaticPayments': 'No se pudieron detener los pagos automáticos. Inténtelo de nuevo.',
  'act.couldNotStopPlanPlease': 'No se pudo detener el plan. Inténtelo de nuevo.',
  'act.couldNotUpdatePleaseTry': 'No se pudo actualizar eso. Inténtelo de nuevo.',
  'act.couldNotUpdateYourFamily': 'No se pudo actualizar su selección de familia. Inténtelo de nuevo.',
  'act.destinationFundNotFound': 'Fondo de destino no encontrado',
  'act.documentNotFound': 'Documento no encontrado',
  'act.donationsAlreadyOptionalThereNothing': 'Las aportaciones ya son opcionales: no hay nada de lo que darse de baja.',
  'act.donationsGivenFromDonationsPane': 
    'Las aportaciones se entregan desde el panel de Aportaciones, no se pagan '
    + 'como cuotas.',
  'act.duesNeedAmount': 'Las cuotas necesitan un importe',
  'act.duesScheduleNotFound': 'Plan de cuotas no encontrado',
  'act.electionNotFound': 'Elección no encontrada',
  'act.enterBudgetAmount': 'Escriba un importe de presupuesto',
  'act.enterFamilyCode': 'Escriba un código de familia',
  'act.enterFamilyCode2': 'Escriba un código de familia.',
  'act.enterFamilyName': 'Escriba un nombre de familia',
  'act.enterFirstLastName': 'Escriba un nombre y un apellido',
  'act.enterAmount': 'Escriba un importe',
  'act.enterAmountGreaterThanZero': 'Escriba un importe mayor que cero',
  'act.enterAmountGive': 'Escriba el importe que desea aportar.',
  'act.enterAmountPay': 'Escriba el importe que desea pagar.',
  'act.enterEmailAddress': 'Escriba una dirección de correo electrónico',
  'act.enterEmailAddressAccountGrant': 'Escriba la dirección de correo de la cuenta a la que conceder acceso',
  'act.enterFirstLastNamePerson': 'Escriba el nombre y el apellido de la persona a la que está invitando',
  'act.enterSixDigitsFromText': 'Escriba los seis dígitos del mensaje de texto.',
  'act.everyoneAudienceFamilyTreeWithout': 
    'Todas las personas de ese público están en el árbol genealógico sin '
    + 'dirección de correo, así que no hay a quién enviar.',
  'act.failedCreateFamilyRecordPlease': 'No se pudo crear el registro de la familia. Inténtelo de nuevo.',
  'act.failedLinkYourAccountPlease': 'No se pudo vincular su cuenta. Inténtelo de nuevo.',
  'act.failedPrepareAccountLinkPlease': 'No se pudo preparar el enlace de la cuenta. Inténtelo de nuevo.',
  'act.familyCodeRequired': 'Se requiere el código de familia',
  'act.familyCodeNotFoundCheck': 
    'Código de familia no encontrado. Consúltelo con su familia e inténtelo '
    + 'de nuevo.',
  'act.fileMustUnder2Mb': 'El archivo debe pesar menos de 2 MB',
  'act.fundNotFound': 'Fondo no encontrado',
  'act.gatheringNotFound': 'Reunión no encontrada',
  'act.gatheringTemplateNotFound': 'Reunión o plantilla no encontrada',
  'act.giveStartTimeWellLeave': 'Indique también una hora de inicio, o deje vacía la hora de fin',
  'act.giveAlbumName': 'Póngale un nombre al álbum',
  'act.giveArticleTitle': 'Póngale un título al artículo',
  'act.giveDocumentName': 'Póngale un nombre al documento',
  'act.giveElectionTitle': 'Póngale un título a la elección.',
  'act.giveEntryTitle': 'Póngale un título a la entrada.',
  'act.giveMeetingTitle': 'Póngale un título a la reunión',
  'act.giveMessageSubject': 'Póngale un asunto al mensaje',
  'act.giveTopicTitle': 'Póngale un título al tema',
  'act.giveThemFirstLastName': 'Indique su nombre y su apellido antes de invitarle',
  'act.invitationNotFound': 'Invitación no encontrada',
  'act.meetingNotFound': 'Reunión no encontrada',
  'act.memberNotFound': 'Miembro no encontrado',
  'act.milestoneNotFound': 'Hito no encontrado',
  'act.mobileNumberRemoved': 'Número de móvil eliminado.',
  'act.moveStepUpDown': 'Mueva un paso hacia arriba o hacia abajo',
  'act.multiFamilySupportNotEnabled': 
    'La compatibilidad con varias familias aún no está habilitada en la base '
    + 'de datos. Aplique la migración '
    + '20260617000000_multi_family_membership.sql.',
  'act.noFamilyAssociatedAccount': 'Ninguna familia asociada a la cuenta',
  'act.noFamilyAssociatedYourAccount': 'Ninguna familia asociada a su cuenta.',
  'act.noFamilyCodeAssociatedAccount': 'Ningún código de familia asociado a la cuenta',
  'act.noFamilySelected': 'Ninguna familia seleccionada',
  'act.noFamilySelected2': 'Ninguna familia seleccionada.',
  'act.noFileProvided': 'No se proporcionó ningún archivo',
  'act.noFilesChosen': 'No se eligió ningún archivo',
  'act.noVoteBeenCalledTopic': 'No se ha convocado ninguna votación sobre ese tema.',
  'act.noVoteBeenCalledTopic2': 'Todavía no se ha convocado ninguna votación sobre este tema.',
  'act.nobodyFamilyMatchesAudienceSo': 
    'Nadie en la familia coincide con ese público, así que no se ha enviado '
    + 'nada. Revise la región o el capítulo que eligió.',
  'act.nobodyFamilyMatchesAudienceSo2': 
    'Nadie en la familia coincide con ese público, así que no hay nada que '
    + 'enviar.',
  'act.notMemberFamily': 'No es miembro de esta familia',
  'act.notAuthenticated': 'No autenticado',
  'act.notAuthenticated2': 'No autenticado.',
  'act.notAuthorized': 'No autorizado',
  'act.notFound': 'No encontrado',
  'act.noteNotFound': 'Nota no encontrada',
  'act.nothingChange': 'Nada que cambiar',
  'act.numberConfirmed': 'Número confirmado.',
  'act.oneThoseAttendeesNotFamily': 'Uno de esos asistentes no está en esta familia',
  'act.oneThosePeopleNotFamily': 'Una de esas personas no está en esta familia',
  'act.oneThosePeopleNotFamily2': 'Una de esas personas no está en esta familia.',
  'act.onlinePaymentsNotSetUp': 'Los pagos en línea aún no están configurados en esta instalación.',
  'act.onlinePaymentsNotSetUp2': 'Los pagos en línea aún no están configurados.',
  'act.onlinePaymentsOffDeployment': 'Los pagos en línea están desactivados en esta instalación.',
  'act.connectNotSetUpDeployment': 'Los pagos en línea aún no están configurados en esta instalación.',
  'act.onlyTemplateStepCanInclude': 'Solo un paso de plantilla puede incluir otra plantilla',
  'act.onlyPeopleAttendeeListCan': 'Solo las personas de la lista de asistentes pueden votar en esta reunión.',
  'act.onlySecretaryMeetingCanWrite': 'Solo quien levanta el acta de esta reunión puede redactarla.',
  'act.paymentNotFound': 'Pago no encontrado',
  'act.paymentsBeenRecordedAgainstDue': 
    'Se han registrado pagos contra esta cuota, así que su fecha de inicio, '
    + 'importe, frecuencia, edad inicial, ajuste de linaje y quién la debe ya '
    + 'no se pueden cambiar. Todavía puede cambiar la fecha de fin.',
  'act.personNotYourFamily': 'Esa persona no está en su familia.',
  'act.personNotFound': 'Persona no encontrada',
  'act.personNotFound2': 'Persona no encontrada.',
  'act.photoNotFound': 'Fotografía no encontrada',
  'act.pickHowOftenYouWant': 
    'Elija primero con qué frecuencia desea pagar esta cuota: los pagos '
    + 'automáticos siguen la periodicidad que elija.',
  'act.pickTemplateStepIncludes': 'Elija la plantilla que incluye este paso',
  'act.profileNotFound': 'Perfil no encontrado',
  'act.profileNotFound2': 'Perfil no encontrado.',
  'act.profilePicturesPartStandardPlan': 
    'Las fotos de perfil forman parte del plan Standard. Esta familia está en '
    + 'Free.',
  'act.recipientNotFoundFamily': 'No se encontró a ese destinatario en esta familia',
  'act.recordCheckNumberReferenceContribution': 'Registre un número de cheque o una referencia para la aportación',
  'act.recordCheckNumberReferenceDisbursement': 'Registre un número de cheque o una referencia para el desembolso',
  'act.recordCheckNumberReferencePayment': 'Registre un número de cheque o una referencia para el pago',
  'act.recordGenderOtherPersonFirst': 
    'Registre primero el género de la otra persona, para poder nombrar esto '
    + 'también desde su lado.',
  'act.recordHowContributionGiven': 'Registre cómo se entregó la aportación',
  'act.recordHowPaymentMade': 'Registre cómo se realizó el pago',
  'act.recordWhoContributionCameFrom': 'Registre de quién vino la aportación',
  'act.recordWhyMoneyBeingMoved': 'Registre por qué se traslada el dinero',
  'act.recurringPaymentsDuesOnly': 'Los pagos recurrentes son solo para cuotas.',
  'act.regionNotFound': 'Región no encontrada',
  'act.relationshipNotFound': 'Parentesco no encontrado',
  'act.requiredMustYesNo': 'Obligatorio debe ser sí o no',
  'act.savedYourFamilyMaySend': 'Guardado. Su familia puede enviarle consultas por mensaje de texto.',
  'act.sayWhatHappeningSoRelatives': 'Diga qué está pasando, para que sus familiares sepan qué se les pregunta',
  'act.sayWhatNeedsChangeSending': 
    'Diga qué hay que cambiar: devolver una tarea sin comentarios no deja '
    + 'nada sobre lo que actuar',
  'act.sayWhichTimezoneTimeSo': 
    'Diga en qué zona horaria es la hora, para que los familiares de otros '
    + 'lugares puedan leerla',
  'act.sayWhyPersonNoEmail': 'Diga por qué esta persona no tiene dirección de correo electrónico',
  'act.sayWhyPersonNeedsStaff': 
    'Diga por qué esta persona necesita acceso de personal. La lista es un '
    + 'registro de auditoría.',
  'act.scheduleNotFound': 'Plan no encontrado',
  'act.segmentNotFound': 'Tramo no encontrado',
  'act.signAcceptInvitation': 'Inicie sesión para aceptar esta invitación.',
  'act.someMembersStillBeingCharged': 
    'A algunos miembros se les sigue cobrando automáticamente y no pudimos '
    + 'detenerlo. No se ha desconectado nada; inténtelo de nuevo.',
  'act.somebodyCannotTheirOwnRelative': 'Nadie puede ser su propio familiar',
  'act.somebodyYouRemovingAlreadyVoted': 
    'Alguien a quien está quitando ya ha votado. Un voto no se puede retirar, '
    + 'así que tiene que permanecer en la lista.',
  'act.staffMemberNotFound': 'Miembro del personal no encontrado',
  'act.stepNotFound': 'Paso no encontrado',
  'act.stripeUpdatedButWeCould': 
    'Se actualizó Stripe pero no pudimos registrarlo. Póngase en contacto con '
    + 'soporte antes de volver a intentarlo.',
  'act.stripeUpdatedButWeCould2': 
    'Se actualizó Stripe pero no pudimos registrar el cambio. Póngase en '
    + 'contacto con soporte antes de volver a intentarlo.',
  'act.taskNotFound': 'Tarea no encontrada',
  'act.templateNameRequired': 'Se requiere el nombre de la plantilla.',
  'act.templateNotFound': 'Plantilla no encontrada',
  'act.templateNotFoundYourFamily': 'Plantilla no encontrada en su familia.',
  'act.templateNotFound2': 'Plantilla no encontrada.',
  'act.bylawNoFileAttached': 'Ese estatuto no tiene ningún archivo adjunto.',
  'act.channelNotAvailableNotificationYet': 'Ese canal todavía no está disponible para este aviso.',
  'act.checkAlreadyClosed': 'Esa consulta ya estaba cerrada',
  'act.codeNotRight': 'Ese código no es correcto.',
  'act.couldNotPreparedNothingBeen': 'No se pudo preparar eso. No se ha enviado nada.',
  'act.couldNotReadJustNow': 'No se pudo leer eso en este momento.',
  'act.couldNotRemovedJustNow': 'No se pudo eliminar eso en este momento.',
  'act.couldNotWithdrawnNominationsMay': 
    'No se pudo retirar. Puede que las nominaciones se hayan cerrado, o que '
    + 'la persona la haya aceptado desde que se cargó esta página: una '
    + 'nominación aceptada permanece en la papeleta, y la forma de salir de '
    + 'ella es que la rechace.',
  'act.doesNotLookLikeMobile': 
    'Eso no parece un número de móvil. Incluya el código de área, por ejemplo '
    + '512-555-0134.',
  'act.driveNotOneYourFamily': 'Esa recaudación no es de su familia.',
  'act.dueDateNotRealDate': 'Esa fecha de vencimiento no es una fecha real',
  'act.dueNotOneYours': 'Esa cuota no es suya.',
  'act.endDateNotRealDate': 'Esa fecha de fin no es una fecha real',
  'act.entryCouldNotChangedOnly': 
    'No se pudo modificar esa entrada. Solo puede hacerlo quien la registró, '
    + 'y solo mientras siga ocupando el cargo.',
  'act.entryCouldNotRemovedOnly': 
    'No se pudo eliminar esa entrada. Solo puede hacerlo quien la registró, y '
    + 'solo mientras siga ocupando el cargo.',
  'act.entryRefusedJournalOnlyWritable': 
    'Esa entrada fue rechazada. Un cuaderno solo lo puede escribir quien '
    + 'ocupa el cargo: vuelva a cargar la página para ver cuáles son los suyos.',
  'act.familyNameTooLong100': 'Ese nombre de familia es demasiado largo (100 caracteres como máximo).',
  'act.fileCouldNotOpenedMay': 'No se pudo abrir ese archivo. Puede que se haya eliminado.',
  'act.invitationAlreadyBeenAccepted': 'Esa invitación ya se aceptó.',
  'act.invitationNoLongerValidAsk': 'Esa invitación ya no es válida. Pida una nueva.',
  'act.invitationCancelledSendNewOne': 'Esa invitación se canceló. Envíe una nueva en su lugar.',
  'act.notChannelWeSend': 'Ese no es un canal por el que enviamos.',
  'act.notDate': 'Eso no es una fecha',
  'act.notDateSegmentCanHappen': 'Eso no es una fecha en la que este tramo pueda ocurrir',
  'act.notGatheringStatus': 'Ese no es un estado de reunión',
  'act.notLanguageWeSpeakYet': 'Ese no es un idioma que hablemos todavía',
  'act.notNotificationWeSend': 'Ese no es un aviso que enviemos.',
  'act.notPlanCanBought': 'Ese no es un plan que se pueda comprar.',
  'act.notPlan': 'Ese no es un plan.',
  'act.notRelationshipTreeRecords': 'Ese no es un parentesco que este árbol registre',
  'act.notTimeWeCanRead': 'Esa no es una hora que podamos leer',
  'act.notTimezoneWeRecognise': 'Esa no es una zona horaria que reconozcamos',
  'act.notVote': 'Ese no es un voto.',
  'act.nominationNotBallot': 'Esa nominación no está en esta papeleta.',
  'act.nominationRefusedNominationsMayClosed': 
    'Esa nominación fue rechazada: puede que las nominaciones se hayan '
    + 'cerrado, o que esta elección no sea para su parte de la familia. Vuelva '
    + 'a cargar la página para ver cómo está.',
  'act.nominationWithdrawnWhileYouLooking': 'Esa nominación se retiró mientras la estaba viendo. Inténtelo de nuevo.',
  'act.noteCouldNotChangedOnly': 
    'No se pudo modificar esa nota. Solo puede hacerlo quien la escribió, y '
    + 'solo mientras siga ocupando el cargo.',
  'act.noteCouldNotRemovedOnly': 
    'No se pudo eliminar esa nota. Solo puede hacerlo quien la escribió, y '
    + 'solo mientras siga ocupando el cargo.',
  'act.noteRefusedJournalOnlyWritable': 
    'Esa nota fue rechazada. Un cuaderno solo lo puede escribir quien ocupa '
    + 'el cargo: vuelva a cargar la página para ver cuáles son los suyos.',
  'act.numberChangedWhileCodeFlight': 
    'Ese número cambió mientras el código estaba en camino. Envíe un código '
    + 'nuevo e inténtelo de nuevo.',
  'act.numberAlreadyConfirmed': 'Ese número ya está confirmado',
  'act.paymentAlreadyBeenReversed': 'Ese pago ya se ha revertido.',
  'act.personAlreadyAccountLinked': 'Esa persona ya tiene una cuenta vinculada.',
  'act.personNotFinishedJoiningFamily': 'Esa persona aún no ha terminado de unirse a la familia.',
  'act.personNotCandidatePosition': 'Esa persona no es candidata a ese cargo.',
  'act.personNotPartFamilyElection': 
    'Esa persona no está en la parte de la familia a la que corresponde esta '
    + 'elección.',
  'act.personNotFamily': 'Esa persona no está en esta familia',
  'act.personNotFamily2': 'Esa persona no está en esta familia.',
  'act.personNotPartConnection': 'Esa persona no forma parte de esta conexión',
  'act.personSMembershipNotBeen': 'La membresía de esa persona aún no se ha aprobado',
  'act.photoMustUnder10Mb': 'Esa fotografía debe pesar menos de 10 MB',
  'act.positionNotBallot': 'Ese cargo no está en esta papeleta.',
  'act.relationshipTypeNotSetUp': 'Ese tipo de parentesco no está configurado',
  'act.rowItselfReversal': 'Esa fila es en sí misma una reversión.',
  'act.secretaryNotFamily': 'Esa persona encargada del acta no está en esta familia',
  'act.sendCouldNotContinuedJust': 'No se pudo continuar ese envío en este momento.',
  'act.templateNotPartGathering': 'Esa plantilla no forma parte de esta reunión',
  'act.templateNotFound3': 'No se encontró esa plantilla',
  'act.voteAlreadyClosedDeleteTopic': 
    'Esa votación ya se cerró. Elimine el tema y vuelva a preguntar si hace '
    + 'falta una segunda ronda.',
  'act.voteClosed': 'Esa votación se ha cerrado.',
  'act.wouldChangeHowTheyRelated': 'Eso cambiaría cómo están relacionados, no solo cómo se llama',
  'act.endDateCannotPast': 'La fecha de fin no puede estar en el pasado.',
  'act.endTimeAfterStartTime': 'La hora de fin tiene que ser posterior a la de inicio',
  'act.fileMustUnder25Mb': 'El archivo debe pesar menos de 25 MB.',
  'act.gatheringCannotEndBeforeStarts': 'La reunión no puede terminar antes de empezar',
  'act.messageTooLongKeepUnder': 'El mensaje es demasiado largo: manténgalo por debajo de 20 000 caracteres.',
  'act.paymentsBeenStoppedStripeBut': 
    'Los pagos se han detenido en Stripe pero no pudimos actualizar su '
    + 'registro. Vuelva a cargar la página.',
  'act.restoreReturnedNoResultPlease': 'La restauración no devolvió ningún resultado. Inténtelo de nuevo.',
  'act.sameDueListedTwice': 'La misma cuota aparece dos veces.',
  'act.sendProgressedButCouldNot': 'El envío avanzó pero no se pudo leer.',
  'act.subjectTooLongKeepUnder': 'El asunto es demasiado largo: manténgalo por debajo de 200 caracteres.',
  'act.templateCopyNotFoundYour': 'No se encontró en su familia la plantilla a copiar.',
  'act.thereNoAutomaticPaymentsSet': 'No hay pagos automáticos configurados para esta cuota.',
  'act.thereNothingSetUpDue': 'No hay nada que configurar en esta cuota.',
  'act.thereNoPlanWaitingSet': 'No había ningún plan esperando a ser configurado.',
  'act.theyAlreadyAccount': 'Ya tiene una cuenta.',
  'act.theyAccountManageTheirOwn': 'Tiene una cuenta y gestiona su propio perfil.',
  'act.accountNoEmailAddressSend': 'Esta cuenta no tiene dirección de correo a la que enviar un código.',
  'act.checkBeenClosedSoNo': 'Esta consulta se ha cerrado, así que no se enviarán más preguntas',
  'act.checkBeenClosedIfYou': 
    'Esta consulta se ha cerrado. Si todavía necesita ayuda, póngase en '
    + 'contacto directamente con su familia.',
  'act.donationReceivedFundsSoIts': 
    'Esta recaudación ha recibido fondos, así que su fecha de inicio ya no se '
    + 'puede cambiar.',
  'act.electionNotYourPartFamily': 'Esta elección no es para su parte de la familia.',
  'act.familyAlreadyPaysMonthlyUse': 
    'Esta familia ya paga cada mes. Use Cambiar plan en lugar de iniciar una '
    + 'segunda suscripción.',
  'act.familyNoMonthlyPlanStop': 'Esta familia no tiene ningún plan mensual que detener.',
  'act.familyNoPaymentHistoryYet': 'Esta familia todavía no tiene historial de pagos.',
  'act.familyNoSettingsRecordChange': 'Esta familia no tiene un registro de ajustes que cambiar.',
  'act.familyNotConnectedAccountYet': 'Esta familia todavía no ha conectado una cuenta.',
  'act.feePercentOutOfRange': 'El porcentaje debe estar entre 0 % y 50 %.',
  'act.feeFixedOutOfRange': 'La tarifa fija debe estar entre $0.00 y $10.00.',
  'act.couldNotSaveFeePolicy': 'No se pudo guardar. Inténtelo de nuevo.',
  'act.feePolicySaved': 'Guardado.',
  'act.familyNotConnectedAccount': 'Esta familia no ha conectado una cuenta.',
  'act.familyAlreadyRemovedNoSettings': 
    'Esta familia ya está eliminada, o no tiene un registro de ajustes que '
    + 'eliminar.',
  'act.familyNotSetUpTake': 'Esta familia todavía no está configurada para aceptar pagos con tarjeta.',
  'act.familyPaidPlanChangeFrom': 
    'Esta familia está en un plan de pago. Cámbielo desde la sección de '
    + 'Facturación de Ajustes, para que el pago siga al plan.',
  'act.familyPaysMonthlyCancelMonthly': 
    'Esta familia paga cada mes. Cancele primero el plan mensual y luego '
    + 'pague por adelantado a partir del siguiente periodo.',
  'act.featureNotCurrentlyAvailable': 'Esta función no está disponible actualmente.',
  'act.gatheringBeenCancelledSoIts': 
    'Esta reunión se ha cancelado, así que ya no se recogen sus tareas. '
    + 'Pregunte a un organizador si eso no es correcto.',
  'act.invitationCreatedBeforeWeStarted': 
    'Esta invitación se creó antes de que empezáramos a registrar nombres. '
    + 'Cancélela y envíe una nueva en su lugar.',
  'act.lastOwnerMakeSomebodyElse': 
    'Este es el último propietario. Nombre propietario a otra persona '
    + 'primero, o nadie podrá conceder acceso de personal.',
  'act.meetingClosed': 'Esta reunión está cerrada.',
  'act.meetingClosedReopenChangeMinutes': 'Esta reunión está cerrada. Vuelva a abrirla para cambiar el acta.',
  'act.sendNotFinishedStopFirst': 'Este envío no ha terminado. Deténgalo primero y luego elimínelo.',
  'act.taskCannotAnsweredVersion': 'Esta tarea no se puede responder en esta versión',
  'act.taskAlreadyBeenApprovedApproved': 
    'Esta tarea ya se ha aprobado, y una respuesta aprobada es definitiva. '
    + 'Pida a un organizador que la vuelva a abrir si hace falta cambiarla.',
  'act.taskAssignedSomebodyElse': 'Esta tarea está asignada a otra persona',
  'act.titleMessageRequired': 'Se requieren el título y el mensaje',
  'act.tooFewDaysLeftMonth': 
    'Quedan muy pocos días este mes para iniciar hoy un plan mensual. Elija '
    + 'la opción que cubre este mes y el siguiente.',
  'act.tooManyAttemptsWaitMinute': 'Demasiados intentos. Espere un minuto e inténtelo de nuevo.',
  'act.tooManyFamiliesCreatedJust': 
    'Se han creado demasiadas familias en este momento. Espere un minuto e '
    + 'inténtelo de nuevo.',
  'act.topicNotFound': 'Tema no encontrado',
  'act.turnedOffYourFamilyWill': 'Desactivado. Su familia no le enviará mensajes de texto.',
  'act.weCouldNotReadFamily': 
    'No pudimos leer la lista de la familia en este momento. No se ha enviado '
    + 'nada.',
  'act.weWillStopAskingYou': 'Dejaremos de preguntar. Puede pasar a un plan de pago cuando quiera.',
  'act.writeSomethingFirst': 'Escriba algo primero',
  'act.writeSomethingFirst2': 'Escriba algo primero.',
  'act.writeSomethingSend': 'Escriba algo para enviar',
  'act.youAlreadyAccountAddressSign': 
    'Ya tiene una cuenta con esta dirección. Inicie sesión y esta invitación '
    + 'estará esperándole.',
  'act.youNotMemberFamily': 'No es miembro de esa familia.',
  'act.youNotCheck': 'No está en esta consulta',
  'act.youCannotChangeYourOwn': 
    'No puede cambiar su propio acceso de personal. Pida a otro propietario '
    + 'que lo haga.',
  'act.youDoNotBelongFamily': 'Todavía no pertenece a ninguna familia.',
  'act.youDoNotPermissionCopy': 
    'No tiene permiso para copiar lo que concede una plantilla. Cree una '
    + 'plantilla en blanco en su lugar.',
  'act.youDoNotPermissionManage': 'No tiene permiso para gestionar el acceso.',
  'act.notPermissionDeleteTemplates': 'No tiene permiso para eliminar plantillas.',
  'act.notPermissionChangePermissionTemplates':
    'No tiene permiso para cambiar las plantillas de permisos.',
  'act.youDoNotPermissionReverse': 'No tiene permiso para revertir pagos.',
  'act.youAlreadyNominatedThemPosition': 'Ya le ha nominado para ese cargo.',
  'act.youDeclinedDueOptBack': 
    'Ha rechazado esta cuota. Vuelva a aceptarla antes de configurar pagos '
    + 'automáticos.',
  'act.youNoMemberRecordFamily': 'No tiene registro de miembro en esta familia.',
  'act.youRepliedStopTextFrom': 
    'Respondió STOP a un mensaje nuestro, así que no podemos volver a activar '
    + 'los mensajes desde aquí. Envíe START al número que le escribió.',
  'act.yourAnswerSavedButTask': 
    'Se guardó su respuesta pero no se pudo pasar la tarea a revisión. '
    + 'Inténtelo de nuevo.',
  'act.yourChapterSavedButYour': 
    'Se guardó su capítulo, pero no se pudo trasladar con usted a sus hijos '
    + 'menores de 18 años sin cuenta propia. Pida a un administrador que asigne '
    + 'su capítulo en Miembros y acceso.',
  'act.yourCurrentRecordAlreadyFamily': 
    'Su registro actual ya tiene vínculos familiares. Póngase en contacto con '
    + 'un administrador para fusionarlos.',
  'act.yourEmailAddressAlreadyConfirmed': 'Su dirección de correo electrónico ya está confirmada.',
  'act.yourMembershipAwaitingApproval': 'Su membresía está pendiente de aprobación.',

  // La copia propia del panel. Véase la versión inglesa para el razonamiento.
  'auth.alreadyAccount': 'Ya tiene una cuenta',
  'auth.signAccept': 'Inicie sesión para aceptar',
  'auth.linkNoLongerValid': 'Ese enlace ya no es válido',
  'auth.resetLinksWorkOnce': 
    'Los enlaces de restablecimiento funcionan una sola vez y caducan al cabo '
    + 'de una hora. Pida uno nuevo y le llegará en un momento.',
  'auth.sendMeNewLink': 'Envíenme un enlace nuevo',
  'acct.noneSectionsSummaryBeen': 
    'No se ha compartido con usted ninguna de las secciones del Resumen. Pida '
    + 'a un administrador acceso a las que necesite: sus cuotas, las '
    + 'recaudaciones, su historial de pagos y los fondos de la familia se '
    + 'conceden por separado.',
  'acct.seeAllDues': 'Ver todas sus cuotas',
  'acct.seeFullPaymentHistory': 'Ver su historial de pagos completo',
  'acct.openDonationDrives': 'Recaudaciones abiertas',
  'acct.allDrives': 'Todas las campañas',
  'acct.seeDonations': 'ver Donaciones',
  'adm.backElections': 'Volver a Elecciones',
  'adm.weCouldNotLoad': 
    'No pudimos cargar los datos de esta familia. Inténtelo de nuevo en un '
    + 'momento.',
  'comm.unableLoadChat': 'No se pudo cargar el chat',
  'comm.makeSureChatMigration': 
    'Compruebe que se ha aplicado la migración del chat en su proyecto de '
    + 'Supabase.',
  'comm.familyTree': 'Árbol genealógico',
  'comm.noElectionsPartFamily': 'Todavía no hay elecciones para su parte de la familia.',
  'comm.backElections': 'Volver a Elecciones',
  'comm.noVotesCast': 'No se ha emitido ningún voto.',
  'comm.allAlbums': 'Todos los álbumes',
  'shell.somethingWentWrong': 'Algo salió mal',
  'shell.weCouldnTLoad': 
    'No pudimos cargar esta página. Suele ser algo temporal; inténtelo de '
    + 'nuevo.',
  'shell.tryAgain': 'Inténtelo de nuevo',
  'shell.backDashboard': 'Volver al panel',
  'gath.backGatherings': 'Volver a Reuniones',
  'hlp.creatingJoiningFamily': 'Crear una familia o unirse a una',
  'hlp.allHelp': 'Toda la ayuda',
  'hlp.page': 'En esta página',
  'hlp.moreManual': 'Más del manual',
  'lib.allMeetings': 'Todas las reuniones',
  'lib.officerSJournalMembers': 
    'El cuaderno de un cargo es para los miembros que ocupan un cargo, y '
    + 'usted todavía no ocupa ninguno.',
  'lib.everyOfficeFamilyNotebook': 
    'Cada cargo de la familia tiene su propio cuaderno: lo que un tesorero '
    + 'averiguó sobre el banco, lo que un responsable de eventos aprendió sobre '
    + 'el salón. Pertenece al cargo y no a la persona, así que sigue ahí para '
    + 'quien venga después.',
  'lib.membersAccessBoardPositions': 'Miembros y acceso › Cargos de la junta',
  'shell.loading': 'Cargando…',
  'shell.pageNotFound': 'Página no encontrada',
  'shell.pageReLookingDoesn': 'La página que busca no existe o puede que se haya movido.',
  'prof.requestJoin': 'Su solicitud para unirse a',
  'prof.membership': 'Su membresía de',
  'rep.everyOffice': 'Todos los cargos',
  'rep.everyBoardPositionFamily': 
    'Todos los cargos de la junta en el orden propio de la familia, con quién '
    + 'los ocupa.',
  'rep.held': 'Ocupado por',
  'rep.holdingMoreThanOne': 'Ocupa más de un cargo',
  'rep.notProblemItselfSmall': 
    'No es un problema en sí mismo: en un capítulo pequeño es habitual que '
    + 'una persona haga dos trabajos. Está aquí porque suele ser la señal de un '
    + 'hueco que alguien ha cubierto sin decirlo.',
  'rep.wearingTwoHats': 'Con dos sombreros',
  'rep.everyPublishedElectionIts': 'Todas las elecciones publicadas con su fase, nominaciones y participación.',
  'rep.turnoutCountsPeopleNot': 
    'La participación cuenta PERSONAS, no papeletas: quien vota para tres '
    + 'cargos en una elección es un votante. Una elección cuya área no tiene '
    + 'miembros aprobados lee',
  'rep.officesNobodyStood': 'Cargos a los que nadie se presentó',
  'rep.membersWhoVoted': 'Miembros que han votado',
  'rep.everyGatheringItsTask': 
    'Todas las reuniones con el avance de sus tareas y, cuando se muestra, su '
    + 'presupuesto.',
  'rep.taskCountsOverdueWhen': 
    'Una tarea cuenta como atrasada cuando su fecha ha pasado y nadie la ha '
    + 'aprobado; una que se ha enviado y aún no se ha resuelto sigue pendiente.',
  'rep.tasksApproved': 'Tareas aprobadas',
  'rep.nobodyHolding': 'Nadie lo ocupa',
  'rep.everyMeeting': 'Todas las reuniones',
  'rep.everyMeetingMostRecent': 
    'Todas las reuniones, la más reciente primero, con el tamaño de la sala, '
    + 'los temas y las votaciones.',
  'rep.minutes': 'Acta de',
  'rep.room': 'En la sala',
  'rep.whoTakesPart': 'Quién participa',
  'rep.everyRelativeWhoBeen': 
    'Cada familiar al que se ha convocado a una reunión, con a cuántas se le '
    + 'convocó, en cuántas votó y de cuántas levantó el acta.',
  'rep.asked': 'Convocado a',
  'rep.voted': 'Votó en',
  'rep.votesCast': 'Votos emitidos',
  'stf.staffConsole': 'Consola del personal',
  'stf.readsAcrossEveryFamily': 'Lee todas las familias de la plataforma',
  'stf.pageNotFound': 'Página no encontrada',
  'stf.thereNothingAddress': 'No hay nada en esta dirección.',
  'stf.everybodyWhoCanOpen': 
    'Todas las personas que pueden abrir esta consola, y qué tipo de acceso '
    + 'tienen. Solo un propietario puede ver esta página o cambiar algo en '
    + 'ella; a los demás se les responde 404, la misma respuesta que la consola '
    + 'da a un cliente. El primerísimo propietario de una base de datos nueva '
    + 'sigue viniendo de',
  'shell.everyoneFamily': 'Todos los de esta familia',
  'inv.invitationNotValid': 'Esta invitación no es válida',
  'inv.mayExpiredBeenCancelled': 
    'Puede que haya caducado, se haya cancelado o ya se haya usado. Pida a '
    + 'quien le invitó que le envíe una nueva.',
  'inv.goSign': 'Ir a iniciar sesión',
  'inv.signAccept': 'Inicie sesión para aceptar',
  'inv.createAccount': 'Cree una cuenta',
  'inv.sign': 'Iniciar sesión',
  'inv.invitationDifferentAddress': 'Esta invitación es para otra dirección',
  'inv.goDashboard': 'Ir a su panel',
  'inv.couldNotAcceptInvitation': 'No se pudo aceptar esta invitación',
  'ui.familyNotConnectedCard': 
    'Su familia todavía no ha conectado un procesador de tarjetas, así que no '
    + 'se puede aportar a las recaudaciones en línea. Entregue su donativo a '
    + 'quien lleve las cuentas y aparecerá aquí en cuanto lo registre.',
  'ui.onePaymentItemizedDue': 
    'Un solo pago, detallado por cuota. Se asienta en las cuentas de la '
    + 'familia en cuanto se acredita: no hay nada que nadie tenga que '
    + 'introducir después.',
  'ui.familyNotConnectedCard2': 
    'Su familia todavía no ha conectado un procesador de tarjetas. Pague por '
    + 'el medio que su familia ya utilice y aparecerá aquí en cuanto un '
    + 'administrador lo registre.',
  'adm.howFamilyDividesItself': 
    'Cómo se divide la familia geográficamente. Un capítulo pertenece a una '
    + 'región, o queda bajo Nacional, que es donde empieza todo y donde se '
    + 'queda un miembro sin capítulo. Las cuotas se pueden acotar a una región '
    + 'o a un capítulo en',
  'adm.nothingSetHereFeature': 
    'Nada que configurar aquí: esta función está siempre disponible o la '
    + 'rigen las filas de arriba.',
  'adm.canOpenAccountingBut': 
    'Puede abrir Contabilidad, pero no se ha compartido con usted ninguna de '
    + 'sus secciones. Pida a un administrador acceso a las áreas que necesite: '
    + 'cuotas, aportaciones, fondos, distribución, hitos y ajustes de pago se '
    + 'conceden por separado.',
  'adm.accountDuesDepositedInto': 
    'Aquí se registrará la cuenta en la que se ingresan las cuotas y desde la '
    + 'que se pagan los desembolsos y los gastos de los eventos, para que los '
    + 'números de un cheque o una transferencia no haya que buscarlos en otro '
    + 'sitio.',
  'adm.notYetAvailableAccount': 
    'Todavía no disponible. Los datos bancarios necesitan almacenamiento '
    + 'cifrado y un permiso más estrecho que Contabilidad antes de poder '
    + 'guardarse aquí.',
  'adm.notYetAcceptedCancelling': 
    'Todavía sin aceptar. Cancelar una hace que el enlace deje de funcionar; '
    + 'conviene hacerlo si fue a la dirección equivocada, ya que solo esa '
    + 'dirección puede usarlo.',
  'adm.theyAlreadyAccountBut': 
    'Ya tiene cuenta pero nunca confirmó su dirección de correo, así que no '
    + 'podría haber iniciado sesión para aceptar. También hemos pedido que se '
    + 'le reenvíe el correo de confirmación: tiene que pulsar ese primero.',
  'adm.theirAccountConfirmedSo': 
    'Su cuenta está confirmada, así que el enlace le llevará directamente a '
    + 'iniciar sesión y unirse.',
  'adm.thereNoAccountAddress': 
    'Todavía no hay ninguna cuenta con esa dirección, así que el enlace le '
    + 'llevará a crear una. No necesitará el código de familia.',
  'adm.weCouldNotCheck': 
    'No pudimos comprobar si esa dirección tiene cuenta, así que si sigue sin '
    + 'poder entrar, conviene preguntarle si alguna vez confirmó su correo.',
  'adm.keptRatherThanDeleted': 
    'Se conserva en lugar de eliminarse, para que quede el registro de la '
    + 'decisión. Puede admitir a alguien después de todo, y cualquier miembro '
    + 'puede enviarle una invitación nueva.',
  'adm.onlyPartFamilyCan': 
    'Solo esta parte de la familia puede ver la elección, ser nominada o '
    + 'votar, y solo puede cubrir cargos registrados al mismo nivel.',
  'adm.bothDaysCountNominations': 
    'Cuentan ambos días: las nominaciones están abiertas desde el primero '
    + 'hasta el último, salvo que la votación se abra el día de cierre, en cuyo '
    + 'caso se cierran al abrirse esta. La fecha de cierre no puede ser '
    + 'anterior al día siguiente a su apertura.',
  'adm.votingMayOpenSame': 
    'La votación puede abrirse el mismo día en que se cierran las '
    + 'nominaciones, y ese día pasa entonces a ser de la votación. No puede '
    + 'abrirse antes.',
  'adm.whatFundToppedUp': 
    'Hasta cuánto se completa este fondo antes de que cualquier fondo por '
    + 'debajo reciba algo. Puede cambiarlo, y también el orden en que se llenan '
    + 'los fondos, en Fondos → Distribución.',
  'adm.milestoneAwardedOutFund': 
    'Un hito se concede con cargo a un fondo, y todavía no hay ninguno. Añada '
    + 'primero un fondo en Fondos → Saldos.',
  'adm.setShareEachDues': 
    'Fije la parte de cada pago de cuotas que va a cada fondo. Los fondos más '
    + 'arriba en la lista se llenan primero; un fondo por debajo de su mínimo '
    + 'se completa antes de que los inferiores reciban algo.',
  'adm.statusStatementRatherThan': 
    'El estado es una afirmación y no algo que calcule el calendario: una '
    + 'reunión puede cancelarse sin mover sus fechas, y Completa es su palabra '
    + 'para decirlo.',
  'adm.severalGatheringsMayFlagged': 
    'Se pueden marcar varias reuniones a la vez: el panel muestra la más '
    + 'próxima que aún no haya terminado, así que el reencuentro del año pasado '
    + 'nunca bloquea el de este. Allí no aparece nada cuando ninguna reunión '
    + 'marcada sigue pendiente.',
  'adm.onePhotographCroppedBand': 
    'Una fotografía, recortada a la forma de la franja. Sin ella, la franja '
    + 'dibuja el árbol de GENORRA. Cualquiera que tenga el enlace puede ver una '
    + 'foto subida, igual que una foto de familia, así que queda publicada para '
    + 'quien la reciba.',
  'adm.budgetAlwaysDrawnFund': 
    'Un presupuesto siempre se toma de un fondo, y puede superar lo que ese '
    + 'fondo tiene: las cifras lo dicen en lugar de rechazarlo, porque una '
    + 'familia planifica un reencuentro antes de haber reunido el dinero.',
  'adm.gatheringMadePartsEach': 
    'Una reunión está hecha de partes, y cada una es una ocasión en sí misma: '
    + 'un reencuentro es la Bienvenida, el Picnic y la Despedida, en sus '
    + 'propios días y lugares. Cada plantilla que añada es una de ellas, y sus '
    + 'pasos se convierten aquí en tareas. Nada de la plantilla alcanza a las '
    + 'tareas que ya están en esta reunión: cada una conserva su propia copia '
    + 'de lo que pedía.',
  'adm.bothOptionalLeaveDay': 
    'Ambos son opcionales. Deje el día vacío para una reunión que ocurre toda '
    + 'de una vez, y el lugar vacío para usar el que la plantilla suele usar.',
  'adm.whatOneTaskExpected': 
    'Cuánto se espera que cueste esta tarea. Vacío significa que no le cuesta '
    + 'nada a la familia. Las partidas en conjunto son lo que la franja de '
    + 'arriba compara con el presupuesto.',
  'adm.photoCurrentlyDashboardBand': 'La foto que está ahora en la franja del panel',
  'adm.nothingWaitingReviewTask': 
    'No hay nada esperando revisión. Una tarea aparece aquí en cuanto el '
    + 'familiar al que se le encargó envía una respuesta.',
  'adm.templateChecklistHandedOut': 
    'Una plantilla es una lista de tareas que se reparte: alguien que pueda '
    + 'crear plantillas tiene que añadir la primera.',
  'adm.budgetAlwaysDrawnFund2': 
    'Un presupuesto siempre se toma de un fondo. Puede superar lo que el '
    + 'fondo tiene: la reunión lo dice en rojo en lugar de rechazarlo.',
  'adm.severalGatheringsMayFlagged2': 
    'Se pueden marcar varias reuniones a la vez: el panel muestra la más '
    + 'próxima que aún no haya terminado, así que el reencuentro del año pasado '
    + 'nunca bloquea el de este.',
  'adm.everyStepTemplateBecomes': 
    'Cada paso de esa plantilla se convierte aquí en una tarea propia, en su '
    + 'propio orden y en este punto de la lista. Nadie responde a este paso: es '
    + 'la lista, no una pregunta. Una plantilla no puede incluirse a sí misma, '
    + 'ni nada que lleve de vuelta a ella.',
  'adm.startingFigureCopiedOnto': 
    'Una cifra inicial que se copia en la tarea. Un organizador puede '
    + 'cambiarla en la reunión, y el dinero que cuenta es el presupuesto propio '
    + 'de la reunión.',
  'adm.onePerThingSomebody': 
    'Uno por cada cosa que alguien tenga que hacer o decidir, en el orden en '
    + 'que se repartirán. Se copian en las tareas de cada reunión programada a '
    + 'partir de esta plantilla, así que editar uno aquí nunca cambia una '
    + 'reunión que ya está en marcha.',
  'adm.whatEachMemberEncouraged': 
    'A cuánto se anima a llegar a cada miembro. Es orientativo: los miembros '
    + 'aportan lo que quieren y pueden pasarse.',
  'adm.driveMembersCanGive': 
    'Una recaudación a la que los miembros pueden aportar entre dos fechas. '
    + 'Nadie la debe y nunca cuenta contra el saldo de un miembro.',
  'adm.groupChaptersTexasEastern': 
    'Un grupo de capítulos: «Texas», «Oriental», «Sudeste». Opcional: una '
    + 'familia puede funcionar solo con capítulos, o sin ninguno de los dos.',
  'adm.noChaptersYetUntil': 
    'Todavía no hay capítulos. Hasta que los haya, cada miembro está bajo '
    + 'Nacional y solo debe las cuotas de toda la familia.',
  'adm.chapterSRegionDecides': 
    'La región de un capítulo decide qué cuotas regionales deben sus '
    + 'miembros. Puede mover un capítulo a otra región en cualquier momento '
    + 'desde',
  'adm.billingCouldNotLoaded': 
    'No se pudo cargar la facturación. Vuelva a cargar la página y no inicie '
    + 'un pago nuevo en la pestaña Plan hasta que aparezca, por si esta familia '
    + 'ya tiene uno.',
  'adm.termEndedPayAgain': 
    'Este periodo ha terminado. Vuelva a pagar en la pestaña Plan para '
    + 'reabrir las páginas que cubría; todos los registros siguen aquí.',
  'adm.stripeSOwnPortal': 
    'El portal propio de Stripe, donde se cambia la tarjeta guardada y se '
    + 'pueden descargar todas las facturas.',
  'adm.canSeeWhatFamily': 
    'Puede ver lo que paga esta familia pero no cambiarlo. Pídalo a un '
    + 'administrador con acceso a Ajustes.',
  'adm.nominationNobodyAnsweredNot': 
    'Una nominación que nadie ha respondido no está en la papeleta. Solo se '
    + 'puede votar a los candidatos que han aceptado.',
  'adm.whatFamilyCalledEverywhere': 
    'Cómo se llama esta familia en toda la aplicación: el selector, el panel '
    + 'y los correos que invitan a unirse. Cambiarlo no mueve nada más: el '
    + 'código de familia de abajo es aquello bajo lo que está archivado cada '
    + 'registro.',
  'adm.whereFamilyDecidesWhether': 
    'Dónde está la familia. Esto decide si una reunión ha terminado, si una '
    + 'tarea está atrasada y cuándo se cierra una elección: las respuestas en '
    + 'las que todos los miembros tienen que coincidir. No cambia las horas de '
    + 'una reunión, que siempre se muestran tal como se escribieron, ni sus '
    + 'propias fechas, que siguen a Mi perfil.',
  'adm.canSeePageBut': 
    'Puede ver esta página pero no cambiar el nombre. Pida a un administrador '
    + 'el permiso de Ajustes.',
  'adm.shareRelativesSoThey': 
    'Comparta esto con sus familiares para que puedan unirse. Todo el que se '
    + 'una espera en Aprobación pendiente hasta que alguien lo admita.',
  'adm.codeCannotChangedFamily': 
    'El código no se puede cambiar y una familia no se puede eliminar. Cada '
    + 'registro de la familia —cuotas, fondos, eventos, chat, miembros— está '
    + 'archivado bajo este código, y nada en la base de datos apunta en sentido '
    + 'contrario, así que cambiarlo dejaría a la familia sin nada de su propia '
    + 'historia.',
  'adm.switchesFamilyOffEverybody': 
    'Desactiva la familia para todos sus integrantes. Nadie puede abrirla, el '
    + 'código de familia deja de funcionar y las invitaciones pendientes dejan '
    + 'de aceptarse.',
  'adm.familyNotSetUp': 
    'Su familia todavía no ha configurado ningún cargo de la junta. Añádalos '
    + 'en Miembros y acceso → Organización y vuelva después.',
  'adm.cannotSeeSetMember': 
    'No puede ver ni fijar la contraseña de este miembro. Envíele un enlace y '
    + 'elegirá una nueva él mismo; la actual sigue funcionando hasta que lo '
    + 'haga.',
  'adm.billingStartsWhenTerm': 
    'La facturación empieza cuando termina el periodo que ya ha pagado. Hoy '
    + 'no se cobra nada.',
  'adm.canSeePlanBut': 
    'Puede ver el plan pero no cambiarlo. Pida a un administrador el permiso '
    + 'de Ajustes.',
  'adm.refreshPageIfKeeps': 
    'Vuelva a cargar la página. Si esto sigue pasando, no intente conectar '
    + 'una cuenta: pida a un administrador que lo compruebe, porque la familia '
    + 'puede que ya tenga una.',
  'adm.duesRecordedHandFrom': 
    'Mientras tanto, las cuotas se registran a mano desde los libros de '
    + 'Transacciones, y cada pago ya registrado se queda exactamente donde '
    + 'está.',
  'adm.anyRecurringPaymentsRunning': 
    'Los pagos recurrentes que estuvieran en marcha se cancelaron en Stripe '
    + 'al desconectar esto. Esos no se pueden reanudar: cada uno de esos '
    + 'familiares tendrá que configurar su pago de nuevo cuando vuelva a '
    + 'conectar.',
  'adm.accountBelongsFamilyNot': 
    'La cuenta pertenece a la familia, no a GENORRA. El dinero va '
    + 'directamente al banco de la propia familia, las comisiones de Stripe '
    + 'salen del lado de la familia y la familia conserva su propio panel de '
    + 'Stripe. GENORRA nunca ve ni guarda una clave de Stripe y no se queda con '
    + 'nada de lo que la familia recauda.',
  'adm.canSeeSectionBut': 
    'Puede ver esta sección pero no cambiarla. Pida a un administrador con '
    + 'acceso a los ajustes de pago que conecte una cuenta.',
  'ui.optionalLeaveEmptyPin': 
    'Opcional. Déjelo vacío para fijarlo hasta que alguien lo suelte. Cada '
    + 'miembro puede descartarlo de sus propias novedades cuando quiera.',
  'ui.willSeeMessageWhichever': 
    'Verá este mensaje cualquiera que sea la dirección que escriba. No '
    + 'decimos si existe una cuenta, porque el código de familia que hace falta '
    + 'para llegar a este sitio está pensado para compartirse, y un formulario '
    + 'que respondiera dejaría que cualquiera que tenga uno averiguara cuáles '
    + 'de sus familiares se han registrado.',
  'ui.checkSpamFolderFirst': 
    'Revise primero la carpeta de correo no deseado y después pruebe con la '
    + 'dirección con la que se registró, y no con la que su familia suele usar '
    + 'para localizarle. El enlace funciona una vez y caduca, así que pida uno '
    + 'nuevo en lugar de reutilizar un correo antiguo.',
  'ui.accountConfirmedBeforeCan': 
    'Una cuenta tiene que estar confirmada antes de poder iniciar sesión. '
    + 'Enviamos un enlace cuando se registró: revise primero la carpeta de '
    + 'correo no deseado y use el mensaje más reciente, ya que cada enlace '
    + 'funciona una vez y caduca al cabo de una hora.',
  'ui.pickSomethingNotUsed': 
    'Elija algo que no haya usado aquí antes. Iniciará sesión en cuanto se '
    + 'guarde.',
  'ui.wholeWordsPhrasesLeading': 
    'Palabras y frases completas, y un signo menos delante excluye una. Llega '
    + 'al interior de un documento solo cuando se ha podido leer el texto: vea '
    + 'la etiqueta de cada artículo.',
  'ui.pastingTextWhatMakes': 
    'Pegar el texto es lo que hace que un artículo se pueda buscar palabra '
    + 'por palabra. Un PDF o un archivo de Word se guarda y se puede descargar, '
    + 'pero su contenido todavía no se lee.',
  'ui.familySRecordsNever': 
    'Los registros de su familia nunca se comparten: ni nombres, ni '
    + 'parentescos, ni fechas de nacimiento, ni fotografías, ni mensajes.',
  'dash.familyMemberMayAlready': 
    'Puede que un familiar ya le haya añadido. Búsquese abajo y vincule su '
    + 'cuenta al registro existente.',
  'dash.familyMembers': 'Miembros de la familia',
  'dash.pendingApproval': 'Aprobación pendiente',
  'dash.upcomingGatherings': 'Próximas reuniones',
  'dash.addMember': 'Añadir miembro',
  'dash.recordPayment': 'Registrar pago',
  'dash.sendMessage': 'Enviar mensaje',
  'dash.myTasks': 'Mis tareas',
  'dist.emailEveryoneFamilyOnce': 
    'Escriba de una vez a toda la familia. La lista de quién lo recibe es su '
    + 'propia membresía: no hay nada que mantener al día y nadie está en ella '
    + 'dos veces.',
  'dist.newDistribution': 'Nuevo envío',
  'dist.canLeavePageSend': 'Puede salir de esta página: el envío continúa desde donde iba.',
  'dist.weCouldNotRead': 
    'No pudimos leer sus envíos en este momento. No se ha perdido nada; '
    + 'inténtelo de nuevo en un momento.',
  'dist.sent': 'Enviado a',
  'dist.sent2': 'Enviado por',
  'dist.tryAgain': 'Inténtelo de nuevo',
  'dist.whoGoes': 'A quién va',
  'dist.plainTextLeaveBlank': 
    'Texto sin formato. Deje una línea en blanco entre párrafos. Las '
    + 'respuestas vuelven a su propia dirección de correo, no a GENORRA.',
  'dist.loading': 'Cargando…',
  'dist.whatSent': 'Qué se envió',
  'dist.whoWent': 'A quién fue',
  'dist.reunionDetails4th': 'Detalles del reencuentro del día 4',
  'dist.waitingSend': 'Esperando envío',
  'dist.couldNotDelivered': 'No se pudo entregar',
  'dist.noEmailAddressFile': 'Sin dirección de correo registrada',
  'dist.sharesAddress': 'Comparte una dirección',
  'dist.notSentStopped': 'Sin enviar: detenido',
  'dist.emailsSentBeenSent':
    'Los correos que se enviaron ya están enviados. Esto elimina el registro de a quién se '
    + 'escribió y qué pasó con cada mensaje, y no se puede deshacer.',
  'dues.schedule': 'Por plan',
  'dues.noDuesSchedulesActive': 
    'No hay ningún plan de cuotas activo, así que no hay nada que proyectar. '
    + 'Añada uno en Contabilidad → Cuotas.',
  'dues.member': 'Por miembro',
  'dues.onlyThoseWhoOwe': 'Solo quienes lo deben',
  'dues.nobodyFamilyBeenApproved': 
    'Todavía no se ha aprobado a nadie en la familia, así que no hay nada que '
    + 'proyectar.',
  'dues.noMembersMatchFilter': 'Ningún miembro coincide con ese filtro.',
  'dues.eachScheduleMeasuredOver': 
    'Cada plan se mide sobre su propio año, así que los totales son la suma '
    + 'de ellos',
  'dues.filterName': 'Filtrar por nombre…',
  'dues.filterMembers': 'Filtrar miembros',
  'dues.onlyMembersDescendedFrom': 'Solo lo deben los miembros que descienden de la línea de la familia.',
  'dues.onlyMembersPartFamily': 
    'Solo los miembros de esta parte de la familia deben esta cuota. Un '
    + 'miembro sin capítulo está bajo Nacional y no debe nada acotado.',
  'dues.nothingPaid': 'Nada pagado',
  'dues.partPaid': 'Parcialmente pagado',
  'dues.notYetDue': 'Aún no vencido',
  'dues.notTheirs': 'No le corresponde',
  'dues.pendingInvite': 'Invitación pendiente',
  'ui.putRelativeForwardAny': 
    'Proponga a un familiar para cualquier cargo de abajo, o preséntese '
    + 'usted. Puede retirar su propio nombre de una nominación mientras las '
    + 'nominaciones estén abiertas.',
  'ui.standingOfficeYourselfNeeds': 
    'Presentarse a un cargo uno mismo no necesita el acuerdo de nadie más, y '
    + 'cuenta como aceptado de inmediato.',
  'ui.theyGoTreeStraight': 
    'Entra en el árbol de inmediato. Le enviaremos una invitación por correo '
    + 'y, cuando la acepte, su cuenta se une a',
  'ui.duesCanStartAge': 
    'Las cuotas pueden empezar a una edad. Sin fecha de nacimiento no podemos '
    + 'saber cuándo empieza este niño a deberlas, y se le facturaría como a un '
    + 'adulto.',
  'ui.shouldRareWeGenerate': 
    'Esto debería ser poco frecuente. Generamos una dirección para que el '
    + 'registro pueda existir y nunca enviamos nada a ella, así que esta '
    + 'persona no puede iniciar sesión y no le llegará nada. Si alguna vez '
    + 'pudiera querer una cuenta, invítela en su lugar.',
  'ui.siblingsSharePersonS': 
    'Los hermanos comparten la generación de esta persona, así que se listan '
    + 'aquí en lugar de dibujarse en la fila de arriba.',
  'ui.decidesWhetherTheyFill': 
    'Esto decide si ocupa el lugar del padre o el de la madre, y nos permite '
    + 'nombrar la conexión de vuelta hacia esa persona.',
  'ui.gotEmailAddressNow': 
    '¿Ya tiene una dirección de correo? Envíele una invitación. Cuando la '
    + 'acepte, su cuenta se une a',
  'gath.budgetGatheringCouldNot': 
    'No se pudo leer el presupuesto de esta reunión en este momento. Nada ha '
    + 'cambiado; vuelva a cargar la página para intentarlo otra vez.',
  'gath.noTasksYetGathering': 
    'Todavía no hay tareas. Las tareas de una reunión vienen de las '
    + 'plantillas con las que se creó, así que un organizador que añada aquí '
    + 'una plantilla añade sus trabajos a esta lista.',
  'gath.everyStepEveryTemplate': 
    'Cada paso de cada plantilla que elija se convierte en una tarea de esta '
    + 'reunión, lista para repartir. Si no elige ninguna, esto es una fecha en '
    + 'el calendario de la familia sin tareas, y un organizador puede '
    + 'desarrollarla después.',
  'gath.nothingAssignedMomentWhen': 
    'De momento no hay nada asignado a usted. Cuando un organizador le '
    + 'encargue una parte de una reunión, aparecerá aquí con qué hay que enviar '
    + 'y para cuándo.',
  'gath.runsOverMoreThan': 'Dura más de un día',
  'gath.startTime': 'Hora de inicio',
  'gath.optional': 'Opcional.',
  'gath.leaveEmptyIfAll': 'Déjelo vacío si todo es el mismo día.',
  'gath.endTime': 'Hora de fin',
  'gath.addAnotherDay': 'Añadir otro día',
  'gath.chooseTimezone': 'Elija una zona horaria…',
  'gath.everyoneSeesTimeExactly': 
    'Todos ven la hora exactamente como usted la escribió, con esta zona '
    + 'horaria indicada al lado. No se convierte nada.',
  'ui.weLlEmailThem': 
    'Le enviaremos una invitación por correo. Solo esta dirección puede '
    + 'usarla y caduca en 14 días. El nombre es lo que su familia ve mientras '
    + 'espera a ser admitida.',
  'ui.invitationCreatedButWe': 
    'Se creó la invitación, pero no pudimos enviarla por correo. Envíele este '
    + 'enlace en su lugar: funciona exactamente igual.',
  'ui.treatLikePasswordAnyone': 
    'Trátelo como una contraseña: cualquiera que lo consiga y tenga esa '
    + 'dirección de correo puede usarlo. Se muestra una sola vez.',
  'shell.anythingTypedNotSaved': 
    'Todo lo que haya escrito y no haya guardado se perderá, así que termine '
    + 'o continúe ahora.',
  'shell.iMStillHere': 'Sigo aquí',
  'shell.stillThere': '¿Sigue ahí?',
  'shell.familyTree': 'Árbol genealógico',
  'shell.meetingMinutes': 'Actas de reuniones',
  'shell.officerNotes': 'Cuadernos de cargos',
  'shell.duesDonations': 'Cuotas y aportaciones',
  'shell.paymentHistory': 'Historial de pagos',
  'shell.duesProjections': 'Proyecciones de cuotas',
  'shell.pLSummary': 'Resumen de resultados',
  'shell.boardOffices': 'Junta y cargos',
  'shell.howManual': 'Manual de uso',
  'ui.theseMinutesClosedNothing': 
    'Estas actas están cerradas. Nada de la reunión cambia ya, y eso es lo '
    + 'que las convierte en el registro.',
  'ui.scheduleOneSayingWhat': 
    'Programe una diciendo qué clase de reunión es: toda la familia, un '
    + 'capítulo, una junta, un mismo cargo en todas las áreas, o solo las '
    + 'personas que usted nombre. Todos los de la sala reciben el aviso y la '
    + 'reunión les aparece en el calendario. Durante la reunión, quien levanta '
    + 'el acta añade un tema y escribe notas debajo, y puede convocar una '
    + 'votación que la sala responde.',
  'ui.everyoneSeesTimeExactly': 
    'Todos ven la hora exactamente como usted la escribió, con esta zona '
    + 'horaria indicada al lado. No se convierte nada.',
  'ui.administratorFamilySwitchedOff': 
    'Un administrador de esta familia la desactivó. Nadie puede abrirla, '
    + 'unirse a ella ni aceptar una invitación.',
  'ui.everyPaymentFundPhotograph': 
    'Cada pago, fondo, fotografía, evento, mensaje, documento y persona está '
    + 'exactamente donde estaba. Eliminar una familia cierra sus puertas; no '
    + 'destruye ningún registro y no ha tocado su cuenta ni ninguna otra '
    + 'familia a la que pertenezca.',
  'ui.onlyGenorraSupportCan': 
    'Solo el soporte de GENORRA puede recuperar una familia: no hay ningún '
    + 'botón para ello en ninguna parte del producto, a propósito. Si esto no '
    + 'era lo previsto, pida a quien administre la familia que se ponga en '
    + 'contacto con soporte.',
  'ui.requestBackTheirAdministrators': 
    'Su solicitud vuelve a estar con sus administradores, con su nota '
    + 'adjunta. Verán quién la rechazó antes y qué ha dicho usted al respecto.',
  'ui.sayWhoHowRelated': 
    'Diga quién es y cómo está emparentado, para que quien la revise pueda '
    + 'situarle. Esto va a los administradores de la familia.',
  'ui.weSentConfirmationLink': 
    'Le enviamos un enlace de confirmación al registrarse. Su solicitud no se '
    + 'puede aprobar hasta que lo haya usado.',
  'ui.weWillGenerateFamily': 
    'Generaremos un código de familia que podrá compartir. Su nombre y sus '
    + 'datos de contacto se copian del perfil que ya tiene y se mantienen '
    + 'iguales en todas las familias a las que pertenezca.',
  'ui.shareRelativesSoThey': 
    'Comparta esto con sus familiares para que puedan unirse. Todo el que se '
    + 'una espera en Aprobaciones de miembros hasta que usted lo admita.',
  'ui.profileDetailsSharedAcross': 
    'Los datos de su perfil se comparten entre todas las familias a las que '
    + 'pertenece. Elija cuál se abre al iniciar sesión, o cambie la familia que '
    + 'está viendo ahora.',
  'ui.familyAccountBelongsProfile': 
    'La familia a la que pertenece esta cuenta. Los datos de su perfil se '
    + 'comparten entre todas las familias a las que se une.',
  'ui.switchedOffAdministratorNothing': 
    'Desactivada por un administrador. No se eliminó nada, y solo el soporte '
    + 'de GENORRA puede recuperarla.',
  'prof.whatFamilyMayContact': 
    'Sobre qué puede contactarle su familia, y cómo. Todo lo de aquí es suyo '
    + 'y nadie más puede fijarlo por usted.',
  'prof.chapterAppliesFamilyOnly': 
    'Su capítulo se aplica solo a esta familia; el resto de su perfil se '
    + 'comparte entre todas las familias a las que pertenece. Cambiarlo también '
    + 'traslada a sus hijos menores de 18 años que no tengan cuenta propia; '
    + 'todos los demás fijan el suyo.',
  'prof.canAlsoDecideWhat': 
    'También puede decidir lo que debe: una familia puede asociar cuotas a '
    + 'una región o a un capítulo. No elegir nada le deja bajo Nacional, '
    + 'debiendo las cuotas de toda la familia y ninguna de las locales.',
  'prof.sunsetDate': 'Fecha de fallecimiento',
  'prof.datesTimesProductRecords': 
    'Las fechas y horas que registra el producto —cuándo se introdujo un '
    + 'pago, cuándo se envió un mensaje— se le muestran en esta zona horaria.',
  'prof.leaveEmptyWeFollow': 
    'Déjelo vacío y seguimos a su navegador. La traducción sigue en curso, '
    + 'así que algunas pantallas están en inglés cualquiera que sea el idioma '
    + 'que elija.',
  'prof.changeSignEmail': 'Cambiar el correo de inicio de sesión',
  'prof.passwordBeenChangedEvery': 
    'Su contraseña se ha cambiado, y todos los demás dispositivos con la '
    + 'sesión abierta en esta cuenta se han cerrado. Necesitarán la contraseña '
    + 'nueva.',
  'rep.everyApprovedMemberFamily': 
    'Todos los miembros aprobados de la familia, estén donde estén. No se '
    + 'cuentan los solicitantes que siguen esperando en la cola de '
    + 'aprobaciones, ni los familiares registrados como fallecidos.',
  'rep.lookingUpWhoGroup': 'Consultando quién está en este grupo…',
  'rep.whoGroupNotYours': 
    'Quién está en este grupo no le corresponde verlo. Las cifras del gráfico '
    + 'sí; los nombres necesitan además el Directorio de miembros.',
  'rep.theirRegionFollowsTheir': 
    'Su región sigue a su capítulo. Los hijos menores de dieciocho años sin '
    + 'cuenta propia se trasladan con ellos.',
  'rep.adultMinorWorkedOut': 
    'Si es adulto o menor se calcula a partir de esto cada vez que se carga '
    + 'el informe; no se guarda nada sobre su edad.',
  'ui.relativeWhoNotTold': 
    'Un familiar que no ha dicho a la familia en qué capítulo está no está en '
    + 'ninguna región, así que no se le pregunta. Use',
  'stf.staffListCouldNot': 
    'No se pudo leer la lista del personal. Eso es una consulta rechazada y '
    + 'no un equipo vacío: usted está en ella, o esta página habría respondido '
    + '404 en lugar de mostrarse. Inténtelo de nuevo en un momento y consulte '
    + 'el registro del servidor para ver el motivo.',
  'stf.addressBelongAccountAlready': 
    'La dirección tiene que pertenecer a una cuenta que ya exista. A alguien '
    + 'que nunca se ha registrado no se le puede conceder nada, y esta pantalla '
    + 'lo dirá en lugar de escribir una fila para un id, y por eso pide una '
    + 'dirección y no un id de usuario.',
  'stf.recordedRowShownList': 
    'Se registra en la fila y se muestra en la lista de arriba. Es lo único '
    + 'que explicará esta concesión a quien lea la lista dentro de un año, y '
    + 'por eso es obligatorio.',
  'stf.pasteAddressFromTicket': 
    'Pegue la dirección del ticket. Esto dice si existe alguna cuenta, si se '
    + 'ha confirmado o usado alguna vez, y todos los registros de familia que '
    + 'llevan esa dirección, incluido uno que fue invitado y nunca se unió.',
  'stf.authenticationServiceDidNot': 
    'El servicio de autenticación no respondió, así que no sabemos si esta '
    + 'dirección tiene cuenta. Eso es una consulta fallida, no una cuenta '
    + 'inexistente; inténtelo de nuevo.',
  'stf.addressNeverBeenConfirmed': 
    'La dirección nunca se ha confirmado, y eso es lo que impide el inicio de '
    + 'sesión. Reenviar la confirmación es la solución.',
  'stf.familyRecordsAddressCould': 
    'No se pudieron leer los registros de familia de esta dirección; eso es '
    + 'una consulta rechazada y no una dirección que no pertenece a nada.',
  'stf.addressNoFamilyRecord': 
    'Esta dirección no está en ningún registro de familia. Una cuenta sin '
    + 'familia ve un 404 en todas las páginas, que es a lo que se parece '
    + '«simplemente no funciona».',
  'stf.accountListCouldNot': 
    'No se pudo leer la lista de cuentas. Eso es el servicio de autenticación '
    + 'rechazando o agotando el tiempo, no una plataforma sin cuentas.',
  'stf.familiesListCouldNot': 
    'No se pudo leer la lista de familias. Eso es una consulta rechazada y no '
    + 'una plataforma vacía; inténtelo de nuevo en un momento y consulte el '
    + 'registro del servidor para ver el motivo.',
  'tx.canOpenTransactionsBut': 
    'Puede abrir Transacciones, pero no se ha compartido con usted ninguno de '
    + 'sus libros. Pida a un administrador acceso a los que necesite: cuotas, '
    + 'aportaciones, contribuciones, desembolsos y transferencias se conceden '
    + 'por separado.',
  'tx.noContributionsYet': 'Todavía no hay contribuciones.',
  'tx.noDisbursementsRecorded': 'No hay desembolsos registrados.',
  'tx.noTransfersBetweenFunds': 'Todavía no hay transferencias entre fondos.',
  'tx.noneSetUpYet': 'Todavía no hay ninguno: un administrador los añade en Contabilidad.',
  'tx.waivingForgivesDueNo': 
    'Exonerar perdona la cuota. No cambió de manos ningún dinero, así que no '
    + 'hay método ni referencia que registrar.',
  'tx.paymentMethod': 'Forma de pago',
  'tx.checkReference': 'N.º de cheque / referencia',
  'tx.whoGave': 'Quién lo dio',
  'tx.someoneSomethingElse': 'Otra persona u otra cosa…',
  'tx.nameSource': 'Nombre u origen',
  'tx.milestoneOptional': 'Hito (opcional)',
  'tx.transferCannotEditedDeleted': 
    'Una transferencia no se puede editar ni eliminar. Si está equivocada, '
    + 'devuelva el dinero: ambos asientos quedan en el libro.',
  'tx.check1043': 'Cheque n.º 1043',
  'tx.optionalNotes': 'Notas opcionales',
  'tx.auntRubySEstate': 'Herencia de la tía Ruby, excedente del reencuentro de 2026…',
  'tx.boardVote202608': 
    'Votación de la junta del 12-08-2026: excedente trasladado al fondo de '
    + 'becas',
  'tx.newContribution': 'Nueva contribución',
  'tx.newDisbursement': 'Nuevo desembolso',
  'tx.newTransfer': 'Nueva transferencia',
  'tx.recorded': 'Registrado por',
  'tx.paymentMethod2': 'Forma de pago',
  'tx.paid': 'Pagado a',
  'tx.fundMilestone': 'Fondo / hito',
  'tx.from': 'De → a',
  'ui.stateProvince': 'Estado / provincia',
  'ui.profilePhoto': 'Foto de perfil',
  'ui.confirmationCode': 'Código de confirmación',
  'ui.chosen': 'Elegido:',
  'ui.nobodyMatches': 'Nadie coincide con eso.',
  'ui.searchName': 'Buscar por nombre…',
  'ui.whoCanDoWhat': 'Quién puede hacer qué',
  'ui.farScrollingGoesThere': 
    'Hasta aquí llega el desplazamiento. Hay novedades más antiguas: busque '
    + 'una palabra de una de ellas para encontrarla.',
}
