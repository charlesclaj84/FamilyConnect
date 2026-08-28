import type { Catalogue } from '@/lib/i18n/t'

/**
 * The words in the mail the app sends. Español — Latin American, formal address.
 *
 * ── `usted` THROUGHOUT, AND IT MATTERS MORE HERE THAN ON SCREEN ─────────────────────
 * `lib/i18n/es.ts` carries the decision and the reasoning. Mail is where it is most exposed:
 * three of these messages are about MONEY or about REMOVING something, and two of them are the
 * warning somebody gets when another person is signed in as them. Formal address is what that
 * register wants in Spanish, and *tú* in a security notice reads as a marketing email.
 *
 * Visible below in *Escriba* (not *Escribe*), *no haga nada* (not *no hagas nada*), *cambie su
 * contraseña* (not *cambia tu contraseña*), and *Abra* (not *Abre*).
 *
 * ── THE MARKUP IS PART OF THE SENTENCE AND MOVES WITH IT ───────────────────────────
 * Every `<strong>` here wraps the same thing its English counterpart wraps, but the tag sits
 * wherever Spanish word order puts that phrase — which is the reason emphasis lives inside the
 * string rather than being applied around it in JSX. `i18n:check` cannot verify a tag survived
 * translation, so the tags are kept few and simple.
 *
 * ── ONE PLURAL SPLIT KEPT, AND IT IS THE TRANSLATOR'S TO WIDEN ─────────────────────
 * `email.disconnect.autopayOne` / `autopayMany` are two strings because English needs two.
 * Spanish also needs exactly two here, so they map across — but the SPLIT is what makes a
 * language with more plural forms able to add them, which a single string carrying `{n}` could
 * never do.
 */
