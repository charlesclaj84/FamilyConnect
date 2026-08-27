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
  'notify.notBuilt': 'Aún no está disponible',
  'notify.stopped': 'Detenido',
  'notify.toggleLabel': '{channel} para {notification}',
  'notify.noneOnFile': 'No hay ninguno registrado',
  'notify.placeholderAddress': 'Una dirección generada: nada puede llegar ahí',
  'notify.endingIn': 'Termina en {digits}',
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
}
