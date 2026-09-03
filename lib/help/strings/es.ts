import type { Catalogue } from '@/lib/i18n/t'

/**
 * The manual, es. Keyed against `lib/help/content.ts` — see `lib/help/keys.ts` for the
 * key scheme and why the English is derived rather than repeated here.
 *
 * TRANSLATED PART BY PART. A key that is not here yet resolves to the English, so a partly
 * translated manual reads as English chapters beside translated ones rather than as a page of
 * key names. `npm run i18n:check` reports the backlog as a count on every run.
 */
export const helpEs: Catalogue = {
  // ──── PART 1 — Getting started ────────────────────────────────────────────────
  'help.part.start.title': 'Primeros pasos',
  'help.part.start.blurb': 'De qué está hecha la pantalla, y cómo entran usted y sus familiares.',
  'help.finding-your-way-around.title': 'Orientarse',
  'help.finding-your-way-around.summary':
    'El menú lateral, la barra superior y los pocos controles que están en todas las '
    + 'pantallas.',
  'help.finding-your-way-around.the-rail.heading': 'El menú lateral de la izquierda',
  'help.finding-your-way-around.the-rail.b0':
    'Todo en el producto se alcanza desde el menú lateral color burdeos. Sus encabezados '
    + 'agrupan las pantallas por su propósito — **Comunidad**, **Reuniones**, **Biblioteca**, '
    + '**Contabilidad**, **Informes**, **Administración**, **Ayuda** — y un encabezado se '
    + 'abre al pulsarlo, cerrando el que estaba abierto.',
  'help.finding-your-way-around.the-rail.b1':
    'El menú lateral solo muestra las pantallas que usted puede abrir. Si falta un '
    + 'encabezado que esperaba, es porque todas las pantallas que están debajo o no forman '
    + 'parte del plan de su familia o no son algo que su familia le haya dado. Eso no es una '
    + 'falla: vea [Quién puede hacer qué](/help/who-can-do-what).',
  'help.finding-your-way-around.the-rail.b2':
    'En un teléfono el menú lateral está detrás del botón **Menú**, arriba a la izquierda. '
    + 'Se cierra solo en cuanto usted elige algo.',
  'help.finding-your-way-around.the-top-bar.heading': 'La barra de arriba',
  'help.finding-your-way-around.the-top-bar.b0':
    'Hay cinco controles arriba a la derecha en todas las páginas.',
  'help.finding-your-way-around.the-top-bar.b1.i0.term': 'Cambio de familia',
  'help.finding-your-way-around.the-top-bar.b1.i0.text':
    'Aparece cuando su cuenta pertenece a más de una familia. Elegir otra familia recarga '
    + 'la página en la que está, como esa familia.',
  'help.finding-your-way-around.the-top-bar.b1.i1.term': 'Ayuda',
  'help.finding-your-way-around.the-top-bar.b1.i1.text':
    'Un signo de interrogación que lleva al capítulo de este manual que describe la '
    + 'pantalla en la que está. No aparece en las pocas pantallas que ningún capítulo cubre '
    + 'todavía, ni en estas páginas de ayuda.',
  'help.finding-your-way-around.the-top-bar.b1.i2.term': 'Campana',
  'help.finding-your-way-around.the-top-bar.b1.i2.text':
    'Sus notificaciones, más una fila fija por cada familia con personas esperando '
    + 'aprobación, incluidas las familias que no está viendo en este momento.',
  'help.finding-your-way-around.the-top-bar.b1.i3.term': 'Idioma',
  'help.finding-your-way-around.the-top-bar.b1.i3.text':
    'El código de dos letras junto a la campana: **EN**, **ES** o **FR**. Elegir uno cambia '
    + 'el producto a ese idioma en todas partes, y en todos los dispositivos donde inicie '
    + 'sesión, porque se guarda con su perfil y no con este navegador. No se muestra mientras '
    + 'el producto hable un solo idioma.',
  'help.finding-your-way-around.the-top-bar.b1.i4.term': 'Su nombre',
  'help.finding-your-way-around.the-top-bar.b1.i4.text':
    'Abre el menú de la cuenta: [Mi perfil](/personal-info), [Mis familias](/my-families), '
    + '**Apariencia** — Claro, Oscuro o Sistema, recordado en este navegador — y cerrar '
    + 'sesión.',
  'help.finding-your-way-around.the-top-bar.b2':
    'Cada uno de estos se cierra solo unos segundos después de que usted se aleja, así que '
    + 'un panel nunca queda encima de la página que se puso a leer. Se mantiene abierto '
    + 'mientras el puntero esté sobre él, y mientras usted lo recorra con el teclado.',
  'help.finding-your-way-around.notifications.heading': 'La campana',
  'help.finding-your-way-around.notifications.b0':
    'Las notificaciones llegan en tiempo real: no hace falta recargar. Cubren cosas que le '
    + 'pasaron a usted: una decisión sobre su membresía, alguien pidiendo unirse a una '
    + 'familia que usted administra, y cosas así.',
  'help.finding-your-way-around.notifications.b1':
    'Las notificaciones le pertenecen *en una familia*, porque eso es lo que una '
    + 'notificación es. Lo único que cruza de una familia a otra es la cola de aprobaciones: '
    + 'si administra dos familias y alguien está esperando en la segunda, la campana se lo '
    + 'dice mientras usted sigue viendo la primera.',
  'help.finding-your-way-around.signed-out.heading': 'La sesión se cierra después de una hora',
  'help.finding-your-way-around.signed-out.b0':
    'Si no se escribe ni se pulsa nada durante 60 minutos, se cierra su sesión en este '
    + 'dispositivo y se le envía a la página de inicio de sesión, con una nota que dice por '
    + 'qué. Aparece un aviso durante el último minuto para que pueda quedarse.',
  'help.finding-your-way-around.signed-out.b1':
    'La actividad en cualquier pestaña cuenta, así que leer un anuncio largo en una pestaña '
    + 'no le cierra la sesión en otra. Cerrar sesión aquí no cierra la sesión de su teléfono: '
    + 'para eso, use **Cerrar sesión en otros dispositivos** en [Inicio de sesión y '
    + 'seguridad](/personal-info?section=security).',
  'help.finding-your-way-around.signed-out.b2':
    '**En un teléfono ocurre cuando usted vuelve.** Un teléfono cierra la página mientras '
    + 'está en segundo plano, así que no hay nada corriendo que cuente la hora y no se puede '
    + 'mostrar ningún aviso; la comprobación se hace en el momento en que usted la reabre. Si '
    + 'estuvo fuera más de una hora, aterriza en la página de inicio de sesión en vez de '
    + 'donde lo dejó, que es la misma regla llegando un poco más tarde.',
  'help.finding-your-way-around.saving.heading': 'Cómo funciona guardar',
  'help.finding-your-way-around.saving.b0':
    'Nada de un formulario se guarda hasta que usted pulsa su botón. Cualquier cosa '
    + 'destructiva — eliminar un anuncio, quitar una conexión en el árbol, rechazar un '
    + 'programa de cuotas — le pide confirmación primero y dice qué va a pasar.',
  'help.finding-your-way-around.saving.b1':
    'Cuando algo se rechaza, el motivo aparece junto al botón que usted pulsó. Si una '
    + 'página entera dice que no se pudo cargar, casi siempre vale la pena intentarlo una vez '
    + 'más antes de suponer lo peor.',
  'help.joining-a-family.title': 'Crear una familia o unirse a una',
  'help.joining-a-family.summary':
    'Códigos familiares, invitaciones, la cola de aprobaciones y qué hacer mientras espera.',
  'help.joining-a-family.create.heading': 'Crear una familia',
  'help.joining-a-family.create.b0.i0':
    'En la página de registro, elija **Crear familia** y póngale un nombre.',
  'help.joining-a-family.create.b0.i1':
    'Termine de registrarse. Usted es el primer integrante y queda aprobado de inmediato.',
  'help.joining-a-family.create.b0.i2':
    'Se genera un código familiar de seis caracteres y se le muestra. Ese código es la '
    + 'forma en que sus familiares se unen.',
  'help.joining-a-family.create.b1':
    'El código siempre está disponible después en [Configuración](/admin/settings) y en '
    + '[Mis familias](/my-families).',
  'help.joining-a-family.join-by-code.heading': 'Unirse con un código familiar',
  'help.joining-a-family.join-by-code.b0':
    'Si alguien le dio un código familiar, elija **Unirse a una familia** cuando se '
    + 'registre y escríbalo. Si ya tiene cuenta, use **Unirse a otra familia** en [Mis '
    + 'familias](/my-families) en su lugar: una cuenta puede pertenecer a varias familias.',
  'help.joining-a-family.join-by-code.b1':
    'Unirse con un código no lo admite. Lo pone en la cola de aprobaciones de la familia, y '
    + 'alguien de ahí tiene que dejarlo entrar. Cualquiera que tenga el código puede pedir '
    + 'unirse, y precisamente por eso la decisión es de una persona y no del código.',
  'help.joining-a-family.invitations.heading': 'Unirse desde una invitación',
  'help.joining-a-family.invitations.b0':
    'Una invitación es un enlace enviado por correo a una sola dirección. Para quien la '
    + 'envía es mejor que un código, porque puede preaprobarlo: siga el enlace, ponga una '
    + 'contraseña y queda dentro sin esperar.',
  'help.joining-a-family.invitations.b1':
    'Una invitación que no preaprueba lo pone en la cola, igual que un código. En cualquier '
    + 'caso el enlace es para la dirección a la que se envió: si al abrirlo tiene la sesión '
    + 'iniciada como otra persona, el producto lo dice en vez de asociar la invitación a la '
    + 'cuenta equivocada sin avisar.',
  'help.joining-a-family.confirm-your-email.heading': 'Confirmar su dirección de correo',
  'help.joining-a-family.confirm-your-email.b0':
    'Como sea que se registre — una familia nueva, un código familiar o una invitación — se '
    + 'envía un enlace de confirmación a la dirección con la que se registró, y la cuenta no '
    + 'puede iniciar sesión hasta que ese enlace se haya abierto. Funciona una vez y vence al '
    + 'cabo de una hora, así que use el mensaje más nuevo y no uno más antiguo del mismo '
    + 'hilo.',
  'help.joining-a-family.confirm-your-email.b1':
    'Si intenta iniciar sesión antes de abrirlo, la página de inicio de sesión dice que la '
    + 'dirección no está confirmada y ofrece **Enviar el enlace de nuevo** debajo del '
    + 'formulario. Mire en la carpeta de correo no deseado antes de pulsarlo: un enlace que '
    + 'llegó y se pasó por alto es de lejos el motivo más común, y otra copia no ayuda.',
  'help.joining-a-family.confirm-your-email.b2':
    'A nadie se le dice si ese correo llegó — ni a usted ni a nosotros — así que la página '
    + 'dice qué pidió en vez de prometer la entrega. Si nunca llega nada, lo más probable es '
    + 'que la dirección no sea la que se usó al registrar la cuenta.',
  'help.joining-a-family.waiting.heading': 'Mientras espera',
  'help.joining-a-family.waiting.b0':
    'Hasta que alguien lo admita, tiene tres pantallas abiertas: el panel, que le dice cómo '
    + 'va la solicitud, [Mi perfil](/personal-info) y [Mis familias](/my-families). El resto '
    + 'del menú lateral aparece en el momento en que lo aprueban: no tiene que volver a '
    + 'iniciar sesión, la página se da cuenta sola.',
  'help.joining-a-family.waiting.b1':
    'Completar su perfil mientras espera es lo útil que puede hacer. Es lo que le da a '
    + 'quien revise la cola una persona a la que reconocer en vez de una dirección de correo.',
  'help.joining-a-family.declined.heading': 'Si una solicitud se rechaza',
  'help.joining-a-family.declined.b0':
    'Se le avisa, y puede apelarla: su nota vuelve a la misma cola y la solicitud queda '
    + 'pendiente otra vez. La nota es lo importante — es lo que le da a quien la revise un '
    + 'motivo para mirar dos veces — así que escriba la frase en vez de volver a enviarla en '
    + 'silencio.',
  'help.joining-a-family.declined.b1':
    'Su perfil sigue siendo suyo en cualquier caso, y cualquier otra familia a la que '
    + 'pertenezca no se ve afectada.',
  // ──── PARTS 2 and 3 — Your own account, and The dashboard ─────────────────────
  'help.part.you.title': 'Su propia cuenta',
  'help.part.you.blurb': 'Las cosas que son suyas y no de la familia.',
  'help.my-profile.title': 'Mi perfil',
  'help.my-profile.summary':
    'Su nombre, cómo lo encuentran sus familiares y la configuración de su inicio de '
    + 'sesión.',
  'help.my-profile.sections.heading': 'Las cinco secciones',
  'help.my-profile.sections.b0':
    'El menú de la parte superior de la página alterna entre ellas. Cada una se guarda por '
    + 'su cuenta, así que puede completar una y volver más tarde.',
  'help.my-profile.sections.b1.i0.term': 'General',
  'help.my-profile.sections.b1.i0.text':
    'Nombre, nombre preferido, teléfono, correo, cumpleaños y su foto.',
  'help.my-profile.sections.b1.i1.term': 'Dirección',
  'help.my-profile.sections.b1.i1.text':
    'Dónde vive. Lo usan el Directorio y todo lo que la familia le envíe por correo postal.',
  'help.my-profile.sections.b1.i2.term': 'Información adicional',
  'help.my-profile.sections.b1.i2.text':
    'Talla de camiseta, capítulo y los demás datos que piden las reuniones y los informes.',
  'help.my-profile.sections.b1.i3.term': 'Notificaciones',
  'help.my-profile.sections.b1.i3.text':
    'Sobre qué puede contactarlo su familia y por qué medio: un interruptor por '
    + 'notificación y por canal.',
  'help.my-profile.sections.b1.i4.term': 'Inicio de sesión y seguridad',
  'help.my-profile.sections.b1.i4.text': 'La dirección con la que inicia sesión, y su contraseña.',
  'help.my-profile.notifications.heading': 'Notificaciones',
  'help.my-profile.notifications.b0':
    '**Notificaciones** es una cuadrícula: una fila por cada cosa sobre la que su familia '
    + 'puede contactarlo, y una columna por cada vía por la que podría llegarle — **Correo**, '
    + '**SMS** y **Notificación push**. Se abre como una lista de lo que usted ha elegido; '
    + 'pulse **Editar** encima de ella para cambiar algo, y **Listo** cuando haya terminado. '
    + 'No hay **Guardar** ni **Cancelar**: cada celda es una pulsación, **Activado** o '
    + '**Desactivado**, y surte efecto en el momento en que usted la pulsa, así que **Listo** '
    + 'solo vuelve a guardar los interruptores.',
  'help.my-profile.notifications.b1':
    'Usa la dirección de correo y el número de móvil que ya están en sus datos de '
    + '**General**. Los dos se muestran en la parte superior de la pantalla para que vea a '
    + 'dónde iría una notificación, y cambiar cualquiera de los dos allí lo cambia para todas '
    + 'las notificaciones a la vez. Esta pantalla nunca le pide un segundo número.',
  'help.my-profile.notifications.b2.i0.term': 'Aviso de seguridad',
  'help.my-profile.notifications.b2.i0.text':
    'Su familia abre un aviso durante una tormenta, una evacuación o una emergencia y '
    + 'pregunta si usted está a salvo. El correo está activado a menos que lo desactive; el '
    + 'SMS está desactivado a menos que lo active.',
  'help.my-profile.notifications.b3':
    '**El correo está activado por defecto y el SMS no**, y eso es deliberado y no una '
    + 'incoherencia. Lo que hay que evitar es un aviso que no le llegue a nadie, y su familia '
    + 'ya tiene su dirección; pero un mensaje de texto tiene que aceptarse antes de que '
    + 'alguien lo envíe, así que nada relacionado con el SMS queda activado porque usted no '
    + 'se dio cuenta.',
  'help.my-profile.notifications.b4':
    '**Notificación push** dice **Próximamente** en todas las filas, y hoy **SMS** también. '
    + 'Las dos columnas están ahí para que vea lo que viene en vez de que le sorprenda más '
    + 'adelante; hoy nada en el producto envía ninguna de las dos, y el correo es la vía que '
    + 'funciona. Si usted aceptó recibir mensajes de texto antes de que se desactivaran, su '
    + 'interruptor de **SMS** se queda donde está y todavía puede desactivarlo: desactivar '
    + 'algo nunca es más difícil que activarlo.',
  'help.my-profile.notifications-delivery.heading':
    'Cuando Activado no significa que vaya a llegar',
  'help.my-profile.notifications-delivery.b0':
    'Un interruptor dice lo que usted ha pedido. Si de hecho podemos entregarlo es otra '
    + 'cuestión, y la pantalla lo dice debajo de la cuadrícula en vez de dejar que '
    + '**Activado** insinúe más de lo que debería.',
  'help.my-profile.notifications-delivery.b1.i0':
    'No hay dirección de correo registrada, o solo una provisional: nada marcado como '
    + 'activado para Correo puede llegar. Añada una dirección real en **General**.',
  'help.my-profile.notifications-delivery.b1.i1':
    'No hay número de móvil registrado: nada marcado como activado para SMS puede llegar.',
  'help.my-profile.notifications-delivery.b1.i2':
    'Un número de móvil que todavía no hemos confirmado: le enviamos un código de seis '
    + 'dígitos antes de mandarle cualquier mensaje.',
  'help.my-profile.notifications-delivery.b1.i3':
    'Los mensajes de texto todavía no están activados de nuestro lado. Puede registrar su '
    + 'elección ahora y empezaremos a usarla en cuanto lo estén.',
  'help.my-profile.notifications-stopping.heading': 'Detener los mensajes de texto',
  'help.my-profile.notifications-stopping.b0':
    'Mientras **SMS** diga **Próximamente** no hay nada que detener, porque hoy nada en el '
    + 'producto envía un mensaje de texto. Lo que sigue vale una vez que se activen, y para '
    + 'quien los haya aceptado antes de eso. Desactivar la celda de **SMS** los detiene de '
    + 'inmediato, sin nada que confirmar y sin que se le pregunte por qué. Puede volver a '
    + 'activarla cuando quiera.',
  'help.my-profile.notifications-stopping.b1':
    'Responder **STOP** a cualquier mensaje que le enviemos también los detiene, y ese caso '
    + 'es distinto de una forma que vale la pena conocer. Quien actúa sobre él es su '
    + 'operadora de móvil y no nosotros, así que no podemos volver a activarlo desde esta '
    + 'página y tampoco puede nadie de su familia. La celda dice **Detenido** en vez de '
    + 'ofrecer un interruptor. Si los quiere de vuelta, envíe **START** al número que le '
    + 'escribió.',
  'help.my-profile.per-family.heading': 'Un perfil por familia',
  'help.my-profile.per-family.b0':
    'Si pertenece a más de una familia, tiene un perfil distinto en cada una. Editar esta '
    + 'página cambia la familia que está viendo en este momento y nada más, lo cual es '
    + 'deliberado: la dirección que da a sus suegros no siempre es la que da a sus primos.',
  'help.my-profile.chapter.heading': 'Su capítulo',
  'help.my-profile.chapter.b0':
    'El bloque encabezado con el nombre de su familia tiene un campo que pertenece solo a '
    + 'esa familia: en qué **Capítulo** está. Aparece solo cuando la familia ha creado '
    + 'alguno; si no lo ha hecho, el bloque lo dice.',
  'help.my-profile.chapter.b1':
    'Decide dos cosas. Los hijos e hijas menores de 18 años que no tienen cuenta propia se '
    + 'mueven con usted — todos los demás en la familia son personas por su cuenta y '
    + 'mantienen el capítulo en que están — y puede decidir lo que usted debe, porque una '
    + 'familia puede vincular las cuotas a una región o a un capítulo. No elegir nada lo deja '
    + 'bajo **Nacional**: debe las cuotas de toda la familia y ninguna de las locales. Vea '
    + '[regiones y capítulos](/help/regions-and-chapters#dues).',
  'help.my-profile.chapter.b2':
    'Un hijo cuya fecha de nacimiento no se ha registrado no se mueve, porque nada en su '
    + 'ficha dice que sea menor de 18 años. Añádala en su ficha, o póngale el capítulo desde '
    + 'Miembros y acceso.',
  'help.my-profile.password.heading': 'Cambiar su contraseña',
  'help.my-profile.password.b0.i0': 'Abra **Inicio de sesión y seguridad**.',
  'help.my-profile.password.b0.i1': 'Escriba su contraseña actual, y después la nueva dos veces.',
  'help.my-profile.password.b0.i2': 'Si se le envía un código por correo, escríbalo.',
  'help.my-profile.password.b0.i3':
    'Guarde. Se cierra la sesión de todos los demás dispositivos conectados como usted.',
  'help.my-profile.password.b1':
    'También hay un control **Cerrar sesión en otros dispositivos** por separado, para '
    + 'cuando simplemente ha dejado la sesión abierta en algún sitio y no quiere cambiar nada '
    + 'más.',
  'help.my-profile.photo.heading': 'Su foto',
  'help.my-profile.photo.b0':
    'La foto que sube en **General** es la que aparece junto a su nombre en la barra '
    + 'superior, en el saludo del panel y en cualquier lugar donde la familia lo vea. Sin '
    + 'ella se muestran sus iniciales.',
  'help.my-profile.photo.b1.i0': 'Abra **General**.',
  'help.my-profile.photo.b1.i1': 'Pulse la cámara en el círculo de la parte superior de la página.',
  'help.my-profile.photo.b1.i2': 'Elija una imagen y confirme.',
  'help.my-profile.photo.b2':
    'Un JPEG, PNG o WebP, de hasta 2 MB. Cualquier otra cosa se rechaza con una línea que '
    + 'dice por qué en vez de fallar en silencio, y una foto nueva reemplaza la anterior.',
  'help.my-profile.photo.b3':
    'Su foto es UNA sola foto, compartida por todas las familias a las que pertenece, a '
    + 'diferencia del resto de esta página, que es por familia. Cualquiera que pueda verlo en '
    + 'el [Directorio](/community/directory) puede verla, así que es el único campo de aquí '
    + 'que conviene tratar como público dentro de la familia.',
  'help.my-profile.photo.b4':
    'Que se MUESTRE depende del plan de la familia, y eso se decide por familia y no por '
    + 'cuenta: una familia cuyo plan no incluye fotos de perfil muestra sus iniciales en '
    + 'todas partes y no ofrece cámara en esta página. Si pertenece a dos familias, es muy '
    + 'posible que vea su foto en una y sus iniciales en la otra. No se pierde nada en '
    + 'ninguno de los dos casos: la imagen sigue ahí y aparece en el momento en que el plan '
    + 'de una familia la incluye.',
  'help.my-families.title': 'Mis familias',
  'help.my-families.summary':
    'Todas las familias a las que pertenece su cuenta, cuál se abre por defecto y cómo '
    + 'añadir otra.',
  'help.my-families.reading.heading': 'Leer la lista',
  'help.my-families.reading.b0':
    'Cada familia muestra su nombre, su código y su situación en ella. Dos marcas importan:',
  'help.my-families.reading.b1.i0.term': 'Viendo',
  'help.my-families.reading.b1.i0.text':
    'La familia que el resto del producto le está mostrando en este momento.',
  'help.my-families.reading.b1.i1.term': 'Predeterminada',
  'help.my-families.reading.b1.i1.text':
    'La familia que se abre cuando inicia sesión. Pulse **Predeterminada** en cualquier '
    + 'otra fila para moverla.',
  'help.my-families.switching.heading': 'Cambiar de familia',
  'help.my-families.switching.b0':
    'Use el cambio de familia de la barra superior: hace el mismo trabajo desde todas las '
    + 'páginas. Cambiar reconstruye la página entera para la familia nueva: lo que estuviera '
    + 'a medio escribir se descarta en vez de arrastrarse, que es lo que evita que un '
    + 'formulario rellenado para una familia se guarde en otra.',
  'help.my-families.adding.heading': 'Añadir otra familia',
  'help.my-families.adding.b0':
    '**Unirse a una familia** toma un código familiar y lo pone en la cola de esa familia. '
    + '**Crear una familia** empieza una nueva con usted como su primer integrante. Ninguna '
    + 'de las dos altera las familias en las que ya está.',
  'help.part.dashboard.title': 'El panel',
  'help.part.dashboard.blurb': 'La pantalla en la que aterriza, y qué le está diciendo cada panel.',
  'help.the-dashboard.title': 'El panel',
  'help.the-dashboard.summary':
    'Su familia de un vistazo: las cifras, lo que hay que hacer y lo que ha pasado '
    + 'últimamente.',
  'help.the-dashboard.greeting.heading': 'El saludo',
  'help.the-dashboard.greeting.b0':
    'Su nombre, su foto, los cargos que ocupe y su capítulo si su familia los usa.',
  'help.the-dashboard.reminders.heading': 'Los recordatorios',
  'help.the-dashboard.reminders.b0':
    'Debajo del saludo hay hasta dos avisos. Los dos son peticiones y no advertencias, y '
    + 'ninguno retiene nada.',
  'help.the-dashboard.reminders.b1.i0.term': 'Complete su perfil',
  'help.the-dashboard.reminders.b1.i0.text':
    'Sus familiares lo encuentran en el Directorio, y el suyo está casi vacío. Nombra lo '
    + 'que falta — un teléfono, dónde vive, su cumpleaños, una foto — y lleva directamente a '
    + 'Mi perfil. No tiene botón para descartarlo porque desaparece solo: complete la mitad '
    + 'de lo que pide y deja de aparecer.',
  'help.the-dashboard.reminders.b1.i1.term': 'Elija su capítulo',
  'help.the-dashboard.reminders.b1.i1.text':
    'Solo en una familia que tiene capítulos, y solo mientras usted no esté en ninguno. '
    + 'Ponerlo aquí es lo mismo que ponerlo en su perfil, y los familiares sin cuenta propia '
    + 'se mueven con usted.',
  'help.the-dashboard.reminders.b2':
    'Ninguno de los dos avisos es visible para nadie más, y nada en ninguna pantalla queda '
    + 'bloqueado detrás de ellos. Un miembro que no quiera introducir nada tiene derecho a '
    + 'ello.',
  'help.the-dashboard.premier-gathering.heading': 'La reunión destacada',
  'help.the-dashboard.premier-gathering.b0':
    'Justo debajo del saludo, una banda para la reunión que la familia ha dicho que más '
    + 'importa: su título, sus fechas, dónde es, cuánto de su trabajo se ha aprobado, y **Ver '
    + 'detalles** directamente hacia ella. La mayor parte del tiempo no está ahí para nadie: '
    + 'aparece solo mientras una reunión está destacada y todavía por delante. Vea '
    + '[Reuniones](/help/gatherings#browsing).',
  'help.the-dashboard.premier-gathering.b1':
    'Mientras se muestra, el saludo de encima cambia con ella: su nombre se apoya en la '
    + 'página en vez de en una banda de color, con la fotografía de la reunión al lado. Quien '
    + 'organiza la reunión elige esa fotografía, y el árbol de GENORRA hace de sustituto '
    + 'hasta que lo haga: vea [La banda del panel](/help/gathering-management#premier).',
  'help.the-dashboard.at-a-glance.heading': 'Un vistazo',
  'help.the-dashboard.at-a-glance.b0':
    'El panel es sobre USTED y su situación con la familia. Hasta tres cifras en la parte '
    + 'superior, y cada una aparece solo si de verdad le corresponde verla:',
  'help.the-dashboard.at-a-glance.b1.i0.term': 'Integrantes de la familia',
  'help.the-dashboard.at-a-glance.b1.i0.text':
    'Cuántas personas aprobadas hay en la familia. Las personas registradas en el árbol sin '
    + 'cuenta se cuentan: son familia. Las personas que todavía esperan aprobación no.',
  'help.the-dashboard.at-a-glance.b1.i1.term': 'Pendientes de aprobación',
  'help.the-dashboard.at-a-glance.b1.i1.text':
    'Cuántas personas están esperando. Aparece solo cuando alguien lo está de verdad, y '
    + 'solo para quien puede actuar al respecto.',
  'help.the-dashboard.at-a-glance.b1.i2.term': 'Próximas reuniones',
  'help.the-dashboard.at-a-glance.b1.i2.text':
    'Cuántas reuniones no han terminado todavía. Aparece solo mientras al menos una no lo '
    + 'ha hecho, y **Ver calendario** debajo lleva al [Calendario](/gatherings/calendar).',
  'help.the-dashboard.at-a-glance.b2':
    'Debajo de las cifras, en el mismo panel: **Saldo pendiente** — lo que usted todavía '
    + 'debe — y **Campañas de donación**, las que la familia tiene abiertas en este momento. '
    + 'Las dos tienen su propia sección más abajo.',
  'help.the-dashboard.at-a-glance.b3':
    '**Recaudado este año** era una cuarta cifra de aquí hasta el 19-08-2026 y ahora es una '
    + 'tarjeta propia más abajo en la página. Es lo que la FAMILIA ha ingresado y no algo '
    + 'sobre usted, que es una cifra de tesorería para leer con atención y no para mirar de '
    + 'paso. Quién puede verla no cambió: sigue siendo quien puede ver los libros.',
  'help.the-dashboard.quick-actions.heading': 'Acciones rápidas',
  'help.the-dashboard.quick-actions.b0':
    'Atajos a las cosas que la gente hace más: añadir un miembro, registrar un pago, enviar '
    + 'un mensaje. Un botón aparece solo si usted puede hacer lo que nombra, así que un panel '
    + 'de Acciones rápidas vacío no es una falla.',
  'help.the-dashboard.quick-actions.b1':
    '**Dos de los botones no son sobre un permiso en absoluto.** Aparecen cuando hay algo '
    + 'esperando por usted y se van cuando no: todo lo demás de la fila es un trabajo que '
    + 'usted PUEDE hacer, y estos son trabajos que se le han pedido.',
  'help.the-dashboard.quick-actions.b2.i0.term': 'Mis tareas',
  'help.the-dashboard.quick-actions.b2.i0.text':
    'Una tarea de una reunión está esperando su respuesta. Lleva directamente a ella. Vea '
    + 'Mis tareas de la reunión.',
  'help.the-dashboard.quick-actions.b2.i1.term': 'Nominar / Votar',
  'help.the-dashboard.quick-actions.b2.i1.text':
    'Una elección en la que puede participar está abierta en este momento, y el rótulo dice '
    + 'cuál de las dos cosas quiere. Lleva a esa papeleta y no a la lista, y si hay dos '
    + 'abiertas a la vez ofrece la que cierra antes.',
  'help.the-dashboard.quick-actions.b3':
    'Una elección aparece aquí solo mientras su ventana de nominaciones o de votación está '
    + 'abierta. Una que todavía no ha abierto, o una que espera entre las dos ventanas, está '
    + 'en [Elecciones](/community/elections) y no es un trabajo, así que no se ofrece como '
    + 'tal. Vea [Elecciones](/help/elections#the-dates).',
  'help.the-dashboard.recent-updates.heading': 'Novedades recientes',
  'help.the-dashboard.recent-updates.b0':
    'Sus notificaciones y los anuncios de la familia en una sola lista. Los anuncios '
    + 'fijados van arriba hasta que usted los oculta; uno oculto vuelve a la lista por orden '
    + 'de fecha en vez de desaparecer, así que siempre puede encontrarlo de nuevo.',
  'help.the-dashboard.recent-updates.b1':
    'Ocultar es por persona y no por navegador: hágalo en su portátil y su teléfono está de '
    + 'acuerdo.',
  'help.the-dashboard.recent-updates.b2':
    '**Ver todas las novedades** al pie de la tarjeta abre [Novedades](/community/updates): '
    + 'el mismo flujo sin el límite de cinco filas, y con un cuadro de búsqueda. La tarjeta '
    + 'es el recordatorio; esa página es el registro.',
  'help.the-dashboard.balance.heading': 'Saldo pendiente',
  'help.the-dashboard.balance.b0':
    'Dentro de **Un vistazo**, debajo de las cifras: lo que usted personalmente todavía '
    + 'debe este año, en todos los programas de cuotas en que está. Es la misma cifra con la '
    + 'que abre [Resumen](/accounting/summary), y **Ver cuotas** lo lleva al detalle programa '
    + 'por programa en [Cuotas](/accounting/dues-and-donations).',
  'help.the-dashboard.donation-drives.heading': 'Campañas de donación',
  'help.the-dashboard.donation-drives.b0':
    'También dentro de **Un vistazo**, debajo del saldo: todas las campañas que la familia '
    + 'tiene abiertas en este momento, con lo que han avanzado hacia su meta y cuánto de eso '
    + 'vino de usted. Las campañas que han cerrado no están aquí — la barra ya no puede '
    + 'moverse — pero siguen en [Donaciones](/accounting/dues-and-donations?pane=donations).',
  'help.the-dashboard.donation-drives.b1':
    'La que cierra antes va primero, y el panel dice el número si hay más de tres. No '
    + 'aparece en absoluto cuando no hay ninguna campaña abierta, que es la mayoría de las '
    + 'familias la mayor parte del tiempo.',
  'help.the-dashboard.collected.heading': 'Recaudado este año',
  'help.the-dashboard.collected.b0':
    'Lo que la familia ha ingresado este año en cuotas y donaciones, con **Ver pagos** '
    + 'hacia el libro. Era una cifra dentro de **Un vistazo** hasta el 19-08-2026 y ahora es '
    + 'una tarjeta propia: ese panel es sobre quien lee, y esto es el ingreso de la '
    + 'organización.',
  'help.the-dashboard.collected.b1':
    'Se muestra solo a alguien que puede ver los libros, y para cualquier otra persona está '
    + 'ausente en vez de vacía: una cifra vacía invita a un miembro a preguntarse qué se le '
    + 'está ocultando. Una familia que de verdad no ha ingresado nada muestra un cero, que es '
    + 'otra cosa y es una respuesta real.',
  'help.the-dashboard.tree-card.heading': 'Árbol familiar',
  'help.the-dashboard.tree-card.b0':
    'Cuántas personas hay en el árbol, cuántas generaciones alcanza y cuántas todavía no '
    + 'están conectadas con nadie. Se muestra incluso cuando el árbol está vacío, porque '
    + '«nadie lo ha empezado» es lo más útil que puede decir en ese punto.',
  'help.the-dashboard.banners.heading': 'Bandas',
  'help.the-dashboard.banners.b0':
    'Entre el saludo y los paneles, el panel a veces pone algo que usted tiene que hacer, '
    + 'lo más habitual un aviso para elegir su capítulo. Cada uno desaparece cuando deja de '
    + 'aplicarse, así que lo normal es que no haya ninguno.',
  // ──── PARTS 4 and 5 — Reports, and Reference ──────────────────────────────────
  'help.part.reports.title': 'Informes',
  'help.part.reports.blurb':
    'Lo que la familia HACE, leído de vuelta: el trabajo, las elecciones, las juntas y los '
    + 'cargos.',
  'help.gatherings-report.title': 'Informe de reuniones',
  'help.gatherings-report.summary':
    'Todas las reuniones con cuánto de su trabajo está hecho, qué está atrasado y qué '
    + 'reclaman sus tareas contra el presupuesto.',
  'help.gatherings-report.what-it-is.heading': 'Qué responde',
  'help.gatherings-report.what-it-is.b0':
    '[Reuniones](/reporting/gatherings) en **Informes** es una fila por reunión: cuántas de '
    + 'sus tareas están aprobadas, cuántas van tarde, cuántas no tienen a nadie a cargo y — '
    + 'donde usted puede ver el dinero — cuánto suman sus partidas de tareas frente a lo que '
    + 'presupuestó.',
  'help.gatherings-report.what-it-is.b1':
    'No cambia nada y no crea nada. Cada fila lleva a [Reuniones](/gatherings), donde vive '
    + 'la cosa en sí.',
  'help.gatherings-report.what-it-is.b2':
    '**Las reuniones canceladas se dejan fuera por completo**, tanto de las filas como de '
    + 'los totales. Sus tareas abiertas no son trabajo que nadie deba, y contarlas dejaría a '
    + 'una familia que canceló una cosa permanentemente en rojo en todas las cifras de aquí.',
  'help.gatherings-report.overdue.heading': 'Qué cuenta como atrasado',
  'help.gatherings-report.overdue.b0':
    'Una tarea está atrasada cuando **su fecha ha pasado y nadie la ha aprobado**. Eso '
    + 'incluye una que se ha entregado y sobre la que todavía no se ha decidido: el trabajo '
    + 'puede muy bien estar hecho, pero sigue pendiente desde el lado de quien organiza, y '
    + 'este es el informe de quien organiza. Una tarea devuelta también cuenta.',
  'help.gatherings-report.overdue.b1':
    '**Una tarea sin fecha límite nunca está atrasada.** No se prometió nada para un día en '
    + 'concreto, así que no hay ningún día respecto al cual pueda ir tarde.',
  'help.gatherings-report.money.heading': 'Las columnas de dinero',
  'help.gatherings-report.money.b0':
    '**Asignado** es lo que reclaman las partidas de tareas de la reunión, mostrado frente '
    + 'a lo que la reunión reservó. Se marca cuando las partidas reclaman más que el '
    + 'presupuesto, que es un plan por corregir y no un error, así que no se muestra en rojo.',
  'help.gatherings-report.money.b1':
    'Las dos cifras de dinero aparecen solo si su familia tiene un plan que incluye la '
    + 'banda de presupuesto de la reunión y a usted se le ha otorgado. Sin una de las dos '
    + 'cosas, las columnas simplemente no están: una columna de guiones sería afirmar que la '
    + 'familia no presupuestó nada.',
  'help.elections-report.title': 'Informe de elecciones',
  'help.elections-report.summary':
    'Participación por elección, cuántas personas se presentaron y para qué cargos nadie '
    + 'propuso un nombre.',
  'help.elections-report.what-it-is.heading': 'Qué responde',
  'help.elections-report.what-it-is.b0':
    '[Elecciones](/reporting/elections) en **Informes** es una fila por elección publicada: '
    + 'qué ámbito cubre, en qué fase está, cuántas nominaciones atrajo y cuántas se '
    + 'aceptaron, y cuál fue la participación.',
  'help.elections-report.what-it-is.b1':
    '**Los borradores no se cuentan.** Un borrador no tiene fechas, ni papeleta, ni '
    + 'electorado, así que una fila con 0 % de participación para uno sería un informe sobre '
    + 'una elección de la que nadie ha sido informado.',
  'help.elections-report.turnout.heading': 'Cómo se calcula la participación',
  'help.elections-report.turnout.b0':
    '**La participación cuenta personas, no papeletas.** Alguien que vota para tres cargos '
    + 'en una elección es un votante. La mitad de abajo de la cifra es quién podría haber '
    + 'votado: todos los miembros aprobados en una elección nacional, los miembros de un '
    + 'capítulo en una elección de capítulo, y los miembros de todos los capítulos de una '
    + 'región en una regional — la misma regla que decide quién ve la elección en primer '
    + 'lugar.',
  'help.elections-report.turnout.b1':
    'Una elección cuyo ámbito no tiene miembros aprobados dice **n/d** en vez de 0 %. Nadie '
    + 'podría haber votado en ella, y 0 % se leería como una elección que todos ignoraron.',
  'help.elections-report.unopposed.heading': 'Cargos para los que nadie se presentó',
  'help.elections-report.unopposed.b0':
    'Un cargo sin ninguna nominación **aceptada** no tiene nada en la papeleta. Una '
    + 'nominación que la persona nominada no ha aceptado no cuenta: no pone ningún nombre '
    + 'delante de nadie.',
  'help.elections-report.unopposed.b1':
    'Esta es la cifra sobre la que vale la pena actuar antes de que cierre la ventana de '
    + 'nominaciones, y por eso es una de las cuatro de la parte superior de la página.',
  'help.meetings-report.title': 'Informe de juntas',
  'help.meetings-report.summary':
    'Con qué frecuencia se reúne la familia, cuánta gente había en cada sala y quién '
    + 'responde cuando se convoca una votación.',
  'help.meetings-report.what-it-is.heading': 'Qué responde',
  'help.meetings-report.what-it-is.b0':
    '[Juntas](/reporting/meetings) en **Informes** tiene dos tablas. La primera es una fila '
    + 'por junta: su fecha, quién tomó el acta, cuántas personas había en la sala, cuántos '
    + 'temas trató y cuántos votos se emitieron. La segunda es una fila por familiar: a '
    + 'cuántas juntas se le convocó, en cuántas votó y de cuántas levantó el acta.',
  'help.meetings-report.what-it-is.b1':
    'Cada fila de junta lleva a [Actas](/library/meeting-minutes), que es donde vive el '
    + 'registro en sí.',
  'help.meetings-report.not-attendance.heading': 'Por qué nada aquí dice «asistencia»',
  'help.meetings-report.not-attendance.b0':
    '**Nada en GENORRA registra quién se presentó de hecho.** No hay registro de entrada. '
    + 'Así que esto informa de las dos cosas que puede contar, y ninguna de las dos es la '
    + 'asistencia:',
  'help.meetings-report.not-attendance.b1.i0.term': 'Convocados',
  'help.meetings-report.not-attendance.b1.i0.text':
    'La lista de asistentes: a quién se invitó cuando se programó la junta.',
  'help.meetings-report.not-attendance.b1.i1.term': 'Votaron en',
  'help.meetings-report.not-attendance.b1.i1.text':
    'En cuántas de esas juntas la persona respondió a una votación. Es la única prueba '
    + 'positiva de que alguien estuvo en la sala, y es un mínimo y no un recuento: una junta '
    + 'tranquila en la que no se convocó ninguna votación no produce nada de esto.',
  'help.meetings-report.not-attendance.b2':
    'Promediar las dos para obtener una tasa de asistencia sería una cifra que ninguna fila '
    + 'de la base de datos respalda, y es exactamente el tipo de número que se cita en una '
    + 'junta un año después.',
  'help.meetings-report.minuted.heading': 'Actas levantadas frente a juntas celebradas',
  'help.meetings-report.minuted.b0':
    '**Actas** cuenta las juntas que alguien ha cerrado. Cerrar es lo que convierte una '
    + 'junta en un registro — no más temas, no más notas, no más votos — así que la '
    + 'diferencia entre las dos cifras es el atraso de la familia en juntas que nadie ha dado '
    + 'por cerradas.',
  'help.board-report.title': 'Informe de directiva y cargos',
  'help.board-report.summary':
    'Todos los cargos que la familia ha definido, quién los ocupa y cuáles están vacantes.',
  'help.board-report.what-it-is.heading': 'Qué responde',
  'help.board-report.what-it-is.b0':
    '[Directiva y cargos](/reporting/board) en **Informes** enumera todos los cargos de la '
    + 'directiva que la familia ha definido, en el orden de la propia familia, con quien los '
    + 'ocupe — y, donde no los ocupa nadie, la palabra **Vacante**.',
  'help.board-report.what-it-is.b1':
    'No cambia nada. Definir un cargo y otorgarlo es **Miembros → Organización**, que es '
    + 'un permiso aparte.',
  'help.board-report.what-it-is.b2':
    'Esa separación es el motivo de que esta pantalla exista: se le puede mostrar a un '
    + 'comité de nominaciones dónde están los huecos sin darle el poder de cambiar la lista.',
  'help.board-report.vacancies.heading': 'Las vacantes son el hallazgo',
  'help.board-report.vacancies.b0':
    '**Todos los cargos son una fila, incluidos los vacíos**, y **Vacante** es una de las '
    + 'cuatro cifras de la parte superior. Un informe que enumerara solo los cargos ocupados '
    + 'no podría enunciar su dato más útil.',
  'help.board-report.vacancies.b1':
    'Las filas se mantienen en el orden de la propia familia en vez de poner las vacantes '
    + 'primero, para que esto se pueda leer al lado de la lista de **Integrantes → '
    + 'Organización**. El color es lo que hace que un hueco se pueda encontrar.',
  'help.board-report.two-hats.heading': 'Ocupar más de un cargo',
  'help.board-report.two-hats.b0':
    'Aparece una sección cuando alguien ocupa dos o más. Eso no es un problema en sí — un '
    + 'capítulo pequeño a menudo tiene a una persona haciendo dos trabajos — pero suele ser '
    + 'la señal de un hueco que alguien ha cubierto en silencio, y eso vale la pena saberlo '
    + 'antes de la próxima elección.',
  'help.board-report.two-hats.b1':
    'Un cargo ocupado para una región o un capítulo en concreto dice cuál al lado del '
    + 'nombre. El mismo título en dos niveles son dos cargos distintos: un presidente '
    + 'nacional y un presidente de capítulo son filas separadas.',
  'help.part.reference.title': 'Referencia',
  'help.part.reference.blurb':
    'Las dos cosas que explican la mayoría de las preguntas que hace la gente.',
  'help.who-can-do-what.title': 'Quién puede hacer qué',
  'help.who-can-do-what.summary':
    'Cómo se deciden los permisos, y por qué una página de la que ha oído hablar no está en '
    + 'su menú lateral.',
  'help.who-can-do-what.one-template.heading': 'Una plantilla por integrante',
  'help.who-can-do-what.one-template.b0':
    'Todo lo que usted puede hacer viene de la única plantilla de permisos en la que está. '
    + 'No hay nada más que comprobar ni nada que sumar: si no está en su plantilla, usted no '
    + 'lo tiene.',
  'help.who-can-do-what.one-template.b1':
    'Los administradores de su familia deciden las plantillas y quién está en cuál, desde '
    + '[Miembros](/admin/members).',
  'help.who-can-do-what.actions.heading': 'Cuatro acciones, tres alcances',
  'help.who-can-do-what.actions.b0':
    'Todas las funciones se otorgan de cuatro formas — **ver**, **crear**, **editar** y '
    + '**eliminar** — y cada una se fija en uno de tres alcances.',
  'help.who-can-do-what.actions.b1.i0.term': 'Ninguno',
  'help.who-can-do-what.actions.b1.i0.text': 'Nada en absoluto.',
  'help.who-can-do-what.actions.b1.i1.term': 'Propios',
  'help.who-can-do-what.actions.b1.i1.text': 'Solo sus propios registros. Sus anuncios, sus pagos.',
  'help.who-can-do-what.actions.b1.i2.term': 'Cualquiera',
  'help.who-can-do-what.actions.b1.i2.text': 'Los de cualquier persona, en toda la familia.',
  'help.who-can-do-what.actions.b2':
    'La distinción es lo que permite a una familia decir «puede eliminar sus propias '
    + 'publicaciones pero no las de los demás», que es un arreglo común y sensato.',
  'help.who-can-do-what.self-service.heading': 'Las cosas que nadie tiene que otorgar',
  'help.who-can-do-what.self-service.b0':
    'Algunas cosas son suyas por ser integrante y no necesitan ningún permiso: enviar un '
    + 'mensaje de chat, confirmar asistencia, editar su propio perfil, elegir su propia '
    + 'periodicidad de cuotas. Exigir permiso para eso significaría que una familia podría '
    + 'dejarse fuera de su propio chat sin querer.',
  'help.who-can-do-what.missing.heading': 'Por qué falta una página',
  'help.who-can-do-what.missing.b0':
    'El menú lateral solo enumera lo que usted puede abrir, y hay tres motivos distintos '
    + 'por los que algo puede no estar ahí:',
  'help.who-can-do-what.missing.b1.i0':
    'Su plantilla no le otorga **ver** en ella. Pídalo a un administrador.',
  'help.who-can-do-what.missing.b1.i1':
    'No forma parte del plan de su familia: abrirla directamente muestra la pantalla de '
    + 'mejora en vez de ocultarla. Vea [Planes](/help/plans).',
  'help.who-can-do-what.missing.b1.i2':
    'Todavía no está disponible. Abrirla directamente dice Muy pronto.',
  'help.who-can-do-what.missing.b2':
    'Los mismos tres motivos deciden una PESTAÑA. Varias pantallas son un menú de paneles — '
    + 'Integrantes, Contabilidad, Anuncios, Transacciones — y cada panel se otorga por su '
    + 'cuenta, así que una pestaña que no está en el menú es una que no le han dado y no una '
    + 'que se haya ido. Una pantalla en la que usted no tiene ninguno de sus paneles no está '
    + 'en el menú lateral en absoluto.',
  'help.who-can-do-what.missing.b3':
    'Escribir la dirección de una página que no le han otorgado da un simple «no '
    + 'encontrado». Eso es deliberado: una página restringida no debería confirmar que '
    + 'existe.',
  'help.plans.title': 'Planes',
  'help.plans.summary': 'Qué incluye cada plan, y qué pasa en el límite.',
  'help.plans.plans.heading': 'Los planes',
  'help.plans.plans.b0':
    'Gratis, Estándar, Plus y Premium, y son inclusivos: cada uno es todo lo que está por '
    + 'debajo y más. Lo que incluye cada uno está en la sección **Plan** de '
    + '[Configuración](/admin/settings), que es el texto que se mantiene al día.',
  'help.plans.plans.b1':
    'Cada plan de pago muestra ahí un precio, por mes, mes a mes. Aquí no se escribe '
    + 'ninguna cifra: el panel lee la real, y un precio copiado en un manual es un precio que '
    + 'queda desactualizado sin que nadie lo note.',
  'help.plans.plans.b2':
    'Gratis es gratis, y no es una prueba. Estándar y Plus se pueden comprar; Premium tiene '
    + 'un precio y todavía no está a la venta, y su fila está marcada como **Muy pronto**. '
    + 'Nunca se cobra nada por un plan que una familia no ha pagado.',
  'help.plans.paying.heading': 'Pagar un plan',
  'help.plans.paying.b0':
    'Los planes de pago se configuran en la sección **Facturación** de '
    + '[Configuración](/admin/settings), debajo de los planes mismos, y solo alguien con el '
    + 'permiso de Configuración puede abrirla. Hay dos formas de pagar: **mensual**, que se '
    + 'renueva el día 1, o **por adelantado**, que compra un número fijo de meses de una vez '
    + 'y no renueva nada.',
  'help.plans.paying.b1':
    'El pago lo cobra Stripe en sus propias páginas. Ningún dato de tarjeta se escribe en '
    + 'GENORRA y ninguno se guarda aquí. La sección **Plan** de arriba no puede subir a una '
    + 'familia por su cuenta: una mejora es un pago, así que esas filas apuntan a '
    + 'Facturación.',
  'help.plans.paying.b2':
    'Pasar a un plan más barato es gratis y no pasa por Facturación. Un plan mensual '
    + 'también se puede detener, lo que lo deja correr hasta el final del mes ya pagado en '
    + 'vez de terminarlo ese mismo día.',
  'help.plans.paying.b3':
    'Un plan solo cambia cuando el pago de hecho ha pasado, que es Stripe diciéndonoslo y '
    + 'no el navegador volviendo. Si cierra la pestaña a mitad del pago, no se pierde nada: '
    + 'el plan cambia cuando cambia el dinero, y la sección Facturación muestra lo que se ha '
    + 'pagado.',
  'help.plans.chosen-at-signup.heading': 'Un plan elegido al crear la familia',
  'help.plans.chosen-at-signup.b0':
    'Elegir Estándar o Plus en la página de precios, o en el formulario de registro, no lo '
    + 'paga: todavía no hay familia a la que facturar ni cuenta a la que cobrar. En su lugar, '
    + 'la elección queda registrada para la familia.',
  'help.plans.chosen-at-signup.b1':
    'Una vez confirmada la dirección de correo y con quien creó la familia dentro, el panel '
    + 'abre con **Terminar de pagar** ese plan, por encima de todo lo demás que tenga que '
    + 'decir. Lleva dos botones.',
  'help.plans.chosen-at-signup.b2.i0.term': 'Pagar ahora',
  'help.plans.chosen-at-signup.b2.i0.text':
    'Lo lleva directamente a Stripe para pagar mensualmente, empezando por lo que queda de '
    + 'este mes. No hay ninguna pantalla aparte que haya que encontrar primero.',
  'help.plans.chosen-at-signup.b2.i1.term': 'Cancelar',
  'help.plans.chosen-at-signup.b2.i1.text':
    'Abandona el plan que la familia pidió y la deja en Gratis. No cancela nada en Stripe y '
    + 'no compra nada: todos los planes siguen a la venta en Configuración después.',
  'help.plans.chosen-at-signup.b3':
    'Un enlace debajo de los botones lleva a la sección Facturación, que es donde se pueden '
    + 'comprar meses por adelantado. Hasta que un pago pase, la familia está en Gratis y no '
    + 'se ha cobrado nada.',
  'help.plans.boundary.heading': 'Dos muros distintos',
  'help.plans.boundary.b0.i0.term': 'Muy pronto',
  'help.plans.boundary.b0.i0.text':
    'La función todavía no se ha construido. Nadie la tiene, en ningún plan.',
  'help.plans.boundary.b0.i1.term': 'Mejorar el plan',
  'help.plans.boundary.b0.i1.text':
    'La función está construida y funcionando, y el plan de su familia no la incluye.',
  'help.plans.boundary.b1':
    'Se muestran por separado a propósito. Decirle a una familia que paga que una función '
    + 'terminada está «muy pronto» sería falso, y decirle a una familia gratuita que espere '
    + 'algo que podría tener esta tarde sería peor.',
  'help.plans.data.heading': 'Cambiar de plan nunca elimina datos',
  'help.plans.data.b0':
    'Un plan decide qué pantallas puede abrir una familia. Una familia que pasa a un plan más '
    + 'barato conserva todos los registros que haya introducido durante **sesenta días**: las '
    + 'páginas que los leen dejan de abrirse, y volver dentro de esos sesenta días los trae de '
    + 'vuelta de inmediato. Después de sesenta días se elimina lo que el plan más barato no '
    + 'incluye. Antes llegan cuatro recordatorios, y [Facturación](/admin/settings) muestra la '
    + 'fecha en todo momento.',
  'help.troubleshooting.title': 'Si algo parece estar mal',
  'help.troubleshooting.summary':
    'Las pocas cosas que sorprenden a la gente, y qué está pasando de verdad.',
  'help.troubleshooting.cannot-sign-in.heading': 'No puedo iniciar sesión de ninguna manera',
  'help.troubleshooting.cannot-sign-in.b0':
    'Si la página de inicio de sesión responde que su dirección de correo no está '
    + 'confirmada, la cuenta existe y su contraseña era correcta: está esperando el enlace '
    + 'que se envió cuando se registró. Pulse **Enviar el enlace de nuevo** en el panel '
    + 'debajo del formulario, y abra el mensaje más nuevo. Cada enlace funciona una vez y '
    + 'vence al cabo de una hora, así que un correo más antiguo del mismo hilo no lo dejará '
    + 'entrar.',
  'help.troubleshooting.cannot-sign-in.b1':
    'Nada nos dice si ese correo llegó, así que el panel dice qué pidió en vez de afirmar '
    + 'que se entregó. Mire la carpeta de correo no deseado, y si no llega nada en absoluto, '
    + 'puede que la dirección no sea la que se usó al registrar la cuenta: vea [Confirmar su '
    + 'dirección de correo](/help/joining-a-family#confirm-your-email).',
  'help.troubleshooting.cannot-sign-in.b2':
    'Una contraseña equivocada responde de otra forma, y también una dirección sin cuenta: '
    + 'las dos dicen que las credenciales no son válidas en vez de nombrar la confirmación. '
    + 'Si eso es lo que ve, pida un enlace de restablecimiento desde la página de inicio de '
    + 'sesión.',
  'help.troubleshooting.missing-page.heading':
    'Una página de la que me hablaron no está en mi menú lateral',
  'help.troubleshooting.missing-page.b0':
    'Tres motivos posibles, y [Por qué falta una página](/help/who-can-do-what#missing) los '
    + 'separa. El más común de lejos es que su plantilla no lo otorga.',
  'help.troubleshooting.wrong-family.heading': 'Estoy viendo la familia equivocada',
  'help.troubleshooting.wrong-family.b0':
    'Compruebe el cambio de familia de la barra superior. Si aterriza habitualmente en la '
    + 'equivocada, ponga la otra como **Predeterminada** en [Mis familias](/my-families): esa '
    + 'es la familia que se abre cuando inicia sesión.',
  'help.troubleshooting.signed-out.heading': 'Me cierra la sesión constantemente',
  'help.troubleshooting.signed-out.b0':
    'Sesenta minutos sin escribir ni pulsar nada le cierran la sesión en ese dispositivo. '
    + 'Es un cierre de sesión real y no una pantalla de bloqueo, así que volver a entrar es '
    + 'todo el arreglo. Si pasa mientras usted está trabajando de verdad, puede que la '
    + 'pestaña se haya quedado en una pantalla que no recibe nada escrito: el temporizador '
    + 'cuenta teclas y clics, no que la página esté abierta.',
  'help.troubleshooting.signed-out.b1':
    '**En un teléfono, reabrir la aplicación después de un rato lo deja en la página de '
    + 'inicio de sesión sin ningún aviso previo.** Es esa misma hora, medida de la única '
    + 'forma en que se puede: un teléfono cierra la página en segundo plano, así que no había '
    + 'nada corriendo para avisarle y la comprobación se hace cuando usted vuelve. Volver a '
    + 'entrar retoma donde estaba.',
  'help.troubleshooting.empty-list.heading': 'Una lista dice que aquí no hay nada',
  'help.troubleshooting.empty-list.b0':
    'Normalmente de verdad no hay nada. Dos cosas que conviene comprobar primero: si está '
    + 'en la familia correcta, y si el panel en el que está se limita a sus propios registros '
    + 'en vez de a los de la familia — un permiso de **ver** otorgado con alcance *propios* '
    + 'le muestra sus filas y las de nadie más, lo cual es correcto y puede parecer vacío.',
  'help.troubleshooting.tree-empty.heading': 'El árbol se abre en otra persona',
  'help.troubleshooting.tree-empty.b0':
    'Eso pasa cuando usted no tiene padres ni hijos registrados: el árbol se abre en el '
    + 'familiar al que está unido en vez de en una página vacía, y lo dice. **Centrar en mí** '
    + 'lo devuelve, y añadir un padre o un hijo hace que se abra en usted a partir de '
    + 'entonces.',
  'help.troubleshooting.approved-nothing.heading': 'Me aprobaron pero no cambió nada',
  'help.troubleshooting.approved-nothing.b0':
    'Debería cambiar por su cuenta en menos de un minuto, o en cuanto usted vuelva a la '
    + 'pestaña: la página lo comprueba en vez de hacerle iniciar sesión otra vez. Si no lo ha '
    + 'hecho, recargar la página lo resolverá.',
  'help.troubleshooting.what-is-this-screen.heading': 'No entiendo para qué sirve una pantalla',
  'help.troubleshooting.what-is-this-screen.b0':
    'Todas las pantallas que tienen un capítulo llevan un signo de interrogación arriba a '
    + 'la derecha, junto a la campana, y va directamente a ese capítulo. Algunas pantallas '
    + 'llevan además un signo de interrogación al lado de un control en concreto — el '
    + 'interruptor de Linaje en el [Árbol familiar](/community/family-tree), el plan en '
    + '[Configuración](/admin/settings) — y ese va al párrafo sobre ese control y no al '
    + 'comienzo del capítulo.',
  'help.troubleshooting.what-is-this-screen.b1':
    'Si el signo de interrogación no está ahí, ningún capítulo documenta esa pantalla '
    + 'todavía. [La página de contenidos](/help) enumera todo lo que cubre el manual.',
  // ──── PART 6 — Administration (Members, Organization) ─────────────────────────
  'help.part.admin.title': 'Administración',
  'help.part.admin.blurb':
    'Los ajustes que gobiernan la familia: quién está dentro, qué forma tiene y qué paga.',
  'help.members-and-access.title': 'Miembros',
  'help.members-and-access.summary':
    'La lista de integrantes, la cola de aprobaciones, las invitaciones y las plantillas de '
    + 'permisos que están detrás.',
  'help.members-and-access.tabs.heading': 'Cuatro pestañas, cuatro trabajos',
  'help.members-and-access.tabs.b0.i0.term': 'Miembros',
  'help.members-and-access.tabs.b0.i0.text':
    'Todos los que tienen cuenta: en qué plantilla de permisos está cada uno y qué cargo '
    + 'de la junta ocupa. Cuatro columnas: Nombre, Cargo, Sección y Grupo, con todo lo '
    + 'demás sobre una persona detrás de su nombre, igual que en el '
    + '[Directorio](/help/directory#columns). Un interruptor encima de la tabla también '
    + 'lista las **Fichas**: vea [fichas](#records).',
  'help.members-and-access.tabs.b0.i1.term': 'Organización',
  'help.members-and-access.tabs.b0.i1.text':
    'Qué forma tiene la familia: sus regiones y capítulos, y los cargos de la directiva que '
    + 'mantiene. Va en segundo lugar porque las regiones y los capítulos son aquello contra '
    + 'lo que se leen las columnas Región y Capítulo de la tabla de Miembros. La cubren dos '
    + 'capítulos: [Organización](/help/regions-and-chapters) y [Cargos de la '
    + 'directiva](/help/board-positions).',
  'help.members-and-access.tabs.b0.i2.term': 'Aprobaciones pendientes',
  'help.members-and-access.tabs.b0.i2.text':
    'Las personas que piden unirse, y las invitaciones que usted ha enviado.',
  'help.members-and-access.tabs.b0.i3.term': 'Plantillas de permisos',
  'help.members-and-access.tabs.b0.i3.text': 'Las plantillas en sí, y lo que otorga cada una.',
  'help.members-and-access.tabs.b1':
    'Las cuatro se otorgan por separado y la página se abre con cualquiera de ellas: '
    + 'alguien puede trabajar la cola de aprobaciones sin poder editar plantillas, y alguien '
    + 'puede mantener en orden los capítulos de la familia sin poder ver la lista de '
    + 'integrantes en absoluto.',
  'help.members-and-access.records.b4':
    'Dos cosas se rechazan en vez de ofrecerse. Una persona con CUENTA no se puede '
    + 'eliminar aquí: desactívela desde el menú de su fila, lo cual conserva todo lo que '
    + 'tenga asociado. Y una ficha con DINERO asociado (un pago, una aportación o un '
    + 'desembolso) se rechaza nombrando lo que tiene asociado, porque el libro de cuentas '
    + 'de una familia nunca se edita ni se elimina.',
  'help.members-and-access.records.b3':
    '**Eliminar una ficha es permanente y se ofrece aquí.** Quita a la persona y todo lo '
    + 'anotado sobre ella: su lugar en el árbol familiar, las etiquetas de fotografía que '
    + 'la nombran, y cualquier junta o comprobación en la que estuviera incluida. La '
    + 'confirmación la nombra antes de que usted se comprometa. Requiere el permiso de '
    + 'eliminación en Miembros, que es distinto del de edición.',
  'help.members-and-access.records.b2':
    '**No todas las fichas tienen una.** Invitar a alguien desde el árbol familiar le da '
    + 'una dirección real de inmediato, y sigue siendo una ficha hasta que acepte, así que '
    + 'esa fila muestra la dirección real y ninguna etiqueta.',
  'help.members-and-access.records.b1':
    'La tabla muestra otras cosas sobre ellos, porque casi todo lo que muestra la tabla '
    + 'de Miembros estaría vacío: una ficha no ocupa ningún cargo de la junta ni tiene '
    + 'plantilla de permisos, y no hay nada que desactivar. Lo que muestra en su lugar es '
    + 'su **dirección**, y si es una que el producto **generó** para ellos: eso es lo que '
    + 'significa **Dirección generada** en esa columna. Una dirección generada no puede '
    + 'recibir correo; existe para que la ficha tenga algo único.',
  'help.members-and-access.records.b0':
    'El interruptor encima de la tabla tiene dos posiciones. **Con cuenta** es la que '
    + 'abre la pestaña y es todo lo anterior. **Fichas** es la otra lista: parientes que '
    + 'alguien anotó en el [árbol familiar](/community/family-tree) y que nunca han '
    + 'iniciado sesión: una abuela, un niño, cualquiera anotado para que el árbol tenga '
    + 'sentido.',
  'help.members-and-access.records.heading': 'Personas sin cuenta',
  'help.members-and-access.approving.heading': 'Admitir a alguien',
  'help.members-and-access.approving.b0.i0': 'Abra **Aprobaciones pendientes**.',
  'help.members-and-access.approving.b0.i1':
    'Lea la solicitud: el perfil de la persona es aquello por lo que la está reconociendo.',
  'help.members-and-access.approving.b0.i2': 'Apruebe, o rechace con un motivo.',
  'help.members-and-access.approving.b1':
    'Un integrante aprobado obtiene el producto completo de inmediato; su menú lateral se '
    + 'rellena solo sin que tenga que volver a iniciar sesión. A un solicitante rechazado se '
    + 'le avisa, y puede apelar una vez.',
  'help.members-and-access.inviting.heading': 'Invitar a alguien',
  'help.members-and-access.inviting.b0':
    '**Invitar** envía un enlace a una sola dirección de correo. Una invitación puede '
    + 'preaprobar, lo que deja entrar a la persona directamente cuando la acepta: es la '
    + 'diferencia entre una invitación y repartir el código familiar.',
  'help.members-and-access.inviting.b1':
    'Las invitaciones se pueden reenviar y revocar desde la misma pestaña. Si el correo en '
    + 'sí no se llega a enviar, se le avisa y se le da el enlace para que lo pase usted '
    + 'mismo, en vez de mostrarle un éxito sobre un mensaje que nunca salió.',
  'help.members-and-access.templates.heading': 'Plantillas de permisos',
  'help.members-and-access.templates.b0':
    'Cada integrante está en exactamente una plantilla, y esa plantilla es todo lo que '
    + 'puede hacer. No hay una segunda capa: no hay grupos que unir ni excepciones por '
    + 'persona que conciliar.',
  'help.members-and-access.templates.b1.i0':
    'Abra **Plantillas de permisos** y cree una, opcionalmente partiendo de una copia de '
    + 'una plantilla existente.',
  'help.members-and-access.templates.b1.i1':
    'Encuentre la función que quiere cambiar. Cada una es una fila que dice lo que otorga '
    + 'hoy: «Ver todo», «Editar propios» o **Nada**.',
  'help.members-and-access.templates.b1.i2':
    'Pulse la fila para abrirla. Sus permisos de **ver**, **crear**, **editar** y '
    + '**eliminar** aparecen debajo, y solo los que significan algo para esa función.',
  'help.members-and-access.templates.b1.i3':
    'Fije cada uno en **Todos**, **Propios** o **—**. El cambio se confirma y luego se '
    + 'aplica de inmediato.',
  'help.members-and-access.templates.b1.i4':
    'Ponga gente en ella desde el menú de la fila en la pestaña **Miembros**.',
  'help.members-and-access.templates.b2':
    'Solo hay una función abierta a la vez, así que abrir otra cierra la anterior. Eso es '
    + 'deliberado: cuarenta funciones por cuatro ajustes es un muro de interruptores, y un '
    + 'administrador viene aquí a cambiar uno de ellos.',
  'help.members-and-access.templates.b3':
    'Una fila cerrada sigue siendo la respuesta. Dice lo que la plantilla otorga para esa '
    + 'función, así que leer una plantilla entera es leer la lista hacia abajo y no abrir '
    + 'todas las filas; y **Nada** se escribe en vez de dejarse en blanco, porque una fila en '
    + 'blanco se lee como una que no se llegó a cargar.',
  'help.members-and-access.templates.b4':
    'Cambiar una plantilla la cambia para todas las personas que están en ella, de '
    + 'inmediato.',
  'help.members-and-access.editing-a-profile.heading': 'Corregir el perfil de alguien',
  'help.members-and-access.editing-a-profile.b0':
    'Pulse el nombre de un integrante en la pestaña **Miembros** para ver su ficha '
    + 'completa, y después **Editar perfil** para cambiarla; o vaya directamente allí con '
    + '**Editar perfil** en **Perfil**, dentro del menú al final de su fila. El formulario '
    + 'son las mismas tres secciones que un integrante ve en su propio [Mi '
    + 'perfil](/personal-info) — General, Dirección e Información adicional — así que un '
    + 'apellido mal escrito o una dirección que ha cambiado se puede arreglar mientras lo '
    + 'tiene al teléfono.',
  'help.members-and-access.editing-a-profile.b1':
    'Dos cosas no se pueden editar aquí a propósito, y las dos son suyas y no de usted:',
  'help.members-and-access.editing-a-profile.b2.i0.term': 'Su dirección de correo',
  'help.members-and-access.editing-a-profile.b2.i0.text':
    'Se muestra, y es de solo lectura. Es con lo que inicia sesión, así que solo esa '
    + 'persona puede cambiarla, desde Inicio de sesión y seguridad en su propio perfil. Para '
    + 'un familiar que todavía no se ha registrado es una dirección provisional generada, y '
    + 'pasa a ser una dirección real cuando acepta una invitación.',
  'help.members-and-access.editing-a-profile.b2.i1.term': 'Su contraseña',
  'help.members-and-access.editing-a-profile.b2.i1.text':
    'Nadie puede verla ni fijarla, usted incluido. **Enviar un restablecimiento de '
    + 'contraseña** le envía un enlace por correo y esa persona elige la nueva; su contraseña '
    + 'actual sigue funcionando hasta que lo use.',
  'help.members-and-access.editing-a-profile.b3':
    'A un integrante no se le avisa de que usted cambió su perfil, así que dígaselo. El '
    + '**Capítulo** al que pertenece tampoco está aquí: los integrantes lo fijan ellos '
    + 'mismos, y la pestaña [Organización](/help/regions-and-chapters) es la que decide qué '
    + 'capítulos existen.',
  'help.members-and-access.editing-a-profile.b4':
    'Esto necesita **editar** en Miembros. Alguien que solo puede ver la lista de '
    + 'integrantes ve la ficha y ningún botón de Editar.',
  'help.members-and-access.disabling.heading': 'Desactivar a un integrante',
  'help.members-and-access.disabling.b0':
    '**Desactivar integrante**, desde el menú de la fila en la pestaña **Miembros**, es la '
    + 'alternativa a quitar a alguien. Conserva su ficha y su historial y pierde el acceso: '
    + 'es la jugada correcta para una persona que ya no debería iniciar sesión pero cuyos '
    + 'pagos y cuyo lugar en el árbol forman parte del registro de la familia. **Activar '
    + 'integrante** la devuelve.',
  'help.regions-and-chapters.title': 'Organización',
  'help.regions-and-chapters.summary':
    'Dividir una familia grande en regiones y capítulos, en la pestaña Organización de '
    + 'Miembros, y qué decide el capítulo de un integrante.',
  'help.regions-and-chapters.what-it-is.heading': 'Dos niveles, y Nacional',
  'help.regions-and-chapters.what-it-is.b0':
    '**Organización** es la cuarta pestaña de [Miembros](/admin/members?tab=organization), '
    + 'y es cómo se organiza una familia que está repartida. Un **capítulo** es donde un '
    + 'integrante pertenece de verdad — Houston, Atlanta — y una **región** es un grupo de '
    + 'capítulos, como Texas o el Este. Una familia puede funcionar solo con capítulos, con '
    + 'los dos, o con ninguno.',
  'help.regions-and-chapters.what-it-is.b1':
    'La pestaña tiene dos mitades. Este capítulo es la de arriba, la geografía; la de abajo '
    + 'son los cargos de la familia y tiene su propio capítulo, [Cargos de la '
    + 'directiva](/help/board-positions). Se otorgan por separado, así que a alguien se le '
    + 'puede dar una mitad y no la otra: una pestaña que muestra solo una de las dos no es '
    + 'una falla.',
  'help.regions-and-chapters.what-it-is.b2':
    'Antes era una pantalla propia en el menú lateral y ahora es una pestaña, porque quién '
    + 'está en la familia y cómo se divide la familia son un solo trabajo. Un enlace o un '
    + 'marcador que apunte a la dirección antigua sigue aterrizando aquí.',
  'help.regions-and-chapters.what-it-is.b3':
    '**Nacional** es la tercera cosa de la pantalla y no es una región que usted cree. Es '
    + 'aquello a lo que todo pertenece hasta que lo archiva en otro sitio: un capítulo sin '
    + 'región está bajo Nacional, y también lo está cualquier integrante que no haya elegido '
    + 'un capítulo. No se puede renombrar, eliminar ni desactivar, y todas las familias lo '
    + 'tienen.',
  'help.regions-and-chapters.what-it-is.b4':
    'Los integrantes eligen su propio capítulo, en [Mi perfil](/personal-info). A nadie se '
    + 'le asigna uno desde aquí: esta pestaña decide qué capítulos EXISTEN.',
  'help.regions-and-chapters.adding.heading': 'Añadir y mover',
  'help.regions-and-chapters.adding.b0.i0':
    'Escriba un nombre bajo **Añadir una región** y pulse **Añadir región**. «Nacional» se '
    + 'rechaza, porque ya existe.',
  'help.regions-and-chapters.adding.b0.i1':
    'Escriba un nombre bajo **Añadir un capítulo**, elija **En la región** — o déjelo en '
    + 'Nacional — y pulse **Añadir capítulo**.',
  'help.regions-and-chapters.adding.b0.i2':
    'Para mover un capítulo más tarde, cambie la celda **Región** de su fila. Se guarda de '
    + 'inmediato.',
  'help.regions-and-chapters.adding.b1':
    'Mover un capítulo de una región a otra cambia quién debe una cuota regional, en el '
    + 'momento. Eso es intencionado: los integrantes de verdad están ahora en la región '
    + 'nueva, así que las cuotas de la región nueva son de verdad suyas.',
  'help.regions-and-chapters.deleting.heading': 'Eliminar una, y cuándo no se puede',
  'help.regions-and-chapters.deleting.b0':
    'Eliminar una región mueve sus capítulos a Nacional. La membresía de nadie cambia y no '
    + 'se toca ningún registro; la confirmación dice cuántos capítulos se moverán.',
  'help.regions-and-chapters.deleting.b1':
    'Un capítulo o una región no se puede eliminar mientras algo siga apuntando a él. El '
    + 'botón Eliminar de la fila no está disponible y dice qué lo impide: integrantes en el '
    + 'capítulo, un programa de cuotas limitado a él, un anuncio dirigido a él, o un cargo de '
    + 'la directiva ocupado ahí.',
  'help.regions-and-chapters.deleting.b2':
    'Eso es un rechazo y no un ordenamiento hecho de su parte, y a propósito: el capítulo '
    + 'de alguien decide lo que debe y quién lo dirige, así que mover a catorce personas como '
    + 'efecto secundario de un borrado no es una decisión que se tome por accidente. Mueva a '
    + 'los integrantes, cambie el alcance de las cuotas, y después elimine.',
  'help.regions-and-chapters.deleting.b3':
    'Nada de aquí es un callejón sin salida. Cambie el alcance de una cuota a toda la '
    + 'familia en [Contabilidad](/admin/accounting?section=dues) y la región se elimina.',
  'help.regions-and-chapters.dues.heading': 'Qué decide un capítulo sobre el dinero',
  'help.regions-and-chapters.dues.b0':
    'Un programa de cuotas lo debe toda la familia, una región, o un capítulo, y se fija '
    + 'con **Debido por** en el formulario de cuotas en '
    + '[Contabilidad](/admin/accounting?section=dues). Vea '
    + '[Contabilidad](/help/accounting#dues).',
  'help.regions-and-chapters.dues.b1.i0.term': 'Nacional',
  'help.regions-and-chapters.dues.b1.i0.text':
    'Todos los integrantes la deben. Es la opción por defecto, y la única hasta que haya '
    + 'creado una región o un capítulo.',
  'help.regions-and-chapters.dues.b1.i1.term': 'Una región',
  'help.regions-and-chapters.dues.b1.i1.text':
    'Solo la deben los integrantes cuyo CAPÍTULO está en esa región.',
  'help.regions-and-chapters.dues.b1.i2.term': 'Un capítulo',
  'help.regions-and-chapters.dues.b1.i2.text': 'Solo la deben los integrantes de ese capítulo.',
  'help.regions-and-chapters.dues.b2':
    '**Un integrante sin capítulo está bajo Nacional**, así que una cuota regional o de '
    + 'capítulo no se le aplica en absoluto: no aparece en su pantalla de '
    + '[Cuotas](/accounting/dues-and-donations) y nunca se le factura. Ese es el estado en el '
    + 'que empiezan todas las familias, y es el motivo más común de que una cuota de capítulo '
    + 'nueva no recaude nada: [Proyección de cuotas](/reporting/dues-projections) lo dice en '
    + 'la fila del programa cuando nadie de la familia está en la parte a la que corresponde.',
  'help.regions-and-chapters.dues.b3':
    'La región de un integrante se deduce de su capítulo cada vez que se pregunta. No hay '
    + 'una región aparte que fijar en una persona, y mover un capítulo a otra región mueve '
    + 'con él a todos los que están dentro sin ningún paso más.',
  // ──── PART 6 — Administration (Board Positions, Running an election) ──────────
  'help.board-positions.title': 'Cargos de la directiva',
  'help.board-positions.summary':
    'Los cargos que mantiene su familia, quién ocupa cada uno, y por qué la lista empieza '
    + 'vacía.',
  'help.board-positions.what-it-is.heading': 'Los cargos de su familia',
  'help.board-positions.what-it-is.b0':
    '**Cargos de la directiva** es la lista de cargos que su familia mantiene de hecho — '
    + 'presidente, tesorero, un responsable de la reunión — y el registro de quién ocupa cada '
    + 'uno. Es la mitad inferior de la pestaña **Organización** de '
    + '[Miembros](/admin/members?tab=organization), debajo de las regiones y los capítulos: '
    + 'una pestaña responde las dos mitades de «qué forma tiene esta familia».',
  'help.board-positions.what-it-is.b1':
    '**La lista empieza vacía, y eso es deliberado.** No hay dos familias que funcionen '
    + 'igual: una tiene cinco directivos y un responsable para la reunión, otra tiene veinte '
    + 'comisiones. Así que no se le configura nada y no se le sugiere nada: usted añade los '
    + 'cargos que tiene, y los que no tiene simplemente no están.',
  'help.board-positions.what-it-is.b2':
    'Todos los cargos pertenecen solo a su familia. Que otra familia llame igual a su '
    + 'tesorero no tiene ningún efecto sobre el suyo, y ninguna de las dos familias puede ver '
    + 'la lista de la otra.',
  'help.board-positions.adding.heading': 'Añadir un cargo',
  'help.board-positions.adding.b0.i0': 'Pulse **Añadir cargo**. Se abre un cuadro sobre la página.',
  'help.board-positions.adding.b0.i1':
    'Escriba el nombre tal y como lo dice en voz alta: eso es lo que aparece al lado del '
    + 'nombre de alguien en todos los demás sitios.',
  'help.board-positions.adding.b0.i2':
    'Elija una **Categoría**: **Directivo** para un cargo electo, **Cargo designado** para '
    + 'uno que se le da a alguien.',
  'help.board-positions.adding.b0.i3':
    'Elija un **Alcance** — vea más abajo — y pulse **Añadir cargo**.',
  'help.board-positions.adding.b1.i0.term': 'Nacional',
  'help.board-positions.adding.b1.i0.text':
    'Una sola persona para toda la familia. Casi todo es así.',
  'help.board-positions.adding.b1.i1.term': 'Regional',
  'help.board-positions.adding.b1.i1.text':
    'Una persona por región. Usted elige qué región cuando se lo da a alguien.',
  'help.board-positions.adding.b1.i2.term': 'Capítulo',
  'help.board-positions.adding.b1.i2.text': 'Una persona por capítulo, elegido de la misma forma.',
  'help.board-positions.adding.b2':
    'Regional y Capítulo solo significan algo cuando su familia ha configurado regiones o '
    + 'capítulos, que es la mitad superior de esta misma pestaña. Hasta entonces, use '
    + 'Nacional.',
  'help.board-positions.adding.b3':
    '**El mismo título puede existir una vez en cada alcance.** Un **presidente** nacional '
    + 'y un **presidente** regional son dos cargos distintos, y una familia con cuatro '
    + 'regiones tiene un presidente regional que ocupan cuatro personas, una por región. Así '
    + 'que no hace falta llamar al segundo «presidente regional» para distinguirlos: eso lo '
    + 'hace la columna Alcance.',
  'help.board-positions.adding.b4':
    'Lo que no se puede repetir es un título en el MISMO alcance. Añada un segundo '
    + 'presidente nacional y la pantalla lo dice, en vez de crear en silencio un duplicado '
    + 'que nadie podría distinguir del primero.',
  'help.board-positions.renaming.heading': 'Corregir un nombre',
  'help.board-positions.renaming.b0':
    'El lápiz en la fila de un cargo convierte su nombre en un cuadro de texto. **Entrar** '
    + 'guarda, **Escape** cancela, y el nombre cambia en todos los sitios donde se imprime: '
    + 'debajo del nombre de la gente en el [Directorio](/community/directory), en su '
    + '[Panel](/dashboard) y en su [Mi perfil](/personal-info).',
  'help.board-positions.renaming.b1':
    'Solo se puede cambiar el nombre. **Categoría** y **Alcance** no, porque el alcance de '
    + 'un cargo se copia en la ficha de cada persona que lo ocupa cuando se le da, junto con '
    + 'la región o el capítulo al que correspondía; así que cambiar el alcance después '
    + 'dejaría esas fichas describiendo algo que el cargo ya no es. Una familia que tiene el '
    + 'alcance mal quita el cargo y lo vuelve a añadir, lo cual también vuelve a hacer las '
    + 'asignaciones que estaban mal.',
  'help.board-positions.renaming.b2':
    'Dos cargos en el MISMO alcance no pueden compartir un nombre. Renombrar un cargo '
    + 'regional con un nombre que su lista nacional ya usa está bien; renombrarlo con el '
    + 'nombre de otro cargo regional se rechaza, y no se guarda nada.',
  'help.board-positions.assigning.heading': 'Dar un cargo a alguien',
  'help.board-positions.assigning.b0':
    '**No desde este panel.** Configurar qué cargos mantiene su familia se hace aquí; '
    + 'decidir quién ocupa uno se hace en la pestaña **Miembros**, desde la propia fila de '
    + 'esa persona.',
  'help.board-positions.assigning.b1.i0': 'Abra la pestaña **Miembros** y encuentre a la persona.',
  'help.board-positions.assigning.b1.i1':
    'Abra el menú al final de su fila y elija **Dar un cargo de la directiva** en '
    + '**Perfil**.',
  'help.board-positions.assigning.b1.i2':
    'Elija el cargo. Para uno regional o de capítulo, elija a qué región o capítulo '
    + 'corresponde.',
  'help.board-positions.assigning.b1.i3': 'Pulse **Dar cargo**.',
  'help.board-positions.assigning.b2':
    'Se movió ahí el 20-08-2026, y el motivo es lo que uno tiene en mente al hacerlo. Qué '
    + 'cargos existen es una decisión sobre la FAMILIA, tomada una vez y revisada cada año, y '
    + 'va al lado de las regiones y los capítulos. Hacer a Ada tesorera es una decisión sobre '
    + 'ADA, y todo lo demás que se decide sobre Ada ya está en su fila: su plantilla de '
    + 'permisos, si su acceso está activado, su perfil. Asignar desde la fila del cargo '
    + 'obligaba a encontrar el cargo para encontrar a la persona.',
  'help.board-positions.assigning.b3':
    'Más de una persona puede ocupar el mismo cargo, que es lo que necesita un cargo '
    + 'regional o de capítulo, y una persona puede ocupar más de uno. Su columna **Cargo** '
    + 'enumera lo que ocupa, y lo mismo hace el cuadro que se abre desde su fila.',
  'help.board-positions.assigning.b4':
    'Solo los familiares que han terminado de registrarse pueden ocupar un cargo. Alguien '
    + 'registrado en el árbol familiar sin cuenta no puede, porque el registro de quién ocupa '
    + 'un cargo va unido a su cuenta: invítelo primero, desde el [Árbol '
    + 'familiar](/community/family-tree).',
  'help.board-positions.removing.heading': 'Quitar uno, y eliminar un cargo',
  'help.board-positions.removing.b0':
    'La papelera al lado de un título, en el cuadro que se abre desde la fila de un '
    + 'integrante en la pestaña **Miembros**, le quita ese cargo a esa persona. Sigue siendo '
    + 'integrante de la familia y nada más sobre ella cambia.',
  'help.board-positions.removing.b1':
    '**Un cargo que alguien ocupa no se puede eliminar.** Su botón de eliminar no está '
    + 'disponible y dice cuántas personas lo ocupan; quíteselo a cada una y pasa a estar '
    + 'disponible.',
  'help.board-positions.removing.b2':
    'Eso es un rechazo y no un ordenamiento hecho de su parte, y por el mismo motivo que '
    + 'eliminar un capítulo: el cargo de alguien está en su perfil y en el Directorio, y '
    + 'quitar cuatro cargos como efecto secundario de eliminar una fila no es una decisión '
    + 'que se tome por accidente.',
  'help.board-positions.where-it-shows.heading': 'Dónde aparece un cargo',
  'help.board-positions.where-it-shows.b0':
    'Un cargo es público dentro de la familia. En cuanto alguien ocupa uno, aparece:',
  'help.board-positions.where-it-shows.b1.i0':
    'debajo de su nombre en el [Directorio](/community/directory),',
  'help.board-positions.where-it-shows.b1.i1': 'en su propio [Mi perfil](/personal-info),',
  'help.board-positions.where-it-shows.b1.i2': 'y en su [Panel](/dashboard) cuando inicia sesión.',
  'help.board-positions.where-it-shows.b2':
    'Un cargo regional o de capítulo se escribe completo — «presidente del capítulo de '
    + 'Houston», «secretario regional de Texas» — así que dos personas que ocupan el mismo '
    + 'cargo en lugares distintos se leen como dos títulos diferentes.',
  'help.board-positions.where-it-shows.b3':
    'Estos cargos son aquello para lo que se celebra una elección. Una elección en un nivel '
    + 'solo puede cubrir cargos registrados en ese nivel, así que una elección de capítulo '
    + 'ofrece los cargos del capítulo y nada más: vea [Celebrar una '
    + 'elección](/help/running-an-election).',
  'help.running-an-election.title': 'Celebrar una elección',
  'help.running-an-election.summary':
    'Fijar las dos ventanas de fechas, elegir qué parte de la familia vota, poner cargos en '
    + 'la papeleta y publicarla.',
  'help.running-an-election.what-it-is.heading': 'Qué es esta pantalla',
  'help.running-an-election.what-it-is.b0':
    'Todas las elecciones que tiene la familia, en todos los niveles, borradores incluidos. '
    + 'Cada fila muestra dónde está la elección hoy, para qué parte de la familia es, sus dos '
    + 'ventanas de fechas, y cuántos cargos, nominaciones y votos tiene.',
  'help.running-an-election.what-it-is.b1':
    '**Nueva elección** abre el formulario en un panel sobre la lista, y el control de '
    + 'editar en un borrador hace lo mismo. La lista se queda detrás, que es la idea: puede '
    + 'ver lo que la familia ya tiene mientras escribe la siguiente.',
  'help.running-an-election.what-it-is.b2':
    'Una elección es o un **borrador** — suyo, invisible para la familia — o está '
    + '**publicada**, lo que la pone en el calendario de la familia. No hay nada más que '
    + 'fijar: una vez publicada, la gobiernan las fechas.',
  'help.running-an-election.the-windows.heading': 'Las dos ventanas de fechas',
  'help.running-an-election.the-windows.b0':
    '**Nominaciones** y **Votación**, cada una con una fecha de apertura y una de cierre. '
    + 'Son lo que hace que la elección ocurra; nadie tiene que volver y pulsar nada.',
  'help.running-an-election.the-windows.b1.i0':
    'Las nominaciones corren desde el día en que abren hasta el final del día en que '
    + 'cierran. Los dos días cuentan.',
  'help.running-an-election.the-windows.b1.i1':
    'La votación corre igual, y no puede abrir ANTES de que cierren las nominaciones: una '
    + 'papeleta nunca se vota mientras la lista de candidatos todavía puede cambiar.',
  'help.running-an-election.the-windows.b1.i2':
    'Puede abrir el mismo día en que cierran, y entonces ese día pertenece a la votación: '
    + 'las nominaciones se cierran al abrir la papeleta. Esa es la elección más corta que el '
    + 'producto puede describir: un día de nominaciones, un día de votación. Déle a las '
    + 'nominaciones todo su día de cierre fijándolo un día antes.',
  'help.running-an-election.the-windows.b1.i3':
    'Cada ventana tiene que durar al menos un día. Una fecha de cierre en la fecha de '
    + 'apertura o antes se rechaza a medida que la escribe.',
  'help.running-an-election.the-windows.b1.i4':
    'Los selectores de fecha atenúan los días que romperían la cadena: en cuanto las '
    + 'nominaciones abren el día 1, el selector de cierre no ofrecerá el 1 ni nada anterior, '
    + 'y los selectores de votación se mueven con él. El selector de apertura de la votación '
    + 'SÍ ofrece el día en que cierran las nominaciones, porque ese sí está permitido.',
  'help.running-an-election.the-windows.b2':
    'El día después de que cierra la votación, la elección ha terminado y sus resultados '
    + 'aparecen para todas las personas que podían votar en ella. Nada los publica y nada '
    + 'cierra la urna.',
  'help.running-an-election.the-windows.b3':
    'Las cuatro fechas son necesarias para publicar. Un borrador puede no tener ninguna, o '
    + 'tener algunas: para eso está un borrador.',
  'help.running-an-election.the-level.heading': 'Elegir quién vota',
  'help.running-an-election.the-level.b0':
    '**Quién vota** elige el nivel: toda la familia, una región, o un capítulo. Decide tres '
    + 'cosas a la vez, y no son separables.',
  'help.running-an-election.the-level.b1.i0':
    'Quién puede VER la elección. Una elección de capítulo no se enumera para el resto de '
    + 'la familia y su enlace no se abre para ellos.',
  'help.running-an-election.the-level.b1.i1':
    'Quién puede ser NOMINADO. La lista de personas nominables en la papeleta solo contiene '
    + 'a las personas para las que es la elección.',
  'help.running-an-election.the-level.b1.i2':
    'Qué CARGOS puede cubrir: solo los registrados en el mismo nivel en [Cargos de la '
    + 'directiva](/help/board-positions).',
  'help.running-an-election.the-level.b2':
    'Cambiar el nivel después de haber elegido cargos borra los que ya no le pertenecen, y '
    + 'dice cuáles. Eso no es el formulario perdiendo su trabajo: es la regla de que una '
    + 'elección no puede cubrir un cargo de otro nivel.',
  'help.running-an-election.the-level.b3':
    'Una familia sin regiones y sin capítulos obtiene Nacional y nada más, porque no hay '
    + 'nada a lo que apuntar. Las regiones y los capítulos se configuran en [Regiones y '
    + 'capítulos](/help/regions-and-chapters).',
  'help.running-an-election.the-level.b4':
    'Los integrantes que no están en ningún capítulo están bajo Nacional. Participan en las '
    + 'elecciones nacionales y en ninguna limitada, así que una elección reducida a un '
    + 'capítulo es más estrecha de lo que puede parecer: compruebe quién está archivado ahí '
    + 'de verdad antes de publicar una.',
  'help.running-an-election.positions.heading': 'Qué hay en la papeleta',
  'help.running-an-election.positions.b0':
    '**Cargos** es la lista de cargos que cubre esta elección. Cada uno se elige de la '
    + 'lista de la directiva de la familia en el nivel que coincide, y **Ganadores** es a '
    + 'cuántas personas sienta el cargo, normalmente una.',
  'help.running-an-election.positions.b1':
    'Un cargo que esperaba y no encuentra o está registrado en otro nivel o no está '
    + 'registrado en absoluto. Añádalo o cámbiele el alcance en [Cargos de la '
    + 'directiva](/help/board-positions) primero.',
  'help.running-an-election.positions.b2':
    'Una elección necesita al menos un cargo antes de poder publicarse.',
  'help.running-an-election.publishing.heading': 'Publicarla',
  'help.running-an-election.publishing.b0.i0':
    'Rellene el formulario y pulse **Crear borrador**. Todavía no hay nada visible para la '
    + 'familia.',
  'help.running-an-election.publishing.b0.i1':
    'Vuelva a leer la fila: el nivel, las dos ventanas y el número de cargos.',
  'help.running-an-election.publishing.b0.i2':
    'Deje **Anunciar** marcado si quiere que se avise a la familia, y luego pulse '
    + '**Publicar** y confirme.',
  'help.running-an-election.publishing.b1':
    'El anuncio se dirige igual que la elección: una elección de capítulo se anuncia a ese '
    + 'capítulo. Una regional va a toda la familia y nombra la región, porque un anuncio se '
    + 'puede dirigir a un capítulo y no a una región.',
  'help.running-an-election.publishing.b2':
    '**El aviso es una vía de entrada.** Su título es un enlace directo a la elección, '
    + 'tanto en el tablón como en la tarjeta de **Novedades recientes** del '
    + '[Panel](/dashboard), así que nadie tiene que ir a buscar la papeleta de la que le '
    + 'acaban de hablar. Un integrante cuya familia ha desactivado las Elecciones, o que no '
    + 'está en un plan que las incluya, ve el aviso sin el enlace en vez de un enlace que lo '
    + 'rechaza.',
  'help.running-an-election.publishing.b3':
    'Después de eso no hay nada que hacer. Las nominaciones abren en su fecha, cierran en '
    + 'la suya, la votación abre y cierra por su cuenta, y los resultados aparecen.',
  'help.running-an-election.watching-it.heading': 'Seguir una en marcha',
  'help.running-an-election.watching-it.b0':
    'La flecha al final de cualquier fila abre la pantalla propia de esa elección: la vista '
    + 'de quien organiza, no la papeleta. Cuatro cifras en la parte superior:',
  'help.running-an-election.watching-it.b1.i0.term': 'Pueden votar',
  'help.running-an-election.watching-it.b1.i0.text':
    'Integrantes aprobados de la parte de la familia a la que corresponde esta elección que '
    + 'tienen cuenta. Alguien registrado en el árbol familiar sin cuenta propia puede ser '
    + 'nominado y no puede votar, así que no se cuenta aquí.',
  'help.running-an-election.watching-it.b1.i1.term': 'Han votado',
  'help.running-an-election.watching-it.b1.i1.text':
    'Cuántas de ellas lo han hecho, y la participación que eso da.',
  'help.running-an-election.watching-it.b1.i2.term': 'No han votado',
  'help.running-an-election.watching-it.b1.i2.text':
    'La diferencia. Es un número y nunca una lista: no se nombra a nadie, ni aquí ni en '
    + 'ninguna parte.',
  'help.running-an-election.watching-it.b1.i3.term': 'En la papeleta',
  'help.running-an-election.watching-it.b1.i3.text':
    'Nominaciones aceptadas frente a nominaciones totales. Una nominación que nadie ha '
    + 'respondido no está en la papeleta, y solo se puede votar a candidatos que han '
    + 'aceptado.',
  'help.running-an-election.watching-it.b2':
    'Debajo, todos los cargos con las personas que se presentan a ellos, sus recuentos de '
    + 'votos y su porcentaje. Quienes van en cabeza llevan un trofeo, tantas personas como '
    + 'sienta el cargo.',
  'help.running-an-election.watching-it.b3':
    '**Mientras la votación está abierta estas cifras son una instantánea, y la pantalla lo '
    + 'dice.** Nada aquí declara un ganador hasta que la ventana cierra; está para que usted '
    + 'vea si una elección va a funcionar — si alguien aceptó, si alguien está votando — '
    + 'mientras todavía hay tiempo de hacer algo al respecto.',
  'help.running-an-election.watching-it.b4':
    'Esta pantalla nunca muestra en qué sentido votó una persona nombrada, y nada en '
    + 'ninguna parte lo hace. Vea [Elecciones](/help/elections#voting) para el lado del '
    + 'integrante.',
  'help.running-an-election.changing-it.heading': 'Cambiar o retirar una',
  'help.running-an-election.changing-it.b0':
    '**Un borrador se puede editar libremente**: su título, sus fechas, su nivel, sus '
    + 'cargos.',
  'help.running-an-election.changing-it.b1':
    '**Una elección publicada no se puede editar.** Sus fechas son lo que se le dijo a la '
    + 'familia, y moverlas cambiaría lo que una papeleta era en vez de corregir una errata.',
  'help.running-an-election.changing-it.b2':
    '**Volver a borrador** devuelve una elección publicada, y se ofrece solo mientras nadie '
    + 'ha sido nominado y no se ha votado nada. En cuanto alguien ha actuado, la elección es '
    + 'el registro de algo que la familia hizo: déjela correr, o elimínela.',
  'help.running-an-election.changing-it.b3':
    '**Eliminar** quita la elección con todas las nominaciones y todos los votos que tiene, '
    + 'y no se puede deshacer. La confirmación dice cuántos hay de cada cosa.',
  'help.running-an-election.changing-it.b4':
    'Eliminar una región o un capítulo al que está limitada una elección se rechaza '
    + 'mientras la elección existe: cambie primero el alcance de la elección a toda la '
    + 'familia, o elimínela. Nada sobre la forma de la familia puede cambiar en silencio '
    + 'quién tenía derecho a votar.',
  // ──── PART 6 — Administration (Settings) ──────────────────────────────────────
  'help.family-settings.title': 'Configuración',
  'help.family-settings.summary':
    'El nombre de la familia, el código con el que se unen los familiares, el plan que '
    + 'tiene y cómo desactivarla.',
  'help.family-settings.bands.heading': 'Tres secciones',
  'help.family-settings.bands.b0':
    'La página son tres secciones, que se eligen en el menú de la parte superior. '
    + '**Facturación** es lo que su familia ha pagado a GENORRA, hasta cuándo, y todos los '
    + 'recibos. **Plan** es en qué suscripción está esta familia, qué incluye cada una, y '
    + 'dónde se pasa de una a otra. **Familia** es la familia en sí: su nombre, el código con '
    + 'el que se unen los familiares, y cómo desactivarla.',
  'help.family-settings.bands.b1':
    'Configuración abre en **Plan**, porque es la sección que la mayoría de la gente viene '
    + 'a mirar o a cambiar.',
  'help.family-settings.bands.b2':
    'Pagar un plan se cubre en [Pagar un plan](/help/plans#paying); esta página es donde '
    + 'están los controles.',
  'help.family-settings.name.heading': 'El nombre de la familia',
  'help.family-settings.name.b0':
    'Cómo se llama la familia en todo el producto. Renombrarla no cambia nada más: el '
    + 'código, los integrantes y todos los registros se quedan exactamente como estaban.',
  'help.family-settings.code.heading': 'El código familiar',
  'help.family-settings.code.b0':
    'Seis caracteres, generados cuando se creó la familia, y permanentes. No se puede '
    + 'cambiar ni volver a generar.',
  'help.family-settings.code.b1':
    'Cualquiera que tenga el código puede pedir unirse, así que trátelo como una invitación '
    + 'y no como una contraseña; y recuerde que pedir no es unirse. Todas las solicitudes '
    + 'llegan a la cola de aprobaciones para que alguien decida.',
  'help.family-settings.plan.heading': 'El plan',
  'help.family-settings.plan.b0':
    'La sección **Plan**, con la que abre Configuración, muestra en qué plan está la '
    + 'familia, cuánto cuesta cada uno al mes, y qué incluye. **Funciones** en cualquier fila '
    + 'abre la lista completa de ese plan. Vea [Planes](/help/plans).',
  'help.family-settings.plan.b1':
    '**Todas las filas de plan llevan su propio botón.** Una fila por encima de la que '
    + 'usted tiene dice **Mejorar a …** y empieza el pago; una fila por debajo dice **Bajar a '
    + '…**. La fila en la que ya está dice **Plan actual** y no hace nada. Un plan que tiene '
    + 'precio y todavía no está a la venta muestra **Muy pronto** en vez de un botón.',
  'help.family-settings.plan.b2':
    'Bajar pide su contraseña además de una confirmación, porque cierra páginas para todos '
    + 'los integrantes de la familia a la vez. No se elimina nada en ninguno de los dos '
    + 'casos.',
  'help.family-settings.plan.b3':
    '**Bajar es también la forma de dejar de pagar.** Bajar a Gratis termina un plan '
    + 'mensual al final del periodo que ya ha pagado: no hay un control aparte de «dejar de '
    + 'renovar», porque dejar de pagar y elegir dónde se detiene son una sola decisión. La '
    + 'confirmación nombra la fecha en que surte efecto.',
  'help.family-settings.billing.heading': 'Pagar el plan',
  'help.family-settings.billing.b0':
    '**Facturación** es lo que su familia ha pagado de hecho: qué plan, el día hasta el que '
    + 'está pagado, el día en que vence el próximo pago, y si algo lo renueva. Nada de ahí '
    + 'empieza un pago: los botones que lo hacen están en las filas de plan de **Plan**, y '
    + 'abren la propia página de Stripe. Nada en esta pantalla recibe un número de tarjeta.',
  'help.family-settings.billing.b1':
    '**«Próximo pago» significa dos cosas distintas y la fila de al lado dice cuál.** En un '
    + 'plan mensual es el día en que se carga la tarjeta automáticamente. En un plan pagado '
    + 'por adelantado no hay nada que lo renueve, así que es el día en que se cierran las '
    + 'páginas a menos que alguien vuelva a comprar.',
  'help.family-settings.billing.b2':
    '**Todas las familias se facturan el día 1.** El primer pago es solo lo que queda del '
    + 'mes en curso, calculado por día y redondeado hacia arriba, así que entrar el día 20 '
    + 'cuesta unos días y no un mes, y todos los pagos posteriores caen en el día 1.',
  'help.family-settings.billing.b3':
    '**Si lo que queda del mes suma menos de 5 $, el primer pago cubre este mes y el '
    + 'siguiente.** Un cargo de un dólar o dos no merece aparecer en un extracto de tarjeta, '
    + 'y por debajo de unos 50 centavos una red de tarjetas no lo acepta en absoluto. La '
    + 'pantalla dice qué opción se le está ofreciendo y por qué.',
  'help.family-settings.billing.b4':
    'Hay dos formas de pagar y una sola tarifa. **Mensual** se renueva hasta que usted lo '
    + 'detiene. **Por adelantado** es un solo pago que cubre lo que queda de este mes más los '
    + 'meses completos que quiera, hasta 60, que también puede cambiar en la página de '
    + 'Stripe. No hay descuento por pagar por adelantado y no hay precio anual: un año por '
    + 'adelantado son doce meses a la tarifa mensual.',
  'help.family-settings.billing.b5.i0.term': 'Subir',
  'help.family-settings.billing.b5.i0.text':
    'Surte efecto en el momento. Si había pagado por adelantado en un plan más barato, lo '
    + 'que quedaba de aquello se valora a la tarifa que pagó y se gasta primero en el plan '
    + 'nuevo, así que a menudo no hay nada que pagar, y lo que sobre se guarda como crédito '
    + 'para su próxima factura. Nunca se le factura la diferencia de todo el periodo que pagó '
    + 'por adelantado.',
  'help.family-settings.billing.b5.i1.term': 'Bajar',
  'help.family-settings.billing.b5.i1.text':
    'No cuesta nada y no cambia nada hoy. Surte efecto el día 1: el siguiente si paga '
    + 'mensualmente, o el día 1 después de que se agote el periodo que pagó por adelantado. '
    + 'Seis meses de Plus, bajados en el segundo mes, son Plus del mes dos al seis y el plan '
    + 'más barato a partir del mes siete. No hay reembolso, que es exactamente lo que '
    + 'mantiene esas páginas abiertas hasta que termina.',
  'help.family-settings.billing.b6':
    '**Nada se otorga por pulsar un botón aquí.** El plan cambia cuando el pago se liquida, '
    + 'que puede ser un momento después, así que si la banda todavía muestra el plan antiguo '
    + 'justo después de pagar, dele un minuto y recargue. Si un pago falla, esta sección lo '
    + 'dice y nada de lo que su familia pueda alcanzar cambia mientras Stripe siga intentando '
    + 'la tarjeta.',
  'help.family-settings.billing.b7':
    '**Tarjetas y recibos** abre el propio portal de facturación de Stripe, donde se cambia '
    + 'la tarjeta registrada y se puede descargar cualquier factura. **Lo que GENORRA ha '
    + 'cobrado** enumera aquí los mismos pagos: qué se compró, cuándo se pagó, qué cubre y '
    + 'cuánto.',
  'help.family-settings.billing.b8':
    'Estos son los cargos de GENORRA a su familia y están deliberadamente muy lejos del '
    + 'dinero de su propia familia. Nada de esta sección aparece en sus fondos, en su [Estado '
    + 'de resultados](/reporting/pl-summary), en su proyección de cuotas ni en el historial '
    + 'de pagos de ningún integrante: lo que su familia nos paga y lo que sus familiares '
    + 'pagan a su familia son dos libros separados.',
  'help.family-settings.billing.b9':
    '**Para dejar de pagar, baje a Gratis en la sección [Plan](/admin/settings).** Eso '
    + 'termina un plan mensual al final del periodo ya pagado, nunca de inmediato. Todas las '
    + 'páginas siguen abiertas hasta entonces.',
  'help.family-settings.billing.b10':
    '**Lo que el plan más barato no incluye se conserva después durante sesenta días, y luego '
    + 'se elimina.** Nada desaparece el día en que baja. Se le recuerda treinta, quince, cinco '
    + 'y un día antes, y volver a subir dentro de esos sesenta días lo encuentra todo '
    + 'exactamente donde estaba: vea [qué pasa con sus '
    + 'registros](/help/family-settings#retention).',
  'help.family-settings.removal.heading': 'Quitar la familia',
  'help.family-settings.removal.b0':
    '**Quitar esta familia**, al final de la sección **Familia**, desactiva la familia '
    + 'entera. Nadie puede abrirla, el código familiar deja de funcionar, y cualquier '
    + 'invitación que siga pendiente deja de aceptarse. Se ofrece solo a alguien cuya '
    + 'plantilla de permisos otorga **Quitar familia**, que es distinto del permiso que le '
    + 'deja renombrar la familia.',
  'help.family-settings.removal.b1':
    'No se elimina nada. Todos los pagos, fondos, fotografías, eventos, mensajes, '
    + 'documentos y personas se quedan exactamente donde están. Quitar cierra las puertas de '
    + 'la familia; no destruye ningún registro.',
  'help.family-settings.removal.b2':
    '**La facturación se detiene, y esa parte no se puede revertir.** Su plan de GENORRA no se renovará: sigue vigente hasta el final del periodo que ya pagó, y no se reembolsa nada. A cada miembro que paga sus cuotas automáticamente se le cancela ese pago en Stripe de inmediato, y no se pueden reactivar: recuperar la familia restaura todos los registros, pero cada familiar que pagaba automáticamente tendrá que volver a configurarlo. Es el mismo compromiso que supone [desconectar Stripe](/help/accounting#processing), y existe por la misma razón: lo que puede deshacer oculta algo que no puede.',
  'help.family-settings.removal.b3':
    'Son dos pasos. **Enviarme un código de retirada** envía seis dígitos a la dirección '
    + 'con la que usted inicia sesión, no a una dirección que escriba y no a nadie más. '
    + '**Introducir el código y quitar** pide después esos dígitos y una confirmación. El '
    + 'código dura quince minutos, funciona una vez, y se cancela solo tras cinco intentos '
    + 'fallidos; pida otro con **Enviar otro código**.',
  'help.family-settings.removal.b4':
    'A los integrantes de una familia retirada no se los deja adivinando. Iniciar sesión '
    + 'muestra una pantalla que dice que la familia se retiró y que no se eliminó nada, [Mis '
    + 'familias](/my-families) la enumera con una marca de **Retirada**, y el menú de familia '
    + 'de la parte superior de la página también la marca; así que una cuenta que pertenece a '
    + 'más de una familia sigue en las otras exactamente como antes.',
  'help.family-settings.removal.b5':
    '**Solo el soporte de GENORRA puede recuperar una familia.** No hay ningún botón para '
    + 'eso en ninguna parte del producto, y a propósito: una familia que pudiera revertir su '
    + 'propia retirada no habría sido retirada. Si fue un error, escriba al soporte y pídalo.',
  // ──── PART 7 — Money (Summary, Payment history, Transactions, P&L Summary) ────
  'help.part.money.title': 'Dinero',
  'help.part.money.blurb':
    'Lo que usted debe, lo que ha ingresado la familia y cómo está configurado.',
  'help.summary.title': 'Resumen',
  'help.summary.summary':
    'Su situación de un vistazo: lo que debe, lo que ha pagado, qué campañas están abiertas '
    + 'y qué tiene la familia.',
  'help.summary.what-it-is.heading': 'Un compendio, no una pantalla propia',
  'help.summary.what-it-is.b0':
    '[Resumen](/accounting/summary) muestra el titular de cada una de las cuatro cosas que '
    + 'tiene debajo y nombra dónde está el resto. Nada vive solo aquí: todas las cifras '
    + 'tienen una pantalla detrás, a la que se llega desde el enlace al lado de su encabezado '
    + 'o desde la sección **Contabilidad** del menú lateral.',
  'help.summary.what-it-is.b1.i0.term': 'Situación de la cuenta / Próximas cuotas',
  'help.summary.what-it-is.b1.i0.text':
    'Lo que usted debe y a cuánto asciende el próximo pago. Completo en '
    + '[Cuotas](/accounting/dues-and-donations).',
  'help.summary.what-it-is.b1.i1.term': 'Pagado este año',
  'help.summary.what-it-is.b1.i1.text':
    'Su total del año, desglosado por programa. Completo en [Historial de '
    + 'pagos](/accounting/payment-history).',
  'help.summary.what-it-is.b1.i2.term': 'Campañas de donación abiertas',
  'help.summary.what-it-is.b1.i2.text':
    'Las campañas que siguen en marcha. Las cerradas se cuentan aquí y se enumeran en '
    + '[Donaciones](/accounting/dues-and-donations?pane=donations).',
  'help.summary.what-it-is.b1.i3.term': 'Fondos de la familia',
  'help.summary.what-it-is.b1.i3.text':
    'Todos los fondos que mantiene la familia y lo que tiene cada uno. Este no tiene '
    + 'pantalla aparte.',
  'help.summary.what-you-see.heading': 'Por qué puede faltar una sección',
  'help.summary.what-you-see.b0':
    'Cada una de las cuatro se otorga por separado, y Resumen muestra solo las que usted '
    + 'tiene. Una sección que no puede ver es una que su familia no le ha dado: vea [Quién '
    + 'puede hacer qué](/help/who-can-do-what). Si no tiene ninguna, la página lo dice en vez '
    + 'de mostrarle encabezados vacíos.',
  'help.summary.what-you-see.b1':
    'Sea lo que sea lo que se le ha otorgado, las cifras de dinero de aquí son suyas. Nada '
    + 'en esta página muestra las cuotas, los pagos ni las donaciones de otro integrante. '
    + 'Fondos de la familia es la excepción en su naturaleza y no en su privacidad: el saldo '
    + 'de un fondo pertenece a toda la familia, y no nombra a nadie.',
  'help.payment-history.title': 'Historial de pagos',
  'help.payment-history.summary':
    'Todo lo registrado a su nombre, con su fecha, importe, método y estado.',
  'help.payment-history.the-list.heading': 'La lista',
  'help.payment-history.the-list.b0':
    '[Historial de pagos](/accounting/payment-history) son todos los pagos que la familia ha '
    + 'registrado a su nombre: cuotas y donaciones en una sola lista, con cada fila '
    + 'etiquetada según lo que era. Cualquier encabezado de columna ordena, y el cuadro '
    + '**Filtrar** reduce por programa, método o estado.',
  'help.payment-history.the-list.b1':
    'Está en **Contabilidad** en el menú lateral, debajo de **Cuotas y donaciones** — '
    + 'las dos son la misma pregunta a dos escalas: lo que usted debe y lo que ha pagado. '
    + '[Transacciones](/reporting/transactions) es su equivalente para toda la familia y '
    + 'está en **Informes**. Las dos son el dinero leído de vuelta — esta es la suya, esa '
    + 'es la de la familia — mientras que [Contabilidad](/admin/accounting) es donde se '
    + 'configura en primer lugar.',
  'help.payment-history.the-list.b2':
    'Pulsar una fila abre la entrada completa: el número de cheque o la referencia, '
    + 'cualquier nota, y la fecha en que se registró, que no es lo mismo que la fecha en que '
    + 'se pagó, y que suele ser lo que explica por qué algo acaba de aparecer.',
  'help.payment-history.reversals.heading': 'Correcciones',
  'help.payment-history.reversals.b0':
    'Un pago introducido mal no se edita ni se elimina. Se registra una entrada correctora '
    + 'contra él con un importe negativo, y las dos se quedan en la lista, así que el '
    + 'registro se explica solo en vez de cambiar en silencio.',
  'help.payment-history.reversals.b1':
    '**Exonerado** significa que la familia canceló lo que se debía y no que se movió '
    + 'dinero. El importe sigue mostrándose, porque se descuenta de su saldo, y un saldo que '
    + 'baja sin ninguna cifra en ninguna parte que lo respalde es un saldo que usted no puede '
    + 'comprobar.',
  'help.transactions.title': 'Transacciones',
  'help.transactions.summary':
    'Los cinco libros de la familia: dinero que entra, dinero que sale, y dinero que se '
    + 'mueve entre fondos.',
  'help.transactions.ledgers.heading': 'Los cinco libros',
  'help.transactions.ledgers.b0':
    '[Transacciones](/reporting/transactions) está en **Informes** en el menú lateral, '
    + 'porque leer el libro mayor de vuelta es lo que la pantalla es sobre todo. '
    + '[Historial de pagos](/accounting/payment-history) es el que está en '
    + '**Contabilidad**: sus propios pagos en vez del registro completo de la familia. Es '
    + 'un menú de cinco pestañas, una por cada tipo de entrada.',
  'help.transactions.ledgers.b1.i0.term': 'Cuotas',
  'help.transactions.ledgers.b1.i0.text': 'Cuotas pagadas por los integrantes.',
  'help.transactions.ledgers.b1.i1.term': 'Donaciones',
  'help.transactions.ledgers.b1.i1.text': 'Aportaciones a una campaña.',
  'help.transactions.ledgers.b1.i2.term': 'Aportaciones',
  'help.transactions.ledgers.b1.i2.text':
    'Dinero que llega a un fondo, asignado ahí automáticamente o registrado a mano.',
  'help.transactions.ledgers.b1.i3.term': 'Desembolsos',
  'help.transactions.ledgers.b1.i3.text': 'Dinero pagado desde un fondo.',
  'help.transactions.ledgers.b1.i4.term': 'Traspasos',
  'help.transactions.ledgers.b1.i4.text':
    'Dinero movido de un fondo a otro. Suma cero en toda la familia; lo que cambia es qué '
    + 'bolsa lo tiene.',
  'help.transactions.ledgers.b2':
    'Cada pestaña se otorga por separado, así que una familia puede dejar que alguien '
    + 'registre cuotas sin dejarle pagar dinero. Una pestaña que no puede ver es una que no '
    + 'le han dado.',
  'help.transactions.recording.heading': 'Registrar algo',
  'help.transactions.recording.b0':
    'Cada libro tiene su propio botón arriba a la derecha — **Nuevo pago de cuota**, '
    + '**Nuevo pago de donación**, **Nueva aportación**, **Nuevo desembolso**, **Nuevo '
    + 'traspaso** — que abre un formulario para ese tipo de entrada: quién, cuánto, para qué '
    + 'y cómo se pagó. La persona y el fondo vienen de selectores y no de texto libre, así '
    + 'que nada aterriza a nombre de alguien que no existe.',
  'help.transactions.recording.b1':
    'Registrar es un permiso propio en cada libro: poder ver un libro no le permite '
    + 'añadirle nada.',
  'help.transactions.reversals.heading': 'Corregir un pago',
  'help.transactions.reversals.b0':
    'Un pago registrado no se edita ni se elimina: **Revertir** en su fila registra una '
    + 'entrada correctora contra él, y el original queda marcado como revertido. Las dos '
    + 'entradas se quedan, así que el historial se explica solo.',
  'help.transactions.reversals.b1':
    'Revertir es un permiso propio, deliberadamente separado de registrar.',
  'help.p-and-l-summary.title': 'Estado de resultados',
  'help.p-and-l-summary.summary':
    'Lo que la familia ha recaudado, lo que ha pagado, y lo que tiene cada fondo.',
  'help.p-and-l-summary.what-it-is.heading': 'Qué responde',
  'help.p-and-l-summary.what-it-is.b0':
    'El estado de la familia, en una página: todo lo que ha entrado, todo lo que ha salido, '
    + 'y la diferencia entre las dos cosas. [Transacciones](/reporting/transactions) es el '
    + 'libro entrada por entrada del que esto es un resumen, y [Proyección de '
    + 'cuotas](/reporting/dues-projections) es lo que todavía se debe; esta pantalla es solo '
    + 'sobre dinero que de hecho se ha movido.',
  'help.p-and-l-summary.what-it-is.b1':
    '**Todas las cifras son desde el principio.** No hay ningún rango de fechas que fijar: '
    + 'la página cuenta todas las entradas que la familia haya registrado, desde la primera. '
    + 'La línea de la parte superior de la página lo dice, y vale la pena leerla antes de que '
    + 'una cifra vaya a un informe.',
  'help.p-and-l-summary.what-it-is.b2':
    'Esta pantalla se llamaba **Finanzas familiares** hasta agosto de 2026. No se movió '
    + 'nada de ella excepto el nombre y su lugar en el menú lateral: ahora está en '
    + '**Informes**, con las demás pantallas que leen el dinero de vuelta.',
  'help.p-and-l-summary.three-lines.heading': 'Las tres cifras de arriba',
  'help.p-and-l-summary.three-lines.b0.i0.term': 'Ingresos',
  'help.p-and-l-summary.three-lines.b0.i0.text':
    'Todo lo recaudado. Cuotas y donaciones juntas — las dos son pagos registrados a nombre '
    + 'de un integrante — más las aportaciones hechas directamente a un fondo. Las dos cosas '
    + 'se desglosan debajo de la cifra.',
  'help.p-and-l-summary.three-lines.b0.i1.term': 'Gastos',
  'help.p-and-l-summary.three-lines.b0.i1.text':
    'Dinero desembolsado de un fondo. Ese es el único tipo de salida que este producto '
    + 'registra, así que es todo lo que se ha gastado.',
  'help.p-and-l-summary.three-lines.b0.i2.term': 'Superávit neto',
  'help.p-and-l-summary.three-lines.b0.i2.text':
    'Ingresos menos gastos. Dice **Déficit neto** y se pone en rojo cuando ha salido más de '
    + 'lo que ha entrado.',
  'help.p-and-l-summary.three-lines.b1':
    'Una reversión se corrige sola aquí. Revertir un pago en '
    + '[Transacciones](/reporting/transactions) registra una entrada opuesta, y se cuentan '
    + 'tanto el pago como su reversión, así que el ingreso vuelve a donde le corresponde en '
    + 'vez de contar dos veces la corrección.',
  'help.p-and-l-summary.unrouted.heading': 'Recaudado, todavía sin asignar a un fondo',
  'help.p-and-l-summary.unrouted.b0':
    'Las cuotas llegan como un pago y luego se **asignan** a uno o más fondos según las '
    + 'reglas configuradas en [Contabilidad](/admin/accounting). Cuando ninguna regla cubre '
    + 'un programa, el dinero se recauda y no queda en ningún fondo, y esta línea es cuánto.',
  'help.p-and-l-summary.unrouted.b1':
    'No es un error y no se muestra como tal. El dinero está sin asignar hasta que alguien '
    + 'lo asigna, y una familia que funciona con una sola bolsa y sin ninguna asignación '
    + 'funciona perfectamente bien. Está aquí para que una familia que *quería* asignar algo '
    + 'pueda ver que no lo hizo.',
  'help.p-and-l-summary.unrouted.b2':
    'La cifra puede decir **Asignado por encima de los ingresos por cuotas**, que es la '
    + 'misma línea al revés: un administrador puede aportar directamente a un fondo, así que '
    + 'puede haber entrado en los fondos más de lo que las cuotas trajeron nunca.',
  'help.p-and-l-summary.funds.heading': 'Saldos de los fondos, y por qué no suman la cifra neta',
  'help.p-and-l-summary.funds.b0':
    '**Saldos de los fondos hoy** es lo que tiene cada fondo ahora mismo. **Superávit '
    + 'neto** son los ingresos menos los gastos de toda la historia de la familia. Son dos '
    + 'tipos de número distintos y no se espera que coincidan.',
  'help.p-and-l-summary.funds.b1':
    'Tres cosas ordinarias las separan: cuotas que nunca se asignaron a un fondo, '
    + 'aportaciones hechas directamente a uno, y traspasos entre fondos. Ninguna de las tres '
    + 'es una falla, y la página lo dice en vez de dejar que alguien intente conciliar las '
    + 'dos y concluya que una está mal.',
  'help.p-and-l-summary.funds.b2':
    '**Ingresos asignados a los fondos**, en medio, muestra a dónde fue el dinero asignado, '
    + 'fondo por fondo; abrir una fila lo desglosa según de dónde vino.',
  // ──── PART 7 — Money (Dues & Donations) ───────────────────────────────────────
  'help.my-dues.title': 'Cuotas y donaciones',
  'help.my-dues.summary':
    'Todos los programas en los que está y cuánto tiene que ser el próximo pago, y todas '
    + 'las campañas que su familia tiene en marcha.',
  'help.my-dues.what-it-is.heading': 'Dos paneles, una pantalla',
  'help.my-dues.what-it-is.b0':
    '[Cuotas y donaciones](/accounting/dues-and-donations) responde una pregunta en dos '
    + 'direcciones: qué le pide su familia, y a qué le invita a contribuir. **Cuotas** son '
    + 'todos los programas en los que está; **Donaciones** son todas las campañas que la '
    + 'familia tiene en marcha. Pulse cualquiera de las dos en el menú de arriba.',
  'help.my-dues.what-it-is.b1':
    'Eran dos pantallas separadas hasta el 20-08-2026. Un enlace o un marcador a cualquiera '
    + 'de las dos sigue encontrando el dinero de la familia: empiece por '
    + '[Resumen](/accounting/summary), que abre con las dos.',
  'help.my-dues.what-it-is.b2':
    'Ninguno de los dos paneles muestra nunca las cuotas ni las donaciones de otra persona, '
    + 'sea lo que sea lo que se le haya otorgado. Todas las cifras de la pantalla son o un '
    + 'total de la familia o las suyas. Lo que ha pagado la familia en su conjunto es otra '
    + 'pregunta, que se hace en [Transacciones](/reporting/transactions).',
  'help.my-dues.schedules.heading': 'Sus programas',
  'help.my-dues.schedules.b0':
    'El panel **Cuotas** enumera todos los programas en los que está, en dos tablas: '
    + '**Cuotas obligatorias**, que deben todas las personas que están en ellas, y **Cuotas '
    + 'opcionales**, que usted decide asumir o rechazar. Cada fila dice cuánto cuesta el '
    + 'programa al año, cuánto tiene que ser el próximo pago, cuándo vence, y qué queda. Las '
    + 'dos tarjetas de arriba son las mismas con las que abre [Resumen](/accounting/summary).',
  'help.my-dues.schedules.b1':
    'Usted solo ve una tabla en la que tiene algún programa. Una familia que no tiene '
    + 'cuotas opcionales muestra una tabla y ningún encabezado vacío, así que una tabla de '
    + '**Cuotas opcionales** que falta significa que no hay ninguna para usted, no que algo '
    + 'no se cargó.',
  'help.my-dues.schedules.b2':
    '**Todos los programas en los que está siguen enumerados, incluidos los que ya ha '
    + 'liquidado.** Una cuota que ha pagado por completo dice **Pagada** y muestra un saldo '
    + 'de cero en vez de desaparecer: las tablas son en qué está, y lo que todavía debe es la '
    + 'tarjeta **A pagar ahora** que hay debajo.',
  'help.my-dues.schedules.b3':
    'Una fila sombreada y marcada **Atrasada** es una que el calendario ya ha pedido y que '
    + 'el dinero no ha cubierto. Es un indicador y no una advertencia: ir atrasado no es un '
    + 'error, y el próximo pago simplemente lleva la puesta al día.',
  'help.my-dues.schedules.b4':
    'Aparecen otros dos indicadores al lado del nombre de un programa. **Rechazada** es una '
    + 'cuota opcional de la que se ha dado de baja. **Aún no vence** es una cuota que empieza '
    + 'a una edad que usted no ha alcanzado: vea [Cuotas que empiezan a una edad](#age).',
  'help.my-dues.next-payment.heading': 'Su próximo pago',
  'help.my-dues.next-payment.b0': 'Dos cifras están una al lado de la otra y no son lo mismo.',
  'help.my-dues.next-payment.b1.i0.term': 'Cuota fraccionada',
  'help.my-dues.next-payment.b1.i0.text': 'Lo que cuesta un pago una vez que está al día.',
  'help.my-dues.next-payment.b1.i1.term': 'Próximo vencimiento',
  'help.my-dues.next-payment.b1.i1.text':
    'Cuánto tiene que ser el próximo pago, que incluye todo lo que el calendario ya ha '
    + 'pedido y que el dinero no ha cubierto.',
  'help.my-dues.next-payment.b2':
    'Así que pasarse a mensual a mitad de año en un programa de 600 $ hace que el próximo '
    + 'pago sea grande y todos los siguientes ordinarios: la puesta al día se cobra una vez y '
    + 'usted vuelve a estar al día. La puesta al día está marcada, y es un indicador y no una '
    + 'advertencia: ir atrasado no es un error.',
  'help.my-dues.cadence.heading': 'Cambiar la frecuencia con la que paga',
  'help.my-dues.cadence.b0':
    'Cada programa tiene una frecuencia de pago que usted fija para sí mismo: semanal, '
    + 'mensual, trimestral, anual, o de una sola vez. El total anual no cambia; la frecuencia '
    + 'lo divide. La que tiene se imprime debajo del importe en la fila.',
  'help.my-dues.cadence.b1':
    'Para cambiarla, abra el menú de la fila — el botón del extremo derecho — y pulse '
    + '**Cambiar la frecuencia de pago**. El diálogo pone precio a las cinco antes de que '
    + 'elija una: cuánto cuesta cada fracción y, cuando un cambio lo dejaría poniéndose al '
    + 'día, cuánto sería el pago inmediato siguiente.',
  'help.my-dues.cadence.b2':
    'Esto es suyo para fijarlo y no necesita permiso de nadie. Nadie más puede fijarlo por '
    + 'usted.',
  'help.my-dues.pay-online.heading': 'Pagar con tarjeta',
  'help.my-dues.pay-online.b0':
    'Una vez que su familia ha conectado un procesador de tarjetas, todas las cuotas que '
    + 'todavía debe llevan un botón **Pagar** en su propia fila. Se abre con el importe que '
    + 'vence ahora ya puesto — cámbielo si quiere pagar más o liquidar la cuota entera — y lo '
    + 'lleva a la propia página de Stripe para introducir su tarjeta.',
  'help.my-dues.pay-online.b1':
    'El pago se registra en los libros de la familia en cuanto se liquida. No hay nada que '
    + 'un tesorero tenga que teclear después, y aparece en su propio historial de pagos junto '
    + 'a cualquier cosa registrada a mano.',
  'help.my-dues.pay-online.b2':
    '**Configurar pagos automáticos**, en el menú de la fila, inicia un pago con tarjeta '
    + 'permanente para esa cuota a la frecuencia que ya haya elegido. Sigue esa frecuencia en '
    + 'vez de volver a preguntar, así que [cambiar su frecuencia](#cadence) es la forma de '
    + 'cambiar lo que se cobra. Cada cuota es aparte: configurar una no dice nada sobre las '
    + 'demás. Una cuota que ha configurado dice **Automática** en su fila, con lo que se '
    + 'cobra y con qué frecuencia.',
  'help.my-dues.pay-online.b3':
    'Los pagos automáticos son solo para cuotas. Una campaña de donación es un regalo, y '
    + 'aceptar dar una vez no es aceptar dar todos los meses; así que a las campañas se les '
    + 'da de una en una desde el panel **Donaciones**.',
  'help.my-dues.pay-online.b4':
    '**Detener los pagos automáticos**, en el mismo menú, los termina de inmediato, y todo '
    + 'lo ya pagado se queda en su registro. No hay nada que cancelar en otro sitio.',
  'help.my-dues.pay-online.b5':
    'Que no haya ningún botón **Pagar** en ninguna parte significa que su familia todavía '
    + 'no ha conectado un procesador, o que Stripe sigue comprobando la cuenta. Pregunte a '
    + 'quien lleve la contabilidad de su familia — es la sección **Cobros** de '
    + '[Contabilidad](/admin/accounting) — y pague por los medios que su familia ya use '
    + 'mientras tanto.',
  'help.my-dues.due-now.heading': 'Pagar todo a la vez',
  'help.my-dues.due-now.b0':
    '**A pagar ahora**, debajo de las dos tablas, enumera todas las cuotas que tienen algo '
    + 'que pagar y a cuánto asciende cada una, y luego el total. Es lo que pagaría para estar '
    + 'completamente al día hoy, puestas al día incluidas, y una línea que lleva una lo dice '
    + 'debajo de sí misma.',
  'help.my-dues.due-now.b1':
    '**Pagar … con tarjeta** cobra todo en un solo pago con tarjeta. La página de Stripe lo '
    + 'desglosa, una línea por cuota, así que puede ver para qué es cada parte del total '
    + 'antes de comprometerse, y llega a los libros de la familia dividido de la misma forma, '
    + 'una entrada por programa.',
  'help.my-dues.due-now.b2':
    'El diálogo enumera todas las cuotas con su propio importe, así que puede cambiar '
    + 'cualquiera antes de pagar. Ponga una a cero para dejarla fuera de este pago; se queda '
    + 'exactamente donde estaba.',
  'help.my-dues.due-now.b3':
    'Si su familia no ha conectado un procesador de tarjetas, **A pagar ahora** sigue '
    + 'sumándolo todo: simplemente lo dice en vez de ofrecer un botón. La cifra es la misma '
    + 'que hay que entregar por cheque.',
  'help.my-dues.age.heading': 'Cuotas que empiezan a una edad',
  'help.my-dues.age.b0':
    'Una familia puede decir que una cuota empieza cuando un integrante llega a una edad '
    + 'determinada. Hasta entonces se queda al final de su lista marcada **Aún no vence**, '
    + 'con la fecha en que empieza y nada que pagar.',
  'help.my-dues.age.b1':
    'El año en que llega a esa edad se cobra por meses, y el mes de su cumpleaños es '
    + 'gratis: una cuota anual de 120 $ y un decimoctavo cumpleaños en julio son 50 $ ese '
    + 'año, y después 120 $ todos los años. La fila lo dice: **50 $ este año · 120 $/año '
    + 'después**.',
  'help.my-dues.age.b2':
    'Alguien sin fecha de nacimiento registrada debe la cuota completa, porque el producto '
    + 'no adivina una edad. Si una cuota suya debería estar reducida y no lo está, compruebe '
    + 'su cumpleaños en [Mi perfil](/personal-info).',
  'help.my-dues.bloodline-dues.heading': 'Cuotas que solo debe la línea de sangre',
  'help.my-dues.bloodline-dues.b0':
    'Una familia puede limitar una cuota a los integrantes que descienden de su línea: un '
    + 'fondo funerario para la línea, una parcela en el cementerio. Si una de las cuotas de '
    + 'su familia funciona así y usted entró en la familia por matrimonio, no es suya y no '
    + 'aparece en esta pantalla en absoluto.',
  'help.my-dues.bloodline-dues.b1':
    'Eso es deliberado y no una omisión: una cuota que nunca deberá, enumerada como algo '
    + 'que usted no está pagando, sería una nota permanente sobre cómo entró en la familia, '
    + 'en su propia pantalla. Lo que debe es lo que hay aquí.',
  'help.my-dues.chapter-dues.heading': 'Cuotas de una región o un capítulo',
  'help.my-dues.chapter-dues.b0':
    'Una familia puede vincular una cuota a una región o a un capítulo: un local que '
    + 'alquila el capítulo de Texas, una beca que financia la región del Este. Si una cuota '
    + 'de su familia pertenece a una parte de la familia en la que usted no está, no es suya '
    + 'y no aparece en esta pantalla, por el mismo motivo que no aparece una cuota solo para '
    + 'la línea de sangre.',
  'help.my-dues.chapter-dues.b1':
    'Su capítulo está en [Mi perfil](/personal-info), y usted lo fija. **Si no ha elegido '
    + 'ninguno está bajo Nacional**: debe todas las cuotas de toda la familia y ninguna '
    + 'regional ni de capítulo. Así que si esperaba que la cuota de un capítulo apareciera '
    + 'aquí y no lo ha hecho, lo primero que hay que comprobar es que su perfil diga en qué '
    + 'capítulo está.',
  'help.my-dues.opt-out.heading': 'Darse de baja',
  'help.my-dues.opt-out.b0':
    '**Darse de baja**, en el menú de una fila de la tabla **Cuotas opcionales**, dice que '
    + 'el programa no le corresponde: un fondo del que no forma parte, un capítulo al que no '
    + 'pertenece. Le pide confirmación, y **Volver a darse de alta** en el mismo menú lo '
    + 'revierte. Solo una cuota opcional lo ofrece; nada de la tabla **Cuotas obligatorias** '
    + 'se puede rechazar.',
  'help.my-dues.opt-out.b1':
    'Darse de baja no es lo mismo que haber pagado. Quita el programa de su saldo de aquí '
    + 'en adelante; no borra lo que ya se debía.',
  'help.my-dues.drives.heading': 'Qué muestra una campaña',
  'help.my-dues.drives.b0':
    'El panel **Donaciones** de [Cuotas y '
    + 'donaciones](/accounting/dues-and-donations?pane=donations) enumera todas las campañas '
    + 'que la familia ha hecho, cada una con una barra que muestra lo que ha avanzado. Debajo '
    + 'de la barra: lo que se ha recaudado, cuál era la meta y — solo si usted ha dado a esa '
    + 'campaña — cuánto de eso fue suyo.',
  'help.my-dues.drives.b1':
    'Una campaña que ha pasado su meta sigue adelante en vez de detenerse en el 100 %: la '
    + 'barra se reescala y el exceso se muestra como su propio segmento, porque una campaña '
    + 'que dobló su objetivo no debería parecerse a una que llegó por los pelos.',
  'help.my-dues.drives.b2':
    'Una campaña sin meta fijada no tiene barra que dibujar, así que muestra el total '
    + 'acumulado.',
  'help.my-dues.closed.heading': 'Campañas cerradas',
  'help.my-dues.closed.b0':
    'Una campaña que ha pasado su fecha de fin queda marcada como **Cerrada** y atenuada, y '
    + 'se queda en esta página. [Resumen](/accounting/summary) enumera solo las abiertas y '
    + 'cuenta el resto: un compendio es sobre qué hacer a continuación, y esta página es el '
    + 'registro completo.',
  'help.my-dues.giving.heading': 'Dar a una campaña',
  'help.my-dues.giving.b0':
    '**Dar**, en una campaña abierta, lo lleva a la propia página de Stripe para introducir '
    + 'su tarjeta. Escriba lo que quiera dar — no hay un importe fijo ni un máximo, y la '
    + 'campaña le dice qué cumpliría su meta si la tiene. Se registra en los libros de la '
    + 'familia en cuanto se liquida, y aparece en su [historial de '
    + 'pagos](/accounting/payment-history) junto a cualquier cosa registrada a mano.',
  'help.my-dues.giving.b1':
    'Se da a una campaña a la vez y nunca de forma recurrente, que es la diferencia con '
    + 'pagar cuotas. Aceptar dar una vez no es aceptar dar todos los meses, y dar a una '
    + 'campaña no dice nada sobre las demás.',
  'help.my-dues.giving.b2':
    'Una aportación va entera al fondo de **Donaciones** de su familia. No se reparte entre '
    + 'fondos como se reparte un pago de cuotas: vea [Fondos](/help/accounting#funds).',
  'help.my-dues.giving.b3':
    'Una campaña que ha cumplido su meta sigue aceptando aportaciones, y una que está '
    + '**Cerrada** no acepta ninguna. Una campaña cerrada no muestra ningún botón **Dar** '
    + 'porque su total ya no puede moverse.',
  'help.my-dues.giving.b4':
    'Que no haya ningún botón **Dar** en ninguna campaña significa que su familia todavía '
    + 'no ha conectado un procesador de tarjetas. Entregue su aportación a quien lleve los '
    + 'libros y aparecerá aquí en cuanto la registre.',
  'help.my-dues.giving.b5':
    'Nada en esta página dice quién dio qué. Todas las cifras son o un total de la familia '
    + 'o las suyas.',
  // ──── PART 7 — Money (Dues Projections) ───────────────────────────────────────
  'help.dues-projections.title': 'Proyección de cuotas',
  'help.dues-projections.summary':
    'Lo que la familia debería recaudar este año, lo que ha entrado, y quién sigue '
    + 'debiendo.',
  'help.dues-projections.what-it-is.heading': 'Qué responde',
  'help.dues-projections.what-it-is.b0':
    '[Transacciones](/reporting/transactions) es lo que entró. Esto es lo que debería: '
    + 'todos los programas de cuotas activos, multiplicados por los integrantes que los '
    + 'deben, frente a lo que se ha recaudado de hecho.',
  'help.dues-projections.what-it-is.b1':
    'Nada en esta pantalla cambia nada. Registrar un pago o exonerar uno está en '
    + '[Transacciones](/reporting/transactions); cambiar cuánto cuesta una cuota está en '
    + '[Contabilidad](/admin/accounting).',
  'help.dues-projections.what-it-is.b2':
    '**Un familiar que ha fallecido no se cuenta.** Poner una **Fecha de fallecimiento** en '
    + 'el perfil de alguien lo saca de esta pantalla por completo: no debe nada, así que ni '
    + 'el total que se le debe a la familia ni la lista de quién tiene que pagar todavía lo '
    + 'incluyen. Los pagos que hizo en el pasado siguen contando en lo recaudado.',
  'help.dues-projections.figures.heading': 'Las cuatro cifras',
  'help.dues-projections.figures.b0.i0.term': 'Previsto este año',
  'help.dues-projections.figures.b0.i0.text':
    'Lo que deben los integrantes contados aquí por los periodos actuales de sus programas. '
    + 'Todo lo demás de la pantalla es una fracción de esa cifra.',
  'help.dues-projections.figures.b0.i1.term': 'Recaudado',
  'help.dues-projections.figures.b0.i1.text':
    'Dinero que llegó de verdad. Una reversión se compensa sola, así que un pago corregido '
    + 'deja la cifra donde le corresponde.',
  'help.dues-projections.figures.b0.i2.term': 'Exonerado',
  'help.dues-projections.figures.b0.i2.text':
    'Perdonado. Liquida la cuota y se descuenta de lo que todavía se debe, y nunca se '
    + 'cuenta como dinero, porque no llegó ninguno.',
  'help.dues-projections.figures.b0.i3.term': 'Falta recaudar',
  'help.dues-projections.figures.b0.i3.text':
    'Lo previsto, menos lo que se ha liquidado de una forma u otra. La cifra por la que '
    + 'existe la pantalla.',
  'help.dues-projections.figures.b1':
    'Aparece una quinta solo cuando hay algo: dinero **pendiente de liquidación**, que es '
    + 'un pago iniciado y todavía sin confirmar. No se cuenta como recaudado y no se ha '
    + 'descontado de lo que se debe.',
  'help.dues-projections.year.heading': 'Qué año',
  'help.dues-projections.year.b0':
    'El de cada programa. Una cuota anclada al 1 de abril y un gravamen anclado al 1 de '
    + 'enero tienen de verdad dos años en curso, así que todas las filas indican el periodo '
    + 'sobre el que se midieron y el total de la familia es la suma de ellas.',
  'help.dues-projections.year.b1':
    'Por eso los totales de aquí coinciden con lo que cada integrante ve en su propia '
    + 'pantalla de [Cuotas](/accounting/dues-and-donations). Un único año natural habría sido '
    + 'más ordenado y habría estado en desacuerdo con el saldo de cada integrante.',
  'help.dues-projections.who-is-counted.heading': 'Quién se cuenta',
  'help.dues-projections.who-is-counted.b0':
    'Todas las personas que la familia ha aprobado, la misma lista que muestra el '
    + '[Directorio de integrantes](/community/directory). Alguien registrado en el [árbol '
    + 'familiar](/community/family-tree) que nunca ha iniciado sesión debe sus cuotas '
    + 'exactamente igual que cualquier otra persona, así que se cuenta. Dejarlos fuera nunca '
    + 'hizo la deuda más pequeña: hizo que esta pantalla informara de una más pequeña.',
  'help.dues-projections.who-is-counted.b1':
    'La columna **Estado** responde una pregunta distinta de la del dinero: si hay alguien '
    + 'a quien enviarle una factura.',
  'help.dues-projections.who-is-counted.b2.i0.term': 'Activo',
  'help.dues-projections.who-is-counted.b2.i0.text':
    'Tiene cuenta, y la cuota se muestra en su propia pantalla de '
    + '[Cuotas](/accounting/dues-and-donations).',
  'help.dues-projections.who-is-counted.b2.i1.term': 'Invitado',
  'help.dues-projections.who-is-counted.b2.i1.text':
    'Todavía sin cuenta, y hay una invitación abierta. La familia ha preguntado, y la '
    + 'pelota está en su tejado.',
  'help.dues-projections.who-is-counted.b2.i2.term': 'Invitación pendiente',
  'help.dues-projections.who-is-counted.b2.i2.text':
    'Registrado en la familia y nunca se le pidió que se uniera. Este es el único de los '
    + 'tres sobre el que usted puede actuar: invítelo desde el [árbol '
    + 'familiar](/community/family-tree).',
  'help.dues-projections.who-is-counted.b3':
    'Una invitación que ha **vencido** se lee como Invitación pendiente y no como Invitado. '
    + 'Un enlace vencido no se puede aceptar, así que la familia tiene que volver a '
    + 'preguntar, y decir otra cosa informaría de un trabajo como hecho.',
  'help.dues-projections.who-is-counted.b4':
    '**Falta recaudar** dice debajo de sí misma cuánto de esa cifra lo deben personas sin '
    + 'cuenta. Eso es parte del total y nunca una deducción de él: a la familia se le debe el '
    + 'dinero haya o no un buzón al que enviarle la factura.',
  'help.dues-projections.who-is-counted.b5':
    'Cinco cosas reducen lo que alguien debe, y las cinco se respetan: una cuota que '
    + 'empieza a una edad, una cuota que solo debe la línea de sangre, una cuota de una '
    + 'región o un capítulo, una cuota opcional que ha rechazado, y cualquier cosa que la '
    + 'familia haya exonerado.',
  'help.dues-projections.who-is-counted.b6':
    'Cualquiera sin fecha de nacimiento registrada debe una cuota limitada por edad en su '
    + 'totalidad, porque nunca se adivina una edad. Si una cifra parece demasiado alta, eso '
    + 'es lo primero que hay que comprobar.',
  'help.dues-projections.who-is-counted.b7':
    'Alguien que todavía espera aprobación **no** se cuenta. Todavía no se ha unido a la '
    + 'familia, así que no debe nada.',
  'help.dues-projections.standings.heading': 'Cómo está cada integrante',
  'help.dues-projections.standings.b0':
    'La tabla de integrantes empieza por las personas a las que hay que reclamar. Una fila '
    + 'informa de la situación **menos** liquidada que ese integrante tiene en cualquier '
    + 'programa, así que alguien al día en tres cuotas y que debe una cuarta se enumera como '
    + 'que debe.',
  'help.dues-projections.standings.b1.i0.term': 'Nada pagado',
  'help.dues-projections.standings.b1.i0.text': 'Debe el importe completo de este periodo.',
  'help.dues-projections.standings.b1.i1.term': 'Pagado en parte',
  'help.dues-projections.standings.b1.i1.text': 'Algo ha entrado, no todo.',
  'help.dues-projections.standings.b1.i2.term': 'Liquidado',
  'help.dues-projections.standings.b1.i2.text': 'Pagado por completo, o perdonado.',
  'help.dues-projections.standings.b1.i3.term': 'Rechazado',
  'help.dues-projections.standings.b1.i3.text': 'Se dio de baja de una cuota opcional.',
  'help.dues-projections.standings.b1.i4.term': 'Aún no vence',
  'help.dues-projections.standings.b1.i4.text':
    'Por debajo de la edad a la que empieza esa cuota. No es lo mismo que liquidado: no ha '
    + 'pagado nada y no debe nada.',
  'help.dues-projections.standings.b1.i5.term': 'No le corresponde',
  'help.dues-projections.standings.b1.i5.text':
    'La cuota está limitada a la línea de sangre y este integrante está fuera de ella. A '
    + 'diferencia de «Aún no vence», nunca pasará a corresponderle.',
  'help.dues-projections.standings.b1.i6.term': 'En otra parte',
  'help.dues-projections.standings.b1.i6.text':
    'La cuota es de una región o un capítulo y esa persona está en otro, o en ninguno, lo '
    + 'que la deja bajo Nacional. A diferencia de «No le corresponde», esta situación cambia '
    + 'si cambia de capítulo.',
  'help.dues-projections.standings.b2':
    '**Situación** y **Estado** son dos columnas distintas, y la fila que vale la pena '
    + 'mirar es una que es a la vez Nada pagado e Invitación pendiente. La situación es sobre '
    + 'el dinero; el estado es sobre si se le puede pedir a alguien.',
  'help.dues-projections.standings.b3':
    'Una cuota solo para la línea de sangre en una familia que no ha nombrado su línea no '
    + 'la debe nadie, y su fila lo dice en vez de mostrar un 0,00 $ previsto sin explicación.',
  'help.dues-projections.standings.b4':
    '**Solo quienes deben** reduce la tabla, y el cuadro de filtro busca en cualquier parte '
    + 'de cualquier nombre.',
  'help.dues-projections.reminders.heading': 'Recordatorios automáticos',
  'help.dues-projections.reminders.b0':
    'Con un plan Premium el producto envía por correo a cada integrante un recordatorio '
    + 'cuando vence un plazo, y la franja de la parte superior de esta página es donde se '
    + 've si están llegando. Es el único lugar que lo indica — nada más en el producto '
    + 'menciona un recordatorio después de que ha salido.',
  'help.dues-projections.reminders.b1.i0.term': 'Enviados',
  'help.dues-projections.reminders.b1.i0.text':
    'Salió. A nadie se le recuerda dos veces el mismo plazo.',
  'help.dues-projections.reminders.b1.i1.term': 'Pendiente de envío',
  'help.dues-projections.reminders.b1.i1.text':
    'En cola, y la próxima ejecución diaria lo tomará.',
  'help.dues-projections.reminders.b1.i2.term': 'Ya pagado',
  'help.dues-projections.reminders.b1.i2.text':
    'El plazo se liquidó después de poner el recordatorio en cola, así que nunca se '
    + 'envió. Es el producto negándose a reclamar a alguien un dinero que la familia ya '
    + 'tenía, y no es un fallo.',
  'help.dues-projections.reminders.b1.i3.term': 'Sin dirección',
  'help.dues-projections.reminders.b1.i3.text':
    'El familiar tiene una dirección de relleno en lugar de una real, así que no hay '
    + 'adónde enviarlo. Tampoco es un fallo — y es el único estado sobre el que merece la '
    + 'pena actuar.',
  'help.dues-projections.reminders.b1.i4.term': 'Fallidos',
  'help.dues-projections.reminders.b1.i4.text':
    'Se intentó el envío y fue rechazado. Se reintenta en ejecuciones posteriores.',
  'help.dues-projections.reminders.b2':
    '**No se les puede contactar por correo** nombra a los familiares que están detrás de '
    + 'la cifra Sin dirección, porque un recuento dice que el problema existe y un nombre '
    + 'es lo que permite resolverlo. Invitarles desde el [árbol '
    + 'familiar](/community/family-tree), o añadir una dirección a su ficha, es la '
    + 'solución — y vale la pena mucho más allá de las cuotas, ya que un familiar sin '
    + 'dirección no recibe nada de lo que envía la familia.',
  'help.dues-projections.reminders.b3':
    'Un recordatorio no lleva ninguna consecuencia asociada. No hay recargo por demora, '
    + 'ni bloqueo, ni escalada de avisos en ninguna parte de este producto — es un correo '
    + 'que dice que vence un plazo. Lo que una familia debe a GENORRA por su propio plan '
    + 'es algo completamente distinto, y eso sí tiene consecuencias: vea '
    + '[Configuración](/admin/settings).',
  'help.dues-projections.reminders.b4':
    'La franja es Premium. En cualquier otro plan no hay recordatorios sobre los que '
    + 'informar, así que está ausente en lugar de vacía — y solo se muestra a quien puede '
    + 'ver la Contabilidad de la familia, porque cómo la familia reclama su dinero es '
    + 'asunto de la tesorería.',
  // ──── PART 7 — Money (Membership, Accounting) ─────────────────────────────────
  'help.membership.title': 'Membresía',
  'help.membership.summary':
    'Integrantes por región y capítulo, quién ha terminado de unirse, y adultos frente a '
    + 'menores.',
  'help.membership.what-it-is.heading': 'Qué responde',
  'help.membership.what-it-is.b0':
    'De qué está compuesta la familia hoy. El [Directorio de '
    + 'integrantes](/community/directory) enumera a sus familiares uno por uno; esto los '
    + 'cuenta: dónde están, cuántos han terminado de unirse, y cuántos son niños.',
  'help.membership.what-it-is.b1':
    'Nada de aquí se guarda. Todas las cifras se calculan cuando la página se carga, así '
    + 'que siempre es la respuesta de hoy y no hay ningún historial con el que comparar.',
  'help.membership.what-it-is.b2':
    '**Quién se cuenta:** todos los integrantes que la familia ha aprobado, y nadie más. '
    + 'Alguien que todavía espera en [Aprobaciones pendientes](/admin/members) no se ha unido '
    + 'aún, y un familiar registrado como fallecido tampoco se cuenta. Un familiar que nunca '
    + 'ha iniciado sesión *sí* se cuenta: forma parte de la familia tenga cuenta o no, que es '
    + 'la misma regla que usa [Proyección de cuotas](/reporting/dues-projections), así que '
    + 'las dos pantallas siempre coinciden en el tamaño de la familia.',
  'help.membership.drilling-in.heading': 'Pulsar una fila para ver quién está en ella',
  'help.membership.drilling-in.b0':
    '**Todas las filas al lado de todos los gráficos se abren.** Pulse una y enumera a las '
    + 'personas que contó, con un cuadro de filtro en cuanto hay más de unas pocas. Eso '
    + 'incluye las filas que el gráfico plegó en **Otros** y las que están a cero, porque la '
    + 'tabla al lado de un gráfico siempre enumera todos los segmentos.',
  'help.membership.drilling-in.b1':
    'Es la FILA y no el segmento del anillo: un anillo dibuja cinco segmentos y pliega el '
    + 'resto, así que la fila es lo único que puede abrir todos y cada uno. También es un '
    + 'botón de verdad, así que se puede alcanzar con el tabulador y pulsar con el teclado.',
  'help.membership.drilling-in.b2':
    '**Los nombres se piden cuando usted pulsa, y no antes.** Los gráficos en sí llevan '
    + 'recuentos y nombres de lugares y ningún nombre de persona, y por eso este informe no '
    + 'es una pantalla solo para administradores. Abrir una fila pide ese grupo y solo ese.',
  'help.membership.drilling-in.b3':
    'Necesita el [Directorio de integrantes](/community/directory) además de este informe '
    + 'para ver quién está en un grupo. Una familia que ha restringido el Directorio ha '
    + 'decidido quién puede leer los nombres de sus integrantes, y un gráfico no lo rodea: si '
    + 'tiene uno y no el otro, las cifras se abren y los nombres no.',
  'help.membership.putting-it-right.heading': 'Corregir lo que un gráfico está señalando',
  'help.membership.putting-it-right.b0':
    '**Tres de los cuatro gráficos ofrecen una corrección cada uno, en la fila que la '
    + 'necesita.** Cada una es la misma acción que usa la pantalla que la posee, así que '
    + 'todas las reglas que esa pantalla impone valen también aquí.',
  'help.membership.putting-it-right.b1.i0.term': 'Sin capítulo, y Nacional',
  'help.membership.putting-it-right.b1.i0.text':
    'Fije el capítulo de esa persona. Su región lo sigue: no hay una región aparte que '
    + 'fijar, porque una región es una propiedad del capítulo. Sus hijos e hijas menores de '
    + 'dieciocho años sin cuenta propia se mueven con ella, exactamente como en [Mi '
    + 'perfil](/personal-info).',
  'help.membership.putting-it-right.b1.i1.term': 'Invitación pendiente, e Invitado',
  'help.membership.putting-it-right.b1.i1.text':
    'Envíele una invitación. Pide una dirección de correo real, porque un familiar sin '
    + 'cuenta tiene una provisional que no puede recibir correo. Pulsarlo en una fila de '
    + 'Invitado envía una invitación nueva, que es lo que significa reclamar una sin '
    + 'respuesta.',
  'help.membership.putting-it-right.b1.i2.term': 'Cumpleaños sin registrar',
  'help.membership.putting-it-right.b1.i2.text':
    'Registre su fecha de nacimiento. Adulto o menor se calcula a partir de ella cada vez '
    + 'que el informe se carga; nada sobre su edad se guarda.',
  'help.membership.putting-it-right.b2':
    '**Solo esas filas ofrecen algo**, y eso es deliberado: alguien que ya está en el '
    + 'capítulo de Austin no es un problema del que el gráfico esté informando, y a '
    + '**Activo** no se le puede invitar porque ya puede iniciar sesión. Una fila sin nada '
    + 'que corregir se abre igual y enumera igual.',
  'help.membership.putting-it-right.b3':
    '**Una persona a la vez.** No hay un botón de «archivar a todas estas en Austin», '
    + 'porque cada una de estas cosas es una afirmación sobre una persona — en qué capítulo '
    + 'está de verdad, cuándo nació de verdad, si pedirle que se una — y fijar un capítulo '
    + 'mueve con ella a sus hijos pequeños.',
  'help.membership.putting-it-right.b4':
    'Las dos correcciones son dos permisos. Fijar un capítulo y registrar un cumpleaños '
    + 'necesitan permiso para editar integrantes; enviar una invitación necesita permiso para '
    + 'editar el árbol familiar. Si una fila enumera personas y no ofrece ningún control, el '
    + 'panel dice cuál de los dos no se le ha dado.',
  'help.membership.places.heading': 'Por región y por capítulo',
  'help.membership.places.b0':
    'Dos desgloses, uno encima del otro en la estructura de la familia. **A nivel '
    + 'nacional**, arriba, es toda la familia: esa cifra es aquello de lo que todos los '
    + 'porcentajes de la página son una parte.',
  'help.membership.places.b1':
    '**Nacional** también aparece como un segmento del desglose por regiones, y significa '
    + 'lo mismo ahí: la ausencia de una región. Alguien que no está en ningún capítulo, y '
    + 'alguien cuyo capítulo no se ha puesto en una región, están los dos bajo Nacional. '
    + '**Sin capítulo** es el segmento equivalente en el desglose por capítulos.',
  'help.membership.places.b2':
    '**Todos los capítulos que la familia ha creado se enumeran, incluido cualquiera al que '
    + 'nadie se haya unido.** Un capítulo a cero suele ser la fila que vale la pena mirar: o '
    + 'todavía no se ha puesto a nadie en él, o ya no hace falta. Las regiones y los '
    + 'capítulos se configuran en [Miembros](/admin/members), en su pestaña **Organización**.',
  'help.membership.places.b3':
    'Cuando hay más lugares de los que el gráfico puede mostrar con claridad, dibuja los '
    + 'cinco más grandes y pliega el resto en **Otros**, diciendo a cuántos representa. La '
    + 'tabla al lado del gráfico siempre los enumera todos.',
  'help.membership.invitations.heading': 'Quién ha terminado de unirse',
  'help.membership.invitations.b0':
    'Los mismos tres estados de los que informa [Proyección de '
    + 'cuotas](/reporting/dues-projections), contados en vez de enumerados.',
  'help.membership.invitations.b1.i0.term': 'Activo',
  'help.membership.invitations.b1.i0.text': 'Tiene cuenta y puede iniciar sesión.',
  'help.membership.invitations.b1.i1.term': 'Invitado',
  'help.membership.invitations.b1.i1.text':
    'Todavía sin cuenta, y hay una invitación abierta y sin responder. La familia ha '
    + 'preguntado; la pelota está en su tejado.',
  'help.membership.invitations.b1.i2.term': 'Invitación pendiente',
  'help.membership.invitations.b1.i2.text':
    'Registrado en la familia y nunca se le pidió que se uniera. Este es el único sobre el '
    + 'que puede actuar: pulse la fila e invítelo desde ahí, o desde el [árbol '
    + 'familiar](/community/family-tree).',
  'help.membership.invitations.b2':
    '**Pueden iniciar sesión**, en la parte superior de la página, es la cifra de Activos '
    + 'con otro nombre, y **Nunca invitados**, a su lado, aparece solo cuando hay alguien en '
    + 'el tercer grupo. Entre las dos dicen a qué parte de la familia se puede llegar de '
    + 'hecho, que es la cifra que hay que mirar antes de enviar algo a todo el mundo.',
  'help.membership.invitations.b3':
    'Una invitación que ha **vencido** cuenta como Invitación pendiente y no como Invitado. '
    + 'Un enlace vencido no se puede aceptar, así que la familia tiene que volver a '
    + 'preguntar.',
  'help.membership.ages.heading': 'Adultos y menores',
  'help.membership.ages.b0':
    'Se calcula a partir de la fecha de nacimiento de cada integrante, cada vez que la '
    + 'página se carga, así que es correcto la mañana de un cumpleaños y no necesita que se '
    + 'mantenga nada al día.',
  'help.membership.ages.b1':
    '**Cumpleaños sin registrar** es su propio segmento, y no se pliega en ninguno de los '
    + 'otros dos. La mayoría de los árboles familiares tienen bastantes familiares sin '
    + 'cumpleaños registrado, y contarlos como adultos informaría de una precisión que los '
    + 'registros no tienen.',
  'help.membership.ages.b2':
    'Ese segmento vale la pena vigilarlo si la familia tiene una cuota que empieza a una '
    + 'edad: un integrante sin fecha de nacimiento la debe completa, porque nunca se adivina '
    + 'una edad.',
  'help.accounting.title': 'Contabilidad',
  'help.accounting.summary':
    'Configurar programas de cuotas, campañas de donación, fondos, asignación y logros.',
  'help.accounting.what-it-is.heading': 'Configuración, no el trabajo del día',
  'help.accounting.what-it-is.b0':
    '[Contabilidad](/admin/accounting) es donde el dinero se *configura*. Registrar un pago '
    + 'real se hace en [Transacciones](/reporting/transactions), en **Contabilidad** en el '
    + 'menú lateral. Cada sección de aquí es su propio permiso, así que mantener el programa '
    + 'de cuotas y pagar dinero son trabajos distintos.',
  'help.accounting.what-it-is.b1':
    'El menú de la parte superior de la página contiene **Cuotas**, **Donaciones**, '
    + '**Fondos**, **Asignación**, **Logros**, **Cobros** y **Datos bancarios**. Cada uno se '
    + 'otorga por separado, así que usted ve los que se le han dado y ninguno más: un menú '
    + 'con tres elementos no es una falla. Los botones **Cuota nueva** y **Donación nueva** '
    + 'están junto al menú en sus propias páginas, y aparecen solo donde usted puede añadir a '
    + 'esa lista.',
  'help.accounting.what-it-is.b2':
    '**Siguen siendo dos permisos separados, y compartir un panel no cambió nada de eso.** '
    + 'Una familia que deja que alguien mantenga el programa de cuotas pero no dirija las '
    + 'campañas de donación otorga uno y no el otro, y esa persona ve una lista, un botón, y '
    + 'un elemento del menú nombrado por la mitad que tiene. Es una sola pantalla porque las '
    + 'dos cosas se leen juntas, no porque sean un solo trabajo: vea [Quién puede hacer '
    + 'qué](/help/who-can-do-what#one-template).',
  'help.accounting.dues.heading': 'Cuotas',
  'help.accounting.dues.b0':
    'Un programa de cuotas es lo que un integrante debe a lo largo de un año: un nombre, un '
    + 'importe, con qué frecuencia se factura originalmente, y en qué fondo aterriza. Los '
    + 'integrantes eligen después su propia frecuencia dentro de él.',
  'help.accounting.dues.b1':
    'La fecha de inicio importa. Ancla la escalera de fechas de vencimiento, y el '
    + 'formulario pone hoy por defecto, lo cual está bien y merece un momento de reflexión si '
    + 'está introduciendo el programa del año pasado.',
  'help.accounting.dues.b2':
    '**Los integrantes empiezan a pagar a la edad de** es la forma en que una familia dice '
    + 'que los niños no pagan. Déjelo en blanco y todos deben la cuota sea cual sea su edad. '
    + 'Ponga 18 y un integrante no debe nada hasta que cumple 18, después los meses de ese '
    + 'año posteriores a su cumpleaños, y después el importe completo todos los años: una '
    + 'cuota de 120 $ y un cumpleaños en julio son 50 $ ese año. La fila lo muestra como '
    + '**Desde los 18 años**.',
  'help.accounting.dues.b3':
    'Un integrante sin fecha de nacimiento registrada debe la cuota completa, porque el '
    + 'producto no adivina una edad. Añadir un niño al [árbol '
    + 'familiar](/community/family-tree) sin dirección de correo pide una fecha de nacimiento '
    + 'exactamente por este motivo.',
  'help.accounting.dues.b4':
    '**Quién la debe** acota una cuota por el linaje, y tiene tres respuestas. **Todos '
    + 'los integrantes** es la opción predeterminada. **Solo el linaje** la restringe a '
    + 'los familiares marcados como parte de la línea de la familia — quien se casó con '
    + 'la familia no debe nada y no la ve en su propia pantalla de Cuotas, porque una '
    + 'cuota que nunca es suya no se enumera como algo que no está pagando. **Solo los '
    + 'familiares que se casaron con la familia** es el espejo de eso, para una familia '
    + 'que aplica una cuota a sus descendientes y otra distinta a los demás.',
  'help.accounting.dues.b5':
    'El control no está disponible hasta que alguien de su familia haya sido marcado '
    + 'como parte de su linaje. Marque **está en el linaje de la familia** en la tarjeta '
    + 'de un familiar en el [árbol familiar](/community/family-tree) primero. Quien debe '
    + 'la cuota es exactamente quien está marcado, así que marcar a alguien más tarde lo '
    + 'añade — y sin nadie marcado, **Solo el linaje** no la debería nadie mientras que '
    + '**Solo los familiares que se casaron con la familia** la deberían todos, por lo '
    + 'que la elección se retiene hasta que la pregunta tenga respuesta.',
  'help.accounting.dues.b6':
    '**Dónde llega un pago** decide a qué fondo va el dinero. Déjelo en **Repartir '
    + 'entre los fondos** y una cuota pagada se divide según su tabla de '
    + '[Encaminamiento](/admin/accounting), que es lo que hacía cada calendario antes de '
    + 'que esto existiera. Elija un fondo en su lugar y el pago COMPLETO va allí y se '
    + 'omite el encaminamiento — que es lo que quiere una cuota recaudada para una sola '
    + 'cosa, para que el saldo del fondo responda cuánto se ha recaudado para ella.',
  'help.accounting.dues.b7':
    'Este NO se congela cuando ya hay pagos, a diferencia del importe y de **Quién la '
    + 'debe**. Solo decide dónde va el PRÓXIMO pago; nada de lo que ya está en un fondo '
    + 'se mueve. Y si más tarde elimina el fondo, el calendario vuelve discretamente a '
    + 'repartirse entre los fondos — así que si una cuota tiene que llegar a un sitio en '
    + 'concreto, compruébelo después de quitar cualquier fondo.',
  'help.accounting.dues.b8':
    '**Lo deben** dice qué parte de la familia la debe: Nacional — toda la familia — o una '
    + 'región, o un capítulo. Solo aparece cuando su familia tiene una región o un capítulo '
    + 'que elegir; hasta entonces todas las cuotas son Nacionales, que es lo que significa '
    + 'Nacional. Un integrante sin capítulo está bajo Nacional y no debe nada limitado, así '
    + 'que una cuota de capítulo factura solo a las personas que han dicho que están en ese '
    + 'capítulo. Vea [regiones y capítulos](/help/regions-and-chapters#dues).',
  'help.accounting.dues.b9':
    'Un programa contra el que se ha pagado no se puede eliminar así de simple, y su '
    + 'importe, su frecuencia, su fecha de inicio, su edad de inicio, su ajuste de línea de '
    + 'sangre y **Lo deben** quedan entonces fijos: todos los pagos ya registrados se '
    + 'hicieron según esos términos. Cambiar quién debe una cuota reformularía si la gente la '
    + 'debía por periodos ya facturados, y por eso está en esa lista. La página le dice '
    + 'cuándo uno está en uso. La fecha de término todavía puede cambiar.',
  'help.accounting.donations.heading': 'Donaciones',
  'help.accounting.donations.b0':
    'Una campaña de donación es un objetivo al que la familia contribuye. Puede nombrar '
    + 'para quién es, que es lo que le pone una cara: «esto es para los gastos médicos de '
    + 'Martha» en vez de «Fondo general».',
  'help.accounting.funds.heading': 'Fondos',
  'help.accounting.funds.b0':
    'Los fondos son las bolsas en las que se guarda el dinero. Cada uno tiene un saldo, lo '
    + 'que ha entrado, y lo que ha salido.',
  'help.accounting.funds.b1':
    'El formulario de fondo nuevo pide un **Saldo mínimo**, y es la única cifra que de '
    + 'hecho hace algo: un pago que entra rellena cada fondo hasta su mínimo, en el orden '
    + 'fijado en **Asignación**, antes de que nada por debajo reciba una parte. Es la forma '
    + 'en que una familia dice «este no es para gastar». Déjelo en blanco para un fondo sin '
    + 'suelo, y cámbielo después en el panel de Asignación, donde está al lado del orden en '
    + 'que se rellenan los fondos.',
  'help.accounting.routing.heading': 'Asignación',
  'help.accounting.routing.b0':
    'La asignación decide cómo se reparte un pago que entra entre los fondos: 70 % al '
    + 'General, 30 % a Becas, y así. Fíjela una vez y todos los pagos registrados después la '
    + 'siguen, en vez de que alguien lo divida a mano cada vez.',
  'help.accounting.routing.b1':
    '**El fondo de Donaciones incorporado también puede llevarse una parte.** Está en la '
    + 'lista como cualquier otro fondo, así que una familia que quiere que parte de sus '
    + 'cuotas vaya a la bolsa general puede decirlo. Va último en prioridad, lo cual importa '
    + 'cuando no se ha fijado nada: la parte va al fondo que está arriba de la lista, y '
    + 'Donaciones nunca está arriba a menos que sea el único fondo que tiene su familia.',
  'help.accounting.routing.b2':
    'Una donación es distinta y no sigue esta tabla. Una donación va entera al fondo de '
    + 'Donaciones, que es para lo que ese fondo existe; la asignación es sobre las CUOTAS.',
  'help.accounting.milestones.heading': 'Logros',
  'help.accounting.milestones.b0':
    'Lo que la familia paga por una ocasión — una graduación, una boda, un fallecimiento — '
    + 'y de qué fondo sale. Ponerle precio de antemano es lo que convierte «normalmente damos '
    + 'algo» en una cifra sobre la que el tesorero puede actuar.',
  'help.accounting.processing.heading': 'Cobros',
  'help.accounting.processing.b0':
    '**Cobros** es donde su familia conecta su propia cuenta de Stripe, para que los '
    + 'familiares puedan pagar sus cuotas con tarjeta en vez de escribir un cheque. Pulse '
    + '**Conectar una cuenta de Stripe** y Stripe recoge todo lo que necesita en sus propias '
    + 'páginas; cuando vuelva, este panel dice si los pagos con tarjeta están activados.',
  'help.accounting.processing.b1':
    '**El país que elija decide en qué moneda cobra su familia.** El control **País** de '
    + 'este panel fija ambas cosas: elija Canadá y sus cuotas, sus fondos y los presupuestos '
    + 'de sus encuentros se registran en dólares canadienses, y a los familiares se les cobra '
    + 'en dólares canadienses. Es una sola decisión y no dos, así que el dinero que su '
    + 'familia pide y el dinero que llega a su banco son siempre la misma cifra.',
  'help.accounting.processing.b2':
    '**Ambas quedan fijadas en cuanto se registra un pago o se crea la cuenta de Stripe, y '
    + 'ninguna se puede deshacer.** Stripe no puede trasladar una cuenta conectada a otro '
    + 'país, y el libro contable de su familia no se puede volver a denominar después: cien '
    + 'filas que dicen $40 tendrían que significar dos cosas distintas. El panel dice cuál de '
    + 'las dos lo fijó. Elija el país antes de registrar su primer pago.',
  'help.accounting.processing.b3':
    '**La cuenta pertenece a su familia, no a GENORRA.** El dinero va directamente al banco '
    + 'de su familia, las comisiones de procesamiento de Stripe salen del lado de su familia, '
    + 'y su familia conserva su propio panel de Stripe, su propio calendario de pagos y sus '
    + 'propios reembolsos. GENORRA no se lleva ninguna parte de lo que su familia recauda.',
  'help.accounting.processing.b4':
    '**Nunca se le pedirá una clave de Stripe, y usted no debería dar ninguna a nadie.** '
    + 'GENORRA guarda solo el identificador de su cuenta: suficiente para enviarle un pago, e '
    + 'inútil por sí solo para cualquiera. Si alguna pantalla le pide que pegue una clave que '
    + 'empieza por `sk_`, no es este producto.',
  'help.accounting.processing.b5':
    'Un pago con tarjeta se registra en los libros de la familia en el momento en que se '
    + 'liquida y se reparte entre sus fondos según la misma tabla de **Asignación** que sigue '
    + 'un pago teclado a mano. Nadie tiene que introducirlo después, y aparece en '
    + '[Transacciones](/reporting/transactions) junto a todo lo demás.',
  'help.accounting.processing.b6':
    '**Comprobar con Stripe** le pregunta a Stripe por el estado actual de la cuenta, lo '
    + 'cual vale la pena pulsar si acaba de terminar algo de su lado. Hasta que diga que los '
    + 'pagos con tarjeta están activados, los integrantes no ven ninguna sección de **Pagar '
    + 'en línea**, que es mejor que un botón que falla una vez que alguien ha decidido pagar.',
  'help.accounting.processing.b7':
    '**Desconectar detiene también todos los pagos automáticos de los integrantes, y esos '
    + 'no se pueden reiniciar.** Volver a conectar trae de vuelta la misma cuenta de Stripe '
    + 'con su historial y sus datos bancarios exactamente como estaban, pero cada familiar '
    + 'que pagaba automáticamente tiene que volver a configurar su pago, porque el acuerdo se '
    + 'canceló en Stripe y no se puso en pausa. El panel dice a cuántas personas afecta antes '
    + 'de que usted confirme. Nada de lo ya registrado se quita, y la propia cuenta de Stripe '
    + 'de su familia no se toca: esto solo hace que GENORRA deje de usarla.',
  'help.accounting.processing.b8':
    '**Por eso mismo, desconectar pide dos cosas.** Primero su contraseña de inicio de '
    + 'sesión, para que no pueda ocurrir por accidente ni por alguien sentado ante una '
    + 'pantalla desbloqueada. Después un código de seis dígitos enviado a la dirección con la '
    + 'que usted inicia sesión, no a una dirección que escriba y no a nadie más. El código '
    + 'dura quince minutos, funciona una vez, y se cancela solo tras cinco intentos fallidos. '
    + 'Es la misma barrera que [quitar una familia](/help/family-settings#removal), y está '
    + 'ahí por el mismo motivo: la parte que se puede deshacer esconde una parte que no.',
  'help.accounting.processing.b9':
    'Si su familia se ha desconectado, el panel lo dice y el botón dice **Reconectar '
    + 'Stripe** en vez de **Conectar una cuenta de Stripe**, porque de verdad es la misma '
    + 'cuenta volviendo y no una nueva que se crea.',
  'help.accounting.processing.b10':
    '**Quién paga la comisión de Stripe es una decisión de su familia, y está en este '
    + 'panel.** Los pagos con tarjeta cuestan un porcentaje más unos centavos, cada vez. '
    + '**La familia la absorbe** es la opción predeterminada: a un familiar que debe $40 se '
    + 'le cobran $40, y la comisión sale de los fondos a los que se encaminó ese pago — así '
    + 'que los fondos reciben algo menos que el importe registrado. **El miembro la cubre** '
    + 'le cobra un poco más, de modo que los fondos reciben los $40 completos. El panel '
    + 'calcula el ejemplo con su propia tarifa mientras la escribe, porque el resultado no '
    + 'es el que casi nadie espera: subir $40 al 2,9% + 30c da $41,50, no $41,46, ya que la '
    + 'comisión también se aplica al cargo mayor.',
  'help.accounting.processing.b11':
    '**La tarifa que escribe solo sirve para calcular un cargo; nunca se usa como la '
    + 'comisión.** Lo que Stripe realmente cobró se lee de Stripe en cada pago, y esa es la '
    + 'cifra que usan sus libros. Así, una tarifa algo equivocada le cuesta a su familia unos '
    + 'centavos por pago en lugar de meter un número erróneo en el libro mayor — y el panel '
    + 'imprime lo que de verdad se ha cobrado junto a su tarifa declarada, que es la única '
    + 'forma en que alguien lo notaría.',
  'help.accounting.processing.b12':
    '**Aquí aparecen dos totales de comisiones y responden a preguntas distintas.** El '
    + 'primero es lo que GENORRA registró — las comisiones de los pagos que este producto '
    + 'asentó, que es lo que [Resumen de resultados](/reporting/pl-summary) cuenta como '
    + 'gasto. **Mostrar el total propio de Stripe para esta cuenta** se lo pregunta a '
    + 'Stripe, y será mayor si su familia ha usado su cuenta de Stripe para otra cosa, o si '
    + 'Stripe le cobra directamente a la cuenta por facturación mensual o herramientas '
    + 'antifraude. Esos cargos deliberadamente NO están en los libros de su familia: '
    + 'GENORRA nunca contó los ingresos con los que se relacionan, así que contar el costo '
    + 'haría que el informe estuviera mal en el otro sentido. Para la factura detallada, '
    + 'entre en su propio panel de Stripe.',
  'help.accounting.not-yet.heading': 'Datos bancarios',
  'help.accounting.not-yet.b0':
    'La sección existe en el menú y todavía no está conectada. Es donde vivirán los datos '
    + 'bancarios de la propia familia: la cuenta en la que se depositan las cuotas y desde la '
    + 'que se pagan los desembolsos. Hoy no se guarda nada en ella.',
  'help.accounting.not-yet.b1':
    'Conectar un procesador de tarjetas en **Cobros** no necesita esto, y no lo rellena: '
    + 'Stripe guarda los datos bancarios que usted le da, y esta sección es para anotar los '
    + 'números que un tesorero tendría que buscar si no para un cheque o una transferencia.',
  // ──── PART 8 — Community (Chat, Directory, Updates) ───────────────────────────
  'help.part.community.title': 'Comunidad',
  'help.part.community.blurb':
    'Hablar con la familia, y llevar la cuenta de quién es cada persona.',
  'help.chat.title': 'Chat',
  'help.chat.summary':
    'La sala de la familia, los mensajes privados y los grupos que usted mismo crea.',
  'help.chat.rooms.heading': 'Los tres tipos de sala',
  'help.chat.rooms.b0.i0.term': 'Familia',
  'help.chat.rooms.b0.i0.text':
    'Una sala, con todo el mundo dentro, creada para usted. No se puede abandonar ni '
    + 'eliminar.',
  'help.chat.rooms.b0.i1.term': 'Mensajes directos',
  'help.chat.rooms.b0.i1.text': 'Un hilo privado entre usted y otro integrante.',
  'help.chat.rooms.b0.i2.term': 'Mensajes de grupo',
  'help.chat.rooms.b0.i2.text':
    'Un hilo con nombre y con las personas que usted elija: una comisión organizadora, los '
    + 'primos que organizan un regalo.',
  'help.chat.rooms.b1':
    'Los mensajes llegan en vivo. Un punto al lado de una sala significa que hay algo en '
    + 'ella que usted no ha leído; abrir la sala lo quita.',
  'help.chat.dm.heading': 'Empezar un mensaje privado',
  'help.chat.dm.b0.i0': 'Pulse **Nuevo MD** en la parte superior de la lista de salas.',
  'help.chat.dm.b0.i1': 'Elija a la persona.',
  'help.chat.dm.b0.i2': 'Escriba y envíe. Entrar envía, Mayús+Entrar empieza una línea nueva.',
  'help.chat.dm.b1':
    'Solo aparecen en la lista los integrantes que tienen cuenta. Alguien registrado en el '
    + 'árbol familiar sin dirección de correo no tiene dónde recibir un mensaje: vea [Fichas '
    + 'y cuentas](/help/family-tree#records).',
  'help.chat.group.heading': 'Empezar un grupo',
  'help.chat.group.b0.i0': 'Pulse **Nuevo** al lado del encabezado **Mensajes de grupo**.',
  'help.chat.group.b0.i1': 'Póngale nombre: el nombre es lo que todos los demás verán en su lista.',
  'help.chat.group.b0.i2': 'Marque a las personas que incluir, y pulse **Crear grupo**.',
  'help.chat.group.b1':
    'Quien crea un grupo puede añadir y quitar integrantes después, desde el control de '
    + 'arriba a la derecha del hilo.',
  'help.chat.deleting.heading': 'Quitar una conversación',
  'help.chat.deleting.b0':
    'Un hilo de mensaje directo se puede eliminar de su lista. La sala de la familia no: es '
    + 'el único lugar donde siempre se puede alcanzar a toda la familia.',
  'help.directory.title': 'Directorio',
  'help.directory.summary': 'Todas las personas de la familia, con búsqueda, y cómo contactarlas.',
  'help.directory.searching.heading': 'Encontrar a alguien',
  'help.directory.searching.b0':
    'El cuadro de filtro coincide con el nombre, el apellido y el nombre preferido, e '
    + 'ignora los acentos y la puntuación: escribir **jose** encuentra a José, y **oconnor** '
    + 'encuentra a O’Connor.',
  'help.directory.columns.heading': 'Qué muestra la lista',
  'help.directory.columns.b0':
    'Cuatro columnas: **Nombre**, **Cargo**, **Capítulo**, y el **Grupo** en el que está la '
    + 'persona, que es la plantilla de permisos que decide lo que puede hacer. **Cargo** es '
    + 'el puesto de la directiva que ocupa, escrito completo — «tesorero nacional», '
    + '«presidente del capítulo de Austin» — y una raya para la mayoría de la familia, que no '
    + 'ocupa ninguno. En qué capítulo está alguien está en la fila; a qué REGIÓN pertenece '
    + 'ese capítulo está en su cuadro de detalle, porque la región se deduce del capítulo en '
    + 'vez de ser una respuesta aparte.',
  'help.directory.columns.b1':
    'Todo lo demás sobre una persona está detrás de su nombre. **Pulsar un nombre abre su '
    + 'ficha**: teléfono, correo, ciudad y estado, su capítulo y su región, su nombre '
    + 'preferido, su grupo, y si ya tiene cuenta. El nombre es un botón de verdad, así que '
    + 'alcanzarlo con el tabulador y pulsar Entrar abre el mismo panel que un clic.',
  'help.directory.columns.b2':
    'Teléfono, correo y ciudad tenían cada uno su propia columna hasta el 19-08-2026 y '
    + 'ahora están en ese panel. No se quitó nada y no se muestra nada nuevo: los mismos '
    + 'datos, a una pulsación en vez de a cinco columnas de ancho, que es lo que hace la '
    + 'lista legible en un teléfono.',
  'help.directory.columns.b3':
    'En una pantalla estrecha, Cargo, Capítulo y Grupo se pliegan debajo del nombre en vez '
    + 'de deslizarse por el lado, así que nada queda nunca aparcado fuera de la vista.',
  'help.directory.columns.b4':
    'Las personas registradas en el árbol familiar sin dirección de correo también aparecen '
    + 'aquí. Un tío abuelo registrado es integrante de la familia; simplemente no tiene '
    + 'cuenta, y su ficha lo dice.',
  'help.directory.tree.heading': 'De un nombre al árbol',
  'help.directory.tree.b0':
    'El botón **Árbol familiar** lo lleva al árbol, donde puede centrarse en cualquier '
    + 'persona y ver cómo se conecta. Es la misma pregunta desde el otro lado: el Directorio '
    + 'responde *quién*, el árbol responde *cómo están relacionados*.',
  'help.updates.title': 'Novedades',
  'help.updates.summary':
    'El archivo de todo lo que la familia ha anunciado y de todo lo que se le ha enviado a '
    + 'usted, y cómo funciona la búsqueda.',
  'help.updates.what-it-is.heading': 'Una lista, dos tipos de cosa',
  'help.updates.what-it-is.b0':
    'Novedades es el panel **Novedades** de [Anuncios](/community/announcements), y la '
    + 'versión larga de la tarjeta **Novedades recientes** de su [Panel](/dashboard). Esa '
    + 'tarjeta muestra las últimas pocas; esto las muestra todas, de la más nueva a la más '
    + 'antigua, y le permite buscar.',
  'help.updates.what-it-is.b1':
    'Tenía su propia fila de menú hasta el 19-08-2026 y ya no la tiene: las noticias de la '
    + 'familia viven en una sola pantalla. La dirección antigua sigue funcionando y aterriza '
    + 'en el panel, así que un enlace que alguien haya enviado sigue abriendo la lista '
    + 'correcta.',
  'help.updates.what-it-is.b2': 'Aparecen dos tipos de fila:',
  'help.updates.what-it-is.b3.i0.term': 'Anuncio',
  'help.updates.what-it-is.b3.i0.text':
    'Noticias de la familia que alguien publicó en el tablón. Abrirlo va a '
    + '[Anuncios](/community/announcements), que lleva el texto completo, excepto en el caso '
    + 'de un aviso sobre una elección, que va a la elección misma, porque el texto entero ya '
    + 'lo ha leído en la fila.',
  'help.updates.what-it-is.b3.i1.term': 'Enviado a usted',
  'help.updates.what-it-is.b3.i1.text':
    'Algo dirigido a usted personalmente: una tarea, una aprobación, un mensaje que espera. '
    + 'Son las mismas filas que la campana de la barra superior.',
  'help.updates.what-it-is.b4':
    'Nada de aquí es correo de otra persona. Las filas de «enviado a usted» son suyas y '
    + 'solo suyas, y son la misma lista que muestra la campana.',
  'help.updates.what-it-is.b5':
    'Abrir una fila no la marca como leída. De eso se encarga la campana, así que el número '
    + 'que lleva y esta página no pueden estar nunca en desacuerdo.',
  'help.updates.searching.heading': 'Buscar',
  'help.updates.searching.b0':
    'El único cuadro busca en el título y en el cuerpo de los dos tipos de fila, y busca en '
    + 'la base de datos y no en la página, así que alcanza todo, por atrás que esté.',
  'help.updates.searching.b1.i0':
    'Las palabras pueden ir en cualquier orden. Buscar **bloque hotel** encuentra «el '
    + 'bloque en el hotel».',
  'help.updates.searching.b1.i1':
    'Las terminaciones se gestionan: **habitaciones** encuentra «habitación», **reserva** '
    + 'encuentra «reservado», y **pago** encuentra «pagos».',
  'help.updates.searching.b1.i2':
    'Las palabras irregulares no: **pagando** no encuentra «pagado». Busque la palabra tal '
    + 'y como se habría escrito.',
  'help.updates.searching.b1.i3':
    'Ponga un **-** delante de una palabra para dejar fuera las filas que la contienen: '
    + '**reunión -cancelada**.',
  'help.updates.searching.b1.i4':
    'Una parte de una palabra no coincide: **reuni** no encuentra nada. Escriba la palabra '
    + 'completa.',
  'help.updates.searching.b2':
    'Los acentos se comparan de forma exacta aquí, a diferencia de las búsquedas de nombres '
    + 'del resto del producto: buscar «jose» no encontrará «José» en esta página.',
  'help.updates.searching.b3':
    'Una búsqueda es un enlace. La barra de direcciones lleva lo que buscó, así que puede '
    + 'enviárselo a alguien o usar el botón de atrás para recorrer varias.',
  'help.updates.older.heading': 'Ir más atrás',
  'help.updates.older.b0':
    '**Mostrar 25 más antiguas** añade otra página al final de la lista, y sigue hasta que '
    + 'no hay nada más antiguo. Desplazarse hacia atrás acaba deteniéndose, y la página lo '
    + 'dice cuando lo hace: en ese punto la búsqueda es lo que alcanza el resto, porque mira '
    + 'todas las filas y no solo las que están en pantalla.',
  'help.updates.older.b1':
    'El recuento debajo de la lista siempre dice cuántas filas está viendo, así que una '
    + 'lista corta nunca es una lista que se detuvo en silencio.',
  'help.updates.missing.heading': 'Si los anuncios no están en su lista',
  'help.updates.missing.b0':
    'La página lo dirá, encima de la lista. Los anuncios son el tablón de la familia y se '
    + 'otorgan por separado de sus propios mensajes, así que un integrante al que no se le ha '
    + 'dado el tablón ve solo lo que se le ha enviado: vea [Quién puede hacer '
    + 'qué](/help/who-can-do-what#missing).',
  'help.updates.missing.b1':
    'Este panel también se puede desactivar por completo, y en ese caso Anuncios se abre '
    + 'sin él. Sus propios mensajes siguen en la campana, y el tablón sigue siendo el panel '
    + '**General**; este es los dos juntos.',
  // ──── PART 8 — Community (Announcements, Distributions) ───────────────────────
  'help.announcements.title': 'Anuncios',
  'help.announcements.summary':
    'Noticias de la familia, el archivo de todo lo enviado, qué hace realmente fijar algo, '
    + 'y quién cumple años pronto.',
  'help.announcements.reading.heading': 'El tablón',
  'help.announcements.reading.b0':
    '[Anuncios](/community/announcements) son tres paneles. **General** es el tablón y es '
    + 'aquello con lo que abre la pantalla; **Novedades** es el archivo de todo lo que la '
    + 'familia ha anunciado y todo lo que se le ha enviado a usted, cubierto en '
    + '[Novedades](/help/updates#what-it-is); **Cumpleaños** es a quién escribir a '
    + 'continuación, y es la última sección de este capítulo.',
  'help.announcements.reading.b1':
    'El tablón es una pila de publicaciones, de la más nueva a la más antigua, cada una '
    + 'mostrando quién la escribió y cuándo. Las publicaciones fijadas están marcadas y '
    + 'además van arriba en las Novedades recientes de todo el mundo en el panel.',
  'help.announcements.reading.b2':
    'Los tres paneles se otorgan por separado, así que una familia puede repartir la lista '
    + 'de cumpleaños sin repartir el tablón, o al contrario. Un panel que no está es uno que '
    + 'no le han dado: vea [Quién puede hacer qué](/help/who-can-do-what#missing).',
  'help.announcements.posting.heading': 'Publicar',
  'help.announcements.posting.b0.i0': 'Abra el compositor en la parte superior del tablón.',
  'help.announcements.posting.b0.i1': 'Póngale un título y un mensaje.',
  'help.announcements.posting.b0.i2':
    'Elija el destinatario: **Toda la familia**, **Región**, o un solo **Capítulo**.',
  'help.announcements.posting.b0.i3': 'Publique.',
  'help.announcements.posting.b1':
    'Las opciones de capítulo y región solo significan algo cuando su familia ha '
    + 'configurado capítulos. Si no lo ha hecho, todo es para toda la familia.',
  'help.announcements.posting.b2':
    '**Todos los destinatarios reciben una notificación en la campana**, y el tablón se '
    + 'actualiza para quien lo tenga abierto: sin recargar. Un aviso de sección hace sonar '
    + 'la campana solo de esa sección, así que la campana y el tablón nunca discrepan sobre '
    + 'a quién va dirigido un aviso. A usted no se le notifica su propio aviso.',
  'help.announcements.pinning.heading': 'Fijar',
  'help.announcements.pinning.b0':
    '**Hay una sola chincheta, y pertenece a la familia.** A su lado, en una publicación '
    + 'que la familia ha fijado, todos los integrantes tienen un ojo, que oculta esa '
    + 'publicación de la parte superior de sus propias novedades y no cambia nada de lo que '
    + 've nadie más. Dos símbolos, porque son dos actos distintos.',
  'help.announcements.pinning.b1.i0.term': 'Fijar para todos (una chincheta)',
  'help.announcements.pinning.b1.i0.text':
    'Pone la publicación arriba en las novedades de todos los integrantes. Es un acto para '
    + 'toda la familia, y un permiso aparte de publicar: una familia puede dejar que todos '
    + 'publiquen y dejar que una sola persona fije. Se le puede poner un vencimiento, que es '
    + 'la forma correcta de fijar «la reunión es en tres semanas»: se quita a sí misma. La '
    + 'chincheta está rellena y del color de acento mientras está activa.',
  'help.announcements.pinning.b1.i1.term':
    'Ocultar esto de la parte superior de mis novedades (un ojo)',
  'help.announcements.pinning.b1.i1.text':
    'Su propia copia, y todos los integrantes la tienen. Aparece solo en una publicación '
    + 'que la familia ha fijado: no hay nada que ocultar de la parte superior de sus '
    + 'novedades hasta que la familia ha puesto algo ahí.',
  'help.announcements.pinning.b2':
    'Si puede hacer las dos cosas, tenga cuidado con cuál pulsa: quitar la fijación para '
    + 'todos saca la publicación de la parte superior de las novedades de toda la familia, '
    + 'mientras que el ojo no cambia nada de lo que ve nadie más.',
  'help.announcements.dismissing.heading':
    'Ocultar una publicación fijada de sus propias novedades',
  'help.announcements.dismissing.b0':
    'Pulsar el ojo la quita de la parte superior de *sus* novedades y de nada más. Sigue '
    + 'fijada para todos los demás, y sigue en este tablón: el tablón es el registro, el '
    + 'panel es el recordatorio.',
  'help.announcements.dismissing.b1':
    'No oculta la publicación. Sale del bloque fijado y vuelve a la lista por orden de '
    + 'fecha, así que siempre puede encontrarla de nuevo; y la publicación lo dice debajo en '
    + 'cualquier caso: **Fijada para la familia: va arriba en sus novedades**, o **Fijada '
    + 'para la familia: usted la ha ocultado de la parte superior de sus novedades.**',
  'help.announcements.dismissing.b2':
    '**Las dos pantallas están de acuerdo.** Ocúltela aquí o en el panel y la otra lo '
    + 'sigue, porque las dos leen la misma respuesta: la fijación de la familia reducida por '
    + 'su propia ocultación. Eso no era cierto antes del 21-08-2026: este tablón mostraba la '
    + 'fijación de la familia y el panel mostraba la suya, así que una publicación que usted '
    + 'había ocultado seguía arriba en una y no en la otra.',
  'help.announcements.deleting.heading': 'Eliminar',
  'help.announcements.deleting.b0':
    'Eliminar quita la publicación para todo el mundo. Según lo que su familia haya '
    + 'otorgado, puede que pueda eliminar solo sus propias publicaciones, las de cualquiera, '
    + 'o ninguna.',
  'help.announcements.birthdays.heading': 'Cumpleaños',
  'help.announcements.birthdays.b0':
    'El panel **Cumpleaños** son todos los familiares con un cumpleaños en los próximos 60 '
    + 'días, del más cercano al más lejano. Es una lista para actuar y no un registro: **no '
    + 'se envía nada automáticamente**, y escribir la felicitación sigue siendo el trabajo de '
    + 'alguien, y por eso está a un clic del compositor.',
  'help.announcements.birthdays.b1.i0.term': 'Nombre',
  'help.announcements.birthdays.b1.i0.text':
    'De quién se trata. **Buscar por nombre** reduce la lista, ignorando los acentos y la '
    + 'puntuación como hace el Directorio: escribir «jose» encuentra a José.',
  'help.announcements.birthdays.b1.i1.term': 'Fecha',
  'help.announcements.birthdays.b1.i1.text': 'El día en que cae esta vez.',
  'help.announcements.birthdays.b1.i2.term': 'Día',
  'help.announcements.birthdays.b1.i2.text':
    'El día de la semana. Está ahí porque una tarjeta se echa al correo y una llamada se '
    + 'hace pensando en un fin de semana y no en el día 14.',
  'help.announcements.birthdays.b1.i3.term': 'Cuenta atrás',
  'help.announcements.birthdays.b1.i3.text':
    '**Hoy**, **Mañana**, o a cuántos días está. Hoy está marcado, porque es la única fila '
    + 'por la que existe la lista y como texto plano se lee igual que cualquier otra.',
  'help.announcements.birthdays.b1.i4.term': 'Cumple',
  'help.announcements.birthdays.b1.i4.text': 'La edad que alcanza ese día.',
  'help.announcements.birthdays.b2':
    'Todas las personas que la familia ha aprobado están en ella tengan cuenta o no, así '
    + 'que un tío abuelo registrado en el [árbol familiar](/community/family-tree) tiene un '
    + 'cumpleaños como cualquier otra persona. Alguien registrado como fallecido no está en '
    + 'ella, y tampoco nadie cuyo perfil no tenga fecha de nacimiento: un cumpleaños del que '
    + 'nadie le ha hablado al producto no es uno que vaya a adivinar. La línea debajo de la '
    + 'tabla dice cuántas filas hay, y cuántas de ellas está ocultando una búsqueda.',
  'help.announcements.birthdays.b3':
    'Se omite una edad — una raya, y una línea debajo de la tabla diciéndolo — cuando el '
    + 'año registrado es uno del que el producto no se fía, lo que hoy significa un año que '
    + 'todavía no ha ocurrido: 1962 escrito como 2062. El día y el mes siguen mostrándose, '
    + 'porque un desliz de cuatro dígitos es un desliz en el año. Corrija **Fecha de '
    + 'nacimiento** en el [perfil](/personal-info) de esa persona y la edad aparece.',
  'help.announcements.birthdays.b4':
    'Alguien nacido el 29 de febrero se enumera el 28 de febrero en un año sin día '
    + 'bisiesto, así que nunca desaparece de la lista tres años seguidos. La edad sigue '
    + 'contándose en años completos, así que no se salta ninguno.',
  'help.announcements.birthdays.b5':
    'Nada de este panel se puede editar y nada de él se guarda. Todas las fechas se leen de '
    + '**Fecha de nacimiento** en el perfil de la propia persona cada vez que se abre el '
    + 'panel, así que ese es el único lugar donde corregir una.',
  'help.distributions.title': 'Envíos',
  'help.distributions.summary':
    'Enviar un correo a todas las personas de la familia a la vez, sin ninguna lista que '
    + 'mantener al día.',
  'help.distributions.what-it-is.heading': 'Qué es',
  'help.distributions.what-it-is.b0':
    'Un envío es un correo enviado a todas las personas de la familia, o a todas las de una '
    + 'región o un capítulo. Usted escribe un asunto y un mensaje, elige a quién va, y pulsa '
    + 'enviar.',
  'help.distributions.what-it-is.b1':
    'La diferencia entre esto y [Anuncios](/community/announcements) es dónde aterriza el '
    + 'mensaje. Un anuncio espera en el panel de todo el mundo hasta que miran; un envío '
    + 'llega a su bandeja de entrada. Use un anuncio para noticias de la familia, y un envío '
    + 'para algo que tiene que leerse esta semana.',
  'help.distributions.what-it-is.b2':
    'No hay ninguna lista que construir y nada que mantener al día. Las personas que lo '
    + 'reciben se leen de la membresía cada vez que usted envía, así que un familiar que se '
    + 'unió ayer está en ella y uno que nunca estuvo en la familia nunca lo está.',
  'help.distributions.what-it-is.b3':
    'No hay borrador. Un envío sale en cuanto usted lo envía, y no se puede deshacer, así '
    + 'que léalo entero antes de pulsar el botón.',
  'help.distributions.who-gets-it.heading': 'Elegir quién lo recibe',
  'help.distributions.who-gets-it.b0':
    'La lista **A quién va** ofrece a todas las personas de la familia, después cada una de '
    + 'sus regiones, y después cada uno de sus capítulos. Todas las opciones llevan el número '
    + 'de familiares a los que alcanzan, así que puede comprobar el destinatario contra lo '
    + 'que quería antes de que se envíe nada.',
  'help.distributions.who-gets-it.b1':
    'Una región alcanza a los familiares de los capítulos de esa región, y a nadie más. '
    + 'Esto no es lo mismo que un anuncio regional, que todos ven: el correo no se puede '
    + 'recuperar, así que aquí un destinatario significa exactamente lo que dice.',
  'help.distributions.who-gets-it.b2.i0':
    'Un familiar que no está en ningún capítulo no está en ninguna región, así que un envío '
    + 'regional no le llega. Sí le llega «Todas las personas de la familia».',
  'help.distributions.who-gets-it.b2.i1':
    'Solo se envía correo a integrantes aprobados. Alguien que todavía espera ser admitido '
    + 'no está en ningún envío.',
  'help.distributions.who-gets-it.b2.i2':
    'Nadie recibe dos copias. Cuando una pareja comparte una dirección de correo, el '
    + 'mensaje va una vez, y el segundo familiar se enumera como que comparte una dirección.',
  'help.distributions.who-gets-it.b3':
    'La línea debajo del selector dice a cuántas personas se enviará de hecho, que puede '
    + 'ser menos que el número entre paréntesis: vea más abajo.',
  'help.distributions.no-email-address.heading': 'Familiares sin dirección de correo',
  'help.distributions.no-email-address.b0':
    'Alguien registrado en el [Árbol familiar](/community/family-tree) que nunca ha tenido '
    + 'cuenta no tiene dirección de correo propia. GENORRA le da una dirección provisional '
    + 'para que la ficha funcione, y esa dirección no va a ninguna parte.',
  'help.distributions.no-email-address.b1':
    'Esos familiares se cuentan en el destinatario y nunca reciben correo. Tanto el '
    + 'selector como el informe de entrega dicen cuántos hay, con las palabras **Sin '
    + 'dirección de correo registrada**, que no es un fallo de entrega y no es nada que haya '
    + 'que reclamar. Si quiere incluirlos, invítelos desde el árbol familiar, o pase usted '
    + 'mismo el mensaje.',
  'help.distributions.sending.heading': 'Mientras sale',
  'help.distributions.sending.b0':
    'Un envío a una familia grande se manda por lotes, así que la pantalla muestra lo que '
    + 'ha avanzado: **Enviando: 24 de 118 entregados**. Continúa mientras la página esté '
    + 'abierta.',
  'help.distributions.sending.b1':
    'Puede salir de la página. El envío retoma desde donde llegó, y la lista muestra qué '
    + 'sigue pendiente cuando usted vuelve. Nada se envía dos veces, por muchas veces que se '
    + 'reabra la página.',
  'help.distributions.sending.b2':
    '**Detener** termina un envío en curso. Todo lo que ya se ha enviado ha salido y no se '
    + 'puede recuperar; el resto no se envía, y el informe dice **Detenido** con las dos '
    + 'cifras. Cualquiera que pueda enviar puede detener un envío, incluido el de otra '
    + 'persona.',
  'help.distributions.what-happened.heading': 'Qué pasó con cada mensaje',
  'help.distributions.what-happened.b0':
    'Pulsar el asunto abre el mensaje que se envió y la lista de todas las personas a las '
    + 'que fue, con una línea por cada una:',
  'help.distributions.what-happened.b1.i0.term': 'Enviado',
  'help.distributions.what-happened.b1.i0.text':
    'El mensaje se entregó al proveedor de correo de esa dirección.',
  'help.distributions.what-happened.b1.i1.term': 'No se pudo entregar',
  'help.distributions.what-happened.b1.i1.text':
    'Algo salió mal. **Intentar de nuevo** los vuelve a poner en la cola y lo intenta otra '
    + 'vez: un problema temporal suele resolverse.',
  'help.distributions.what-happened.b1.i2.term': 'Sin dirección de correo registrada',
  'help.distributions.what-happened.b1.i2.text':
    'Un familiar del árbol familiar sin dirección. No salió nada mal y no hay nada que '
    + 'reintentar.',
  'help.distributions.what-happened.b1.i3.term': 'Comparte una dirección',
  'help.distributions.what-happened.b1.i3.text':
    'Otro familiar tiene la misma dirección de correo y recibió el mensaje.',
  'help.distributions.what-happened.b1.i4.term': 'No enviado: detenido',
  'help.distributions.what-happened.b1.i4.text': 'El envío se detuvo antes de llegarle.',
  'help.distributions.what-happened.b2':
    'La pantalla nunca dice que un mensaje se envió cuando no se envió. Si el informe dice '
    + '«8 enviados, 2 no se pudieron entregar», eso es lo que pasó, así que vale la pena '
    + 'mirarlo después de enviar algo que importa.',
  'help.distributions.what-happened.b3':
    '«Enviado» significa que el mensaje salió de GENORRA. No puede decirle si alguien lo '
    + 'abrió, ni si su proveedor de correo lo archivó como no deseado.',
  'help.distributions.replies.heading': 'Las respuestas, y cómo se ve el mensaje',
  'help.distributions.replies.b0':
    'El mensaje llega de parte de GENORRA, con su nombre, y una respuesta va a **su propia '
    + 'dirección de correo** y no a nosotros. Así que un familiar que responde a un envío le '
    + 'está escribiendo a usted, que es casi siempre lo que pretende hacer.',
  'help.distributions.replies.b1':
    'El mensaje es texto plano. Deje una línea en blanco entre párrafos y llegan como '
    + 'párrafos; no hay formato, ni adjuntos, ni enlaces añadidos por usted. Para compartir '
    + 'un documento, póngalo en [Documentos](/library/documents) y diga dónde está.',
  'help.distributions.replies.b2':
    'Todos los mensajes dicen al final de qué familia venían y quién los envió, así que '
    + 'nadie tiene que adivinarlo. No hay enlace para darse de baja: esto es su familia '
    + 'escribiendo a sus propios integrantes, no una lista de correo.',
  'help.distributions.who-can.heading': 'Quién puede usarlo',
  'help.distributions.who-can.b0':
    'Envíos está desactivado para todo el mundo hasta que un administrador lo otorga, y se '
    + 'otorga por separado de Anuncios: poder publicar en el tablón no permite a alguien '
    + 'enviar un correo a toda la familia. Vea [Quién puede hacer '
    + 'qué](/help/who-can-do-what).',
  'help.distributions.who-can.b1':
    'Hay tres permisos separados. **Ver** muestra el registro de lo que se ha enviado. '
    + '**Crear** es lo que permite a alguien escribir y enviar uno, y detener un envío. '
    + '**Eliminar** quita el registro de un envío, que es algo más fuerte de poder hacer: es '
    + 'la única copia de a quién se envió y qué pasó con cada mensaje.',
  'help.distributions.who-can.b2':
    'Eliminar el registro no deshace ningún envío. Un envío que no ha terminado hay que '
    + 'detenerlo primero.',
  // ──── PART 8 — Community (Safety Check-Ins) ───────────────────────────────────
  'help.safety-check-ins.title': 'Avisos de seguridad',
  'help.safety-check-ins.summary':
    'Preguntar a los familiares de una zona si están a salvo, y ver quién ha respondido.',
  'help.safety-check-ins.what-it-is.heading': 'Qué es',
  'help.safety-check-ins.what-it-is.b0':
    'Una tormenta, un incendio, una inundación. Alguien abre un aviso dirigido a los '
    + 'familiares que pueden estar afectados, y a cada uno de ellos se le hace una sola '
    + 'pregunta: ¿está a salvo? Responden con un toque, y quien lo abrió ve llegar las '
    + 'respuestas.',
  'help.safety-check-ins.what-it-is.b1':
    'El sentido de la pantalla son las personas que **no** han respondido. Todo lo demás '
    + 'que hay en ella existe para hacer esa lista más corta.',
  'help.safety-check-ins.what-it-is.b2':
    'Nada en esta pantalla vigila el tiempo. GENORRA no sabe qué está pasando cerca de sus '
    + 'familiares y nunca lo pretende: un aviso es una persona preguntando, con sus propias '
    + 'palabras, y dice quién preguntó.',
  'help.safety-check-ins.raising.heading': 'Abrir uno',
  'help.safety-check-ins.raising.b0':
    'Pulse **Abrir un aviso**. Necesita tres cosas, y solo las dos primeras son '
    + 'obligatorias.',
  'help.safety-check-ins.raising.b1.i0':
    'Diga qué está pasando: «Huracán Delia». Esto se convierte en el asunto del correo que '
    + 'reciben sus familiares, así que ponga algo que reconozcan en una bandeja de entrada '
    + 'llena.',
  'help.safety-check-ins.raising.b1.i1':
    'Añada cualquier otra cosa que valga la pena decirles: a dónde ir, a quién llamar, qué '
    + 'sabe. Opcional.',
  'help.safety-check-ins.raising.b1.i2': 'Elija a quién preguntar.',
  'help.safety-check-ins.raising.b2':
    'Después pulse **Preguntarles**. No hay paso de confirmación: el cuadro que está encima '
    + 'del botón ya dice exactamente a cuántos familiares alcanza esto, que es lo que vale la '
    + 'pena comprobar.',
  'help.safety-check-ins.who-to-ask.heading': 'Elegir a quién preguntar',
  'help.safety-check-ins.who-to-ask.b0':
    'Cuatro tipos de destinatario, y todos muestran a cuántos familiares alcanzan antes de '
    + 'que usted envíe.',
  'help.safety-check-ins.who-to-ask.b1.i0.term': 'Todas las personas de la familia',
  'help.safety-check-ins.who-to-ask.b1.i0.text': 'Todos los integrantes aprobados.',
  'help.safety-check-ins.who-to-ask.b1.i1.term': 'Una región',
  'help.safety-check-ins.who-to-ask.b1.i1.text':
    'Todas las personas de los capítulos que forman esa región.',
  'help.safety-check-ins.who-to-ask.b1.i2.term': 'Un capítulo',
  'help.safety-check-ins.who-to-ask.b1.i2.text':
    'Todas las personas registradas como pertenecientes a ese capítulo.',
  'help.safety-check-ins.who-to-ask.b1.i3.term': 'Solo los familiares que yo nombre',
  'help.safety-check-ins.who-to-ask.b1.i3.text':
    'Una lista que usted elige a mano, con un cuadro de búsqueda. Esta es la que hay que '
    + 'usar cuando los capítulos de la familia no coinciden con dónde está el problema de '
    + 'verdad.',
  'help.safety-check-ins.who-to-ask.b2':
    'Un familiar que no le ha dicho a la familia en qué capítulo está tampoco está en '
    + 'ninguna región, así que un aviso regional no le llega. Eso es deliberado: el producto '
    + 'no adivina dónde vive alguien. Use **Solo los familiares que yo nombre** para '
    + 'incluirlo.',
  'help.safety-check-ins.who-to-ask.b3':
    'Un capítulo es cómo se organizó su familia. Una tormenta no lo sigue, y el familiar '
    + 'que se mudó el año pasado es justo el que un destinatario organizado deja fuera en '
    + 'silencio, así que la lista elegida a mano está ahí exactamente para esa persona.',
  'help.safety-check-ins.answering.heading': 'Responder a uno',
  'help.safety-check-ins.answering.b0':
    'Si su familia está preguntando por usted, es lo primero de su [Panel](/dashboard) y lo '
    + 'primero de esta pantalla. Dos botones: **Estoy a salvo** y **Necesito ayuda**. '
    + 'Cualquiera de los dos se registra en el momento: no hay nada que confirmar y nada que '
    + 'escribir.',
  'help.safety-check-ins.answering.b1':
    'Después puede añadir una nota — dónde está, qué necesita — y puede cambiar su '
    + 'respuesta tantas veces como quiera mientras el aviso esté abierto. Decir que necesita '
    + 'ayuda y luego decir que está a salvo es exactamente para lo que esto sirve.',
  'help.safety-check-ins.answering.b2':
    'Responder no necesita ningún permiso, ni ningún plan. Incluso si su familia ha '
    + 'desactivado esta pantalla para usted, o ha pasado a un plan que ya no la incluye, la '
    + 'pregunta sigue apareciendo en su Panel y usted sigue pudiendo responderla.',
  'help.safety-check-ins.the-roster.heading': 'Leer las respuestas',
  'help.safety-check-ins.the-roster.b0':
    '**Ver a quién se preguntó** abre la lista. Todas las personas están en uno de cuatro '
    + 'estados, y la lista se ordena según cuál de ellos necesita atención antes.',
  'help.safety-check-ins.the-roster.b1.i0.term': 'Necesita ayuda',
  'help.safety-check-ins.the-roster.b1.i0.text': 'Lo han dicho. Siempre arriba.',
  'help.safety-check-ins.the-roster.b1.i1.term': 'No alcanzado',
  'help.safety-check-ins.the-roster.b1.i1.text':
    'O no tienen dirección de correo registrada, o el correo no llegó. Estos necesitan una '
    + 'persona, no otro intento.',
  'help.safety-check-ins.the-roster.b1.i2.term': 'Esperando',
  'help.safety-check-ins.the-roster.b1.i2.text':
    'Se les preguntó y todavía no han respondido. Esta es la cifra que hay que llevar a '
    + 'cero.',
  'help.safety-check-ins.the-roster.b1.i3.term': 'A salvo',
  'help.safety-check-ins.the-roster.b1.i3.text': 'Lo han dicho.',
  'help.safety-check-ins.the-roster.b2':
    '**No alcanzado** y **Esperando** son deliberadamente distintos. Alguien a quien se '
    + 'preguntó y no ha dicho nada puede estar simplemente ocupado; alguien sin dirección de '
    + 'correo registrada nunca llegó a que se le preguntara, y por mucho que se espere eso no '
    + 'cambiará. La pantalla dice cuál es cuál, y cuántos hay.',
  'help.safety-check-ins.the-roster.b3':
    'Cuando un correo falló de verdad — una dirección real que rebotó — **Volver a intentar '
    + 'los fallidos** vuelve a enviar solo a esos. No toca a los familiares que no tienen '
    + 'dirección, porque no hay nada a lo que enviar.',
  'help.safety-check-ins.reaching-people.heading': 'Qué puede prometer esto y qué no',
  'help.safety-check-ins.reaching-people.b0':
    'Que esto quede claro, porque aquí importa más que en cualquier otra parte del '
    + 'producto: **un aviso es un correo y una notificación, y ninguna de las dos cosas es '
    + 'una garantía.**',
  'help.safety-check-ins.reaching-people.b1.i0':
    'El correo va a la dirección del perfil de cada familiar. Si esa dirección es errónea, '
    + 'está desactualizada, o es una provisional que la familia generó, no se les pregunta, y '
    + 'la pantalla lo dice en vez de contarlos como silenciosos.',
  'help.safety-check-ins.reaching-people.b1.i1':
    'La notificación solo alcanza a alguien que tiene el producto abierto.',
  'help.safety-check-ins.reaching-people.b1.i2':
    'Nada de aquí envía un mensaje de texto ni hace sonar un teléfono.',
  'help.safety-check-ins.reaching-people.b2':
    'Así que la pantalla nunca dice que se ha preguntado a todo el mundo. Dice a cuántos se '
    + 'preguntó, a cuántos no se pudo, y por qué; y los familiares a los que nadie pudo '
    + 'alcanzar se nombran como un trabajo para que lo haga una persona.',
  'help.safety-check-ins.closing.heading': 'Cerrar uno',
  'help.safety-check-ins.closing.b0':
    '**Cerrar el aviso** desmoviliza a la familia. Detiene cualquier pregunta más que fuera '
    + 'a salir y quita la banda del Panel de todo el mundo.',
  'help.safety-check-ins.closing.b1':
    'Cerrar no destruye nada. Todas las respuestas, y todos los familiares a los que nadie '
    + 'pudo alcanzar, se quedan en el registro exactamente como estaban: un aviso cerrado '
    + 'sigue siendo el relato de lo que la familia preguntó y de lo que volvió.',
  'help.safety-check-ins.closing.b2':
    '**Eliminar** sí lo destruye, y es un permiso aparte por ese motivo. No hay otra copia '
    + 'de quién respondió.',
  'help.safety-check-ins.who-can.heading': 'Quién puede hacer qué',
  'help.safety-check-ins.who-can.b0':
    'Abrir un aviso despierta a mucha gente a la vez, así que se otorga y no se da por '
    + 'supuesto. Hay tres permisos separados.',
  'help.safety-check-ins.who-can.b1.i0.term': 'Ver',
  'help.safety-check-ins.who-can.b1.i0.text':
    'Leer los avisos y, en el ajuste más amplio, la lista completa de quién respondió.',
  'help.safety-check-ins.who-can.b1.i1.term': 'Crear',
  'help.safety-check-ins.who-can.b1.i1.text':
    'Abrir un aviso, preguntar al resto de una cola, y cerrar uno. Quien puede dar la '
    + 'alarma también puede dar el aviso de que todo ha pasado.',
  'help.safety-check-ins.who-can.b1.i2.term': 'Eliminar',
  'help.safety-check-ins.who-can.b1.i2.text':
    'Quitar el registro por completo. Más fuerte que los otros dos, porque destruye el '
    + 'único relato de quién no fue alcanzado nunca.',
  'help.safety-check-ins.who-can.b2':
    'Por defecto un integrante ordinario puede abrir esta pantalla, ver los avisos que él '
    + 'abrió, y responder a cualquier cosa que se le haya preguntado, pero no la lista de '
    + 'quién más ha respondido. Esa lista es un conjunto de familiares con su paradero y su '
    + 'localizabilidad al lado, y se queda con las personas a las que la familia se la ha '
    + 'dado. Vea [Quién puede hacer qué](/help/who-can-do-what).',
  // ──── PART 8 — Community (Family Tree) ────────────────────────────────────────
  'help.family-tree.title': 'Árbol familiar',
  'help.family-tree.summary':
    'Un árbol para toda la familia: cómo leerlo, cómo añadirle cosas y cómo corregirlo.',
  'help.family-tree.how-it-reads.heading': 'Cómo se lee el lienzo',
  'help.family-tree.how-it-reads.b0':
    'El árbol dibuja las generaciones alrededor de una persona, la más antigua arriba: sus '
    + 'antepasados, después esa persona y su cónyuge, después sus descendientes. Cada banda '
    + 'está etiquetada — **Abuelos**, **Hijos**, **Bisnietos** — y más allá de bisnietos '
    + 'cuenta, así que cinco generaciones hacia abajo se lee **Tataranietos de 3.er grado** '
    + 'en vez de una fila de «tatara» que nadie puede sumar. Los hermanos y hermanas se '
    + 'enumeran debajo en vez de dibujarse en la fila, porque comparten la generación de la '
    + 'persona enfocada y la llenarían.',
  'help.family-tree.how-it-reads.b1':
    '**Hasta dónde llega depende del modo.** Leyendo, tiene tres generaciones arriba y '
    + 'cinco abajo. Editando se reduce a dos arriba y una abajo — las generaciones a cada '
    + 'lado de la persona con la que está trabajando — porque cada banda de más es otra fila '
    + 'de tarjetas **+** para familiares que usted no está añadiendo en ese momento.',
  'help.family-tree.how-it-reads.b2':
    'Una generación con muchísimas personas se detiene en veinticuatro tarjetas y dice '
    + 'cuántas quedan. Nadie se pierde: **Todas las personas de esta familia**, debajo del '
    + 'lienzo, enumera la lista completa y todos los nombres vuelven a centrar el árbol.',
  'help.family-tree.how-it-reads.b3':
    'Se abre en usted. Si entró por matrimonio y no tiene padres ni hijos registrados, se '
    + 'abre en el familiar al que está unido y lo dice, con un enlace de **Centrar en mí**.',
  'help.family-tree.how-it-reads.b4':
    'Cuando alguien tiene más de un matrimonio, cada tarjeta de cónyuge lleva la palabra '
    + 'que corresponde — **Esposa**, **Exesposa**, **Pareja** — y los hijos de abajo se '
    + 'separan en un panel por matrimonio, más **Otros hijos** para cualquiera cuyo otro '
    + 'progenitor no sea ninguno de ellos. La separación viene de las conexiones de '
    + 'progenitor que los hijos ya llevan; no se adivina nada.',
  'help.family-tree.moving.heading': 'Moverse',
  'help.family-tree.moving.b0':
    'Pulse a cualquier persona para volver a centrar el árbol en ella. Sus abuelos, padres, '
    + 'cónyuge e hijos se dibujan entonces a su alrededor, y usted sigue desde ahí.',
  'help.family-tree.moving.b1':
    'Debajo del lienzo, **Todas las personas de esta familia** enumera la lista completa. '
    + 'Todos los nombres centran el árbol, así que nadie está nunca a más de un clic. '
    + '**Todavía no está en el árbol** es una lista distinta: son las personas conectadas con '
    + 'nadie, que es trabajo por hacer.',
  'help.family-tree.view-vs-edit.heading': 'Ver y Editar',
  'help.family-tree.view-vs-edit.b0':
    'El árbol abre en **Ver**. Pasar a **Editar** activa los botones **+**, el editor de '
    + 'fichas y los controles de quitar. Todos los integrantes empiezan pudiendo editar, '
    + 'porque construir el árbol de la familia es algo que la familia hace junta; pero ahora '
    + 'es un permiso como cualquier otro, así que sus administradores pueden reducirlo desde '
    + '[Miembros](/admin/members). Si el interruptor de **Editar** no está ahí, es por eso.',
  'help.family-tree.view-vs-edit.b1':
    'Pulsar una tarjeta abre el panel donde se gestionan la ficha de esa persona y sus '
    + 'conexiones. **Ese panel sigue su permiso del Directorio, no el del árbol**: una '
    + 'familia que ha restringido el [Directorio de integrantes](/community/directory) ha '
    + 'dicho que la lista no es para todo el mundo, y el panel es donde se lee una ficha de '
    + 'una persona a la vez. El lienzo en sí sigue dibujando todos los nombres y mostrando '
    + 'cómo se conecta todo el mundo.',
  'help.family-tree.view-vs-edit.b2':
    '**Editar** también cambia cuánto del árbol se dibuja, y eso es deliberado. **Ver** '
    + 'muestra tres generaciones hacia arriba y cinco hacia abajo, de modo que usted puede '
    + 'ver una línea larga desde una sola tarjeta. **Editar** muestra dos hacia arriba y una '
    + 'hacia abajo — cada hueco que le corresponde a la persona del centro, y nada más, '
    + 'porque cada banda adicional es otra fila de botones **+** para familiares que usted no '
    + 'está colocando. Que el lienzo se acorte al pulsar **Editar** es eso, no algo que haya '
    + 'salido mal.',
  'help.family-tree.view-vs-edit.b3':
    'Nada en el árbol quita a nadie de la familia. Quitar una conexión quita el *vínculo* '
    + 'entre dos personas, no a ninguna de las dos.',
  'help.family-tree.adding.heading': 'Añadir un familiar',
  'help.family-tree.adding.b0.i0':
    'Pase a **Editar** y céntrese en la persona a la que está añadiendo.',
  'help.family-tree.adding.b0.i1':
    'Pulse el **+** de la relación: **Padre**, **Madre**, **Marido**, **Esposa**, '
    + '**Pareja**, **Hijo**, **Hija**, **Hermano** o **Hermana**.',
  'help.family-tree.adding.b0.i2': 'Ponga su nombre.',
  'help.family-tree.adding.b0.i3': 'Diga si tiene dirección de correo.',
  'help.family-tree.adding.b1':
    'Si la tiene, recibe una invitación de verdad y entra en la cola de aprobaciones cuando '
    + 'la acepta. Si no la tiene, se le pide un motivo breve con sus propias palabras — '
    + '«falleció en 1998», «demasiado pequeño para tener cuenta», «solo teléfono» — y la '
    + 'ficha se crea sin ella.',
  'help.family-tree.adding.b2':
    '**Añadir un hijo sin correo pide su fecha de nacimiento, y no se guarda sin ella.** '
    + 'Una familia puede fijar una edad a la que empiezan sus cuotas, y una ficha sin '
    + 'cumpleaños se trata como adulta en todo el producto, así que un niño introducido sin '
    + 'ella se facturaría desde el día en que lo añadió. Cualquier otro familiar se puede '
    + 'registrar con cumpleaños o sin él.',
  'help.family-tree.adding.b3':
    'Los abuelos tienen sus propias tarjetas **+** en la fila de arriba, una pareja por '
    + 'progenitor, nombradas según de quién son: **Añadir el padre de Martha**. Cuelgan de un '
    + 'progenitor y no de la persona del medio, porque un abuelo es la madre o el padre de '
    + 'alguien y el árbol no tiene otra forma de decir de qué lado está. Registre primero un '
    + 'progenitor y aparecen los huecos.',
  'help.family-tree.adding.b4':
    'Un matrimonio anterior se registra añadiendo al cónyuge y renombrando después la '
    + 'conexión como **Exmarido**, **Exesposa** o **Expareja** en el cuadro de gestión. Un ex '
    + 'se dibuja al lado de la persona exactamente donde va un cónyuge actual, y a propósito: '
    + 'a menudo es de donde vinieron la mitad de los hijos.',
  'help.family-tree.adding.b5':
    'Todas las conexiones se registran desde los dos extremos, así que añadir a su madre '
    + 'también le da a ella un hijo, que es usted. Cada persona puede llevar más de un '
    + 'matrimonio; el **+** de un cónyuge sigue disponible después del primero.',
  'help.family-tree.records.heading': 'Fichas y cuentas',
  'help.family-tree.records.b0':
    'Solo hay un tipo de persona en el árbol. Algunas tienen cuenta y otras no, y esa es '
    + 'toda la diferencia.',
  'help.family-tree.records.b1.i0.term': 'Solo ficha',
  'help.family-tree.records.b1.i0.text':
    'Alguien introducido por un familiar, sin dirección de correo. Una abuela, un niño, un '
    + 'tío abuelo que falleció en 1998. Cualquier integrante aprobado puede corregir sus '
    + 'datos.',
  'help.family-tree.records.b1.i1.term': 'Invitado',
  'help.family-tree.records.b1.i1.text':
    'Invitado pero todavía no admitido: está en la cola de aprobaciones.',
  'help.family-tree.records.b1.i2.term': 'Un integrante',
  'help.family-tree.records.b1.i2.text':
    'Tiene cuenta. Solo esa persona puede cambiar su propio nombre y sus datos de contacto, '
    + 'desde [Mi perfil](/personal-info).',
  'help.family-tree.records.b2':
    'Una ficha deja de ser una ficha el día en que alguien la invita, que es el control '
    + '**Invitar** del editor de fichas. No hay un paso aparte de «convertir en adulto»: un '
    + 'niño que consigue una dirección de correo simplemente se invita como cualquier otra '
    + 'persona.',
  'help.family-tree.blood.heading': 'Quién pertenece al linaje',
  'help.family-tree.blood.b0':
    'Una marca por persona: **pertenece al linaje de la familia**, o no. Está en la '
    + 'PERSONA y no en ninguna de sus conexiones, y es algo que su familia declara, no algo '
    + 'que el producto deduzca.',
  'help.family-tree.blood.b1':
    'Márquelo para un pariente de sangre. Déjelo sin marcar para alguien que se casó con '
    + 'la familia, y para un pariente político, adoptivo o de acogida. El diálogo lo '
    + 'pregunta cuando añade un pariente nuevo; después, abra la ficha de cualquiera y '
    + 'márquelo ahí. Se guarda en cuanto lo marca.',
  'help.family-tree.blood.b2':
    'Decide dos cosas, y la segunda es dinero: quién aparece en **Linaje** en el árbol, y '
    + 'quién debe una cuota fijada como **Solo linaje**. Si un pariente que usted espera '
    + 'que deba una cuota de linaje no la debe, esto es lo primero que hay que comprobar.',
  'help.family-tree.blood.b3':
    '**Al principio no hay nadie marcado.** Es deliberado y no un descuido: una cuota '
    + 'restringida al linaje la deben las personas marcadas, así que una familia que no ha '
    + 'tocado nada no cobra a nadie en vez de cobrar a un pariente que se casó con la '
    + 'familia.',
  'help.family-tree.blood.b4':
    '**Antes eran cuatro palabras en la conexión** — sangre, político, adoptivo o de '
    + 'acogida — y el linaje se calculaba recorriendo esas conexiones hacia arriba desde un '
    + 'antepasado nombrado. Eso ya no existe. El recorrido acertaba con el grafo y seguía '
    + 'equivocándose con la familia: en una familia creada por un hijo subía por su madre, '
    + 'así que la antigua esposa de su padre volvía a contar como sangre, y la única '
    + 'palanca disponible era marcar a una madre real como madrastra, lo cual dejaba al '
    + 'árbol equivocado sobre ella y sobre cada pariente suyo añadido después.',
  'help.family-tree.blood.b5':
    'Una cosa se perdió de verdad con ello: el árbol ya no imprime **Hijastro** ni **Hija '
    + 'adoptiva** en una ficha. Una conexión es una relación y un nombre; cómo entró '
    + 'alguien en la familia no se imprime en su cara.',
  'help.family-tree.bloodline.heading': 'El interruptor de Linaje',
  'help.family-tree.bloodline.b0':
    '**Familia completa** muestra a todos. **Linaje** muestra solo a las personas '
    + 'marcadas como pertenecientes al linaje de la familia, y oculta a las demás.',
  'help.family-tree.bloodline.b1':
    'Es una sola respuesta para toda la familia, no una por lector: dos miembros no '
    + 'pueden discrepar sobre quién pertenece al linaje de la familia. Cualquiera que pueda '
    + 'editar el árbol puede cambiar una marca, y eso cambia lo que ve cada miembro.',
  'help.family-tree.bloodline.b2':
    'El interruptor solo aparece cuando su familia ha marcado a ALGUNOS de sus parientes '
    + 'y no a todos. Sin nadie marcado ocultaría a toda la familia, y con todos marcados no '
    + 'haría nada, así que no se ofrece en ninguno de los dos casos.',
  'help.family-tree.bloodline.b3':
    'Un pariente sin marcar queda OCULTO por el interruptor, no ausente del árbol. Vuelva '
    + 'a **Familia completa** y ahí está; la marca decide lo que muestra esta vista y nada '
    + 'más de su ficha.',
  'help.family-tree.bloodline.b4':
    '**Un pariente que debería estar y no está simplemente no se ha marcado todavía.** '
    + 'Abra su ficha y márquelo. No hay nada que deducir ni nada más que pueda estar mal, '
    + 'lo cual no era cierto del ajuste al que sustituye: allí, alguien que aparecía como '
    + 'sangre por error era un problema del antepasado desde el que empezaba el recorrido, '
    + 'no de ninguna conexión que usted pudiera ver.',
  'help.family-tree.bloodline.b5':
    'Una cuota fijada como **Solo linaje** la deben exactamente las personas marcadas '
    + 'aquí, así que esta pantalla y esa cifra no pueden discrepar.',
  'help.family-tree.fixing.heading': 'Corregir un error',
  'help.family-tree.fixing.b0.i0':
    'Relación equivocada: abra el diálogo de gestión de la conexión. Un matrimonio se '
    + 'puede renombrar ahí, **Marido** a **Exmarido**. Que alguien pertenezca al linaje es '
    + 'una marca en su propia ficha, en el mismo diálogo.',
  'help.family-tree.fixing.b0.i1':
    'Datos equivocados en una ficha: el control de editar de la tarjeta. Se ofrece solo '
    + 'para personas sin cuenta propia; un integrante es dueño de su propio nombre y lo '
    + 'cambia en [Mi perfil](/personal-info).',
  'help.family-tree.fixing.b0.i2':
    'Conectado con la persona equivocada: quite la conexión. Las dos personas se quedan en '
    + 'la familia.',
  // ──── PART 8 — Community (Elections) ──────────────────────────────────────────
  'help.elections.title': 'Elecciones',
  'help.elections.summary':
    'Cómo una elección corre por sus propias fechas, quién tiene derecho a participar, y '
    + 'cómo nominar, aceptar y votar.',
  'help.elections.what-it-is.heading': 'Qué es esta pantalla',
  'help.elections.what-it-is.b0':
    'Todas las elecciones que está celebrando su parte de la familia. **Activas** es todo '
    + 'lo que todavía no ha terminado: una que no ha abierto, una que recibe nominaciones, '
    + 'una que espera a que abra su papeleta, y una en la que se está votando. **Pasadas** '
    + 'son las que han cerrado.',
  'help.elections.what-it-is.b1':
    'Las elecciones que todavía no se han publicado no se enumeran. Quien organiza escribe '
    + 'primero una elección como borrador, y un borrador no es una papeleta.',
  'help.elections.what-it-is.b2':
    'Abra una para ver sus cargos, sus dos ventanas de fechas, y lo que usted pueda hacer '
    + 'hoy en ella.',
  'help.elections.the-dates.heading': 'Las fechas la gobiernan',
  'help.elections.the-dates.b0':
    'Una elección tiene dos ventanas, y nadie pulsa nada para moverla de una a otra.',
  'help.elections.the-dates.b1.i0.term': 'Nominaciones',
  'help.elections.the-dates.b1.i0.text':
    'Desde el día en que abren hasta el día en que cierran. Preséntese, o presente a otra '
    + 'persona.',
  'help.elections.the-dates.b1.i1.term': 'Votación',
  'help.elections.the-dates.b1.i1.text':
    'Desde el día en que abre hasta el día en que cierra. Emita un voto, o cámbielo.',
  'help.elections.the-dates.b2':
    '**Los dos extremos cuentan.** Una elección cuyas nominaciones dicen «1 de enero – 5 de '
    + 'enero» está abierta el día 5, hasta el final del día. Lo mismo vale para la votación, '
    + 'con una excepción, más abajo.',
  'help.elections.the-dates.b3':
    'La votación nunca abre antes de que cierren las nominaciones, así que la lista de '
    + 'candidatos sobre la que usted vota no puede cambiar por debajo. A menudo hay un hueco '
    + 'en medio, y la pantalla dice qué está esperando.',
  'help.elections.the-dates.b4':
    '**La votación puede abrir el mismo día en que cierran las nominaciones, y entonces ese '
    + 'día pertenece a la votación.** Las nominaciones corren hasta su fecha de cierre, o '
    + 'hasta que abre la votación, lo que llegue primero; así que en un día compartido el '
    + 'formulario de nominación ya está cerrado y la papeleta está activa. Si su familia '
    + 'quiere todo ese día para las nominaciones, la fecha de cierre va un día antes.',
  'help.elections.the-dates.b5':
    'Nada de aquí ocurre a una hora del día. Una ventana abre en su fecha y cierra al final '
    + 'de su fecha de cierre, y la pantalla muestra las mismas fechas a todo el mundo.',
  'help.elections.the-dates.b6':
    '**«El final del día» significa el final del día donde está su familia.** Una elección '
    + 'registra el huso horario en el que se programó, y tanto las fechas en pantalla como el '
    + 'momento en que la papeleta se cierra de verdad se leen en ese único huso; así que un '
    + 'familiar en otra parte del mundo ve la misma fecha de cierre que todos los demás, y la '
    + 'papeleta sigue abierta hasta la medianoche de su familia y no la de otra persona.',
  'help.elections.who-votes.heading': 'Para quién es una elección',
  'help.elections.who-votes.b0':
    'Una elección pertenece a un nivel de la familia, y la pantalla lo nombra debajo del '
    + 'título.',
  'help.elections.who-votes.b1.i0.term': 'Nacional',
  'help.elections.who-votes.b1.i0.text':
    'Toda la familia. Todo el mundo puede verla, ser nominado y votar.',
  'help.elections.who-votes.b1.i1.term': 'Una región',
  'help.elections.who-votes.b1.i1.text': 'Solo los integrantes cuyo capítulo está en esa región.',
  'help.elections.who-votes.b1.i2.term': 'Un capítulo',
  'help.elections.who-votes.b1.i2.text': 'Solo los integrantes de ese capítulo.',
  'help.elections.who-votes.b2':
    'Los niveles no se mezclan. Una elección de capítulo es invisible para el resto de la '
    + 'familia — no se enumera, y su enlace no abre — y solo puede cubrir cargos que la '
    + 'familia registra a nivel de capítulo. Vea [Regiones y '
    + 'capítulos](/help/regions-and-chapters) para cómo se divide la familia, y [Cargos de la '
    + 'directiva](/help/board-positions) para los cargos en sí.',
  'help.elections.who-votes.b3':
    '**Si no está en ningún capítulo, está bajo Nacional.** Ve las elecciones nacionales y '
    + 'participa en ellas, y las elecciones regionales y de capítulo no son suyas. Su '
    + 'capítulo está en [Mi perfil](/personal-info); un administrador también puede fijarlo '
    + 'por usted.',
  'help.elections.nominating.heading': 'Nominar a alguien',
  'help.elections.nominating.b0':
    'Mientras las nominaciones están abiertas, la elección enumera todos los cargos de la '
    + 'papeleta, y debajo de cada uno las personas que se han nominado para él. Cualquier '
    + 'integrante puede nominar.',
  'help.elections.nominating.b1.i0':
    'Encuentre el cargo para el que quiere nominar y pulse **Nominar** al lado.',
  'help.elections.nominating.b1.i1':
    'Para presentarse usted, pulse **Presentarme**. Está en la papeleta de inmediato: nadie '
    + 'tiene que aceptar su propia nominación.',
  'help.elections.nominating.b1.i2':
    'Para presentar a otra persona, encuéntrela en **¿A quién está nominando?** y pulse '
    + '**Nominar**.',
  'help.elections.nominating.b2':
    'El cuadro de nombre busca en cualquier parte de cualquier nombre, así que escribir '
    + '«allen» encuentra a Martha Allen. Enumera solo a las personas para las que es esta '
    + 'elección, y por eso una elección de capítulo ofrece menos nombres de los que tiene la '
    + 'familia.',
  'help.elections.nominating.b3':
    '**Varios integrantes pueden nominar a la misma persona para el mismo cargo.** Aparece '
    + 'una sola vez en la lista, y se dice cuántas personas la presentaron: «nominada por '
    + 'usted y 2 más». Una segunda nominación no es un duplicado; es otro integrante diciendo '
    + 'que la quiere.',
  'help.elections.nominating.b4':
    'Una persona puede ser nominada una vez por cargo por usted, y puede ser nominada para '
    + 'tantos cargos como quiera.',
  'help.elections.withdrawing.heading': 'Retirar una nominación',
  'help.elections.withdrawing.b0':
    'Una nominación que usted hizo muestra **Quitar mi nombre** al lado, y una que hizo '
    + 'para sí mismo muestra **Retirarme**. En cualquier caso usted solo está quitando su '
    + 'propio nombre.',
  'help.elections.withdrawing.b1':
    '**Si otros integrantes nominaron a la misma persona, se queda en la papeleta.** Solo '
    + 'se quita su nombre, y el recuento a su lado baja en uno. Si usted era la única persona '
    + 'que la nominó, sale de la papeleta por completo: la pantalla dice cuál de las dos '
    + 'cosas va a pasar antes de que confirme.',
  'help.elections.withdrawing.b2':
    'Dos cosas lo impiden, y las dos son sobre no cambiar una papeleta por debajo de las '
    + 'personas que la están leyendo:',
  'help.elections.withdrawing.b3.i0.term': 'Ya han aceptado',
  'help.elections.withdrawing.b3.i0.text':
    'Una nominación aceptada se queda en la papeleta. La forma de salir de ella es que esa '
    + 'persona la rechace: vea Aceptar o rechazar más abajo. La excepción es la suya: usted '
    + 'siempre puede retirarse.',
  'help.elections.withdrawing.b3.i1.term': 'Las nominaciones han cerrado',
  'help.elections.withdrawing.b3.i1.text':
    'Una vez que la ventana ha terminado, nada sale de la papeleta. Rechazar es la única '
    + 'salida a partir de entonces.',
  'help.elections.withdrawing.b4':
    'No puede quitar la nominación de otra persona, ni siquiera si es administrador de la '
    + 'familia. Una nominación es algo que un integrante dijo, y solo esa persona puede '
    + 'desdecirlo.',
  'help.elections.accepting.heading': 'Aceptar o rechazar',
  'help.elections.accepting.b0':
    'Si alguien lo nomina, la elección abre con **¡Ha sido nominado!** en la parte '
    + 'superior, una fila por cargo. **Aceptar** lo pone en la papeleta; **Rechazar** lo saca '
    + 'de ella.',
  'help.elections.accepting.b1':
    'No se puede cambiar después, así que la pantalla le pide confirmación. Solo las '
    + 'nominaciones que ha aceptado aparecen como candidaturas cuando abre la votación: una '
    + 'nominación que nadie respondió no está en la papeleta.',
  'help.elections.accepting.b2':
    'Todavía puede responder después de que cierren las nominaciones. La ventana gobierna '
    + 'quién puede ser nominado, no cuánto tiempo tiene usted para responder.',
  'help.elections.voting.heading': 'Votar',
  'help.elections.voting.b0':
    'Mientras la votación está abierta, cada cargo enumera las candidaturas que aceptaron. '
    + 'Pulse una, confirme, y su voto queda registrado.',
  'help.elections.voting.b1':
    'Puede cambiar su voto tantas veces como quiera hasta que la ventana cierre: pulsar '
    + 'otra candidatura reemplaza su voto anterior en vez de sumarse a él. Un voto por cargo.',
  'help.elections.voting.b2':
    '**Su papeleta es suya.** Usted puede ver sus propios votos y nadie más puede, y nada '
    + 'en ninguna parte muestra a otro integrante a quién votó.',
  'help.elections.results.heading': 'Resultados',
  'help.elections.results.b0':
    'Una vez que la ventana de votación ha cerrado, **Resultados** aparece al pie de la '
    + 'elección con el recuento de votos de cada candidatura, ordenado por recuento, con '
    + 'tantas filas como ganadores tiene el cargo.',
  'help.elections.results.b1':
    'Nada se publica mientras la votación sigue abierta, y no hay que pulsar nada para '
    + 'publicarlo: el día después de que cierra la votación, los resultados están ahí.',
  // ──── PART 8 — Community (Officer Notes) ──────────────────────────────────────
  'help.journal.title': 'Notas del cargo',
  'help.journal.summary':
    'Un cuaderno para cada cargo que mantiene su familia, cómo un tema recoge notas a lo '
    + 'largo del tiempo, y por qué todo se queda con el cargo y no con usted.',
  'help.journal.what-it-is.heading': 'Qué es esta pantalla',
  'help.journal.what-it-is.b0':
    'Todos los cargos que la familia registra — tesorero, secretario, responsable de '
    + 'eventos — tienen un cuaderno. Contiene lo que la persona que hace el trabajo necesita '
    + 'tener escrito: cómo funciona de verdad la conciliación bancaria, en qué local '
    + 'contestan el teléfono, qué salió mal el año pasado.',
  'help.journal.what-it-is.b1':
    'Es **Biblioteca > Notas del cargo** en el menú lateral, al lado de '
    + '[Actas](/library/meeting-minutes), [Documentos](/library/documents) y '
    + '[Estatutos](/library/bylaws): las cuatro cosas que la familia escribe y a las que '
    + 'vuelve. Una familia que registra cargos para sus capítulos y regiones además de a '
    + 'nivel nacional los encontrará todos aquí.',
  'help.journal.what-it-is.b2':
    '**Las notas pertenecen al cargo, no a usted.** Eso es todo. Cuando pasa el trabajo a '
    + 'otra persona, todo lo que usted escribió sigue ahí para quien lo tome, y todo lo que '
    + 'escribió la persona anterior estaba ahí para usted.',
  'help.journal.what-it-is.b3':
    '**Una entrada es un tema, no una página.** Tiene un título y luego una serie de notas '
    + 'debajo, de la más antigua a la más nueva, cada una firmada y fechada. Así que «Cómo '
    + 'funciona la conciliación bancaria» es una entrada a la que se le añade un párrafo cada '
    + 'vez que hay algo que añadir, en vez de cuatro entradas con nombres parecidos; y el '
    + 'argumento de por qué se hace así es el hilo completo, no la última versión de él.',
  'help.journal.what-it-is.b4':
    'Si no ocupa ningún cargo, la pantalla lo dice y no hay nada que ver. No ha salido nada '
    + 'mal: las notas del cargo son para quienes ocupan cargos, y los cargos se registran en '
    + '[Cargos de la directiva](/help/board-positions).',
  'help.journal.who-can-read-it.heading': 'Quién puede leerlo',
  'help.journal.who-can-read-it.b0':
    '**Quien ocupa el cargo hoy, y nadie más.** No otros cargos, no los administradores de '
    + 'la familia, no la persona que lo ocupó el año pasado.',
  'help.journal.who-can-read-it.b1':
    'Eso es inusual en este producto y es deliberado. Son notas de trabajo y no un registro '
    + 'que la familia guarda, y un cuaderno que todo el mundo pudiera leer es uno que la '
    + 'gente llevaría en otro sitio.',
  'help.journal.who-can-read-it.b2':
    'Si ocupa más de un cargo, cada uno tiene su propio cuaderno y una franja en la parte '
    + 'superior alterna entre ellos. Nada de uno aparece en otro.',
  'help.journal.who-can-read-it.b3':
    '**Cada uno está nombrado completo: el cargo y el lugar.** «Tesorero nacional», '
    + '«presidente del capítulo de Austin», «secretario de la región del Este»: la misma '
    + 'expresión que imprimen el [Directorio](/community/directory) y '
    + '[Miembros](/admin/members) para el mismo cargo, así que nunca está adivinando cuál de '
    + 'dos cargos de capítulo significa un elemento de la franja.',
  'help.journal.who-can-read-it.b4':
    '**Un cuaderno pertenece al CARGO y no al lugar**, y un cargo limitado lo dice en la '
    + 'pantalla: todas las personas que ocupan «presidente de capítulo» leen las mismas '
    + 'notas, sea cual sea el capítulo que presiden. Si su familia quiere que un capítulo '
    + 'tenga notas propias, eso es un cargo aparte por capítulo y no un cargo ocupado en '
    + 'varios.',
  'help.journal.who-can-read-it.b5':
    'Si dos de ustedes ocupan el mismo cargo, los dos están escribiendo en el mismo '
    + 'cuaderno. Cualquiera de los dos puede añadir una nota a cualquier entrada que haya en '
    + 'él, que es lo que hace de una entrada una conversación; pero una nota sigue siendo '
    + 'propiedad de quien la escribió. Vea [cambiar algo](#editing).',
  'help.journal.who-can-read-it.b6':
    'Una familia puede desactivar esta pantalla por completo en [Quién puede hacer '
    + 'qué](/help/who-can-do-what), igual que cualquier otra pantalla. Lo que no puede hacer '
    + 'es abrir el cuaderno de un cargo a alguien que no lo ocupa.',
  'help.journal.writing.heading': 'Empezar una entrada, y añadirle cosas',
  'help.journal.writing.b0.i0': 'Pulse **Nueva entrada**.',
  'help.journal.writing.b0.i1': 'Póngale un título: eso es lo que muestra la lista.',
  'help.journal.writing.b0.i2':
    'Escriba la primera nota si tiene algo que decir ahora. Puede dejarla vacía y volver a '
    + 'ella.',
  'help.journal.writing.b0.i3': 'Pulse **Añadir entrada**.',
  'help.journal.writing.b1':
    'Después de eso, **Añadir una nota** en la entrada es la forma en que crece. Escriba '
    + 'tanto o tan poco como quiera; los saltos de línea se conservan, así que una lista '
    + 'sigue siendo una lista. Las notas aparecen en el orden en que se escribieron, cada una '
    + 'con un nombre y una fecha, y una que se ha cambiado desde entonces lo dice.',
  'help.journal.writing.b2':
    'Las entradas en sí se enumeran de la más nueva a la más antigua, con quién empezó cada '
    + 'una y cuándo.',
  'help.journal.writing.b3':
    'Cualquiera que ocupe el cargo puede añadir una nota a cualquier entrada, incluida una '
    + 'que empezó otra persona. Eso es deliberado: es la forma en que un sucesor responde a '
    + 'un predecesor debajo de lo que escribió en vez de empezar una entrada rival.',
  'help.journal.meetings.heading': 'Notas de reunión',
  'help.journal.meetings.b0':
    '**Notas de reunión** es el segundo botón, y crea una entrada de un tipo particular: '
    + 'una que registra un día, quién estaba en la sala, y qué se dijo.',
  'help.journal.meetings.b1.i0': 'Pulse **Notas de reunión**.',
  'help.journal.meetings.b1.i1':
    'Compruebe el título y el **Día de la reunión**: los dos se rellenan con hoy para '
    + 'empezar.',
  'help.journal.meetings.b1.i2':
    'En **Quiénes asistieron**, busque a cada familiar que estuvo y márquelo. Los nombres '
    + 'que ha elegido siguen enumerados encima del cuadro de búsqueda, así que una búsqueda '
    + 'que oculte uno no lo pierde.',
  'help.journal.meetings.b1.i3': 'Escriba lo que se discutió y se decidió en el cuadro de notas.',
  'help.journal.meetings.b1.i4': 'Pulse **Añadir entrada**.',
  'help.journal.meetings.b2':
    'Una reunión aparece en la lista marcada como **Notas de reunión**, con el día en que '
    + 'ocurrió y todas las personas que asistieron. Cualquiera que ocupe el cargo puede '
    + 'añadirle una nota después, igual que a cualquier otra entrada, que es la forma en que '
    + 'se registra una corrección, o algo que se recuerda más tarde.',
  'help.journal.meetings.b3':
    '**Quiénes asistieron solo lo puede cambiar quien registró la reunión.** Una lista de '
    + 'asistentes es una afirmación sobre una sala y no lleva el nombre de nadie contra ella, '
    + 'así que no es algo que dos cargos puedan sobrescribirse en silencio entre ellos. Si '
    + 'usted estuvo y se le dejó fuera, añada una nota diciéndolo: el registro muestra '
    + 'entonces las dos cosas.',
  'help.journal.meetings.b4':
    '**Votar sobre tareas todavía no está construido.** Todas las entradas de reunión '
    + 'llevan un panel que lo dice. Cuando exista, convertirá lo que decidió una reunión en '
    + 'tareas y dejará que las personas que asistieron voten sobre ellas; hasta entonces, '
    + 'escriba lo que se acordó en una nota.',
  'help.journal.editing.heading': 'Cambiar o quitar algo',
  'help.journal.editing.b0': 'Hay dos reglas, y cuál se aplica depende de qué esté cambiando.',
  'help.journal.editing.b1.i0.term': 'Una nota',
  'help.journal.editing.b1.i0.text':
    'Solo la persona que la escribió puede editarla o eliminarla: cualquier nota suya, esté '
    + 'donde esté en el hilo, no solo la más reciente. El lápiz y la papelera aparecen al '
    + 'lado de las notas que son suyas y en ninguna otra.',
  'help.journal.editing.b1.i1.term': 'La entrada en sí',
  'help.journal.editing.b1.i1.text':
    'Su título, el día de una reunión y quiénes asistieron pertenecen a quien la empezó. '
    + 'Todos los demás añaden notas.',
  'help.journal.editing.b2':
    'En cualquier caso solo dura mientras usted siga ocupando el cargo. Un excargo no '
    + 'conserva ninguna de las dos cosas, y todo lo que escribió se queda, que es la idea.',
  'help.journal.editing.b3':
    'Así que una nota que dejó la persona anterior a usted es suya para leerla y no para '
    + 'reescribirla. Si está equivocada o desactualizada, añada una nota diciéndolo: eso '
    + 'conserva tanto el original como la corrección, que es lo que hace que el cuaderno '
    + 'valga la pena leerlo años después.',
  'help.journal.editing.b4':
    'Eliminar una nota deja el resto de la entrada intacto. Eliminar una **entrada** se '
    + 'lleva todas las notas que hay debajo, para todas las personas que ocupan el cargo, '
    + 'ahora y después. Las dos cosas son permanentes y la pantalla le pide confirmación.',
  'help.journal.editing.b5':
    'Si un cargo se retira de los cargos de la directiva de la familia, su cuaderno se va '
    + 'con él. No queda ningún cargo al que las notas puedan seguir.',
  // ──── PART 9 — Gatherings (Documents, Bylaws, Gallery, Calendar) ──────────────
  'help.part.gatherings.title': 'Reuniones',
  'help.part.gatherings.blurb':
    'Poner la reunión en el calendario, y repartir el trabajo que lleva.',
  'help.documents.title': 'Documentos',
  'help.documents.summary':
    'Los registros archivados de la familia: qué se puede subir, cómo encontrar uno, y '
    + 'quién puede quitarlo.',
  'help.documents.what-it-is.heading': 'El archivador',
  'help.documents.what-it-is.b0':
    '[Documentos](/library/documents) es donde viven los registros de la familia: '
    + 'formularios, presentaciones, copias firmadas. Se movió a **Biblioteca** el 22-08-2026, '
    + 'al lado de los cuadernos que llevan sus cargos y de las actas y los estatutos de la '
    + 'familia, porque quien quiere uno es quien quiere los otros.',
  'help.documents.what-it-is.b1':
    '**Solo Excel, Word, PDF o CSV**, de hasta 25 MB. Las dos generaciones de los formatos '
    + 'de Office, porque un documento escrito en 2004 de verdad es un `.doc`. Una fotografía '
    + 'va en la [Galería](/community/gallery), que hace álbumes y etiquetado que esta lista '
    + 'nunca hará.',
  'help.documents.uploading.heading': 'Archivar algo',
  'help.documents.uploading.b0.i0': 'Pulse **Subir un documento**.',
  'help.documents.uploading.b0.i1':
    'Elija el archivo. El nombre se rellena solo con el nombre del archivo; cámbielo si '
    + 'quiere.',
  'help.documents.uploading.b0.i2': 'Añada una descripción si la necesita, y elija una categoría.',
  'help.documents.uploading.b0.i3': 'Pulse **Subir**.',
  'help.documents.uploading.b1':
    '**Tres categorías: Estatutos, Formularios y Otros.** Había cinco. *Fotos* se fue '
    + 'porque la [Galería](/community/gallery) es la pantalla para una imagen, y *Actas* se '
    + 'fue porque [Actas](/library/meeting-minutes) es una pantalla de verdad ahora. Un PDF '
    + 'con el acta de una reunión celebrada fuera del producto es **Otros**.',
  'help.documents.uploading.b2':
    'Un documento ya archivado en una de las categorías retiradas la conserva y sigue '
    + 'mostrándola. Nada reescribe la decisión de archivo de otra persona.',
  'help.documents.finding-and-removing.heading': 'Encontrar uno, y quitar uno',
  'help.documents.finding-and-removing.b0':
    'El cuadro de búsqueda coincide con el nombre y la descripción; el desplegable de '
    + 'categoría reduce a un solo tipo. Pulsar el nombre de un documento lo abre.',
  'help.documents.finding-and-removing.b1':
    '**Quien subió un documento puede eliminarlo.** Eliminar el de cualquiera necesita el '
    + 'permiso sin restricción: vea [Quién puede hacer qué](/help/who-can-do-what). El '
    + 'archivo se quita junto con la fila.',
  'help.bylaws.title': 'Estatutos',
  'help.bylaws.summary':
    'Las reglas por las que la familia acordó vivir, y buscar dentro de ellas, incluido lo '
    + 'que la búsqueda todavía no alcanza.',
  'help.bylaws.what-it-is.heading': 'Qué es esta pantalla',
  'help.bylaws.what-it-is.b0':
    '[Estatutos](/library/bylaws) contiene los documentos que rigen a la familia, artículo '
    + 'por artículo, y permite a cualquiera buscarlos. Todos los integrantes aprobados pueden '
    + 'leerlos: una regla que nadie puede leer no es una regla.',
  'help.bylaws.what-it-is.b1':
    'Un artículo tiene un número («Artículo IV»), un título, un resumen opcional, y o el '
    + 'texto escrito, o un documento subido, o las dos cosas.',
  'help.bylaws.not-finished.heading': 'Qué puede alcanzar la búsqueda y qué no',
  'help.bylaws.not-finished.b0':
    '**Esta pantalla es un andamiaje, y una parte de ella de verdad no está construida.** '
    + 'Leer el texto de un PDF o de un archivo de Word no está implementado, así que:',
  'help.bylaws.not-finished.b1.i0':
    'Un artículo cuyo texto usted **escribió o pegó** es buscable palabra por palabra.',
  'help.bylaws.not-finished.b1.i1':
    'Un artículo que es **solo un PDF o un archivo de Word subido** es buscable por su '
    + 'título, su número de artículo y su resumen, no por lo que hay dentro. Sigue subiéndose '
    + 'y sigue descargándose.',
  'help.bylaws.not-finished.b2':
    'Todos los artículos llevan una marca que dice cuál de las dos cosas son, y una '
    + 'búsqueda que no encontró nada también lo dice. Eso es deliberado: «sin resultado» y '
    + '«no indexado» son datos distintos, y un lector que no puede distinguirlos concluye que '
    + 'los estatutos no dicen algo que sí dicen.',
  'help.bylaws.not-finished.b3':
    'Hasta que eso esté construido, **pegar el texto es lo que hace que un artículo se '
    + 'pueda encontrar**. El formulario lo dice donde de otro modo no se le ocurriría.',
  'help.bylaws.searching.heading': 'Buscar',
  'help.bylaws.searching.b0':
    'Palabras completas, y entiende las terminaciones: buscar «reunión» encuentra '
    + '«reuniones». Ponga una frase entre comillas para que coincida como una sola, y ponga '
    + 'un menos delante de una palabra para excluirla.',
  'help.bylaws.searching.b1':
    'Deje el cuadro vacío y pulse **Limpiar** para volver a leerlos en orden, que es para '
    + 'lo que sirve la numeración de la propia familia.',
  'help.gallery.title': 'Galería',
  'help.gallery.summary':
    'Álbumes de las fotografías de la familia: subir un lote, etiquetar quién sale en cada '
    + 'una, y volver a encontrarlas.',
  'help.gallery.what-it-is.heading': 'Álbumes, no un montón',
  'help.gallery.what-it-is.b0':
    'La [Galería](/community/gallery) guarda las fotografías en **álbumes**: una reunión, '
    + 'una boda, un año. Un álbum tiene un nombre, una descripción opcional, y cualquier '
    + 'número de imágenes.',
  'help.gallery.what-it-is.b1':
    '**Las dos cosas se pueden cambiar después.** Pulse el lápiz que hay junto al '
    + 'título del álbum, o el de la esquina de su mosaico en la página de la Galería, y '
    + 'edite cualquiera de las dos. Las fotografías que contiene no se tocan: vea '
    + '[quién puede cambiar qué](#who-can-change-what).',
  'help.gallery.what-it-is.b2':
    'Se llamaba Fotos y estaba en Recursos hasta el 22-08-2026. La misma pantalla, con más '
    + 'cosas.',
  'help.gallery.what-it-is.b3':
    'Solo archivos de imagen: JPEG, PNG, WebP o GIF, de hasta 10 MB cada uno. Un HEIC '
    + 'directo de un iPhone se rechaza, porque ningún navegador salvo Safari puede mostrar '
    + 'uno; iOS convierte a JPEG cuando usted elige un archivo, así que en la práctica esto '
    + 'solo afecta a un archivo que usted mismo haya copiado del teléfono.',
  'help.gallery.uploading.heading': 'Añadir fotografías',
  'help.gallery.uploading.b0.i0': 'Abra el álbum.',
  'help.gallery.uploading.b0.i1': 'Pulse **Añadir fotografías**.',
  'help.gallery.uploading.b0.i2':
    'Pulse **Elegir archivos** y seleccione todos los que quiera a la vez.',
  'help.gallery.uploading.b0.i3': 'Póngales un pie si comparten uno: se aplica a todo el lote.',
  'help.gallery.uploading.b0.i4': 'Pulse **Subir**.',
  'help.gallery.uploading.b1':
    '**Un lote no es todo o nada.** Si un archivo es del tipo equivocado o demasiado '
    + 'grande, el resto se sube igual y el panel nombra los que no lo hicieron, y por qué. No '
    + 'tiene que encontrar el archivo ofensor y empezar de nuevo.',
  'help.gallery.uploading.b2':
    '**Un lote grande sube de doce en doce**, y el botón los va contando según llegan: '
    + '«Subiendo 27 de 200». Deje el panel abierto hasta que termine: cerrar la pestaña a '
    + 'medias conserva lo que ya haya llegado y detiene el resto.',
  'help.gallery.uploading.b3':
    'El pie se aplica a todas las fotografías del lote, lo cual es correcto para «sábado, '
    + 'en el lago» y equivocado para una imagen que necesita el suyo. Arregle una en concreto '
    + 'después en la vista de lista: vea [cambiar un pie](#tidying).',
  'help.gallery.tidying.heading': 'Pies, etiquetas y la vista de lista',
  'help.gallery.tidying.b0':
    'Hay dos formas de mirar un álbum, y el interruptor está encima. **Cuadrícula** es para '
    + 'mirar: miniaturas cuadradas, y pulsar una la abre a tamaño completo. **Lista** es para '
    + 'ordenar: imágenes más pequeñas, una por fila, con el pie y las etiquetas editables ahí '
    + 'mismo.',
  'help.gallery.tidying.b1':
    '**Etiquetar** dice quién sale en una fotografía. Pulse **Etiquetar a alguien** en una '
    + 'fila y busque en la familia; la búsqueda encuentra «José» si escribe «jose» y '
    + '«O’Connor» si escribe «oconnor». Pulse la × de una etiqueta para quitarla.',
  'help.gallery.tidying.b2':
    'Ninguna de las dos vistas oculta nada: los filtros que están encima del álbum son los '
    + 'que lo reducen, y reducen las dos. Vea [Encontrar una fotografía](#finding).',
  'help.gallery.finding.heading': 'Encontrar una fotografía',
  'help.gallery.finding.b0': 'Dos filtros están encima de un álbum, y reducen juntos.',
  'help.gallery.finding.b1.i0.term': 'Buscar en los pies',
  'help.gallery.finding.b1.i0.text':
    'Escriba cualquier parte de un pie. Varias palabras coinciden en cualquier orden, así '
    + 'que «reunión lago» encuentra «Tres días en el lago: reunión de 2026». Los acentos y la '
    + 'puntuación se ignoran en los dos lados: «jose» encuentra «José» y «abuelas» encuentra '
    + '«Abuela’s». Una fotografía sin pie nunca coincide con una búsqueda.',
  'help.gallery.finding.b1.i1.term': 'Quién sale en ella',
  'help.gallery.finding.b1.i1.text':
    'Elija tantas personas etiquetadas como quiera. Una fotografía se muestra cuando tiene '
    + 'a CUALQUIERA de ellas, así que elegir tres amplía el resultado en vez de reducirlo. El '
    + 'botón lleva un recuento mientras el filtro está activo, y solo aparece cuando hay '
    + 'alguien etiquetado en este álbum.',
  'help.gallery.finding.b2':
    'Una línea debajo de la barra dice cuántas de las fotografías del álbum se están '
    + 'mostrando y por qué, con **Limpiar filtros** para volver a poner todas. Ninguno de los '
    + 'dos filtros cambia nada para nadie más: es lo que usted está mirando, no lo que '
    + 'contiene el álbum.',
  'help.gallery.finding.b3':
    '**Buscar en todos los álbumes** es el segundo elemento del menú de [Galería](/community/gallery), '
    + 'junto a **Álbumes**. Toma las mismas dos cosas — palabras de una descripción y '
    + 'cualquiera etiquetado — y recorre de una vez todas las fotografías de la familia '
    + 'en lugar de un solo álbum. **Al pulsar un resultado se abre la fotografía**, y las '
    + 'flechas recorren entonces todo lo que encontró la búsqueda, no un solo álbum. El '
    + 'nombre del álbum DEBAJO de cada resultado es un enlace, para cuando lo que quería '
    + 'saber era dónde está guardada la imagen.',
  'help.gallery.finding.b4':
    'Las dos búsquedas se comportan de forma distinta a propósito. Dentro de un álbum, '
    + 'elegir a tres personas etiquetadas AMPLÍA el resultado: obtiene las fotografías en '
    + 'las que aparezca cualquiera de ellas. En el menú Buscar, elegir a tres lo REDUCE: '
    + 'obtiene solo las fotografías en las que aparezcan las tres. El primero es un filtro '
    + 'sobre un conjunto que ya está mirando; el segundo es una pregunta, y decir más '
    + 'sobre lo que busca debería devolver menos.',
  'help.gallery.who-can-change-what.heading': 'Quién puede cambiar qué',
  'help.gallery.who-can-change-what.b0':
    '**Una fotografía pertenece a quien la subió.** Esa persona puede cambiar su pie y '
    + 'eliminarla. Cualquier otra necesita el permiso sin restricción sobre la Galería: vea '
    + '[Quién puede hacer qué](/help/who-can-do-what).',
  'help.gallery.who-can-change-what.b1.i0.term': 'Pie',
  'help.gallery.who-can-change-what.b1.i0.text':
    'Quien la subió, o alguien con permiso para editar el de cualquiera.',
  'help.gallery.who-can-change-what.b1.i1.term': 'Etiquetas',
  'help.gallery.who-can-change-what.b1.i1.text':
    'Cualquiera que pueda editar la galería. Etiquetar no es sobre de quién es la '
    + 'fotografía: es sobre quién sale en ella, y la persona que reconoce a un primo a menudo '
    + 'no es la que tomó la imagen.',
  'help.gallery.who-can-change-what.b1.i2.term': 'Eliminar una fotografía',
  'help.gallery.who-can-change-what.b1.i2.text':
    'Quien la subió, o alguien con el permiso sin restricción. El archivo de imagen se '
    + 'quita además de la fila.',
  'help.gallery.who-can-change-what.b1.i3.term': 'Cambiar el nombre de un álbum',
  'help.gallery.who-can-change-what.b1.i3.text':
    'Quien lo creó, o alguien con permiso para editar el de cualquiera: el mismo nivel '
    + 'que un pie, y deliberadamente uno por debajo de eliminar. El control es el lápiz que '
    + 'hay junto al título del álbum, y el de la esquina de su mosaico en la página de la '
    + 'Galería. Cambia el nombre y la descripción y nada más.',
  'help.gallery.who-can-change-what.b1.i4.term': 'Eliminar un álbum',
  'help.gallery.who-can-change-what.b1.i4.text':
    'Quien lo creó, o alguien con el permiso sin restricción, que es lo que tiene un '
    + 'administrador. El control es la papelera en la esquina del mosaico del álbum en la '
    + 'página de la Galería. Se lleva todas las fotografías del álbum, y los archivos de '
    + 'imagen también; la confirmación dice cuántas antes de que usted se comprometa.',
  'help.gallery.who-can-change-what.b2':
    'Eliminar un álbum no es reversible ni parcialmente reversible. La advertencia cuenta '
    + 'las fotografías exactamente por ese motivo.',
  'help.calendar.title': 'Calendario',
  'help.calendar.summary':
    'La cuadrícula del mes que pone todas las reuniones, juntas y ventanas de elección en '
    + 'el día en que caen, cómo moverse entre meses, y qué hace en un teléfono.',
  'help.calendar.what-it-is.heading': 'Un mes a la vez',
  'help.calendar.what-it-is.b0':
    '[Calendario](/gatherings/calendar) es una cuadrícula de mes de verdad — semanas hacia '
    + 'abajo, días de la semana a lo ancho, domingo primero — con tres cosas en los días en '
    + 'que caen: las **reuniones** de la familia, las **juntas** a las que está convocado, y '
    + 'las ventanas abiertas de **nominación y votación** de sus elecciones. No crea nada. '
    + 'Todas las entradas son un enlace a la pantalla que las posee — '
    + '[Reuniones](/gatherings), [Actas](/library/meeting-minutes) o '
    + '[Elecciones](/community/elections) — que es donde vive y se edita la cosa en sí.',
  'help.calendar.what-it-is.b1':
    'La leyenda nombra solo lo que de hecho está en la cuadrícula este mes, y todas las '
    + 'entradas dicen de qué tipo son con palabras además de con color, así que la distinción '
    + 'sobrevive tanto a un lector de pantalla como a un lector que no puede separar los '
    + 'tonos. **Reunión destacada** es dorada, **Reunión** es burdeos suave, **Junta** es '
    + 'burdeos relleno, y una elección es terracota cálida: con contorno mientras las '
    + '**Nominaciones** están abiertas, rellena en cuanto lo está la **Votación**. Había una '
    + 'sexta para un Evento hasta el 19-08-2026; ese producto está retirado.',
  'help.calendar.reading.heading': 'Leer un día',
  'help.calendar.reading.b0':
    'Hoy está marcado. **Cualquier cosa que corra a lo largo de varios días se dibuja como '
    + 'una sola barra a lo largo de ellos**, con su nombre en el extremo izquierdo: una '
    + 'reunión de tres días es una barra de tres días de ancho, y una quincena de votación es '
    + 'una barra en cada una de las dos semanas que cruza. Ese es todo el motivo de que '
    + 'exista una fecha de cierre. Una elección aporta dos barras en vez de una: la ventana '
    + 'de nominación y, tras un hueco, la ventana de votación. Los días entre ellas están '
    + 'deliberadamente vacíos, porque en esos días la lista está cerrada y no hay nada que '
    + 'hacer todavía.',
  'help.calendar.reading.b1':
    '**Una barra con un extremo cuadrado está cortada, no terminada.** Una serie que cruza '
    + 'un sábado tiene que dibujarse como una barra por semana, así que los bordes planos son '
    + 'donde continúa hacia la fila de arriba o de abajo; los extremos redondeados son donde '
    + 'la cosa en sí empieza y acaba.',
  'help.calendar.reading.b2':
    'La cuadrícula siempre muestra semanas completas, así que la primera y la última fila '
    + 'llevan unos días de los meses de al lado. Esos días conservan sus entradas: una '
    + 'reunión que empieza el día 1 se ve en la última fila del mes anterior, que es donde '
    + 'uno la estaría buscando una semana antes.',
  'help.calendar.reading.b3':
    'Era una ficha por día hasta el 22-08-2026: una ventana de elección de dos días se leía '
    + 'como dos cosas separadas con el mismo nombre.',
  'help.calendar.moving.heading': 'Moverse entre meses',
  'help.calendar.moving.b0':
    'Los enlaces a cada lado del encabezado son el mes anterior y el mes siguiente, cada '
    + 'uno nombrado, con **Este mes** entre ellos. Los tres son enlaces de verdad, así que '
    + 'cmd-clic, clic con el botón central y copiar la dirección del enlace funcionan en '
    + 'ellos.',
  'help.calendar.moving.b1':
    'El mes está en la dirección, lo que significa que un enlace a un mes es un enlace a '
    + 'ese mes: [junio de 2027](/gatherings/calendar?month=2027-06) abre junio de 2027 para '
    + 'cualquiera a quien se lo envíe, y se puede marcar. Una dirección que la página no '
    + 'puede leer vuelve al mes actual en vez de dibujar un mes que no existe.',
  'help.calendar.phone.heading': 'En un teléfono',
  'help.calendar.phone.b0':
    'Por debajo del ancho que necesita una cuadrícula de siete columnas, el calendario se '
    + 'convierte en una lista de los días que tienen algo, en orden, con el día de la semana '
    + 'y la fecha al lado de cada uno. Un día prestado de un mes vecino se etiqueta como '
    + '**Mes anterior** o **Mes siguiente**, ya que ya no tiene una columna que lo diga.',
  'help.calendar.phone.b1':
    'Eso es una segunda vista del mismo mes y no un segundo calendario: las mismas '
    + 'entradas, los mismos enlaces. Es una elección deliberada frente a apretar la '
    + 'cuadrícula: al ancho de un teléfono un día es demasiado estrecho para contener una '
    + 'fecha y un título, y un mes de celdas mayoritariamente vacías es una pantalla de nada '
    + 'cuando la pregunta es qué viene.',
  'help.calendar.phone.b2':
    '**Una serie de días es una fila por día aquí, no una barra.** La lista no tiene un eje '
    + 'de izquierda a derecha por el que una barra pueda estirarse, así que una reunión de '
    + 'tres días aparece bajo cada una de sus tres fechas con su nombre en cada una, que es '
    + 'lo que uno quiere de una lista de días.',
  'help.calendar.missing.heading': 'Cuando algo no está en él',
  'help.calendar.missing.b0':
    'Aparece una línea encima de la cuadrícula cuando una de las tres fuentes falta en '
    + 'ella, y nombra cuál: reuniones, juntas o elecciones. No puede decir POR QUÉ, y no lo '
    + 'adivina: significa o que la pantalla no se ha compartido con usted, o que no se pudo '
    + 'leer justo ahora.',
  'help.calendar.missing.b1':
    'En cualquier caso el mes que está viendo no es el mes completo, que es la razón de que '
    + 'la línea exista: un agosto vacío sobre el que no se dice nada se lee como un dato '
    + 'sobre la familia. Un mes que de verdad no tiene nada dice eso en su lugar.',
  // ──── PART 9 — Gatherings (Gatherings) ────────────────────────────────────────
  'help.gatherings.title': 'Reuniones',
  'help.gatherings.summary':
    'Qué es una reunión, cómo se programa una, cómo leer sus tareas y su presupuesto, y '
    + 'dónde están sus propias tareas.',
  'help.gatherings.what-it-is.heading': 'Una reunión, y en qué se diferencia de un evento',
  'help.gatherings.what-it-is.b0':
    '[Reuniones](/gatherings) es la familia organizando el trabajo de juntarse. Una reunión '
    + 'es una ocasión con nombre — una reunión familiar, un homenaje, un banquete — '
    + 'desglosada en los trabajos que hacen falta, con el nombre de un familiar al lado de '
    + 'cada uno y una respuesta que alguien acepta. Su pregunta es quién hace qué, y si se ha '
    + 'hecho y se ha aceptado.',
  'help.gatherings.what-it-is.b1':
    'La pantalla son dos paneles. **Reuniones** es todo lo que la familia está planeando, '
    + 'cubierto por este capítulo; **Mis tareas** es su propia parte de ello, cubierta por '
    + '[Mis tareas de la reunión](/help/gathering-tasks#what-it-is). Los dos se otorgan por '
    + 'separado, así que una familia puede dar a alguien sus propias tareas sin darle la '
    + 'lista de toda la familia.',
  'help.gatherings.what-it-is.b2':
    'Había un producto de Eventos aparte hasta el 19-08-2026 — confirmaciones de asistencia '
    + 'por hogar, bloques de habitaciones de hotel y registro de entrada el día — y se ha '
    + 'ido. Reuniones lo reemplazó, y esas tres cosas no están hoy en el producto: un paso de '
    + 'una reunión puede PEDIR cualquiera de ellas a un familiar, pero no hay recuento de '
    + 'asistentes, ni bloque de habitaciones, ni lista de registro. Todo lo que la familia '
    + 'había registrado se conserva; no se le puede añadir nada nuevo.',
  'help.gatherings.what-it-is.b3':
    'Una reunión se puede construir a partir de una o más plantillas: una lista ordenada y '
    + 'con nombre de pasos que alguien escribió una vez. Todos los pasos de todas las '
    + 'plantillas de las que se construye se convierten en una tarea de la reunión, así que '
    + 'nada se olvida de un año al siguiente. La biblioteca es [Plantillas de '
    + 'reunión](/admin/gatherings/templates).',
  'help.gatherings.what-it-is.b4':
    'Una reunión sin plantilla es una fecha en [el calendario](/gatherings/calendar) con un '
    + 'lugar y una descripción y ninguna tarea, que es todo lo que algunas ocasiones '
    + 'necesitan, y es por donde a menudo se empieza. Quien organiza puede añadirle una '
    + 'plantilla después, y los pasos se convierten en tareas entonces.',
  'help.gatherings.what-it-is.b5':
    'Cada una de esas plantillas es un **segmento**: una parte de la ocasión con su propio '
    + 'día y su propio lugar. Eso es lo que permite que una reunión sea de tres días — la '
    + 'Bienvenida el viernes por la tarde en una dirección, el Picnic el sábado en otra, la '
    + 'Despedida el domingo por la mañana — en vez de un bloque de fechas con todo archivado '
    + 'debajo. Una reunión que ocurre toda a la vez en un solo lugar simplemente no indica '
    + 'ninguna de las dos cosas, y se lee como siempre.',
  'help.gatherings.browsing.heading': 'Próximas, y ya celebradas',
  'help.gatherings.browsing.b0':
    'La página son dos listas. **Próximas** contiene todo lo que no ha terminado, de lo más '
    + 'cercano a lo más lejano; **Ya celebradas** contiene el resto, de lo más reciente a lo '
    + 'más antiguo. Una reunión que corre a lo largo de varios días se queda en Próximas '
    + 'todos y cada uno de ellos y está marcada como **Ocurriendo ahora** mientras lo hace.',
  'help.gatherings.browsing.b1':
    'Cada tarjeta lleva las fechas, el lugar, lo que ha avanzado el trabajo — «4 de 9 '
    + 'tareas aprobadas», o **Todavía sin tareas** para una reunión a la que no se ha añadido '
    + 'nada — y un estado. El estado lo fija quien organiza en vez de deducirse del '
    + 'calendario, porque una reunión se puede cancelar sin que sus fechas se muevan:',
  'help.gatherings.browsing.b2.i0.term': 'En preparación',
  'help.gatherings.browsing.b2.i0.text':
    'Se está montando. Las fechas todavía pueden moverse. Solo una reunión construida a '
    + 'partir de plantillas empieza aquí; una que es solo una fecha empieza en Programada, '
    + 'porque no hay nada que preparar.',
  'help.gatherings.browsing.b2.i1.term': 'Programada',
  'help.gatherings.browsing.b2.i1.text': 'Fijada, y adelante.',
  'help.gatherings.browsing.b2.i2.term': 'Completada',
  'help.gatherings.browsing.b2.i2.text': 'Terminada, y declarada terminada por quien la dirigió.',
  'help.gatherings.browsing.b2.i3.term': 'Cancelada',
  'help.gatherings.browsing.b2.i3.text':
    'Suspendida. No se elimina nada y se puede volver a activar.',
  'help.gatherings.browsing.b3':
    '**Destacada** marca una reunión que la familia debería ver primero: recibe una banda '
    + 'en la parte superior de [el panel](/dashboard). Varias pueden llevar la marca a la '
    + 'vez, y el panel muestra la más cercana que sigue por delante, así que la reunión del '
    + 'año pasado nunca bloquea la de este año.',
  'help.gatherings.scheduling.heading': 'Programar una',
  'help.gatherings.scheduling.b0':
    '**Programar una reunión** aparece cuando usted puede empezar una. El formulario pide '
    + 'las plantillas antes del título, porque marcar una cambia para qué sirve el resto del '
    + 'formulario:',
  'help.gatherings.scheduling.b1.i0': 'Pulse **Programar una reunión**.',
  'help.gatherings.scheduling.b1.i1':
    'Marque las plantillas que quiera en **Construida a partir de**. Todos los pasos de '
    + 'todas las que marque se convierten en una tarea, lista para repartir, y cada plantilla '
    + 'que marque se convierte en un segmento de la reunión. No marque ninguna y la reunión '
    + 'es una fecha sin tareas.',
  'help.gatherings.scheduling.b1.i2': 'Rellene **Título**.',
  'help.gatherings.scheduling.b1.i3':
    'Rellene **Cuándo**: vea más abajo. Una fecha es todo lo que se exige.',
  'help.gatherings.scheduling.b1.i4': '**Dónde** y **Qué es** son opcionales.',
  'help.gatherings.scheduling.b1.i5':
    'Pulse **Programar reunión**. Aterriza en la reunión en sí, donde le esperan las tareas '
    + 'que acaba de crear.',
  'help.gatherings.scheduling.b2':
    'Cada plantilla decide por sí misma quién puede programar a partir de ella, así que la '
    + 'lista que se ofrece aquí no es toda la biblioteca: una fijada solo para '
    + 'Administradores no está en ella a menos que usted pueda gestionar reuniones, y una '
    + 'plantilla archivada no puede empezar nada nuevo. Cuando no se ofrece nada en absoluto, '
    + 'el formulario dice que la reunión será una fecha sin tareas y apunta a la biblioteca '
    + 'para quien pueda escribir una: nada va mal con su acceso.',
  'help.gatherings.when.heading': 'Cuándo ocurre',
  'help.gatherings.when.b0':
    '**Cuándo** es el mismo conjunto de controles en cualquier lugar donde se crea o se '
    + 'edita una reunión. Una fecha es lo único en lo que insiste; todo lo demás está ahí '
    + 'cuando lo necesita.',
  'help.gatherings.when.b1.i0.term': 'Empieza',
  'help.gatherings.when.b1.i0.text':
    'El día en que empieza y — si quiere decirlo — la hora. Deje la hora vacía y la reunión '
    + 'es simplemente «ese día», que es como se introducen la mayoría.',
  'help.gatherings.when.b1.i1.term': 'Hora de fin',
  'help.gatherings.when.b1.i1.text':
    'Cuándo termina. En un solo día esto es una hora y nada más: un picnic que va de 11 a 4 '
    + 'tiene hora de fin y no fecha de fin.',
  'help.gatherings.when.b1.i2.term': 'Dura más de un día',
  'help.gatherings.when.b1.i2.text':
    'Marque esto y aparece una pregunta más, porque dos cosas muy distintas duran las dos '
    + 'más de un día.',
  'help.gatherings.when.b2': 'Esa pregunta es la importante:',
  'help.gatherings.when.b3.i0.term': 'Un bloque continuo',
  'help.gatherings.when.b3.i0.text':
    'Una reunión desde el viernes por la tarde hasta el domingo a mediodía. Dé el día en '
    + 'que termina y, si quiere, la hora. Se dibuja como una sola barra que abarca esos días '
    + 'en [el calendario](/gatherings/calendar).',
  'help.gatherings.when.b3.i1.term': 'Días separados, la misma reunión',
  'help.gatherings.when.b3.i1.text':
    'Una reunión de comisión tres sábados. Añada una fila por cada día, cada una con sus '
    + 'propias horas. Cada una se dibuja como su propia entrada en el calendario, todas '
    + 'llevando el título de esta reunión.',
  'help.gatherings.when.b4':
    'La diferencia importa más de lo que parece. Antes de que esto existiera, tres sábados '
    + 'había que introducirlos como un primer día y un último día, lo que ponía una barra a '
    + 'lo largo de toda la quincena y le decía a la familia que se estaban reuniendo dos '
    + 'semanas. Los días separados dicen lo que de hecho está pasando.',
  'help.gatherings.when.b5':
    '**El fin nunca puede ir antes del inicio.** Los selectores de fecha atenúan los días '
    + 'imposibles, y si usted llega ahí por otro camino el formulario lo dice en vez de '
    + 'guardarlo. Lo mismo vale para las horas dentro de un día — de 2 de la tarde a 9 de la '
    + 'mañana no es una reunión — mientras que a lo largo de varios días es perfectamente '
    + 'ordinario, así que del viernes a las 6 de la tarde al domingo a las 11 de la mañana se '
    + 'acepta.',
  'help.gatherings.when.b6':
    '**Ponga una hora y se le pregunta en qué huso horario está**, empezando por el suyo. '
    + 'La hora se muestra después exactamente como usted la escribió, con ese huso nombrado '
    + 'al lado: 11:00 CDT.',
  'help.gatherings.when.b7':
    'Nada se convierte nunca. Una hora aquí significa lo que dice donde está la reunión, '
    + 'exactamente como lo haría en una invitación impresa, y todos los familiares ven la '
    + 'misma cifra: el huso se nombra para que alguien de otro sitio sepa qué hacer con ella, '
    + 'no para que el producto la mueva en silencio.',
  'help.gatherings.the-page.heading': 'La página propia de una reunión',
  'help.gatherings.the-page.b0':
    'El título, las fechas, el lugar, y después **Tareas**: todos los trabajos de la '
    + 'reunión, agrupados por el segmento al que pertenecen, en el orden en que se van a '
    + 'repartir. Cada grupo lleva por encabezado el nombre de ese segmento, y debajo el '
    + 'propio día y lugar del segmento cuando quien organiza los ha indicado; un segmento que '
    + 'no indica ninguno de los dos lleva por encabezado solo su nombre. Una tarea cuya '
    + 'plantilla se ha desvinculado desde entonces se agrupa en **Sin plantilla** en vez de '
    + 'descartarse, porque sigue siendo algo que se le pidió a un familiar.',
  'help.gatherings.the-page.b1':
    'Cada fila da a la tarea su persona, su estado, su fecha límite, su partida de '
    + 'presupuesto y la respuesta aceptada. En cuanto hay más de unas pocas, **Buscar una '
    + 'tarea** reduce por trabajo o por nombre y **Mostrando** reduce a un solo estado.',
  'help.gatherings.the-page.b2.i0.term': 'Sin empezar',
  'help.gatherings.the-page.b2.i0.text': 'Nadie ha enviado nada todavía.',
  'help.gatherings.the-page.b2.i1.term': 'Esperando revisión',
  'help.gatherings.the-page.b2.i1.text': 'Hay una respuesta y nadie ha decidido sobre ella.',
  'help.gatherings.the-page.b2.i2.term': 'Aprobada',
  'help.gatherings.the-page.b2.i2.text':
    'Aceptada. Esa respuesta es el registro que la familia tiene de ella y la persona que '
    + 'la envió no puede cambiarla.',
  'help.gatherings.the-page.b2.i3.term': 'Necesita otra mirada',
  'help.gatherings.the-page.b2.i3.text':
    'Devuelta con notas. Las notas están en la fila, y quien tiene la tarea las lee en [Mis '
    + 'tareas de la reunión](/gatherings/my-tasks).',
  'help.gatherings.the-page.b3':
    '**Organizar esta reunión** aparece para alguien que puede dirigirla y lleva a la misma '
    + 'reunión en [Gestión de reuniones](/admin/gatherings), donde el trabajo se reparte y se '
    + 'decide sobre él. En el plan Gratis dice **Editar esta reunión** y va al mismo sitio: '
    + 'no hay trabajo que repartir, así que la consola es donde se cambian el título, las '
    + 'fechas, el lugar y el estado.',
  'help.gatherings.free-plan.heading': 'Las reuniones en el plan Gratis',
  'help.gatherings.free-plan.b0':
    'Una reunión es una fecha, un lugar y una descripción en el plan Gratis, y eso es una '
    + 'función completa: va a [el calendario](/gatherings/calendar), todos los familiares '
    + 'pueden verla, y se puede editar o cancelar en cualquier momento.',
  'help.gatherings.free-plan.b1':
    'Lo que Gratis no incluye es la mitad de la planificación: las listas de comprobación a '
    + 'partir de las cuales se construye una reunión, las tareas repartidas a familiares por '
    + 'su nombre, y el presupuesto sacado de un fondo. Así que no hay estado **En '
    + 'preparación**, ni **Segmentos**, ni **Tareas**, y nada que organizar; la página de la '
    + 'reunión dice qué añadirían esas cosas en vez de mostrar paneles vacíos para ellas.',
  'help.gatherings.free-plan.b2':
    'No se pierde nada quedándose en Gratis y no se pierde nada al dejarlo. Una familia que '
    + 'sube puede empezar a repartir trabajo en reuniones que ya tiene, y una que baja '
    + 'conserva todas las tareas y respuestas ya registradas: simplemente no puede añadir '
    + 'más.',
  'help.gatherings.budget.heading': 'La banda de Presupuesto',
  'help.gatherings.budget.b0':
    'Una reunión puede llevar un presupuesto sacado de uno de los fondos de la familia. '
    + 'Cuando lo lleva, la banda de **Presupuesto** está encima de las tareas con cuatro '
    + 'cifras:',
  'help.gatherings.budget.b1.i0.term': 'Presupuestado',
  'help.gatherings.budget.b1.i0.text': 'Lo que esta reunión planea gastar en total.',
  'help.gatherings.budget.b1.i1.term': 'Reclamado por las tareas',
  'help.gatherings.budget.b1.i1.text':
    'Las partidas de presupuesto de cada tarea sumadas: lo que se ha reservado para un '
    + 'trabajo concreto.',
  'help.gatherings.budget.b1.i2.term': 'Sin asignar',
  'help.gatherings.budget.b1.i2.text':
    'Presupuestado menos reclamado: lo que queda por repartir. Dice Por encima del '
    + 'presupuesto en cuanto las partidas lo han superado.',
  'help.gatherings.budget.b1.i3.term': 'En el fondo',
  'help.gatherings.budget.b1.i3.text':
    'Lo que el fondo tiene de hecho, y cuánto de eso están reclamando ya otras reuniones.',
  'help.gatherings.budget.b2':
    'Un presupuesto puede ser mayor que el fondo del que se saca, porque una familia planea '
    + 'una reunión antes de haber recaudado el dinero para una. Cuando lo es, una línea roja '
    + 'dice en cuánto; y aparece una segunda línea roja cuando esta reunión cabe en el fondo '
    + 'por sí sola pero no una vez que se cuentan las otras reuniones que sacan del mismo '
    + 'fondo. Ninguna de las dos es un rechazo. Son las cifras que dicen lo que cuesta el '
    + 'plan.',
  'help.gatherings.budget.b3':
    'La línea más discreta de debajo es otra cosa y deliberadamente no es roja: dice que '
    + 'las partidas de las tareas juntas reclaman más de lo que la reunión presupuestó. No se '
    + 'ha gastado nada, y se resuelve subiendo el presupuesto o recortando una partida.',
  'help.gatherings.budget.b4':
    'La banda está ausente en algunas reuniones, y ausente no es vacía. Cuando el dinero de '
    + 'una reunión no se ha compartido con usted no hay banda en absoluto, en vez de una '
    + 'banda diciendo que está oculto, que es otra cosa distinta de una reunión que nadie ha '
    + 'presupuestado; y esa muestra la banda sin nada en ella. Vea [Quién puede hacer '
    + 'qué](/help/who-can-do-what#one-template).',
  // ──── PART 9 — Gatherings (My Gathering Tasks) ────────────────────────────────
  'help.gathering-tasks.title': 'Mis tareas de la reunión',
  'help.gathering-tasks.summary':
    'Las tareas de la reunión que se le han dado, el tipo de respuesta que pide cada una, y '
    + 'qué hacer cuando una vuelve con notas.',
  'help.gathering-tasks.what-it-is.heading': 'Su parte de una reunión',
  'help.gathering-tasks.what-it-is.b0':
    '**Mis tareas** es el segundo panel de [Reuniones](/gatherings), y es todo lo que '
    + 'alguien le ha pedido hacer para una reunión, en todas las reuniones, con la fecha '
    + 'límite más cercana primero; una tarea sin fecha límite va al final. La pestaña lleva '
    + 'el recuento de lo que está esperando por usted, y la línea de arriba dice por separado '
    + 'cuántas han vuelto para otra mirada.',
  'help.gathering-tasks.what-it-is.b1':
    'Tenía su propia fila de menú hasta el 19-08-2026 y ahora es un panel. La dirección '
    + 'antigua sigue funcionando y aterriza en el panel, que es lo que mantiene un enlace de '
    + 'una notificación antigua apuntando al lugar correcto. Una Acción rápida del '
    + '[Panel](/dashboard) aparece cuando hay algo esperando por usted y desaparece cuando no '
    + 'hay nada.',
  'help.gathering-tasks.what-it-is.b2':
    'Cada tarjeta nombra la reunión, la plantilla de la que vino la tarea, cuándo vence y '
    + 'cuánto puede gastar. Una tarea pasada de su fecha límite está marcada en vez de '
    + 'olvidarse en silencio. El texto de ayuda que llevara el paso se imprime debajo del '
    + 'título: eso es la persona que lo escribió diciéndole qué cuenta como hecho.',
  'help.gathering-tasks.what-it-is.b3':
    'LO QUE HACE QUE UNA TAREA SEA DISTINTA DE UN FORMULARIO QUE USTED RELLENA es lo que '
    + 'pasa después de que responde. Va a quien organiza, que la acepta o la devuelve con '
    + 'notas; así que una tarea está terminada cuando alguien lo ha dicho, no cuando usted ha '
    + 'escrito algo.',
  'help.gathering-tasks.what-it-is.b4':
    'El panel está siempre ahí y uno vacío dice que no se le ha asignado nada. Ese es el '
    + 'estado previsto para la mayoría de los integrantes la mayor parte del tiempo, y no una '
    + 'falla; y está siempre ahí para que una tarea que le den esta mañana se pueda encontrar '
    + 'esta mañana.',
  'help.gathering-tasks.answering.heading': 'Qué pide una tarea',
  'help.gathering-tasks.answering.b0':
    'Un paso dice qué tipo de respuesta quiere y usted recibe el campo que corresponde. No '
    + 'hay barra libre: una respuesta que no encaja con el tipo se rechaza, con el motivo y '
    + 'una línea que dice qué espera el campo.',
  'help.gathering-tasks.answering.b1.i0.term': 'Respuesta corta',
  'help.gathering-tasks.answering.b1.i0.text':
    'Una línea: un nombre, un número de teléfono, un local.',
  'help.gathering-tasks.answering.b1.i1.term': 'Respuesta larga',
  'help.gathering-tasks.answering.b1.i1.text':
    'Un párrafo: notas, una descripción, una explicación.',
  'help.gathering-tasks.answering.b1.i2.term': 'Una fecha',
  'help.gathering-tasks.answering.b1.i2.text': 'Una fecha del calendario, desde un campo de fecha.',
  'help.gathering-tasks.answering.b1.i3.term': 'Una lista',
  'help.gathering-tasks.answering.b1.i3.text':
    'Cualquier número de líneas. El cuadro dice **Un elemento por línea**, y una línea '
    + 'vacía se descarta en vez de registrarse como un elemento en blanco.',
  'help.gathering-tasks.answering.b1.i4.term': 'Sí o no',
  'help.gathering-tasks.answering.b1.i4.text':
    'Una decisión, como un par de opciones. Tiene que elegir una: dejarlo en paz no es una '
    + 'respuesta, y nada se lee como No de su parte.',
  'help.gathering-tasks.answering.b1.i5.term': 'Un número',
  'help.gathering-tasks.answering.b1.i5.text':
    'Un recuento o una cantidad. Se permite una fracción, porque «cuántos kilos de brisket» '
    + 'es una pregunta real.',
  'help.gathering-tasks.answering.b1.i6.term': 'Una cantidad de dinero',
  'help.gathering-tasks.answering.b1.i6.text':
    'Una cantidad en dólares con los centavos después del punto: escriba 450.00 para '
    + 'cuatrocientos cincuenta dólares. El cuadro lleva un signo de dólar delante, y uno '
    + 'vacío está sin responder en vez de ser nada gastado.',
  'help.gathering-tasks.answering.b2':
    'Un campo vacío nunca se envía. Pulsar el botón sin nada en la respuesta dice que '
    + 'todavía no hay nada que enviar, que es lo que evita que un cuadro de dinero sin tocar '
    + 'se archive como cero y se lea como respondido en todas las pantallas de después.',
  'help.gathering-tasks.sending.heading': 'Enviar una respuesta',
  'help.gathering-tasks.sending.b0.i0': 'Rellene **Su respuesta**.',
  'help.gathering-tasks.sending.b0.i1':
    'Añada cualquier cosa que valga la pena decir en **¿Algo que decirle a quien '
    + 'organiza?**. Es opcional, y viaja con la respuesta en vez de reemplazarla.',
  'help.gathering-tasks.sending.b0.i2': 'Pulse **Enviar para revisión**.',
  'help.gathering-tasks.sending.b1':
    'Lo que envió se le muestra después encima del formulario, con el encabezado **Enviado '
    + 'para revisión** y la fecha. Hasta que alguien decida sobre él puede enviar algo '
    + 'distinto — el botón dice **Reemplazar mi respuesta** — y todas las versiones se '
    + 'conservan, así que el intercambio se puede leer completo y no solo su última línea.',
  'help.gathering-tasks.sending.b2':
    'A quien pueda decidir sobre ella se le avisa en sus notificaciones en el momento en '
    + 'que entra, así que usted no tiene que decírselo a nadie por separado.',
  'help.gathering-tasks.sent-back.heading': 'Cuando vuelve',
  'help.gathering-tasks.sent-back.b0':
    'Una tarea se puede devolver, y su estado dice entonces **Necesita otra mirada**. Esa '
    + 'formulación es deliberada: no es un rechazo ni una mancha contra usted, es la tarea '
    + 'devuelta con instrucciones, y las instrucciones son todo el sentido de devolverla.',
  'help.gathering-tasks.sent-back.b1':
    'Aparecen en la parte superior de la tarjeta bajo **Qué pidió quien organiza**, encima '
    + 'del formulario, así que las lee antes de escribir. Arregle lo que pidieron y pulse '
    + '**Enviarla de nuevo**.',
  'help.gathering-tasks.sent-back.b2':
    'No hay límite en cuántas veces una tarea puede ir y volver, y una tarea que llevó dos '
    + 'intentos es la misma tarea terminada que una que llevó uno. Volver a enviar es la '
    + 'forma ordinaria en que esto funciona y no un fracaso que haya que evitar.',
  'help.gathering-tasks.sent-back.b3':
    'Nadie puede devolver una tarea sin decir qué tiene que cambiar: la pantalla que usan '
    + 'no la envía de otro modo. Si alguna llega alguna vez sin notas, la tarjeta lo dice, y '
    + 'lo que hay que hacer es preguntarles: de verdad no hay nada ahí sobre lo que actuar.',
  'help.gathering-tasks.approved.heading': 'Una vez que está aprobada',
  'help.gathering-tasks.approved.b0':
    'Una respuesta aprobada es final por las dos partes. La tarjeta pasa a solo lectura y '
    + 'muestra lo que se aceptó; no hay forma de enviar otra, e intentarlo se rechaza con esa '
    + 'frase en vez de parecer que se guarda. También deja de estar atrasada, porque la fecha '
    + 'límite ya no se aplica a nada.',
  'help.gathering-tasks.approved.b1':
    'Si una respuesta aprobada de verdad tiene que cambiar, pregunte a quien organiza la '
    + 'reunión. Tienen un botón **Reabrir…** en su lado, y usarlo devuelve la tarea a sus '
    + 'manos: vuelve al formulario ordinario con su última respuesta ya puesta, así que una '
    + 'corrección de una palabra es una corrección de una palabra. Usted no puede hacerlo por '
    + 'su cuenta, que es todo lo que significa «final por las dos partes».',
  'help.gathering-tasks.approved.b2':
    'Una tarea reabierta llega igual que una que se devolvió: en sus notificaciones, y en '
    + 'la parte superior de [Mis tareas de la reunión](/gatherings/my-tasks), con el motivo '
    + 'que hayan dado, si dieron uno. Nada de lo que envió se elimina por ello, y todas las '
    + 'versiones siguen legibles.',
  // ──── PART 9 — Gatherings (Meeting Minutes) ───────────────────────────────────
  'help.meeting-minutes.title': 'Actas',
  'help.meeting-minutes.summary':
    'Programar una junta por directiva o por cargo, quién puede levantar el acta, y cómo '
    + 'vota la sala sobre un tema.',
  'help.meeting-minutes.what-it-is.heading': 'Qué es esta pantalla',
  'help.meeting-minutes.what-it-is.b0':
    '[Actas](/library/meeting-minutes) es el registro de la familia de aquello sobre lo que '
    + 'se reunió y lo que decidió. Una junta tiene una fecha, una lista de quién se espera, '
    + 'un **secretario** que la escribe, y cualquier número de **temas**, cada uno de los '
    + 'cuales puede llevar notas y una votación.',
  'help.meeting-minutes.what-it-is.b1':
    '**Todas las personas de la familia pueden leer las actas.** Eso es deliberado y es lo '
    + 'contrario del [cuaderno del cargo](/help/journal), que solo lee quien ocupa el cargo: '
    + 'las actas son el registro de las decisiones que tomó la familia, así que alguien que '
    + 'no estuvo en la sala también llega a saber qué se decidió.',
  'help.meeting-minutes.what-it-is.b2':
    'Formaba parte de [Notas del cargo](/library/officer-notes) hasta el 22-08-2026, como '
    + 'un tipo de entrada de «reunión». Una junta se le quedó pequeña: pertenece a la familia '
    + 'y no a un cargo, tiene un secretario, y tiene votos, y nada de eso lo puede expresar '
    + 'un cuaderno.',
  'help.meeting-minutes.scheduling.heading': 'Programar una',
  'help.meeting-minutes.scheduling.b0':
    'Son **tres pasos**, con **Siguiente** y **Atrás**, y nada se guarda hasta el último.',
  'help.meeting-minutes.scheduling.b1.i0': 'Pulse **Programar una junta**.',
  'help.meeting-minutes.scheduling.b1.i1':
    '**Paso 1: lo básico.** Un título, una fecha, y **quién levanta el acta**. Eso último '
    + 'empieza en usted, porque quien programa una junta normalmente la escribe; cámbielo a '
    + 'otra persona si no. Solo el secretario puede escribir en la junta, y tiene que ser '
    + 'adulto.',
  'help.meeting-minutes.scheduling.b1.i2':
    '**Paso 2: quién viene.** Diga primero qué tipo de junta es, y luego elija dentro de '
    + 'ese tipo. Vea más abajo.',
  'help.meeting-minutes.scheduling.b1.i3':
    '**Paso 3: alguien más.** Añada personas individuales encima del cuerpo que eligió, y '
    + 'compruebe el recuento de la sala.',
  'help.meeting-minutes.scheduling.b1.i4': 'Pulse **Programar junta**.',
  'help.meeting-minutes.scheduling.b2':
    '**A todas las personas de la sala se les avisa y les aparece en su calendario.** Va '
    + 'una notificación a cada asistente, y la junta aparece en [el '
    + 'calendario](/gatherings/calendar) para ellos, no para toda la familia, porque una '
    + 'reunión de comisión en el calendario de todo el mundo es un calendario que nadie lee. '
    + 'La lista de asistentes es también lo que decide quién puede votar.',
  'help.meeting-minutes.scheduling.b3':
    'El secretario se añade a la sala automáticamente, lo haya marcado usted o no. Alguien '
    + 'que levanta el acta estuvo ahí.',
  'help.meeting-minutes.scheduling.b4':
    '**Atrás nunca pierde nada.** Volver atrás para arreglar una fecha y regresar deja sus '
    + 'elecciones donde estaban, con una excepción deliberada: cambie el TIPO de junta en el '
    + 'paso 2 y la sala sigue al tipo nuevo, así que una directiva que marcó antes de pasar a '
    + 'una junta de capítulo no viene en silencio detrás.',
  'help.meeting-minutes.who-is-coming.heading': 'Quién viene: cinco tipos de junta',
  'help.meeting-minutes.who-is-coming.b0':
    'Una junta familiar es casi siempre una junta de un **cuerpo** y no una lista de once '
    + 'nombres: toda la familia, un capítulo, la directiva nacional, todos los presidentes de '
    + 'capítulo. Así que el paso 2 pregunta de qué tipo es, muestra solo las opciones de ese '
    + 'tipo, y calcula quién está en el cuerpo cuando usted programa.',
  'help.meeting-minutes.who-is-coming.b1.i0.term': 'Una junta general de la familia',
  'help.meeting-minutes.who-is-coming.b1.i0.text':
    'Todos los adultos de la familia. Nada que elegir: el paso le dice cuántas personas son '
    + 'antes de que se comprometa.',
  'help.meeting-minutes.who-is-coming.b1.i1.term': 'Una junta de capítulo',
  'help.meeting-minutes.who-is-coming.b1.i1.text':
    'Todas las personas registradas en un capítulo, ocupen un cargo o no. **Esta no es la '
    + 'directiva del capítulo**; es el capítulo entero. Solo se ofrecen los capítulos con '
    + 'alguien dentro.',
  'help.meeting-minutes.who-is-coming.b1.i2.term': 'Una junta de directiva',
  'help.meeting-minutes.who-is-coming.b1.i2.text':
    'Todas las personas que ocupan un cargo en un nivel y en un lugar: **Directiva '
    + 'nacional**, **Directiva de la región de Texas**, **Directiva del capítulo de Austin**. '
    + 'Solo se enumeran las directivas en las que de hecho hay alguien, y el número al lado '
    + 'de cada una dice cuántas personas son.',
  'help.meeting-minutes.who-is-coming.b1.i3.term': 'Una junta de cargos',
  'help.meeting-minutes.who-is-coming.b1.i3.text':
    'Un solo cargo tomado en todas las regiones o capítulos que lo llenan. Elegir '
    + '**Presidente de capítulo** invita al presidente de todos los capítulos a la vez.',
  'help.meeting-minutes.who-is-coming.b1.i4.term': 'Solo las personas que yo nombre',
  'help.meeting-minutes.who-is-coming.b1.i4.text':
    'Nadie para empezar: para una comisión improvisada de tres, donde no hay ningún cuerpo '
    + 'al que apuntar. Usted las añade en el paso 3.',
  'help.meeting-minutes.who-is-coming.b2':
    '**Un tipo sin nada que elegir no se puede elegir, y dice por qué.** Una familia que '
    + 'todavía no ha configurado sus cargos no tiene directivas que invitar; esa fila está '
    + 'atenuada con una frase que apunta a **Miembros → Organización** en vez de estar '
    + 'oculta, así que queda claro que el producto lo puede hacer en cuanto la familia lo '
    + 'haya hecho.',
  'help.meeting-minutes.who-is-coming.b3':
    '**Un cuerpo se resuelve cuando usted programa, no cuando se configuró.** Si el '
    + 'capítulo de Austin elige un tesorero nuevo el mes que viene, la directiva que usted '
    + 'eligió hoy invitó al tesorero que lo ocupaba hoy, que es lo correcto, porque la junta '
    + 'es la que a esa persona se le comunicó. Lo mismo vale para un capítulo: es quien esté '
    + 'registrado en él ese día.',
  'help.meeting-minutes.who-is-coming.b4':
    '**El paso 3 añade personas encima.** Sea lo que sea a lo que el cuerpo llegue, usted '
    + 'puede nombrar más; las dos cosas se suman, y alguien que aparece en las dos es un solo '
    + 'asistente. La línea debajo del selector cuenta la sala y la enumera detrás de **ver '
    + 'quién**, así que puede comprobar qué acaba de añadir una elección antes de '
    + 'comprometerse.',
  'help.meeting-minutes.adults.heading': 'Solo adultos, y la única excepción',
  'help.meeting-minutes.adults.b0':
    '**El secretario tiene que ser adulto**, y también cualquiera que se añada a la sala '
    + '**por su nombre**. Los dos selectores solo ofrecen adultos, y la acción rechaza uno de '
    + 'todos modos si se le pide directamente.',
  'help.meeting-minutes.adults.b1':
    '**Una junta de capítulo y una junta general de la familia también son de adultos.** '
    + 'Nadie menor de dieciocho está en ninguna de las dos, así que ninguna es una forma de '
    + 'rodear la regla de arriba.',
  'help.meeting-minutes.adults.b2':
    '**Las personas invitadas como parte de una directiva o de un cargo no se comprueban '
    + 'por edad**, y esa es la excepción. Alguien que ocupa un cargo es alguien a quien la '
    + 'familia puso ahí, y sacarlo de la sala en silencio por un cumpleaños registrado sería '
    + 'el producto pasando por encima de esa decisión en una lista que nadie vuelve a leer.',
  'help.meeting-minutes.adults.b3':
    'La edad se calcula a partir de la fecha de nacimiento del perfil de la persona, y un '
    + 'integrante **sin** cumpleaños registrado cuenta como adulto. «Menor de dieciocho» es '
    + 'algo que la familia ha escrito sobre alguien, no algo que suponer sobre un campo en '
    + 'blanco.',
  'help.meeting-minutes.writing.heading': 'Durante la junta',
  'help.meeting-minutes.writing.b0':
    '**Solo el secretario escribe.** Todos los demás leen. Añada un **tema** por cada cosa '
    + 'que la sala trate, y luego escriba notas debajo a medida que avanza: la misma forma '
    + 'que un cuaderno de cargo, un encabezado y un hilo debajo.',
  'help.meeting-minutes.writing.b1':
    'Las notas se muestran de la más antigua a la más nueva, cada una con la hora en que se '
    + 'escribió, y una que se ha cambiado desde entonces lo dice.',
  'help.meeting-minutes.writing.b2':
    'Si usted es el secretario y faltan los controles, compruebe si la junta se ha cerrado. '
    + 'Una junta cerrada es de solo lectura.',
  'help.meeting-minutes.voting.heading': 'Votar sobre un tema',
  'help.meeting-minutes.voting.b0':
    'El secretario pulsa **Convocar una votación** en un tema. Todas las personas de la '
    + 'lista de asistentes pueden responder entonces **A favor**, **En contra** o '
    + '**Abstención**, y el recuento acumulado está en el tema.',
  'help.meeting-minutes.voting.b1':
    '**Un voto no lo puede cambiar ni retirar nadie.** Ni la persona que lo emitió, ni el '
    + 'secretario, ni un administrador. Eso lo impone la base de datos y no la pantalla, y '
    + 'por eso no hay ningún control que parezca que podría.',
  'help.meeting-minutes.voting.b2':
    '**Cómo votó cada persona está en el registro**, con su nombre. Un voto de junta no es '
    + 'una votación secreta: las actas existen para decir quién decidió qué. Eso es distinto '
    + 'de [Elecciones](/help/elections), donde el voto de un integrante es solo suyo.',
  'help.meeting-minutes.voting.b3.i0.term': 'Solo votan los asistentes',
  'help.meeting-minutes.voting.b3.i0.text':
    'La lista que usted eligió al programar. Alguien que no está en ella puede leer el tema '
    + 'y el recuento y no puede responder.',
  'help.meeting-minutes.voting.b3.i1.term': 'Una votación cerrada se queda cerrada',
  'help.meeting-minutes.voting.b3.i1.text':
    'No se reabre. Si la pregunta hay que volver a hacerla, el secretario elimina el tema y '
    + 'lo añade de nuevo, que es visible, mientras que reabrir una votación en silencio no lo '
    + 'es.',
  'help.meeting-minutes.voting.b3.i2.term': 'Eliminar un tema',
  'help.meeting-minutes.voting.b3.i2.text':
    'La única forma en que un voto se quita alguna vez, y quita la pregunta entera junto '
    + 'con sus notas. La confirmación dice cuántos votos se van con ella.',
  'help.meeting-minutes.voting.b4':
    'Alguien que ya ha votado no se puede quitar de la lista de asistentes: su voto está en '
    + 'el registro, así que quitarlo dejaría un voto emitido por alguien de quien el acta '
    + 'dice que no estuvo.',
  'help.meeting-minutes.closing.heading': 'Cerrar el acta',
  'help.meeting-minutes.closing.b0':
    '**Cerrar el acta** es lo que convierte una junta en un registro: no más temas, no más '
    + 'notas, no más votos. Es lo que hace fiable aquello que la familia cite el año que '
    + 'viene.',
  'help.meeting-minutes.closing.b1':
    'Se puede reabrir, por el secretario o por alguien con permiso para editar juntas: '
    + 'cerrar demasiado pronto es un error ordinario y la alternativa es un registro '
    + 'permanentemente equivocado. Reabrir no deshace nada de lo que se decidió: los votos se '
    + 'quedan exactamente como están.',
  // ──── PART 9 — Gatherings (Gathering Management) ──────────────────────────────
  'help.gathering-management.title': 'Gestión de reuniones',
  'help.gathering-management.summary':
    'Programar una reunión, fijar su fondo y su presupuesto, repartir las tareas, decidir '
    + 'sobre las respuestas que vuelven, y escribir las plantillas de las que todo se '
    + 'construye.',
  'help.gathering-management.what-it-is.heading': 'Tres paneles, y para qué sirven',
  'help.gathering-management.what-it-is.b0':
    '[Reuniones](/admin/gatherings) en Administración es el lado organizador de '
    + '[Reuniones](/gatherings), en un menú con tres paneles:',
  'help.gathering-management.what-it-is.b1.i0':
    '**Reuniones**: todas las reuniones que tiene la familia, con sus fechas, su estado, su '
    + 'presupuesto frente al fondo del que se saca, y cuánto de su trabajo se ha aprobado.',
  'help.gathering-management.what-it-is.b1.i1':
    '**Cola de revisión**: todas las respuestas que esperan una decisión, en todas las '
    + 'reuniones a la vez. El panel lleva el recuento mientras algo espera.',
  'help.gathering-management.what-it-is.b1.i2':
    '**Plantillas**: la biblioteca de la que se construyen todas las reuniones, cubierta '
    + 'por [Plantillas de reunión](/help/gathering-templates#what-it-is).',
  'help.gathering-management.what-it-is.b2':
    'Plantillas tenía su propia fila de menú hasta el 19-08-2026 y ahora es un panel de '
    + 'aquí; su dirección antigua sigue funcionando y aterriza en el panel. Se otorga por '
    + 'separado de los otros dos, así que una familia puede dejar que alguien escriba las '
    + 'listas de comprobación sin dejarle comprometer a la familia con una reunión, o al '
    + 'contrario, que es el arreglo más común.',
  'help.gathering-management.creating.heading': 'Programar una reunión',
  'help.gathering-management.creating.b0.i0': 'Pulse **Nueva reunión**.',
  'help.gathering-management.creating.b0.i1':
    'Marque las plantillas que quiera en **Construida a partir de**. Sus pasos se '
    + 'convierten en sus tareas, en el orden en que se nombran las plantillas. No marque '
    + 'ninguna y la reunión es una fecha sin tareas, a la que se le puede añadir una '
    + 'plantilla después.',
  'help.gathering-management.creating.b0.i2':
    'Rellene **Título** y **Empieza**, y **Termina** solo si dura más de un día.',
  'help.gathering-management.creating.b0.i3':
    '**Lugar** y **Resumen** son opcionales: el resumen es lo que leerán las personas a las '
    + 'que se les pida ayudar.',
  'help.gathering-management.creating.b0.i4':
    'Elija un **Fondo** y un **Presupuesto ($)** si va a gastar dinero, y marque **Mostrar '
    + 'esto en la parte superior del Panel** si es la que la familia debería ver primero.',
  'help.gathering-management.creating.b0.i5':
    'Pulse **Crear reunión**, y después **Abrir la reunión** para empezar a repartir sus '
    + 'tareas.',
  'help.gathering-management.creating.b1':
    'Cada plantilla que marque se convierte en un segmento de la reunión, que es la sección '
    + 'siguiente. Una reunión sin ninguna es la ocasión en sí — sus fechas, su lugar y su '
    + 'descripción — y es lo que el calendario de la familia muestra en cualquier caso.',
  'help.gathering-management.segments.heading': 'Los segmentos, y sus días y lugares',
  'help.gathering-management.segments.b0':
    'Una reunión rara vez es una sola ocasión. Una reunión familiar es la Bienvenida, el '
    + 'Picnic y la Despedida, en sus propios días y en sus propios lugares, y cada plantilla '
    + 'de la que se construyó la reunión es una de esas partes. El panel **Segmentos** de la '
    + 'página propia de una reunión es donde se enumeran, y donde se fijan el día y el lugar '
    + 'de cada uno.',
  'help.gathering-management.segments.b1.i0.term': 'Segmento',
  'help.gathering-management.segments.b1.i0.text':
    'La plantilla de la que vino esta parte, con cuántas tareas vinieron con ella.',
  'help.gathering-management.segments.b1.i1.term': 'Día',
  'help.gathering-management.segments.b1.i1.text':
    'La fecha en que ocurre esta parte. Opcional: déjelo vacío para una reunión que ocurre '
    + 'toda a la vez.',
  'help.gathering-management.segments.b1.i2.term': 'Lugar',
  'help.gathering-management.segments.b1.i2.text':
    'Dónde se celebra esta parte. Opcional, y empieza vacío: una plantilla ya no indica uno '
    + 'habitual.',
  'help.gathering-management.segments.b1.i3.term': 'Tareas',
  'help.gathering-management.segments.b1.i3.text':
    'Cuántas de las tareas de la reunión vinieron de esa plantilla.',
  'help.gathering-management.segments.b2':
    'Escriba en cualquiera de los dos cuadros y aparece un botón **Guardar** en esa fila, '
    + 'así que nada se escribe por pulsación de tecla y una fila que se guarda no bloquea las '
    + 'demás. Las dos cosas son lo que de hecho leen los familiares a los que se les pide '
    + 'ayudar: el día y el lugar de un segmento se imprimen debajo de su encabezado en la '
    + 'página propia de la reunión.',
  'help.gathering-management.segments.b3.i0': 'Elija una plantilla en **Añadir otro segmento**.',
  'help.gathering-management.segments.b3.i1':
    'Fije **Día** y **Lugar**, o deje cualquiera de los dos vacío.',
  'help.gathering-management.segments.b3.i2':
    'Pulse **Añadir sus pasos**. Todos los pasos de esa plantilla se convierten en una '
    + 'tarea de esta reunión, y nada de las tareas que ya están ahí cambia.',
  'help.gathering-management.segments.b4':
    'Un día fuera de las fechas propias de la reunión **se guarda y se comenta en vez de '
    + 'rechazarse**, y el comentario es una línea discreta en la fila y no una roja: no ha '
    + 'fallado nada, simplemente hay una fecha que conciliar. Eso es deliberado: las fechas '
    + 'se mueven, y a quien organiza y cambia el fin de semana no debería detenerle un '
    + 'segmento que no estaba mirando. La línea aparece cuando el segmento se guarda, así que '
    + 'una reunión cuyas fechas se movieron después merece un repaso de este panel.',
  'help.gathering-management.segments.b5':
    'El lugar de un segmento pertenece al segmento y a nada más. Las plantillas indicaban '
    + 'antes un **Lugar habitual** que se copiaba en todos los segmentos construidos a partir '
    + 'de ellas, y eso ya no existe (19-08-2026): un local pertenece a una sola ocasión, y '
    + 'una plantilla que necesita uno lo pide con un paso del tipo **Un lugar**, entregado a '
    + 'un familiar con nombre, con una fecha límite, y revisado como cualquier otra '
    + 'respuesta.',
  'help.gathering-management.premier.heading': 'La banda del Panel',
  'help.gathering-management.premier.b0':
    '**Mostrar esto en la parte superior del Panel** está en el panel **Banda del Panel** '
    + 'de la página propia de una reunión. Una reunión marcada recibe la banda debajo del '
    + 'saludo en [el panel](/dashboard): su título, sus fechas, dónde es, cuántas de sus '
    + 'tareas están aprobadas, y una vía directa hacia ella.',
  'help.gathering-management.premier.b1':
    'Varias reuniones pueden estar marcadas a la vez, deliberadamente. El panel muestra la '
    + 'más cercana que no ha terminado, así que la reunión del año pasado nunca bloquea la de '
    + 'este año, y no aparece nada ahí en absoluto cuando ninguna reunión marcada sigue por '
    + 'delante.',
  'help.gathering-management.premier.b2':
    '**Foto de la banda**, en el mismo panel, fija la imagen alrededor de la que se '
    + 'construye la banda: una fotografía por reunión, recortada a la forma de la banda. '
    + 'Elegir un archivo lo sube en el momento; **Quitar la foto** la retira. Sin una, la '
    + 'banda dibuja el árbol de GENORRA, así que queda terminada en cualquier caso.',
  'help.gathering-management.premier.b3':
    'Una foto de banda subida la puede ver cualquiera que tenga su dirección, exactamente '
    + 'como una fotografía de la [Galería](/community/gallery). Poner una aquí la publica '
    + 'para quien alcance el enlace, así que elija una imagen que la familia estaría contenta '
    + 'de compartir.',
  'help.gathering-management.money.heading': 'El fondo, el presupuesto y la línea roja',
  'help.gathering-management.money.b0':
    'Un presupuesto siempre se saca de un fondo, y los dos se guardan juntos: limpiar el '
    + 'fondo limpia el presupuesto con él, y el cuadro del importe no acepta una cifra hasta '
    + 'que se elige un fondo. Los fondos se configuran en '
    + '[Contabilidad](/admin/accounting?section=funds); vea '
    + '[Contabilidad](/help/accounting#funds).',
  'help.gathering-management.money.b1':
    'Varias reuniones pueden sacar de un solo fondo, así que un saldo no es de una reunión '
    + 'para gastarlo. La banda de cada reunión dice qué más lo está reclamando.',
  'help.gathering-management.money.b2':
    'Un presupuesto mayor que el fondo está permitido y no es un error. Las cifras lo dicen '
    + 'con una línea roja en vez de rechazar el número, porque una familia planea una reunión '
    + 'antes de haber recaudado el dinero para una: rechazarlo significaría que el plan no se '
    + 'podría escribir en absoluto.',
  'help.gathering-management.money.b3':
    'Cada tarea puede llevar su propia **Partida de presupuesto ($)**, fijada en el cuadro '
    + 'de esa tarea: lo que se espera que cueste ese único trabajo, con vacío queriendo decir '
    + 'que no le cuesta nada a la familia. Las partidas juntas son lo que la banda compara '
    + 'con el presupuesto, y el presupuesto sugerido de un paso de plantilla es solo la cifra '
    + 'con la que una partida empieza. Cuando las partidas superan el presupuesto la banda lo '
    + 'dice con un trato más discreto y deliberadamente distinto: no se ha gastado nada, y se '
    + 'resuelve subiendo el presupuesto o recortando una partida.',
  'help.gathering-management.assigning.heading': 'Repartir el trabajo',
  'help.gathering-management.assigning.b0':
    'Pulse **Gestionar** en una tarea — **Revisar** cuando algo espera en ella — y un solo '
    + 'cuadro contiene todo sobre esa tarea.',
  'help.gathering-management.assigning.b1.i0':
    'Elija a alguien en **Asignada a**. El selector busca en cualquier parte de cualquier '
    + 'nombre, que es lo que lo hace usable en una familia de ciento cuarenta personas.',
  'help.gathering-management.assigning.b1.i1': 'Fije **Vence** si tiene fecha límite.',
  'help.gathering-management.assigning.b1.i2': 'Pulse **Guardar quién y cuándo**.',
  'help.gathering-management.assigning.b2':
    'Cualquier persona que la familia haya aprobado puede tener una tarea tenga cuenta '
    + 'propia o no, así que a un familiar registrado en el árbol sin inicio de sesión se le '
    + 'puede pedir igualmente que traiga las fotografías. Alguien cuya membresía sigue '
    + 'esperando no puede, y la pantalla lo dice en vez de fallar en silencio. **Dejarla sin '
    + 'asignar** le quita una tarea a alguien.',
  'help.gathering-management.assigning.b3':
    'A la persona que usted asigna se le avisa en sus notificaciones, y la tarea aparece en '
    + 'sus [Mis tareas de la reunión](/gatherings/my-tasks) con su fecha límite puesta.',
  'help.gathering-management.reviewing.heading': 'Decidir sobre una respuesta',
  'help.gathering-management.reviewing.b0':
    'Una respuesta llega a la **Cola de revisión** con lo que se envió, cualquier nota que '
    + 'añadiera quien la envió, quién la envió y cuándo. Hay dos decisiones:',
  'help.gathering-management.reviewing.b1.i0':
    '**Aprobar**: aceptada, y final. La respuesta pasa a ser el registro que la familia '
    + 'tiene de ella y la persona que la envió no puede cambiarla después, y por eso se '
    + 'confirma primero.',
  'help.gathering-management.reviewing.b1.i1':
    '**Devolver…**: devuelta con instrucciones. Abre **Qué tiene que cambiar**, y ese '
    + 'cuadro es obligatorio: una tarea devuelta con nada dentro le dice a un familiar que su '
    + 'respuesta no se aceptó mientras ninguna pantalla en ninguna parte dice qué hacer al '
    + 'respecto. Lo que usted escriba se envía con la tarea y es lo primero que ven.',
  'help.gathering-management.reviewing.b2':
    'Una tarea devuelta dice **Necesita otra mirada** en todas las pantallas y se puede '
    + 'responder de nuevo tantas veces como haga falta. Todos los envíos se conservan, así '
    + 'que el intercambio entero se puede leer desde la tarea y no solo su última línea.',
  'help.gathering-management.reviewing.b3':
    'Una respuesta aprobada se puede retirar, y solo desde aquí. Abra la tarea y pulse '
    + '**Reabrir…**, añada una línea en **Por qué, si quiere decirlo (opcional)** si hay algo '
    + 'que explicar, y luego pulse **Reabrir** para confirmar. La tarea vuelve a la persona '
    + 'que la tiene con su respuesta todavía puesta, se le avisa en sus notificaciones, y el '
    + 'motivo viaja con ella. No se borra nada: la respuesta se queda como su punto de '
    + 'partida y todos los envíos se quedan en el registro, incluida la aprobación que usted '
    + 'acaba de retirar.',
  'help.gathering-management.reviewing.b4':
    'El motivo es opcional aquí y obligatorio en **Devolver…**, lo cual parece incoherente '
    + 'y no lo es. Devolver trabajo sin instrucciones deja a un familiar sin nada sobre lo '
    + 'que actuar; retirar su propia aprobación suele ser una corrección de su propia lectura '
    + 'de ella, y a menudo no hay nada que decir más allá de que tiene que cambiar.',
  'help.gathering-management.reviewing.b5':
    'Reabrir es la única vuelta desde una aprobación, así que apruebe deliberadamente '
    + 'aunque se pueda deshacer. La persona que envió la respuesta no puede reabrirla y no '
    + 'puede reemplazarla mientras se mantenga: desde su lado, aprobada de verdad es final, y '
    + 'todas las pantallas le dicen que acuda a usted.',
  'help.gathering-management.changing.heading': 'Cambiar o terminar una',
  'help.gathering-management.changing.b0':
    '**Estado** se fija a mano — **En preparación**, **Programada**, **Completada** o '
    + '**Cancelada** — porque ninguno de los cuatro es algo que el calendario sepa: una '
    + 'reunión se puede cancelar sin que sus fechas se muevan, y terminada es la afirmación '
    + 'de alguien y no una fecha que pasa. **Guardar cambios** lo confirma junto con el '
    + 'título, las fechas y el lugar.',
  'help.gathering-management.changing.b1':
    '**Eliminar reunión** se rechaza en cuanto alguna de sus respuestas se ha aprobado. El '
    + 'rechazo dice cuántas y ofrece Cancelada en su lugar, que no elimina nada y se puede '
    + 'volver a activar.',
  'help.gathering-management.changing.b2':
    'Quitar un segmento — la papelera de su fila, confirmada como **Quitar plantilla** — se '
    + 'rechaza de la misma forma en cuanto alguna tarea suya se ha asignado o respondido. Las '
    + 'tareas que vinieron de una plantilla son lo que de hecho se les pidió a los familiares '
    + 'y sobreviven al vínculo, así que desvincular una solo limpia alguna vez las tareas que '
    + 'nadie ha tocado.',
  // ──── PART 9 — Gatherings (Gathering Templates) ───────────────────────────────
  'help.gathering-templates.title': 'Plantillas de reunión',
  'help.gathering-templates.summary':
    'Escribir las listas paso a paso de las que se construye una reunión, incluido un paso '
    + 'que es otra plantilla, decidir quién puede programar a partir de una, y archivar una '
    + 'que ya se ha usado.',
  'help.gathering-templates.what-it-is.heading': 'Qué es una plantilla',
  'help.gathering-templates.what-it-is.b0':
    'El panel **Plantillas** de [Reuniones](/admin/gatherings) en Administración es la '
    + 'biblioteca de la que se construye una reunión. Una plantilla es un nombre y una lista '
    + 'ordenada de pasos — uno por cada cosa que alguien tiene que hacer o decidir — y '
    + 'programar una reunión a partir de ella convierte todos los pasos en una tarea que '
    + 'espera para entregarse a un familiar.',
  'help.gathering-templates.what-it-is.b1':
    'Tenía su propia fila de menú hasta el 19-08-2026 y ahora es un panel. La dirección '
    + 'antigua sigue funcionando y aterriza en él.',
  'help.gathering-templates.what-it-is.b2':
    'Editar una plantilla nunca cambia una reunión ya construida a partir de ella. Todas '
    + 'las tareas conservan su propia copia de lo que pedían, así que un paso renombrado aquí '
    + 'alcanza la reunión familiar del año que viene y no la que está en marcha, y la '
    + 'respuesta de nadie se reescribe nunca por debajo. Eso es lo que hace que la biblioteca '
    + 'sea segura de seguir ordenando, y la tarjeta lo dice.',
  'help.gathering-templates.adding.heading': 'Añadir una plantilla',
  'help.gathering-templates.adding.b0.i0':
    'Pulse **Añadir plantilla** en la parte superior del panel.',
  'help.gathering-templates.adding.b0.i1':
    'Póngale un **Nombre de plantilla**: nómbrela por la ocasión, «Reunión familiar», '
    + '«Homenaje», «Banquete de becas».',
  'help.gathering-templates.adding.b0.i2':
    'Escriba una **Descripción** si quiere una, y elija **Quién puede programar a partir de '
    + 'esto**.',
  'help.gathering-templates.adding.b0.i3': 'Pulse **Añadir plantilla**.',
  'help.gathering-templates.adding.b0.i4':
    'La tarjeta que aparece está cerrada. Pulse su nombre para abrirla, y luego déle un '
    + 'paso por cada cosa que alguien tiene que hacer.',
  'help.gathering-templates.adding.b1':
    '**Todas las tarjetas de plantilla están cerradas hasta que usted las abre.** Abierta, '
    + 'una tarjeta muestra la descripción, quién puede programar a partir de ella, y una fila '
    + 'por paso, que es una página entera en cuanto una familia tiene media docena. Cerrada, '
    + 'cada una muestra su nombre y cuántos pasos tiene, así que la biblioteca se lee como '
    + 'una lista de lo que se tiene y no como todo sobre todo. Pulse un nombre para abrirla; '
    + 'pulse de nuevo para cerrarla.',
  'help.gathering-templates.adding.b2':
    '**En nada de una tarjeta se escribe directamente.** La tarjeta dice qué es la '
    + 'plantilla; **Editar** al lado de su nombre abre un cuadro que contiene el nombre, la '
    + 'descripción y quién puede programar, y todos los pasos tienen su propio botón '
    + '**Editar**. Eso es lo que mantiene la biblioteca legible: una pantalla de cien cuadros '
    + 'activos no se puede repasar de un vistazo, y repasar de un vistazo es para lo que '
    + 'sirve esta página.',
  'help.gathering-templates.adding.b3':
    'Un cuadro abierto o se guarda o se descarta, así que no existe tal cosa como una '
    + 'plantilla guardada a medias. Pulse **Cancelar** o **Escape** y no cambió nada.',
  'help.gathering-templates.adding.b4':
    'Un nombre tiene que ser único dentro de la familia, así que una segunda «Reunión '
    + 'familiar» se rechaza en vez de añadirse en silencio al lado de la primera. La '
    + 'descripción es lo que lee quien organiza antes de programar a partir de ella, y se '
    + 'muestra al lado de la plantilla cuando eligen una.',
  'help.gathering-templates.adding.b5':
    'Aquí había un campo de **Lugar habitual** hasta el 19-08-2026 y ahora no lo hay. Una '
    + 'plantilla que indicaba dónde se celebran habitualmente sus reuniones era un autor '
    + 'adivinando un dato que pertenece a una sola ocasión, y la adivinanza había que '
    + 'corregirla después en todos los segmentos a los que se copiaba. Pida el local en su '
    + 'lugar: un paso del tipo **Un lugar**, entregado a un familiar con nombre y con una '
    + 'fecha límite.',
  'help.gathering-templates.steps.heading': 'Los pasos',
  'help.gathering-templates.steps.b0.i0': 'Pulse **Añadir paso** al lado del encabezado de Pasos.',
  'help.gathering-templates.steps.b0.i1':
    'Escriba la etiqueta en **Paso**: «Reservar el local», «Recuento de asistentes», '
    + '«Catering».',
  'help.gathering-templates.steps.b0.i2':
    'Elija **Qué pide**. La línea debajo del selector dice qué se le dará a rellenar a la '
    + 'persona que tenga la tarea.',
  'help.gathering-templates.steps.b0.i3':
    'Ponga cualquier cosa que necesiten saber en **Texto de ayuda**: a quién llamar, qué '
    + 'cuenta como hecho. Lo leen debajo de la tarea en sí.',
  'help.gathering-templates.steps.b0.i4':
    'Marque **Obligatorio** si la reunión no está terminada hasta que este paso se responda '
    + 'y se apruebe.',
  'help.gathering-templates.steps.b0.i5':
    'Fije un **Presupuesto sugerido ($)** si el trabajo cuesta dinero.',
  'help.gathering-templates.steps.b0.i6': 'Pulse **Añadir paso**.',
  'help.gathering-templates.steps.b1':
    'Hay nueve tipos de paso. Ocho de ellos deciden qué se le da a la persona que responde:',
  'help.gathering-templates.steps.b2.i0.term': 'Respuesta corta',
  'help.gathering-templates.steps.b2.i0.text':
    'Una línea: un nombre, un número de teléfono, una respuesta en unas pocas palabras.',
  'help.gathering-templates.steps.b2.i1.term': 'Respuesta larga',
  'help.gathering-templates.steps.b2.i1.text':
    'Un párrafo: notas, una descripción, una explicación.',
  'help.gathering-templates.steps.b2.i2.term': 'Una fecha',
  'help.gathering-templates.steps.b2.i2.text':
    'Una sola fecha del calendario, elegida en un campo de fecha.',
  'help.gathering-templates.steps.b2.i3.term': 'Un lugar',
  'help.gathering-templates.steps.b2.i3.text':
    'Un local, una dirección, una sala. Una línea, y un teléfono ofrecerá las direcciones '
    + 'que ya conoce.',
  'help.gathering-templates.steps.b2.i4.term': 'Una lista',
  'help.gathering-templates.steps.b2.i4.text':
    'Cualquier número de líneas, un elemento cada una, añadidas y quitadas a medida que '
    + 'avanzan.',
  'help.gathering-templates.steps.b2.i5.term': 'Sí o no',
  'help.gathering-templates.steps.b2.i5.text':
    'Una decisión. Tienen que elegir; dejarlo en blanco no es una respuesta.',
  'help.gathering-templates.steps.b2.i6.term': 'Un número',
  'help.gathering-templates.steps.b2.i6.text':
    'Un recuento o una cantidad. El dinero tiene su propio tipo: use ese para el dinero.',
  'help.gathering-templates.steps.b2.i7.term': 'Una cantidad de dinero',
  'help.gathering-templates.steps.b2.i7.text': 'Una cantidad en dólares, registrada al centavo.',
  'help.gathering-templates.steps.b3':
    'El noveno es el que se sale de la norma y es la sección siguiente.',
  'help.gathering-templates.steps.b4':
    'Cada fila dice qué es el paso: su etiqueta, su texto de ayuda debajo, qué pide, si es '
    + 'obligatorio y qué sugiere gastar. Para cambiar cualquiera de esas cosas, pulse el '
    + 'lápiz de la fila y se abre el mismo cuadro con el paso dentro.',
  'help.gathering-templates.steps.b5':
    'Las flechas de una fila mueven un paso antes o después, y ese orden es el orden en que '
    + 'se reparten las tareas. Eliminar un paso deja todas las tareas ya creadas a partir de '
    + 'él exactamente donde están.',
  'help.gathering-templates.steps.b6':
    'Un presupuesto sugerido es solo una cifra de partida copiada en la tarea. Se puede '
    + 'cambiar en la reunión, y lo que cuenta contra el fondo es el presupuesto propio de la '
    + 'reunión: vea [Gestión de reuniones](/help/gathering-management#money).',
  'help.gathering-templates.nested.heading': 'Un paso que es otra plantilla',
  'help.gathering-templates.nested.b0':
    'El noveno tipo es **Otra plantilla**, y nadie lo responde. Elija una plantilla y todos '
    + 'los pasos de ESA plantilla se convierten en una tarea propia, en ese punto de la '
    + 'lista, cada vez que se construye una reunión a partir de esta.',
  'help.gathering-templates.nested.b1':
    'Es para la lista de comprobación que su familia usa dentro de varias ocasiones '
    + 'distintas. Escriba los cinco pasos de «Catering» una vez, y luego dé a «Reunión '
    + 'familiar», «Homenaje» y «Banquete de becas» un paso de Catering cada uno; y corregir '
    + 'la lista de catering el año que viene corrige las tres.',
  'help.gathering-templates.nested.b2.i0':
    'Pulse **Añadir paso**, y escriba una etiqueta: no encabeza nada por sí sola, así que '
    + 'nómbrela por lo que debería ver quien lea esta plantilla, «La lista de catering».',
  'help.gathering-templates.nested.b2.i1': 'Elija **Otra plantilla** en **Qué pide**.',
  'help.gathering-templates.nested.b2.i2':
    'Elija la que hay que incluir en **Plantilla que incluir**.',
  'help.gathering-templates.nested.b2.i3': 'Pulse **Añadir paso**.',
  'help.gathering-templates.nested.b3':
    '**Texto de ayuda**, **Obligatorio** y **Presupuesto sugerido** no se ofrecen para este '
    + 'tipo y eso es deliberado: nadie va a responderlo, así que no hay nadie a quien '
    + 'aconsejar, nada que exigir y ningún trabajo único al que ponerle precio. Los pasos que '
    + 'trae llevan los suyos.',
  'help.gathering-templates.nested.b4':
    'Una plantilla no se puede incluir a sí misma, y no puede incluir nada que lleve de '
    + 'vuelta a ella: A dentro de B dentro de A se rechaza con una frase que lo dice. Solo se '
    + 'ofrecen las otras plantillas de la familia, y una archivada se puede seguir '
    + 'incluyendo: archivar significa «no empezar nada NUEVO a partir de esto», que es sobre '
    + 'programar una reunión y no sobre componer una lista de comprobación.',
  'help.gathering-templates.nested.b5':
    'Editar la plantilla incluida cambia lo que recibe la reunión SIGUIENTE y nunca una '
    + 'reunión ya en marcha: la misma regla que siguen todos los demás pasos, por el mismo '
    + 'motivo. Así que esto es seguro de seguir ordenando, y corregir una lista de '
    + 'comprobación compartida de verdad alcanza todas las plantillas que la incluyen.',
  'help.gathering-templates.who-may-schedule.heading': 'Quién puede programar a partir de esto',
  'help.gathering-templates.who-may-schedule.b0':
    '**Quién puede programar a partir de esto** se fija por plantilla, y es lo único de '
    + 'esta pantalla que un integrante fuera de las páginas de administración llega a notar '
    + 'alguna vez:',
  'help.gathering-templates.who-may-schedule.b1.i0.term': 'Solo administradores',
  'help.gathering-templates.who-may-schedule.b1.i0.text':
    'Solo alguien que puede gestionar reuniones puede empezar una a partir de esta '
    + 'plantilla.',
  'help.gathering-templates.who-may-schedule.b1.i1.term': 'Cualquier integrante',
  'help.gathering-templates.who-may-schedule.b1.i1.text':
    'Cualquier integrante que pueda programar una reunión puede empezar una a partir de '
    + 'esta plantilla. Sigue sin poder editar la plantilla en sí.',
  'help.gathering-templates.who-may-schedule.b2':
    'Cambiar una plantilla es un trabajo de administración, cualquiera de las dos opciones '
    + 'que esté fijada. Así que una familia puede repartir «cualquiera puede organizar un '
    + 'cumpleaños» sin repartir también «cualquiera puede cambiar en qué consiste un '
    + 'cumpleaños», que es el motivo de que el ajuste esté en la plantilla y no en la '
    + 'persona.',
  'help.gathering-templates.archiving.heading': 'Archivar, y eliminar',
  'help.gathering-templates.archiving.b0':
    '**Archivar** saca una plantilla de la lista de las que se puede programar y deja todas '
    + 'las reuniones construidas a partir de ella exactamente como están. Nada en marcha '
    + 'cambia y no se elimina nada; la tarjeta dice que está archivada y que no se puede '
    + 'empezar nada nuevo a partir de ella, y **Restaurar** la devuelve.',
  'help.gathering-templates.archiving.b1':
    'Una plantilla a partir de la que se construyó una reunión no se puede eliminar. El '
    + 'rechazo dice cuántas reuniones la usaron y ofrece archivarla en su lugar, con un botón '
    + '**Archivarla en su lugar** al lado del mensaje. El motivo es el registro: las tareas '
    + 'de esas reuniones dicen de qué plantilla vinieron, y eliminarla se llevaría eso. Una '
    + 'plantilla que nada ha usado todavía se elimina sin problema, junto con sus pasos.',
  'help.gathering-templates.archiving.b2':
    'El recuento de usos se imprime en la tarjeta al lado del control de eliminar, así que '
    + 'el rechazo rara vez es una sorpresa. Llegó con la página, eso sí, y una reunión '
    + 'programada desde entonces no estará en él: el rechazo en sí es lo que decide.',

  // ── Family Settings · What happens to your records (20260901000002) ──────────────
  'help.family-settings.retention.heading': 'Qué pasa con sus registros',
  'help.family-settings.retention.b0':
    '**Bajar a un plan más barato no elimina nada el día en que lo hace.** Las pantallas que '
    + 'ese plan incluía dejan de abrirse, y todo lo que hay detrás se conserva durante '
    + '**sesenta días**. Si vuelve a subir dentro de esos sesenta días, cada registro está '
    + 'exactamente donde lo dejó.',
  'help.family-settings.retention.b1':
    '**Facturación** muestra la fecha en todo momento, y se envían cuatro recordatorios a '
    + 'quien se encarga de la facturación: treinta días antes, quince, cinco y uno.',
  'help.family-settings.retention.b2.i0.term': 'Conservarlo',
  'help.family-settings.retention.b2.i0.text':
    'Vuelva al plan que dejó. Eso cubre los meses que estuvo fuera y también el mes que viene, '
    + 'para que el plan no quede con un hueco, y la cifra aparece en la sección Facturación '
    + 'antes de que se comprometa a nada.',
  'help.family-settings.retention.b2.i1.term': 'Dejarlo ir',
  'help.family-settings.retention.b2.i1.text':
    'No haga nada y se elimina en la fecha indicada, sin costo adicional. Si ya lo decidió, '
    + '**Eliminar estos registros…** en la sección Facturación lo hace hoy en vez de recordárselo '
    + 'tres veces más; primero le pide un código de seis dígitos enviado por correo, y enumera '
    + 'exactamente qué se va a quitar.',
  'help.family-settings.retention.b3':
    '**Los registros eliminados no se pueden recuperar.** Ni usted, ni el soporte de GENORRA, '
    + 'ni desde una copia de seguridad. Por eso existen los sesenta días y los cuatro '
    + 'recordatorios, y es la única frase de esta página que vale la pena leer dos veces.',
  'help.family-settings.retention.b4':
    '**Lo que nunca se elimina:** sus familiares, el Directorio, los anuncios, el chat, el '
    + 'calendario y todo lo demás que incluye el plan Gratis. Una familia que deja de pagar por '
    + 'completo conserva todo eso.',

  // ── Family Settings · If a payment fails ─────────────────────────────────────────
  'help.family-settings.overdue.heading': 'Si un pago falla',
  'help.family-settings.overdue.b0':
    'Una tarjeta se rechaza por motivos corrientes: venció, el banco la marcó, cambió la '
    + 'dirección de facturación. Nada cambia el día en que ocurre, y actualizar la tarjeta en '
    + '**Facturación** lo resuelve.',
  'help.family-settings.overdue.b1':
    'Si sigue sin pagarse, el acceso se limita por etapas para que quien pueda arreglarlo '
    + 'siempre pueda:',
  'help.family-settings.overdue.b2.i0.term': 'A los 5 días',
  'help.family-settings.overdue.b2.i0.text':
    'Se envía un correo a todos los que se encargan de la facturación. Nada se limita y todos '
    + 'siguen como siempre.',
  'help.family-settings.overdue.b2.i1.term': 'A los 10 días',
  'help.family-settings.overdue.b2.i1.text':
    'Los familiares ya no pueden usar el sitio. Los administradores conservan el acceso '
    + 'completo, y pagar lo restaura para todos a la vez.',
  'help.family-settings.overdue.b2.i2.term': 'A los 30 días',
  'help.family-settings.overdue.b2.i2.text':
    'Solo queda abierta la sección de Facturación, también para los administradores. No se ha '
    + 'quitado nada y todo se vuelve a abrir al pagar.',
  'help.family-settings.overdue.b2.i3.term': 'A los 60 días',
  'help.family-settings.overdue.b2.i3.text':
    'La familia pasa al plan Gratis y se elimina lo que el plan Gratis no incluye. Antes se '
    + 'envían dos avisos: a los 45 días y el día anterior.',
  'help.family-settings.overdue.b3':
    '**No se elimina nada antes del día 60, y tampoco cambia nada del plan antes de esa fecha.** '
    + 'Si paga el día 59, cada pantalla y cada registro están exactamente donde estaban. Lo que '
    + 'se elimina el día 60 no se puede recuperar.',
  'help.family-settings.overdue.b4':
    'A un integrante que ve «no está disponible temporalmente» se le dice todo el mensaje a '
    + 'propósito: lo que una familia le debe a GENORRA no es asunto de cada familiar. Se le pide '
    + 'que se comunique con quien lleva la contabilidad de la familia, que es quien puede '
    + 'resolverlo de verdad.',
}
