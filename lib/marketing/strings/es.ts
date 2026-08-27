import type { Catalogue } from '@/lib/i18n/t'

export const marketingEs: Catalogue = {

  // ──── THE CHROME — nav, the two calls to action, the footer ─────────────────────
  'mkt.nav./features': 'Funciones',
  'mkt.nav./how-it-works': 'Cómo funciona',
  // *Por qué GENORRA* rather than *Por qué nosotros*: the English is an idiom this
  // language does not have as a nav caption, and the brand name is what the
  // question is actually about.
  'mkt.nav./why-us': 'Por qué GENORRA',
  'mkt.nav./pricing': 'Precios',
  'mkt.nav./about': 'Quiénes somos',
  'mkt.signIn': 'Iniciar sesión',
  'mkt.getStarted': 'Empezar gratis',
  'mkt.openMenu': 'Abrir el menú',
  'mkt.closeMenu': 'Cerrar el menú',
  'mkt.footer.blurb':
    'Donde cada generación tiene su lugar. Un solo espacio privado para toda su familia: la '
    + 'reunión, la tesorería, las fotografías y el árbol familiar.',
  'mkt.footer.product': 'Producto',
  'mkt.footer.account': 'Cuenta',
  'mkt.footer.createAccount': 'Cree su cuenta gratis',
  'mkt.footer.rights':
    'Todos los derechos reservados. Los datos de su familia nunca se comparten ni se '
    + 'venden.',
  'mkt.language': 'Idioma',

  // ──── THE SHARED BANDS — the closing ask, and the roadmap pill ──────────────────
  'mkt.comingSoon': 'Muy pronto',
  'mkt.faqEyebrow': 'Preguntas',
  'mkt.cta.title': 'Reúna a su familia',
  'mkt.cta.lede':
    'Cree su cuenta gratis y tenga su primera reunión, su directorio y su árbol familiar '
    + 'funcionando esta semana.',
  'mkt.cta.primary': 'Cree su cuenta gratis',
  'mkt.cta.secondary': 'Vea cómo funciona',
  'mkt.cta.reassure':
    'Empezar es gratis. No hace falta tarjeta. Los datos de su familia nunca se comparten '
    + 'ni se venden.',

  // ──── HOW IT WORKS ──────────────────────────────────────────────────────────────
  'mkt.hiw.metaTitle': 'Monte el portal de su familia en una tarde',
  'mkt.hiw.metaDescription':
    'Cree su familia, comparta un código y sus familiares se unen solos. Vea exactamente '
    + 'cómo GENORRA pasa de estar vacío a dirigir una reunión en cinco pasos.',
  'mkt.hiw.graphName': 'Cómo funciona: monte el portal de su familia en una tarde',
  'mkt.hiw.eyebrow': 'Cómo funciona',
  'mkt.hiw.title': 'De cero a una reunión en marcha, en una tarde',
  'mkt.hiw.lede':
    'Sin proyecto de migración. Sin un fin de semana metiendo datos. Una persona lo '
    + 'empieza, y la familia lo va llenando sola.',
  'mkt.hiw.heroCta': 'Empiece por el paso uno',
  'mkt.hiw.stepsEyebrow': 'Cinco pasos',
  'mkt.hiw.stepsTitle': 'Qué hace usted en realidad',
  'mkt.hiw.stepsLede':
    'En orden. Los pasos cuatro y cinco son opcionales el primer día: muchas familias '
    + 'empiezan solo con el directorio.',
  'mkt.hiw.stepN': 'Paso {n}',
  'mkt.hiw.step0.title': 'Cree su familia',
  'mkt.hiw.step0.detail':
    'Una persona se registra, le pone nombre a la familia y se convierte en su primer '
    + 'administrador. Lleva un minuto aproximadamente y no cuesta nada.',
  'mkt.hiw.step0.aside':
    'Usted es quien la funda, así que tiene todos los permisos desde el principio.',
  'mkt.hiw.step1.title': 'Comparta un código familiar',
  // *código familiar* is what /register calls it in Spanish, and *cola de aprobaciones*
  // is what /admin/members calls that queue. The page promises to use the
  // product’s own words; in this language that is the shell catalogue’s job to say.
  'mkt.hiw.step1.detail':
    'Su familia recibe un código corto. Póngalo en el grupo de mensajes. Los familiares se '
    + 'registran con él y llegan a su cola de aprobaciones: usted no está escribiendo a cien '
    + 'personas a mano.',
  'mkt.hiw.step1.aside':
    '¿Prefiere invitar directamente? Envíe una invitación por correo y se saltan el código.',
  'mkt.hiw.step2.title': 'Apruebe a quien pertenece',
  'mkt.hiw.step2.detail':
    'Todos los solicitantes esperan hasta que un administrador los reconoce. Nadie ve una '
    + 'sola fotografía, dirección ni cifra en dólares antes de que usted diga que sí.',
  'mkt.hiw.step2.aside': '¿Rechazado por error? Pueden pedirle que lo mire otra vez, por escrito.',
  'mkt.hiw.step3.title': 'Publique la reunión',
  'mkt.hiw.step3.detail':
    'Escriba la lista de comprobación una vez, programe la reunión a partir de ella, y '
    + 'todos los pasos se convierten en el trabajo de alguien con una fecha al lado. Lo que '
    + 'vuelve se acepta o se devuelve con notas.',
  'mkt.hiw.step3.aside': '',
  'mkt.hiw.step4.title': 'Active la tesorería',
  // *plan de cuotas* and *reglas de asignación* — both from the shell catalogue
  // (`acct.section.routing` is *Asignación*). *Enrutamiento* would read as a
  // network term.
  'mkt.hiw.step4.detail':
    'Fije un plan de cuotas que los integrantes puedan pagar a plazos, cree los fondos a '
    + 'los que pertenece el dinero, y deje que las reglas de asignación pongan cada pago '
    + 'donde va.',
  // *estado de resultados* rather than *pérdidas y ganancias*, matching
  // `page./reporting/pl-summary.title`.
  'mkt.hiw.step4.aside': 'Su tesorero obtiene un estado de resultados de verdad al otro lado.',
  'mkt.hiw.wholeSetup': 'Eso es toda la configuración',
  'mkt.hiw.wholeSetupLede':
    'Todo lo demás — chat, fotos, documentos, elecciones, capítulos, informes — ya está '
    + 'activado dentro de la misma cuenta, esperando para cuando lo quiera.',
  'mkt.hiw.seeEverything': 'Vea todo lo que incluye',
  'mkt.hiw.faqTitle': 'Lo que las familias preguntan primero',
  'mkt.hiw.faq0.q': '¿Cuánto lleva montar un portal familiar?',
  'mkt.hiw.faq0.a':
    'Crear la familia lleva un minuto aproximadamente. La mayoría de las familias tienen a '
    + 'sus familiares registrándose solos esa misma tarde, porque se unen con un código '
    + 'familiar en vez de introducirse a mano.',
  'mkt.hiw.faq1.q': '¿Tengo que añadir yo a todos los integrantes de la familia?',
  'mkt.hiw.faq1.a':
    'No. Usted comparte un código familiar corto y sus familiares se registran con él, '
    + 'llegando a una cola de aprobaciones para que un administrador la revise. También puede '
    + 'enviar invitaciones por correo directamente, lo que permite a alguien saltarse el '
    + 'código por completo.',
  'mkt.hiw.faq2.q':
    '¿Puede alguien ver la información de nuestra familia antes de que lo aprobemos?',
  'mkt.hiw.faq2.a':
    'No. Un solicitante no ve nada de la familia hasta que un administrador lo aprueba: ni '
    + 'directorio, ni fotografías, ni cifras financieras. La separación entre familias la '
    + 'impone la base de datos en todas las consultas, no un ajuste.',
  'mkt.hiw.faq3.q': '¿Qué pasa si rechazamos a alguien por error?',
  'mkt.hiw.faq3.a':
    'La decisión se conserva en vez de eliminarse, así que se puede revertir. Un '
    + 'administrador puede admitirlo después de todo, cualquier integrante puede enviarle una '
    + 'invitación nueva, y la propia persona puede responder una vez por escrito para pedir a '
    + 'los administradores que lo miren otra vez.',
  'mkt.hiw.faq4.q': '¿GENORRA es gratis para empezar?',
  'mkt.hiw.faq4.a':
    'Sí. Crear su familia, invitar a sus familiares y dirigir su primera reunión no cuesta '
    + 'nada, y no hace falta tarjeta para empezar.',
  'mkt.hiw.testimonials': 'Lo que nos cuentan las familias después',
  'mkt.hiw.ctaTitle': 'Empiece por el paso uno',
  'mkt.hiw.ctaLede': 'Cree su familia, comparta el código y vea cuánto de esto se llena solo.',
  'mkt.hiw.ctaPrimary': 'Cree su familia gratis',

  // ──── THE /features CATALOGUE — 42 cards, keyed on their own route ──────────────
  'mkt.also./community/family-tree.title': 'El árbol familiar',
  'mkt.also./community/family-tree.blurb':
    'Cada rama trazada hacia atrás a lo largo de las generaciones, con la sangre y el '
    + 'matrimonio distinguidos, y un familiar que todavía no tiene correo registrado '
    + 'exactamente igual que todos los demás.',
  'mkt.also./accounting/dues-and-donations.title': 'Cuotas y campañas de donación',
  'mkt.also./accounting/dues-and-donations.blurb':
    'Lo que debe este año y lo que ha pagado, y las campañas que la familia tiene en '
    + 'marcha: el lado del propio integrante en el libro.',
  'mkt.also./accounting/transactions.title': 'El libro completo',
  'mkt.also./accounting/transactions.blurb':
    'Cada aportación registrada y cada desembolso pagado, en un solo libro, con quién lo '
    + 'introdujo y cuándo.',
  'mkt.also./admin/accounting.title': 'Configure cómo funciona el dinero',
  'mkt.also./admin/accounting.blurb':
    'Cuotas con cualquier frecuencia y planes a plazos, los fondos que su familia mantiene, '
    + 'y la asignación que llena el fondo de la reunión antes que el de los estudios.',
  'mkt.also./accounting/summary.title': 'Su situación',
  'mkt.also./accounting/summary.blurb':
    'Sus cuotas, sus donaciones y lo que queda por pagar, con los saldos de los fondos de '
    + 'la familia al lado.',
  'mkt.also./admin/gatherings/templates.title': 'La lista de comprobación, escrita una vez',
  'mkt.also./admin/gatherings/templates.blurb':
    'Escriba la lista de pasos que su familia repite cada año. Programe una reunión a '
    + 'partir de ella y cada paso se convierte en el trabajo de alguien con una fecha encima.',
  'mkt.also./gatherings/my-tasks.title': 'Los trabajos que le dieron',
  'mkt.also./gatherings/my-tasks.blurb':
    'Cada paso de una reunión que es suyo, qué le está pidiendo, y si la respuesta que '
    + 'envió volvió aceptada o con notas.',
  'mkt.also./gatherings/budget.title': 'Lo que está costando la reunión',
  'mkt.also./gatherings/budget.blurb':
    'Un presupuesto sacado de uno de sus fondos, lo que ha reclamado cada tarea contra él, '
    + 'y una marca en el momento en que supera cualquiera de los dos.',
  'mkt.also./community/directory.title': 'El directorio de la familia',
  'mkt.also./community/directory.blurb':
    'Todo el mundo en una lista con búsqueda y los datos de contacto que de verdad hacen '
    + 'falta, y una búsqueda que maneja nombres reales, con acentos y todo.',
  'mkt.also./gatherings.title': 'Todas las reuniones, en una página',
  'mkt.also./gatherings.blurb':
    'Lo que la familia tiene por delante, con la fecha, el lugar y los detalles, y una '
    + 'destacada en la parte superior del panel de todo el mundo.',
  'mkt.also./admin/gatherings.title': 'Ponga una reunión en el calendario',
  'mkt.also./admin/gatherings.blurb':
    'Prográmela, déle sus fechas y su lugar, y vea qué ha vuelto de ella. Gratis no '
    + 'necesita lista de comprobación: una fecha, un lugar y una descripción son una reunión.',
  'mkt.also./personal-info.title': 'Su propia ficha, mantenida por usted',
  'mkt.also./personal-info.blurb':
    'Datos de contacto, cumpleaños, talla de camiseta: lo que la familia necesita saber de '
    + 'usted, mantenido por usted y no por quien lleve la lista.',
  'mkt.also./admin/members/approvals.title': 'Nadie entra hasta que usted lo deja entrar',
  'mkt.also./admin/members/approvals.blurb':
    'Cada solicitud para unirse espera en una cola hasta que alguien la admite, y no ve '
    + 'nada de la familia mientras espera.',
  'mkt.also./reporting/pl-summary.title': 'Un estado de resultados para su tesorero',
  'mkt.also./reporting/pl-summary.blurb':
    'Dinero que entra frente a dinero que sale, directo del libro, en el estado que pide la '
    + 'directiva.',
  'mkt.also./community/chat.title': 'Chat de la familia',
  'mkt.also./community/chat.blurb':
    'Hilos de grupo y mensajes privados, para que la familia siga hablando entre reuniones.',
  'mkt.also./community/announcements.title': 'Anuncios',
  'mkt.also./community/announcements.blurb':
    'Cualquiera puede compartir noticias; los administradores fijan lo que importa en la '
    + 'parte superior del panel de todo el mundo.',
  'mkt.also./community/distributions.title': 'Envíe un correo a toda la familia',
  'mkt.also./community/distributions.blurb':
    'Un mensaje a todo el mundo, o a una región o un capítulo, sacado directamente de su '
    + 'lista de integrantes: nadie se queda fuera, nadie lo recibe dos veces, y usted ve '
    + 'exactamente a quién llegó.',
  'mkt.also./community/safety-check-ins.title': 'Compruebe que todos están a salvo',
  'mkt.also./community/safety-check-ins.blurb':
    'Cuando llega una tormenta o un incendio, hágales una sola pregunta a los familiares de '
    + 'esa región, o a una lista que usted elija. Responden con un toque, y usted ve quién '
    + 'está a salvo, quién necesita ayuda y quién no ha respondido todavía.',
  'mkt.also./community/elections.title': 'Elecciones de cargos',
  'mkt.also./community/elections.blurb':
    'Nomine a alguien, acepte o rechace su propia nominación, y luego vote, dentro de las '
    + 'ventanas de nominación y votación que fijó su familia, con los resultados contados '
    + 'cuando cierra la urna.',
  'mkt.also./community/gallery.title': 'Galería',
  'mkt.also./community/gallery.blurb':
    'Álbumes para cada reunión, subidos en lote, con un etiquetado que encuentra al primo '
    + 'correcto entre cien.',
  'mkt.also./library/documents.title': 'Documentos',
  'mkt.also./library/documents.blurb':
    'Formularios, presentaciones y registros en un lugar compartido que no vive en una '
    + 'bandeja de entrada.',
  'mkt.also./admin/members/organization.title': 'Regiones y capítulos',
  'mkt.also./admin/members/organization.blurb':
    'Divida una familia grande en regiones y capítulos, cada uno con sus propios '
    + 'integrantes y sus propios cargos.',
  'mkt.also./reporting/membership.title': 'Informes para la directiva',
  'mkt.also./reporting/membership.blurb':
    'Integrantes por región y capítulo, cuántos han terminado de unirse, y adultos frente a '
    + 'menores.',
  'mkt.also./community/updates.title': 'El archivo de novedades',
  'mkt.also./community/updates.blurb':
    'Todo lo que la familia ha anunciado alguna vez, y todo lo que se le ha enviado a '
    + 'usted, con búsqueda mucho después de que se fuera del panel.',
  'mkt.also./reporting/payment-history.title': 'Su propio historial de pagos',
  'mkt.also./reporting/payment-history.blurb':
    'Cada pago registrado a su nombre, con su fecha, importe, método y estado, para que '
    + 'nadie tenga que creerle al tesorero sin más.',
  'mkt.also./reporting/dues-projections.title': 'Proyección de cuotas',
  'mkt.also./reporting/dues-projections.blurb':
    'Lo que la familia debería recaudar este año, lo que ha entrado, y quién sigue '
    + 'debiendo, contando a los familiares que nunca terminaron de registrarse.',
  'mkt.also./accounting/transactions/fund-transfers.title': 'Traspasos entre fondos',
  'mkt.also./accounting/transactions/fund-transfers.blurb':
    'Mueva dinero de un fondo a otro y conserve los dos lados en el registro.',
  'mkt.also./admin/members/templates.title': 'Quién puede hacer qué',
  'mkt.also./admin/members/templates.blurb':
    'Una cuadrícula de permisos por función, para que registrar cuotas no sea lo mismo que '
    + 'pagar dinero, y los administradores deciden quién ve la tesorería.',
  'mkt.also./admin/members/board-positions.title': 'Los cargos que mantiene su familia',
  'mkt.also./admin/members/board-positions.blurb':
    'Defina los cargos que su familia tiene de verdad — nacionales, regionales o por '
    + 'capítulo — y registre quién ocupa cada uno. Empieza vacío a propósito: no hay dos '
    + 'familias que mantengan la misma directiva.',
  'mkt.also./admin/elections.title': 'Dirigir la elección',
  'mkt.also./admin/elections.blurb':
    'Fije cuándo abren y cierran las nominaciones y la votación, y se gobiernan solas. '
    + 'Elija si vota toda la familia o solo una región o un capítulo. Los cargos salen de su '
    + 'lista de la directiva en el nivel que corresponde.',
  'mkt.also./library/officer-notes.title': 'El cargo tiene su propio cuaderno',
  'mkt.also./library/officer-notes.blurb':
    'Notas de trabajo que se quedan con el CARGO y no con la persona: tres tesoreros más '
    + 'adelante, quien lo ocupe abre el mismo cuaderno. Solo quienes ocupan ese cargo pueden '
    + 'leerlo, ni siquiera un administrador.',
  'mkt.also./library/meeting-minutes.title': 'Las actas, y cómo votó la sala',
  'mkt.also./library/meeting-minutes.blurb':
    'Programe una junta, nombre a su secretario y elija quién viene por CUERPO — la '
    + 'directiva nacional, la directiva de un capítulo — en vez de marcar once nombres. Los '
    + 'temas se someten a votación, y un voto registrado no lo puede editar nadie.',
  'mkt.also./library/bylaws.title': 'Sus estatutos, con búsqueda',
  'mkt.also./library/bylaws.blurb':
    'Las reglas por las que la familia acordó vivir, guardadas por artículo con las '
    + 'reformas que las cambiaron. Lo subido en texto plano se busca palabra por palabra; un '
    + 'PDF se busca por título, artículo y resumen, y cada entrada dice cuál de las dos cosas '
    + 'es.',
  'mkt.also./reporting/gatherings.title': '¿Está hecho de verdad el trabajo de la reunión?',
  'mkt.also./reporting/gatherings.blurb':
    'Cada reunión con cuánto de su trabajo ha vuelto, qué va atrasado, quién está ayudando, '
    + 'y qué han reclamado las tareas contra el presupuesto.',
  'mkt.also./reporting/elections.title': 'Una participación que merece llamarse mandato',
  'mkt.also./reporting/elections.blurb':
    'Cuántas personas votaron en cada elección, cuántas se presentaron, y para qué cargos '
    + 'nadie propuso un nombre.',
  'mkt.also./reporting/meetings.title': 'Con qué frecuencia se reúnen de verdad',
  'mkt.also./reporting/meetings.blurb':
    'Juntas celebradas, cuánta gente había en cada sala, cuántas decisiones se sometieron a '
    + 'votación, y quién responde cuando se convoca una. Cuenta a quién se convocó y quién '
    + 'votó, y se niega a llamar asistencia a ninguna de las dos cosas: nada en el producto '
    + 'registra quién entró por la puerta.',
  'mkt.also./reporting/board.title': 'Qué cargos están vacantes',
  'mkt.also./reporting/board.blurb':
    'Todos los cargos que su familia ha definido, quién los ocupa, y las vacantes, que es '
    + 'lo único que una lista de lo que existe no puede decirle.',
  'mkt.also./gatherings/calendar.title': 'Un calendario, no tres',
  'mkt.also./gatherings/calendar.blurb':
    'Una cuadrícula de mes de verdad con cada reunión en los días que dura, las juntas a '
    + 'las que está convocado, y los días en que están abiertas las nominaciones y la '
    + 'votación. Una reunión de tres días llena tres días.',
  'mkt.also./help.title': 'Un manual, escrito para sus familiares',
  'mkt.also./help.blurb':
    'Cada pantalla explicada por su nombre: los botones, las columnas, qué hace cada '
    + 'control y dónde mirar cuando algo falta. Un signo de interrogación en la barra '
    + 'superior abre la página del sitio donde usted está.',
  'mkt.also./my-families.title': 'Un solo acceso, más de una familia',
  'mkt.also./my-families.blurb':
    '¿Entró por matrimonio en una segunda familia, o mantiene a la vez la de su padre y la '
    + 'de su madre? Una cuenta pertenece a tantas como quiera, y cambiar entre ellas cambia '
    + 'todo lo que hay en pantalla a la vez.',
  'mkt.also./admin/members.title': 'Cuide la lista de integrantes',
  'mkt.also./admin/members.blurb':
    'Corrija la ficha de un familiar, envíele a alguien un restablecimiento de contraseña, '
    + 'o desactive a un integrante sin eliminar nada de lo que haya hecho.',
  'mkt.also./personal-info/photo.title': 'Una cara para cada nombre',
  'mkt.also./personal-info/photo.blurb':
    'Una fotografía al lado de cada familiar: en el directorio, en el árbol familiar, en la '
    + 'barra superior y en todas las pantallas donde aparezca. Sin ella se muestran sus '
    + 'iniciales.',

  // ──── FEATURES — the page, the roadmap table and the privacy card ───────────────
  'mkt.feat.metaTitle': 'Todo lo que hace funcionar a su organización familiar',
  'mkt.feat.metaDescription':
    'Organización de la reunión, cuotas y tesorería, árbol familiar, fotos, elecciones y '
    + 'chat: todas las herramientas que necesita una organización familiar, en un solo portal '
    + 'privado de GENORRA.',
  'mkt.feat.graphName': 'Todo lo que hace funcionar a su organización familiar',
  'mkt.feat.eyebrow': 'Funciones',
  'mkt.feat.title': 'Todo lo que hace funcionar a su organización familiar',
  'mkt.feat.lede':
    'La mayoría de las familias organizan una reunión desde un grupo de mensajes, una '
    + 'tesorería desde una hoja de cálculo y un árbol familiar desde la memoria de un '
    + 'familiar. GENORRA reemplaza las tres cosas, y las mantiene en el mismo lugar privado.',
  'mkt.feat.heroPrimary': 'Empezar gratis',
  'mkt.feat.heroSecondary': 'Ver precios',
  'mkt.feat.coreEyebrow': 'Lo esencial',
  'mkt.feat.coreTitle': 'Tres trabajos, bien hechos',
  'mkt.feat.coreLede':
    'No treinta funciones a medias. Las tres cosas de las que de verdad depende una '
    + 'organización familiar.',
  'mkt.feat.gridEyebrow': 'Pantalla por pantalla',
  'mkt.feat.gridTitle': 'Todo lo que hace, y en qué plan está',
  'mkt.feat.gridLede':
    'Todas las pantallas del producto, separadas por plan, para que pueda leer una banda y '
    + 'detenerse. Una tarjeta con borde sólido ya está disponible; una de borde discontinuo '
    + 'es una promesa que hace el plan y lo dice en su propia cara. El nivel bajo el que está '
    + 'una tarjeta se lee del mismo registro con el que el producto se limita a sí mismo.',
  'mkt.feat.screenOne': '1 pantalla',
  'mkt.feat.screenMany': '{n} pantallas',
  'mkt.feat.onTheWay': '{n} en camino',
  'mkt.feat.soon0.title': 'Cobre como paga su familia',
  'mkt.feat.soon0.blurb':
    'Tarjeta, débito, PayPal, Apple Pay, Google Pay y Cash App, asignados a sus fondos en '
    + 'el momento en que llegan. Hasta que esto esté disponible, el libro registra el '
    + 'efectivo y los cheques que usted recauda tal como los recauda ahora.',
  'mkt.feat.soon1.title': 'Deje de perseguir a sus familiares por las cuotas',
  'mkt.feat.soon1.blurb':
    'Sale un recordatorio cuando vence cada plazo, y se detiene en el momento en que se '
    + 'paga, así que a nadie se le reclama dinero que ya envió.',
  'mkt.feat.soon2.title': 'Noticias que llegan, en vez de esperar a que las encuentren',
  'mkt.feat.soon2.blurb':
    'Notificaciones en el teléfono y en el navegador para los anuncios, los mensajes y las '
    + 'tareas que le han dado, en vez de un panel que alguien tiene que acordarse de abrir.',
  'mkt.feat.soon3.title': 'La familia en el bolsillo de todos',
  'mkt.feat.soon3.blurb':
    'Aplicaciones para iPhone y Android, conectadas a la misma cuenta familiar, mostrando '
    + 'la misma familia que ve aquí.',
  'mkt.feat.privacyTitle': 'Una familia no puede ver a otra. Nunca.',
  'mkt.feat.privacyLede':
    'La separación entre familias no es un ajuste: la impone la base de datos en cada '
    + 'consulta, y todas las acciones que leen o escriben datos de la familia tienen una '
    + 'prueba que intenta entrar desde otra familia y que tiene que fallar.',
  'mkt.feat.privacy0': 'Los integrantes nuevos se revisan antes de que vean nada',
  'mkt.feat.privacy1': 'Cuentas con el correo verificado',
  'mkt.feat.privacy2': 'Nunca se comparte, nunca se vende, sin publicidad',
  'mkt.feat.whyUsLink': 'Por qué las familias nos eligen frente a las alternativas',

  // ──── THE THREE PILLARS — shared by Home and /features ──────────────────────────
  'mkt.pillar.0.eyebrow': 'Organícelo todo',
  'mkt.pillar.0.title': 'Reuniones que se organizan solas',
  'mkt.pillar.0.short':
    'Construya la reunión a partir de una lista de comprobación, entregue cada paso al '
    + 'familiar al que le toca, y vea de un vistazo qué ha vuelto, sin que nadie persiga una '
    + 'hoja de cálculo la semana anterior.',
  'mkt.pillar.0.blurb':
    'Una reunión es más que una fecha. Escriba la lista de comprobación una vez, programe '
    + 'la reunión a partir de ella, y cada paso se convierte en el trabajo de alguien con una '
    + 'fecha límite al lado.',
  'mkt.pillar.0.b0':
    'Plantillas reutilizables: la lista que su familia repite cada año, escrita una vez',
  'mkt.pillar.0.b1': 'Cada paso asignado a un familiar con nombre, con una fecha límite',
  'mkt.pillar.0.b2':
    'Las respuestas vuelven a quien organiza, que las acepta o las devuelve con notas',
  'mkt.pillar.0.b3':
    'Un presupuesto sacado de un fondo real, con cada tarea reclamando su propia partida',
  'mkt.pillar.0.b4':
    'Una reunión marcada como destacada, en la parte superior del panel de todo el mundo',
  'mkt.pillar.0.b5': 'El calendario del mes, con cada reunión en los días que de verdad dura',
  'mkt.pillar.1.eyebrow': 'El dinero, resuelto',
  'mkt.pillar.1.title': 'Una tesorería de verdad, no una caja de zapatos',
  'mkt.pillar.1.short':
    'Cuotas que sus integrantes de verdad pueden pagar, cada dólar asignado automáticamente '
    + 'al fondo correcto, y un estado de resultados que su tesorero puede entregar a la '
    + 'directiva.',
  'mkt.pillar.1.blurb':
    'Recaude cuotas que sus integrantes de verdad pueden pagar, asigne cada dólar '
    + 'automáticamente al fondo correcto, y responda a «¿dónde fue el dinero?» con un informe '
    + 'en vez de una discusión.',
  'mkt.pillar.1.b0':
    'Cuotas con cualquier frecuencia, y planes a plazos que los integrantes pueden mantener',
  'mkt.pillar.1.b1':
    'Asignación automática: el fondo de la reunión se llena primero, el de los estudios '
    + 'después',
  'mkt.pillar.1.b2': 'Cascadas de saldo mínimo, para que ningún fondo se quede corto en silencio',
  'mkt.pillar.1.b3': 'Aportaciones y desembolsos en un solo libro completo',
  'mkt.pillar.1.b4':
    'Saldos de los fondos que se actualizan en el momento en que entran las cuotas',
  'mkt.pillar.1.b5': 'Un estado de resultados que su tesorero puede entregar a la directiva',
  'mkt.pillar.2.eyebrow': 'Conozca a su familia',
  'mkt.pillar.2.title': 'El registro de la familia, bien llevado',
  'mkt.pillar.2.short':
    'El árbol familiar y el directorio: un registro vivo que mantiene toda la familia, en '
    + 'vez de un solo historiador agotado.',
  'mkt.pillar.2.blurb':
    'Quién está relacionado con quién, cómo contactarlos, y cada rama trazada hacia atrás a '
    + 'lo largo de las generaciones, mantenido por la familia y no por un solo historiador '
    + 'agotado.',
  'mkt.pillar.2.b0': 'Un árbol de varias generaciones: padres, abuelos, hijos y cónyuges',
  'mkt.pillar.2.b1': 'Relaciones de crianza y exparejas tratadas con cuidado',
  'mkt.pillar.2.b2':
    'Trace cualquier rama hacia atrás a lo largo de las generaciones, un clic a la vez',
  'mkt.pillar.2.b3':
    'Registre a un familiar que todavía no tiene correo, e invítelo cuando lo tenga',
  'mkt.pillar.2.b4':
    'Perfiles que mantiene la familia: datos de contacto, cumpleaños, tallas de camiseta',
  'mkt.pillar.2.b5': 'Un directorio con una búsqueda que maneja nombres reales, con acentos y todo',

  // ──── HOME — the product band ───────────────────────────────────────────────────
  // APP_PROMISE joined APP_VALUES with English punctuation and English word order.
  // This is the finished phrase — the three brand values, in Spanish, in the
  // order the brand states them. Never reassemble it from three words.
  'mkt.showcase.eyebrow': 'Herencia · Comunidad · Legado',
  'mkt.showcase.title': 'Todo lo que hace falta para dirigir una familia',
  'mkt.showcase.lede':
    'GENORRA reemplaza los grupos de mensajes, las hojas de cálculo y las cajas de zapatos '
    + 'llenas de recibos con un solo hogar privado para su familia, sus planes y su dinero.',
  'mkt.showcase.andAlso':
    'Y chat de la familia, anuncios, elecciones de cargos, colecciones de fotos, '
    + 'documentos, capítulos regionales e informes para la directiva.',
  'mkt.showcase.moreLink': 'Todo lo que hace, qué incluye cada plan, y qué está todavía en camino',

  // ──── HOME — the family website, on the roadmap ─────────────────────────────────
  'mkt.living.eyebrow': 'En la hoja de ruta',
  'mkt.living.title': 'El sitio web de su propia familia, construyéndose solo',
  'mkt.living.lede':
    'Todos los demás sitios familiares de internet están abandonados en marzo, porque '
    + 'alguien tiene que mantenerlos al día. Este toma lo que su familia ya está haciendo '
    + 'dentro de GENORRA — el próximo evento, las fotografías más nuevas, el último anuncio — '
    + 'y se mantiene al día solo.',
  'mkt.living.src0.label': 'Su próxima reunión',
  'mkt.living.src0.detail':
    'La reunión que ya está organizando se convierte en la página en la que aterriza todo '
    + 'el mundo: la fecha, el lugar y quién hace qué.',
  'mkt.living.src1.label': 'Las fotografías',
  'mkt.living.src1.detail':
    'Las colecciones que su familia ya ha subido se convierten en la galería, de la más '
    + 'nueva a la más antigua, sin que nadie la reconstruya.',
  'mkt.living.src2.label': 'Qué está pasando',
  'mkt.living.src2.detail':
    'Los anuncios y los logros salen a la superficie como noticias, así que el sitio nunca '
    + 'está un año desactualizado.',
  'mkt.living.illustration':
    'Ilustración de una función en desarrollo: no es una captura de pantalla y no es '
    + 'definitiva.',

  // ──── THE PLAN LADDER — the cards on /pricing ───────────────────────────────────
  'mkt.ladder.chooseAria': 'Elija un plan para leer',
  'mkt.ladder.everythingIn': 'Todo lo del plan {tier}',
  'mkt.ladder.undecided': 'Lo que añade este nivel todavía se está decidiendo.',
  'mkt.ladder.startWith': 'Empezar con {tier}',
  'mkt.ladder.accountFirst':
    'Cree su cuenta primero: usted elige cómo pagar cuando su familia exista.',
  'mkt.ladder.notYet': 'Todavía no disponible',
  'mkt.ladder.hearFirst': 'Cree una cuenta gratis y será el primero en saberlo.',
}