export const emailEs: Catalogue = {
  // ── MEMBERSHIP APPROVED ──────────────────────────────────────────────────────────
  'email.approved.subject': 'Su solicitud para unirse a {family} fue aprobada',
  'email.approved.preheader': 'Ya está dentro. {family} lo espera.',
  'email.approved.heading': 'Bienvenido',
  'email.approved.headingNamed': 'Bienvenido, {name}',
  'email.approved.p1':
    'Su solicitud para unirse a <strong style="font-weight:600;">{family}</strong> en {app} fue '
    + 'aprobada.',
  'email.approved.p2':
    'Ya tiene acceso a todo: el árbol familiar, las fotografías, las reuniones, los anuncios y lo '
    + 'demás. Un buen primer paso es completar sus datos, para que quienes lo conocen puedan '
    + 'encontrarlo.',
  'email.approved.button': 'Abrir GENORRA',
  'email.approved.footnote':
    'Recibe este mensaje porque alguien con esta dirección pidió unirse a una familia en {app}.',

  // ── FAMILY INVITATION ────────────────────────────────────────────────────────────
  // SENT IN THE INVITER'S LANGUAGE. The reader may not have chosen Spanish — they have no
  // account and therefore no preference — so this copy leans a little more explicit than the
  // English about what the product IS, on the chance the language is a surprise.
  'email.invitation.subject': '{inviter} lo invitó a unirse a {family}',
  'email.invitation.subjectNoInviter': 'Lo invitaron a unirse a {family}',
  'email.invitation.preheader':
    '{family} le guardó un lugar. La invitación vence en {days} días.',
  'email.invitation.heading': 'Su familia le guardó un lugar',
  'email.invitation.greeting': 'Hola {name}:',
  'email.invitation.opening':
    '<strong style="font-weight:600;">{inviter}</strong> lo invitó a unirse a '
    + '<strong style="font-weight:600;">{family}</strong> en {app}, donde una familia guarda sus '
    + 'historias, sus fotografías, sus planes y el registro de quién es quién.',
  'email.invitation.openingNoInviter':
    'Lo invitaron a unirse a <strong style="font-weight:600;">{family}</strong> en {app}, donde '
    + 'una familia guarda sus historias, sus fotografías, sus planes y el registro de quién es '
    + 'quién.',
  'email.invitation.preApproved':
    'Acepte abajo y entra de inmediato. No hay ningún código familiar que buscar ni nada que '
    + 'llenar antes.',
  'email.invitation.needsReview':
    'Acepte abajo para crear su cuenta. Después, un administrador lo admitirá, así que puede '
    + 'haber una espera corta tras ese paso.',
  'email.invitation.button': 'Aceptar la invitación',
  'email.invitation.fine':
    'Esta invitación es solo para esta dirección y vence en {days} días.',
  'email.invitation.footnote':
    'Si no esperaba este mensaje, puede ignorarlo sin problema. No se crea ninguna cuenta hasta '
    + 'que acepte, y no se le avisa a nadie en ningún caso.',

  // ── FAMILY REMOVAL CODE ──────────────────────────────────────────────────────────
  'email.removal.subject': 'Su código para eliminar {family}',
  'email.removal.preheader': 'El código dura {minutes} minutos y se puede usar una sola vez.',
  'email.removal.heading': 'Confirme la eliminación de esta familia',
  'email.removal.p1':
    'Alguien con su sesión pidió eliminar <strong style="font-weight:600;">{family}</strong> de '
    + '{app}. Escriba este código en la confirmación para terminar:',
  'email.removal.p2':
    'Eliminar una familia la cierra para todos sus integrantes: nadie puede abrirla, unirse a ella '
    + 'ni aceptar una invitación. <strong style="font-weight:600;">No se borra nada.</strong> Cada '
    + 'pago, fotografía, evento y persona queda exactamente donde está, y el equipo de GENORRA '
    + 'puede restaurar la familia.',
  'email.removal.fine': 'Este código dura {minutes} minutos y se puede usar una sola vez.',
  'email.removal.footnote':
    'Si no pidió esto, no haga nada: el código vence por su cuenta y la familia queda exactamente '
    + 'como está. Después cambie su contraseña, porque alguien más tiene su sesión abierta.',

  // ── STRIPE DISCONNECT CODE ───────────────────────────────────────────────────────
  'email.disconnect.subject': 'Su código para desconectar Stripe de {family}',
  'email.disconnect.preheader': 'El código dura {minutes} minutos y se puede usar una sola vez.',
  'email.disconnect.heading': 'Confirme la desconexión de Stripe',
  'email.disconnect.p1':
    'Alguien con su sesión pidió desconectar la cuenta de Stripe con la que '
    + '<strong style="font-weight:600;">{family}</strong> cobra sus cuotas. Escriba este código en '
    + 'la confirmación para terminar:',
  'email.disconnect.p2':
    'Los miembros ya no podrán pagar en línea, y todos los pagos ya registrados se conservan. '
    + '<strong style="font-weight:600;">La cuenta de Stripe de la familia queda intacta</strong>: '
    + 'el dinero, los datos bancarios y el panel de Stripe se quedan exactamente como están.',
  'email.disconnect.autopayOne':
    '<strong style="font-weight:600;">1 familiar</strong> paga sus cuotas automáticamente, y ese '
    + 'cobro se cancelará en Stripe. Los cobros cancelados no se pueden reactivar: al reconectar '
    + 'vuelve la cuenta, pero ese familiar tendría que configurar su pago de nuevo.',
  'email.disconnect.autopayMany':
    '<strong style="font-weight:600;">{n} familiares</strong> pagan sus cuotas automáticamente, y '
    + 'esos cobros se cancelarán en Stripe. Los cobros cancelados no se pueden reactivar: al '
    + 'reconectar vuelve la cuenta, pero cada uno tendría que configurar su pago de nuevo.',
  'email.disconnect.fine': 'Este código dura {minutes} minutos y se puede usar una sola vez.',
  'email.disconnect.footnote':
    'Si no pidió esto, no haga nada: el código vence por su cuenta y nada cambia. Después cambie '
    + 'su contraseña, porque alguien más tiene su sesión abierta.',

  // ── DISTRIBUTION ─────────────────────────────────────────────────────────────────
  // Sent in the SENDER's language, so this copy wraps a message that is also in Spanish. The
  // subject and the heading are the member's own words and are not keys at all.
  'email.distribution.preheaderFrom': 'De {sender}, para toda la familia {family}.',
  'email.distribution.preheaderAnon': 'Un mensaje para toda la familia {family}.',
  'email.distribution.empty': '(No se incluyó ningún mensaje.)',
  'email.distribution.footnoteFrom':
    '{sender} envió esto a toda la familia {family} en {app}. Responda a este correo para '
    + 'contestarle directamente.',
  'email.distribution.footnoteAnon': 'Esto se envió a toda la familia {family} en {app}.',

  // ── SAFETY CHECK-IN ──────────────────────────────────────────────────────────────
  // The one message somebody may read in an emergency, so it is the shortest and the plainest —
  // and the one sent in the READER's language while the raiser's own words come through
  // untranslated. *Aviso* rather than *alerta* throughout, deliberately: this is somebody
  // asking, never the product claiming that something is happening.
  'email.checkIn.subject': '¿Está a salvo? — {family}',
  'email.checkIn.preheader': '{title}: su familia le pide que responda.',
  'email.checkIn.heading': '¿Está a salvo?',
  'email.checkIn.askRaiser':
    '{raiser} pidió a todos en la familia {family} que puedan verse afectados por '
    + '<strong>{title}</strong> que digan si están a salvo.',
  'email.checkIn.askAnon':
    'La familia {family} pidió a todos los que puedan verse afectados por '
    + '<strong>{title}</strong> que digan si están a salvo.',
  'email.checkIn.answer':
    'Abra el aviso y elija <strong style="font-weight:600;">Estoy a salvo</strong> o '
    + '<strong style="font-weight:600;">Necesito ayuda</strong>. Toma un solo toque, y quien '
    + 'preguntó verá su respuesta de inmediato.',
  'email.checkIn.button': 'Responder el aviso',
  'email.checkIn.footnoteRaiser':
    '{raiser} levantó este aviso en la familia {family} en {app}. Si no puede abrir el enlace, '
    + 'responda a este correo y lo verá.',
  'email.checkIn.footnoteAnon':
    'Este aviso se levantó en la familia {family} en {app}. Si no puede abrir el enlace, responda '
    + 'a este correo.',
  'email.chrome.values': 'Conectar | Planear | Celebrar',
  'email.chrome.lead': 'Donde todas las generaciones tienen su lugar.',
  'email.chrome.fallback': 'Si el botón no funciona, pegue esto en su navegador:',

  'email.auth.confirm.subject': 'Ya casi está dentro',
  'email.auth.confirm.preheader': 'Un toque y listo. El enlace vale una hora.',
  'email.auth.confirm.heading': 'Ya casi está dentro',
  'email.auth.confirm.p1':
    'Bienvenido. Confirme esta dirección y su cuenta de {app} estará lista: las historias, las '
    + 'fotografías y los planes de su familia, en un solo lugar.',
  'email.auth.confirm.p2':
    'Una cosa que puede esperar a continuación: su familia revisa a los nuevos miembros antes '
    + 'de admitirlos, así que puede haber una breve espera después de este paso.',
  'email.auth.confirm.button': 'Confirmar mi dirección de correo',
  'email.auth.confirm.fine': 'Este enlace funciona una vez y caduca al cabo de una hora.',
  'email.auth.confirm.footnote':
    'Si no creó una cuenta de {app}, puede ignorar este mensaje: no ocurre nada hasta que se '
    + 'abre el enlace, y caduca por sí solo.',

  'email.auth.recovery.subject': 'Restablezca su contraseña',
  'email.auth.recovery.preheader': 'Elija una contraseña nueva. El enlace vale una hora.',
  'email.auth.recovery.heading': 'Elija una contraseña nueva',
  'email.auth.recovery.p1':
    'Alguien pidió restablecer la contraseña de la cuenta de {app} de esta dirección. Abra el '
    + 'enlace de abajo y elija una nueva.',
  'email.auth.recovery.button': 'Elegir una contraseña nueva',
  'email.auth.recovery.fine': 'Este enlace funciona una vez y caduca al cabo de una hora.',
  'email.auth.recovery.footnote':
    'Si no lo pidió, puede ignorarlo con tranquilidad. Su contraseña no cambiará y el enlace '
    + 'caduca por sí solo.',

  'email.auth.invite.subject': 'Su familia le guardó un sitio',
  'email.auth.invite.preheader': 'Acepte la invitación para unirse a ellos en {app}.',
  'email.auth.invite.heading': 'Su familia le guardó un sitio',
  'email.auth.invite.p1':
    'Alguien de su familia invitó a <strong style="font-weight:600;">{email}</strong> a unirse '
    + 'a ellos en {app}, donde una familia guarda sus historias, sus fotografías, sus planes y '
    + 'el registro de quién pertenece a quién.',
  'email.auth.invite.p2':
    'Acepte abajo y le dejamos la cuenta lista. No hay ningún código de familia que buscar ni '
    + 'nada que rellenar antes.',
  'email.auth.invite.button': 'Aceptar la invitación',
  'email.auth.invite.fine': 'Este enlace funciona una vez y caduca al cabo de una hora.',
  'email.auth.invite.footnote':
    'Si no esperaba esto, puede ignorarlo. No se crea ninguna cuenta hasta que se abre el '
    + 'enlace.',

  'email.auth.reauth.subject': 'Solo comprobamos que es usted',
  'email.auth.reauth.preheader':
    'Su código de confirmación está abajo. Funciona una vez y caduca al cabo de una hora.',
  'email.auth.reauth.heading': 'Solo comprobamos que es usted',
  'email.auth.reauth.p1':
    'Está haciendo un cambio que necesita una segunda comprobación. Escriba este código en la '
    + 'pantalla que se lo pidió:',
  'email.auth.reauth.fine': 'Este código funciona una vez y caduca al cabo de una hora.',
  'email.auth.reauth.footnote':
    'Nunca le pediremos este código por teléfono, mensaje de texto ni correo. Si no lo '
    + 'esperaba, no lo comparta: puede que alguien conozca su contraseña, y lo que hay que '
    + 'hacer es cambiarla.',

  'email.auth.changeOld.subject': 'Confirme su nueva dirección',
  'email.auth.changeOld.preheader':
    'Confirme el cambio desde la dirección que tiene ahora.',
  'email.auth.changeOld.heading': 'Confirme este cambio',
  'email.auth.changeOld.p1':
    'Se pidió trasladar la cuenta de {app} de '
    + '<strong style="font-weight:600;">{email}</strong> a '
    + '<strong style="font-weight:600;">{newEmail}</strong>.',
  'email.auth.changeOld.p2':
    'Ambas direcciones tienen que confirmarlo. Esta es la mitad de la dirección que tiene '
    + 'ahora.',
  'email.auth.changeOld.button': 'Confirmar este cambio',
  'email.auth.changeOld.fine': 'Este enlace funciona una vez y caduca al cabo de una hora.',
  'email.auth.changeOld.footnote':
    'Si no lo pidió, no haga nada y la dirección de su cuenta se queda como está. Conviene '
    + 'cambiar también su contraseña: una petición así solo se puede hacer desde una sesión '
    + 'abierta.',

  'email.auth.changeNew.subject': 'Confirme su nueva dirección',
  'email.auth.changeNew.preheader': 'Confirme la nueva dirección de la cuenta.',
  'email.auth.changeNew.heading': 'Confirme esta dirección',
  'email.auth.changeNew.p1':
    'Se pidió trasladar la cuenta de {app} de '
    + '<strong style="font-weight:600;">{email}</strong> a esta dirección.',
  'email.auth.changeNew.p2':
    'Ambas direcciones tienen que confirmarlo. Esta es la mitad de la nueva.',
  'email.auth.changeNew.button': 'Confirmar esta dirección',
  'email.auth.changeNew.fine': 'Este enlace funciona una vez y caduca al cabo de una hora.',
  'email.auth.changeNew.footnote':
    'Si no esperaba esto, puede ignorarlo: la cuenta conserva la dirección que tiene hasta que '
    + 'se confirmen ambas mitades.',
}
