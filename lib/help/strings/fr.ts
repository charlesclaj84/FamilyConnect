import type { Catalogue } from '@/lib/i18n/t'

/**
 * The manual, fr. Keyed against `lib/help/content.ts` — see `lib/help/keys.ts` for the
 * key scheme and why the English is derived rather than repeated here.
 *
 * TRANSLATED PART BY PART. A key that is not here yet resolves to the English, so a partly
 * translated manual reads as English chapters beside translated ones rather than as a page of
 * key names. `npm run i18n:check` reports the backlog as a count on every run.
 */
export const helpFr: Catalogue = {
  // ──── PART 1 — Getting started ────────────────────────────────────────────────
  'help.part.start.title': 'Premiers pas',
  'help.part.start.blurb': 'De quoi l’écran est fait, et comment vous et vos proches y entrez.',
  'help.finding-your-way-around.title': 'S’orienter',
  'help.finding-your-way-around.summary':
    'Le menu latéral, la barre supérieure et les quelques contrôles présents sur chaque '
    + 'écran.',
  'help.finding-your-way-around.the-rail.heading': 'Le menu latéral de gauche',
  'help.finding-your-way-around.the-rail.b0':
    'Tout dans le produit s’atteint depuis le menu latéral bordeaux. Ses en-têtes '
    + 'regroupent les écrans selon leur objet — **Communauté**, **Rassemblements**, '
    + '**Bibliothèque**, **Comptabilité**, **Rapports**, **Administration**, **Aide** — et un '
    + 'en-tête s’ouvre quand vous cliquez dessus, refermant celui qui était ouvert.',
  'help.finding-your-way-around.the-rail.b1':
    'Le menu latéral ne liste que les écrans que vous pouvez ouvrir. S’il manque un en-tête '
    + 'que vous attendiez, c’est que tous les écrans en dessous ne font pas partie du forfait '
    + 'de votre famille ou ne vous ont pas été accordés par elle. Ce n’est pas un défaut — '
    + 'voyez [Qui peut faire quoi](/help/who-can-do-what).',
  'help.finding-your-way-around.the-rail.b2':
    'Sur un téléphone le menu latéral est derrière le bouton **Menu**, en haut à gauche. Il '
    + 'se referme dès que vous choisissez quelque chose.',
  'help.finding-your-way-around.the-top-bar.heading': 'La barre du haut',
  'help.finding-your-way-around.the-top-bar.b0':
    'Cinq contrôles se trouvent en haut à droite de chaque page.',
  'help.finding-your-way-around.the-top-bar.b1.i0.term': 'Changement de famille',
  'help.finding-your-way-around.the-top-bar.b1.i0.text':
    'Apparaît lorsque votre compte appartient à plus d’une famille. Choisir une autre '
    + 'famille recharge la page où vous êtes, en tant que cette famille.',
  'help.finding-your-way-around.the-top-bar.b1.i1.term': 'Aide',
  'help.finding-your-way-around.the-top-bar.b1.i1.text':
    'Un point d’interrogation qui mène au chapitre de ce manuel décrivant l’écran où vous '
    + 'êtes. Il est absent des quelques écrans qu’aucun chapitre ne couvre encore, et de ces '
    + 'pages d’aide.',
  'help.finding-your-way-around.the-top-bar.b1.i2.term': 'Cloche',
  'help.finding-your-way-around.the-top-bar.b1.i2.text':
    'Vos notifications, plus une ligne permanente pour chaque famille où des personnes '
    + 'attendent une approbation — y compris les familles que vous ne consultez pas en ce '
    + 'moment.',
  'help.finding-your-way-around.the-top-bar.b1.i3.term': 'Langue',
  'help.finding-your-way-around.the-top-bar.b1.i3.text':
    'Le code à deux lettres à côté de la cloche : **EN**, **ES** ou **FR**. En choisir un '
    + 'fait passer le produit dans cette langue partout, et sur chaque appareil où vous vous '
    + 'connectez, parce que c’est conservé avec votre profil et non avec ce navigateur. Il ne '
    + 's’affiche pas tant que le produit ne parle qu’une seule langue.',
  'help.finding-your-way-around.the-top-bar.b1.i4.term': 'Votre nom',
  'help.finding-your-way-around.the-top-bar.b1.i4.text':
    'Ouvre le menu du compte : [Mon profil](/personal-info), [Mes familles](/my-families), '
    + '**Apparence** — Clair, Sombre ou Système, retenu dans ce navigateur — et la '
    + 'déconnexion.',
  'help.finding-your-way-around.the-top-bar.b2':
    'Chacun d’eux se referme de lui-même quelques secondes après que vous vous en éloignez, '
    + 'de sorte qu’un panneau ne reste jamais posé sur la page que vous vous êtes mis à lire. '
    + 'Il reste ouvert tant que votre pointeur est dessus, et tant que vous le parcourez au '
    + 'clavier.',
  'help.finding-your-way-around.notifications.heading': 'La cloche',
  'help.finding-your-way-around.notifications.b0':
    'Les notifications arrivent en temps réel — vous n’avez pas à rafraîchir. Elles portent '
    + 'sur ce qui vous est arrivé : une décision sur votre adhésion, quelqu’un demandant à '
    + 'rejoindre une famille que vous administrez, et ainsi de suite.',
  'help.finding-your-way-around.notifications.b1':
    'Les notifications vous appartiennent *dans une famille*, car c’est ce qu’une '
    + 'notification est. La seule chose qui traverse les familles est la file d’approbation : '
    + 'si vous administrez deux familles et que quelqu’un attend dans la seconde, la cloche '
    + 'vous le dit alors que vous regardez encore la première.',
  'help.finding-your-way-around.signed-out.heading': 'La déconnexion au bout d’une heure',
  'help.finding-your-way-around.signed-out.b0':
    'Si rien n’est saisi ni cliqué pendant 60 minutes, vous êtes déconnecté de cet appareil '
    + 'et renvoyé à la page de connexion, avec une note expliquant pourquoi. Un avertissement '
    + 'apparaît la dernière minute pour vous permettre de rester.',
  'help.finding-your-way-around.signed-out.b1':
    'L’activité dans n’importe quel onglet compte, donc lire une longue annonce dans un '
    + 'onglet ne vous déconnecte pas d’un autre. Se déconnecter ici ne déconnecte pas votre '
    + 'téléphone — pour cela, utilisez **Déconnecter les autres appareils** dans [Connexion '
    + 'et sécurité](/personal-info?section=security).',
  'help.finding-your-way-around.signed-out.b2':
    '**Sur un téléphone cela se produit à votre retour.** Un téléphone ferme la page '
    + 'pendant qu’elle est en arrière-plan, donc rien ne tourne pour compter l’heure et aucun '
    + 'avertissement ne peut être montré ; la vérification a lieu au moment où vous la '
    + 'réouvrez. Si vous êtes parti plus d’une heure, vous arrivez sur la page de connexion '
    + 'au lieu de là où vous en étiez — c’est la même règle qui arrive un peu plus tard.',
  'help.finding-your-way-around.saving.heading': 'Comment fonctionne l’enregistrement',
  'help.finding-your-way-around.saving.b0':
    'Rien dans un formulaire n’est enregistré avant que vous appuyiez sur son bouton. Toute '
    + 'action destructive — supprimer une annonce, retirer un lien sur l’arbre, refuser un '
    + 'barème de cotisations — vous demande d’abord de confirmer et dit ce qui va se passer.',
  'help.finding-your-way-around.saving.b1':
    'Lorsque quelque chose est refusé, le motif apparaît à côté du bouton sur lequel vous '
    + 'avez appuyé. Si une page entière dit qu’elle n’a pas pu se charger, il vaut '
    + 'généralement la peine de réessayer une fois avant de supposer le pire.',
  'help.joining-a-family.title': 'Créer une famille ou en rejoindre une',
  'help.joining-a-family.summary':
    'Codes familiaux, invitations, la file d’approbation, et quoi faire en attendant.',
  'help.joining-a-family.create.heading': 'Créer une famille',
  'help.joining-a-family.create.b0.i0':
    'Sur la page d’inscription, choisissez **Créer une famille** et donnez-lui un nom.',
  'help.joining-a-family.create.b0.i1':
    'Terminez votre inscription. Vous êtes le premier membre et êtes approuvé '
    + 'immédiatement.',
  'help.joining-a-family.create.b0.i2':
    'Un code familial de six caractères est généré et vous est montré. C’est par ce code '
    + 'que vos proches vous rejoignent.',
  'help.joining-a-family.create.b1':
    'Le code reste disponible ensuite dans [Paramètres](/admin/settings) et dans [Mes '
    + 'familles](/my-families).',
  'help.joining-a-family.join-by-code.heading': 'Rejoindre avec un code familial',
  'help.joining-a-family.join-by-code.b0':
    'Si quelqu’un vous a donné un code familial, choisissez **Rejoindre une famille** lors '
    + 'de votre inscription et saisissez-le. Si vous avez déjà un compte, utilisez plutôt '
    + '**Rejoindre une autre famille** dans [Mes familles](/my-families) — un compte peut '
    + 'appartenir à plusieurs familles.',
  'help.joining-a-family.join-by-code.b1':
    'Rejoindre par code ne vous admet pas. Cela vous place dans la file d’approbation de la '
    + 'famille, et quelqu’un là-bas doit vous faire entrer. N’importe qui détenant le code '
    + 'peut demander à se joindre, et c’est exactement pourquoi la décision revient à une '
    + 'personne et non au code.',
  'help.joining-a-family.invitations.heading': 'Rejoindre depuis une invitation',
  'help.joining-a-family.invitations.b0':
    'Une invitation est un lien envoyé par courriel à une seule adresse. Pour la personne '
    + 'qui l’envoie, c’est mieux qu’un code, car elle peut vous pré-approuver : suivez le '
    + 'lien, choisissez un mot de passe, et vous êtes entré sans attendre.',
  'help.joining-a-family.invitations.b1':
    'Une invitation qui ne pré-approuve pas vous place dans la file, comme un code. Dans '
    + 'les deux cas le lien vaut pour l’adresse à laquelle il a été envoyé — si vous êtes '
    + 'connecté sous une autre identité en l’ouvrant, le produit le dit plutôt que de '
    + 'rattacher discrètement l’invitation au mauvais compte.',
  'help.joining-a-family.confirm-your-email.heading': 'Confirmer votre adresse courriel',
  'help.joining-a-family.confirm-your-email.b0':
    'Quelle que soit la façon dont vous vous inscrivez — une nouvelle famille, un code '
    + 'familial ou une invitation — un lien de confirmation est envoyé à l’adresse utilisée, '
    + 'et le compte ne peut pas se connecter avant que ce lien ait été ouvert. Il fonctionne '
    + 'une fois et expire au bout d’une heure : utilisez donc le message le plus récent '
    + 'plutôt qu’un plus ancien du même fil.',
  'help.joining-a-family.confirm-your-email.b1':
    'Si vous essayez de vous connecter avant de l’ouvrir, la page de connexion dit que '
    + 'l’adresse n’est pas confirmée et propose **Renvoyer le lien** sous le formulaire. '
    + 'Regardez dans les indésirables avant d’appuyer : un lien arrivé et passé inaperçu est '
    + 'de loin la raison la plus fréquente, et une seconde copie n’y change rien.',
  'help.joining-a-family.confirm-your-email.b2':
    'Personne n’est informé de l’arrivée de ce courriel — ni vous ni nous — donc la page '
    + 'dit ce qu’elle a demandé plutôt que de promettre une livraison. Si rien n’arrive '
    + 'jamais, le plus probable est que l’adresse ne soit pas celle avec laquelle le compte a '
    + 'été créé.',
  'help.joining-a-family.waiting.heading': 'Pendant que vous attendez',
  'help.joining-a-family.waiting.b0':
    'Jusqu’à ce que quelqu’un vous admette, trois écrans vous sont ouverts : le tableau de '
    + 'bord, qui dit où en est la demande, [Mon profil](/personal-info) et [Mes '
    + 'familles](/my-families). Le reste du menu latéral apparaît dès que vous êtes approuvé '
    + '— vous n’avez pas à vous reconnecter, la page s’en aperçoit d’elle-même.',
  'help.joining-a-family.waiting.b1':
    'Remplir votre profil en attendant est la chose utile à faire. C’est ce qui donne à la '
    + 'personne qui examine la file quelqu’un à reconnaître plutôt qu’une adresse courriel.',
  'help.joining-a-family.declined.heading': 'Si une demande est refusée',
  'help.joining-a-family.declined.b0':
    'Vous en êtes informé, et vous pouvez faire appel : votre note retourne dans la même '
    + 'file et la demande redevient en attente. La note est l’essentiel — c’est ce qui donne '
    + 'à la personne qui l’examine une raison de regarder deux fois — donc écrivez la phrase '
    + 'plutôt que de renvoyer la demande en silence.',
  'help.joining-a-family.declined.b1':
    'Votre profil reste le vôtre dans tous les cas, et toute autre famille à laquelle vous '
    + 'appartenez n’est pas touchée.',
  // ──── PARTS 2 and 3 — Your own account, and The dashboard ─────────────────────
  'help.part.you.title': 'Votre propre compte',
  'help.part.you.blurb': 'Ce qui vous appartient plutôt qu’à la famille.',
  'help.my-profile.title': 'Mon profil',
  'help.my-profile.summary':
    'Votre nom, comment vos proches vous joignent, et les réglages de votre connexion.',
  'help.my-profile.sections.heading': 'Les cinq sections',
  'help.my-profile.sections.b0':
    'Le menu en haut de la page passe de l’une à l’autre. Chacune s’enregistre séparément : '
    + 'vous pouvez donc en remplir une et revenir plus tard.',
  'help.my-profile.sections.b1.i0.term': 'Général',
  'help.my-profile.sections.b1.i0.text':
    'Nom, nom d’usage, téléphone, courriel, date de naissance et votre photo.',
  'help.my-profile.sections.b1.i1.term': 'Adresse',
  'help.my-profile.sections.b1.i1.text':
    'Où vous habitez. Utilisée par le Répertoire et par tout ce que la famille vous envoie.',
  'help.my-profile.sections.b1.i2.term': 'Informations complémentaires',
  'help.my-profile.sections.b1.i2.text':
    'Taille de t-shirt, section, et les autres détails que demandent les rassemblements et '
    + 'les rapports.',
  'help.my-profile.sections.b1.i3.term': 'Notifications',
  'help.my-profile.sections.b1.i3.text':
    'Sur quoi votre famille peut vous contacter et par quel moyen — un interrupteur par '
    + 'notification et par canal.',
  'help.my-profile.sections.b1.i4.term': 'Connexion et sécurité',
  'help.my-profile.sections.b1.i4.text':
    'L’adresse avec laquelle vous vous connectez, et votre mot de passe.',
  'help.my-profile.notifications.heading': 'Notifications',
  'help.my-profile.notifications.b0':
    '**Notifications** est une grille : une ligne pour chaque chose sur laquelle votre '
    + 'famille peut vous contacter, et une colonne pour chaque moyen de vous joindre — '
    + '**Courriel**, **SMS** et **Notification push**. Elle s’ouvre comme une liste de ce que '
    + 'vous avez choisi ; appuyez sur **Modifier** au-dessus pour changer quoi que ce soit, '
    + 'puis sur **Terminé** quand vous avez fini. Il n’y a pas d’**Enregistrer** ni '
    + 'd’**Annuler** : chaque case est une pression, **Activé** ou **Désactivé**, et elle '
    + 'prend effet au moment où vous appuyez, donc **Terminé** ne fait que ranger les '
    + 'interrupteurs.',
  'help.my-profile.notifications.b1':
    'Elle utilise l’adresse courriel et le numéro de mobile déjà présents dans vos '
    + 'informations **Général**. Les deux sont affichés en haut de l’écran pour que vous '
    + 'voyiez où irait une notification, et modifier l’un ou l’autre là le modifie pour '
    + 'toutes les notifications d’un coup. Cet écran ne vous demande jamais un second numéro.',
  'help.my-profile.notifications.b2.i0.term': 'Demande de sécurité',
  'help.my-profile.notifications.b2.i0.text':
    'Votre famille lance une demande pendant une tempête, une évacuation ou une urgence et '
    + 'vous demande si vous êtes en sécurité. Le courriel est activé sauf si vous le '
    + 'désactivez ; le SMS est désactivé sauf si vous l’activez.',
  'help.my-profile.notifications.b3':
    '**Le courriel est activé par défaut et le SMS non**, et c’est délibéré plutôt '
    + 'qu’incohérent. Ce qu’il faut éviter, c’est une demande qui n’atteint personne, et '
    + 'votre famille a déjà votre adresse — mais un texto doit être accepté avant que '
    + 'quiconque en envoie, de sorte que rien concernant le SMS n’est jamais activé parce que '
    + 'vous ne l’auriez pas remarqué.',
  'help.my-profile.notifications.b4':
    '**Notification push** indique **Bientôt disponible** sur chaque ligne, et **SMS** aussi '
    + 'aujourd’hui. Les deux colonnes sont là pour que vous voyiez ce qui arrive plutôt que '
    + 'd’en être surpris plus tard ; rien dans le produit n’envoie encore ni l’une ni '
    + 'l’autre, et le courriel est le moyen qui fonctionne. Si vous avez accepté les textos '
    + 'avant qu’ils ne soient désactivés, votre interrupteur **SMS** reste où il est et vous '
    + 'pouvez toujours le désactiver : désactiver quelque chose n’est jamais plus difficile '
    + 'que de l’activer.',
  'help.my-profile.notifications-delivery.heading':
    'Quand Activé ne veut pas dire que cela arrivera',
  'help.my-profile.notifications-delivery.b0':
    'Un interrupteur dit ce que vous avez demandé. Savoir si nous pouvons réellement le '
    + 'livrer est une autre question, et l’écran le dit sous la grille plutôt que de laisser '
    + '**Activé** suggérer plus qu’il ne devrait.',
  'help.my-profile.notifications-delivery.b1.i0':
    'Aucune adresse courriel enregistrée, ou seulement une adresse provisoire — rien de '
    + 'marqué activé pour Courriel ne peut arriver. Ajoutez une vraie adresse dans '
    + '**Général**.',
  'help.my-profile.notifications-delivery.b1.i1':
    'Aucun numéro de mobile enregistré — rien de marqué activé pour SMS ne peut arriver.',
  'help.my-profile.notifications-delivery.b1.i2':
    'Un numéro de mobile que nous n’avons pas encore confirmé — nous lui envoyons un code à '
    + 'six chiffres avant de vous écrire quoi que ce soit.',
  'help.my-profile.notifications-delivery.b1.i3':
    'Les textos ne sont pas encore activés de notre côté. Vous pouvez enregistrer votre '
    + 'choix dès maintenant et nous commencerons à l’appliquer dès qu’ils le seront.',
  'help.my-profile.notifications-stopping.heading': 'Arrêter les textos',
  'help.my-profile.notifications-stopping.b0':
    'Tant que **SMS** indique **Bientôt disponible**, il n’y a rien à arrêter, car rien dans '
    + 'le produit n’envoie encore de texto. Ce qui suit vaut une fois qu’ils seront activés, '
    + 'et pour quiconque les a acceptés avant cela. Désactiver la case **SMS** les arrête '
    + 'immédiatement, sans rien à confirmer et sans qu’on vous demande pourquoi. Vous pouvez '
    + 'la réactiver quand vous le voulez.',
  'help.my-profile.notifications-stopping.b1':
    'Répondre **STOP** à n’importe quel texto que nous envoyons les arrête aussi — et ce '
    + 'cas-là est différent d’une manière qui vaut la peine d’être connue. C’est votre '
    + 'opérateur mobile qui agit, pas nous, donc nous ne pouvons pas les réactiver depuis '
    + 'cette page et personne dans votre famille ne peut le faire non plus. La case indique '
    + '**Arrêté** au lieu de proposer un interrupteur. Si vous les voulez de nouveau, envoyez '
    + '**START** au numéro qui vous a écrit.',
  'help.my-profile.per-family.heading': 'Un profil par famille',
  'help.my-profile.per-family.b0':
    'Si vous appartenez à plus d’une famille, vous avez un profil distinct dans chacune. '
    + 'Modifier cette page change la famille que vous consultez et rien d’autre — ce qui est '
    + 'délibéré, car l’adresse que vous donnez à votre belle-famille n’est pas toujours celle '
    + 'que vous donnez à vos cousins.',
  'help.my-profile.chapter.heading': 'Votre section',
  'help.my-profile.chapter.b0':
    'Le bloc portant le nom de votre famille contient un champ qui n’appartient qu’à cette '
    + 'famille : dans quelle **Section** vous êtes. Il n’apparaît que si la famille en a créé '
    + '; sinon, le bloc le dit.',
  'help.my-profile.chapter.b1':
    'Elle décide de deux choses. Les fils et filles de moins de 18 ans sans compte propre '
    + 'se déplacent avec vous — tous les autres dans la famille sont leur propre personne et '
    + 'gardent la section où ils sont — et elle peut décider ce que vous devez, car une '
    + 'famille peut rattacher les cotisations à une région ou à une section. Ne rien choisir '
    + 'vous laisse sous **National** : vous devez les cotisations de toute la famille et '
    + 'aucune des cotisations locales. Voyez [régions et '
    + 'sections](/help/regions-and-chapters#dues).',
  'help.my-profile.chapter.b2':
    'Un enfant dont la date de naissance n’a pas été enregistrée ne se déplace pas, car '
    + 'rien dans sa fiche ne dit qu’il a moins de 18 ans. Ajoutez-la sur sa fiche, ou '
    + 'définissez sa section pour lui depuis Membres et accès.',
  'help.my-profile.password.heading': 'Changer votre mot de passe',
  'help.my-profile.password.b0.i0': 'Ouvrez **Connexion et sécurité**.',
  'help.my-profile.password.b0.i1':
    'Saisissez votre mot de passe actuel, puis le nouveau deux fois.',
  'help.my-profile.password.b0.i2': 'Si un code vous est envoyé par courriel, saisissez-le.',
  'help.my-profile.password.b0.i3':
    'Enregistrez. Tous les autres appareils connectés en votre nom sont déconnectés.',
  'help.my-profile.password.b1':
    'Il existe aussi un contrôle **Déconnecter les autres appareils** à part, pour quand '
    + 'vous vous êtes simplement laissé connecté quelque part et ne voulez rien changer '
    + 'd’autre.',
  'help.my-profile.photo.heading': 'Votre photo',
  'help.my-profile.photo.b0':
    'La photo que vous téléversez dans **Général** est celle qui apparaît à côté de votre '
    + 'nom dans la barre du haut, dans le message d’accueil du tableau de bord, et partout où '
    + 'la famille vous voit. Sans elle, vous obtenez vos initiales.',
  'help.my-profile.photo.b1.i0': 'Ouvrez **Général**.',
  'help.my-profile.photo.b1.i1': 'Appuyez sur l’appareil photo dans le cercle en haut de la page.',
  'help.my-profile.photo.b1.i2': 'Choisissez une image et confirmez.',
  'help.my-profile.photo.b2':
    'Un JPEG, PNG ou WebP, jusqu’à 2 Mo. Tout autre format est refusé avec une ligne '
    + 'expliquant pourquoi plutôt qu’un échec silencieux, et une nouvelle photo remplace '
    + 'celle qui la précède.',
  'help.my-profile.photo.b3':
    'Votre photo est UNE seule photo, partagée par toutes les familles auxquelles vous '
    + 'appartenez — contrairement au reste de cette page, qui est par famille. Quiconque peut '
    + 'vous voir dans le [Répertoire](/community/directory) peut la voir : c’est donc le seul '
    + 'champ ici à traiter comme public au sein de la famille.',
  'help.my-profile.photo.b4':
    'Le fait qu’elle soit AFFICHÉE dépend du forfait de la famille, et cela se décide par '
    + 'famille et non par compte : une famille dont le forfait n’inclut pas les photos de '
    + 'profil affiche vos initiales partout et ne propose aucun appareil photo sur cette '
    + 'page. Si vous appartenez à deux familles, vous verrez peut-être bien votre photo dans '
    + 'l’une et vos initiales dans l’autre. Rien n’est perdu dans les deux cas — l’image est '
    + 'toujours là, et elle apparaît dès que le forfait d’une famille l’inclut.',
  'help.my-families.title': 'Mes familles',
  'help.my-families.summary':
    'Toutes les familles auxquelles votre compte appartient, laquelle s’ouvre par défaut, '
    + 'et comment en ajouter une autre.',
  'help.my-families.reading.heading': 'Lire la liste',
  'help.my-families.reading.b0':
    'Chaque famille affiche son nom, son code, et votre situation en son sein. Deux '
    + 'marqueurs comptent :',
  'help.my-families.reading.b1.i0.term': 'Consultée',
  'help.my-families.reading.b1.i0.text':
    'La famille que le reste du produit vous montre en ce moment.',
  'help.my-families.reading.b1.i1.term': 'Par défaut',
  'help.my-families.reading.b1.i1.text':
    'La famille qui s’ouvre à votre connexion. Appuyez sur **Par défaut** sur une autre '
    + 'ligne pour la déplacer.',
  'help.my-families.switching.heading': 'Changer de famille',
  'help.my-families.switching.b0':
    'Utilisez le changement de famille de la barre du haut — il fait le même travail depuis '
    + 'toutes les pages. Changer reconstruit la page entière pour la nouvelle famille : ce '
    + 'qui était à moitié saisi est abandonné plutôt que reporté, et c’est ce qui empêche un '
    + 'formulaire rempli pour une famille d’être enregistré dans une autre.',
  'help.my-families.adding.heading': 'Ajouter une autre famille',
  'help.my-families.adding.b0':
    '**Rejoindre une famille** prend un code familial et vous place dans la file de cette '
    + 'famille. **Créer une famille** en démarre une nouvelle avec vous comme premier membre. '
    + 'Ni l’une ni l’autre ne perturbe les familles auxquelles vous appartenez déjà.',
  'help.part.dashboard.title': 'Le tableau de bord',
  'help.part.dashboard.blurb': 'L’écran où vous arrivez, et ce que chaque panneau vous dit.',
  'help.the-dashboard.title': 'Le tableau de bord',
  'help.the-dashboard.summary':
    'Votre famille en un coup d’œil : les chiffres, ce qu’il y a à faire, et ce qui s’est '
    + 'passé récemment.',
  'help.the-dashboard.greeting.heading': 'Le message d’accueil',
  'help.the-dashboard.greeting.b0':
    'Votre nom, votre photo, les fonctions que vous occupez, et votre section si votre '
    + 'famille en utilise.',
  'help.the-dashboard.reminders.heading': 'Les rappels',
  'help.the-dashboard.reminders.b0':
    'Jusqu’à deux invites se placent sous le message d’accueil. Toutes deux sont des '
    + 'demandes plutôt que des avertissements, et aucune ne retient quoi que ce soit.',
  'help.the-dashboard.reminders.b1.i0.term': 'Complétez votre profil',
  'help.the-dashboard.reminders.b1.i0.text':
    'Vos proches vous trouvent dans le Répertoire, et le vôtre est presque vide. Il nomme '
    + 'ce qui manque — un téléphone, où vous habitez, votre date de naissance, une photo — et '
    + 'mène droit à Mon profil. Il n’a pas de bouton pour l’écarter parce qu’il disparaît de '
    + 'lui-même : remplissez la moitié de ce qu’il demande et il cesse d’apparaître.',
  'help.the-dashboard.reminders.b1.i1.term': 'Choisissez votre section',
  'help.the-dashboard.reminders.b1.i1.text':
    'Seulement dans une famille qui a des sections, et seulement tant que vous n’êtes dans '
    + 'aucune. La définir ici équivaut à la définir sur votre profil, et les proches sans '
    + 'compte propre se déplacent avec vous.',
  'help.the-dashboard.reminders.b2':
    'Aucune de ces deux invites n’est visible par quiconque d’autre, et rien sur aucun '
    + 'écran n’est verrouillé derrière l’une ou l’autre. Un membre qui ne veut rien saisir en '
    + 'a le droit.',
  'help.the-dashboard.premier-gathering.heading': 'Le rassemblement à la une',
  'help.the-dashboard.premier-gathering.b0':
    'Juste sous le message d’accueil, un bandeau pour le rassemblement que la famille a '
    + 'désigné comme le plus important : son titre, ses dates, son lieu, la part de son '
    + 'travail qui a été approuvée, et **Voir les détails** directement vers lui. La plupart '
    + 'du temps il n’est là pour personne : il n’apparaît que tant qu’un rassemblement est à '
    + 'la une et encore à venir. Voyez [Rassemblements](/help/gatherings#browsing).',
  'help.the-dashboard.premier-gathering.b1':
    'Tant qu’il est affiché, le message d’accueil au-dessus change avec lui : votre nom se '
    + 'pose sur la page plutôt que dans un bandeau coloré, avec la photographie du '
    + 'rassemblement à côté. La personne qui organise le rassemblement choisit cette '
    + 'photographie, et l’arbre GENORRA tient lieu de remplaçant jusque-là — voyez [Le '
    + 'bandeau du tableau de bord](/help/gathering-management#premier).',
  'help.the-dashboard.at-a-glance.heading': 'En un coup d’œil',
  'help.the-dashboard.at-a-glance.b0':
    'Le panneau porte sur VOUS et votre situation dans la famille. Jusqu’à trois chiffres '
    + 'en haut, et chacun n’apparaît que s’il vous revient réellement de le voir :',
  'help.the-dashboard.at-a-glance.b1.i0.term': 'Membres de la famille',
  'help.the-dashboard.at-a-glance.b1.i0.text':
    'Combien de personnes approuvées comptent dans la famille. Les personnes inscrites sur '
    + 'l’arbre sans compte sont comptées — elles font partie de la famille. Les personnes qui '
    + 'attendent encore une approbation, non.',
  'help.the-dashboard.at-a-glance.b1.i1.term': 'En attente d’approbation',
  'help.the-dashboard.at-a-glance.b1.i1.text':
    'Combien de personnes attendent. N’apparaît que lorsque quelqu’un attend effectivement, '
    + 'et seulement pour celui qui peut y donner suite.',
  'help.the-dashboard.at-a-glance.b1.i2.term': 'Prochains rassemblements',
  'help.the-dashboard.at-a-glance.b1.i2.text':
    'Combien de rassemblements ne sont pas encore terminés. N’apparaît que tant qu’au moins '
    + 'un ne l’est pas, et **Voir le calendrier** en dessous mène au '
    + '[Calendrier](/gatherings/calendar).',
  'help.the-dashboard.at-a-glance.b2':
    'Sous les chiffres, dans le même panneau : **Solde restant** — ce que vous devez encore '
    + '— et **Campagnes de dons**, celles que la famille a actuellement ouvertes. Toutes deux '
    + 'ont leur propre section plus bas.',
  'help.the-dashboard.at-a-glance.b3':
    '**Encaissé cette année** était un quatrième chiffre ici jusqu’au 19-08-2026 et '
    + 'constitue maintenant une carte à part plus bas sur la page. C’est ce que la FAMILLE a '
    + 'encaissé plutôt que quelque chose vous concernant — un chiffre de trésorier, à lire '
    + 'posément plutôt qu’à survoler. Qui peut le voir n’a pas changé : c’est toujours celui '
    + 'qui peut voir les registres.',
  'help.the-dashboard.quick-actions.heading': 'Actions rapides',
  'help.the-dashboard.quick-actions.b0':
    'Des raccourcis vers ce que les gens font le plus — ajouter un membre, enregistrer un '
    + 'paiement, envoyer un message. Un bouton n’apparaît que si vous pouvez faire ce qu’il '
    + 'nomme : un panneau Actions rapides vide n’est donc pas un défaut.',
  'help.the-dashboard.quick-actions.b1':
    '**Deux des boutons ne concernent aucune autorisation.** Ils apparaissent quand quelque '
    + 'chose vous attend et s’en vont quand ce n’est plus le cas — tout le reste de la rangée '
    + 'est une tâche que vous POUVEZ faire, et ceux-ci en sont une qu’on vous a demandée.',
  'help.the-dashboard.quick-actions.b2.i0.term': 'Mes tâches',
  'help.the-dashboard.quick-actions.b2.i0.text':
    'Une tâche de rassemblement attend votre réponse. Mène droit à elle. Voyez Mes tâches '
    + 'de rassemblement.',
  'help.the-dashboard.quick-actions.b2.i1.term': 'Nommer / Voter',
  'help.the-dashboard.quick-actions.b2.i1.text':
    'Une élection à laquelle vous pouvez participer est ouverte en ce moment, et le libellé '
    + 'dit laquelle des deux actions elle attend. Elle mène à ce bulletin plutôt qu’à la '
    + 'liste, et si deux sont ouvertes en même temps elle propose celle qui ferme le plus '
    + 'tôt.',
  'help.the-dashboard.quick-actions.b3':
    'Une élection n’apparaît ici que tant que sa fenêtre de nominations ou de vote est '
    + 'ouverte. Une élection qui n’a pas encore ouvert, ou qui attend entre les deux '
    + 'fenêtres, se trouve sur [Élections](/community/elections) et n’est pas une tâche — '
    + 'elle n’est donc pas proposée comme telle. Voyez '
    + '[Élections](/help/elections#the-dates).',
  'help.the-dashboard.recent-updates.heading': 'Actualités récentes',
  'help.the-dashboard.recent-updates.b0':
    'Vos notifications et les annonces de la famille dans une seule liste. Les annonces '
    + 'épinglées restent en haut jusqu’à ce que vous les écartiez ; une annonce écartée '
    + 'retombe dans la liste par ordre de date plutôt que de disparaître, de sorte que vous '
    + 'pouvez toujours la retrouver.',
  'help.the-dashboard.recent-updates.b1':
    'L’écartement est par personne et non par navigateur — faites-le sur votre portable et '
    + 'votre téléphone est d’accord.',
  'help.the-dashboard.recent-updates.b2':
    '**Voir toutes les actualités** au pied de la carte ouvre '
    + '[Actualités](/community/updates) : le même fil sans la limite de cinq lignes, et avec '
    + 'un champ de recherche. La carte est le rappel ; cette page est le registre.',
  'help.the-dashboard.balance.heading': 'Solde restant',
  'help.the-dashboard.balance.b0':
    'Dans **En un coup d’œil**, sous les chiffres : ce que vous devez encore '
    + 'personnellement cette année, tous barèmes de cotisations confondus. C’est le même '
    + 'chiffre par lequel [Résumé](/accounting/summary) commence, et **Voir les cotisations** '
    + 'vous mène au détail barème par barème sur '
    + '[Cotisations](/accounting/dues-and-donations).',
  'help.the-dashboard.donation-drives.heading': 'Campagnes de dons',
  'help.the-dashboard.donation-drives.b0':
    'Également dans **En un coup d’œil**, sous le solde : chaque campagne que la famille a '
    + 'actuellement ouverte, avec sa progression vers son objectif et la part qui vient de '
    + 'vous. Les campagnes closes ne sont pas ici — la barre ne peut plus bouger — mais elles '
    + 'restent sur [Dons](/accounting/dues-and-donations?pane=donations).',
  'help.the-dashboard.donation-drives.b1':
    'Celle qui ferme le plus tôt vient en premier, et le panneau donne le nombre s’il y en '
    + 'a plus de trois. Il n’apparaît pas du tout lorsqu’aucune campagne n’est ouverte, ce '
    + 'qui est le cas de la plupart des familles la plupart du temps.',
  'help.the-dashboard.collected.heading': 'Encaissé cette année',
  'help.the-dashboard.collected.b0':
    'Ce que la famille a encaissé cette année en cotisations et en dons, avec **Voir les '
    + 'paiements** vers le registre. C’était un chiffre dans **En un coup d’œil** jusqu’au '
    + '19-08-2026 et c’est maintenant une carte à part : ce panneau porte sur le lecteur, et '
    + 'ceci est le revenu de l’organisation.',
  'help.the-dashboard.collected.b1':
    'Il n’est montré qu’à quelqu’un qui peut voir les registres, et pour toute autre '
    + 'personne il est absent plutôt que vide — un chiffre vide invite un membre à se '
    + 'demander ce qu’on lui cache. Une famille qui n’a réellement rien encaissé affiche un '
    + 'zéro, ce qui est autre chose et constitue une vraie réponse.',
  'help.the-dashboard.tree-card.heading': 'Arbre généalogique',
  'help.the-dashboard.tree-card.b0':
    'Combien de personnes figurent sur l’arbre, combien de générations il atteint, et '
    + 'combien ne sont encore reliées à personne. Elle s’affiche même quand l’arbre est vide, '
    + 'car « personne ne l’a commencé » est la chose la plus utile qu’elle puisse dire à ce '
    + 'moment-là.',
  'help.the-dashboard.banners.heading': 'Bandeaux',
  'help.the-dashboard.banners.b0':
    'Entre le message d’accueil et les panneaux, le tableau de bord place parfois quelque '
    + 'chose que vous devez faire — le plus souvent une invite à choisir votre section. '
    + 'Chacun disparaît dès qu’il ne s’applique plus, de sorte que l’état habituel est qu’il '
    + 'n’y en a aucun.',
  // ──── PARTS 4 and 5 — Reports, and Reference ──────────────────────────────────
  'help.part.reports.title': 'Rapports',
  'help.part.reports.blurb':
    'Ce que la famille FAIT, relu — le travail, les élections, les réunions et les '
    + 'fonctions.',
  'help.gatherings-report.title': 'Rapport des rassemblements',
  'help.gatherings-report.summary':
    'Chaque rassemblement avec la part de son travail accomplie, ce qui est en retard, et '
    + 'ce que ses tâches réclament sur le budget.',
  'help.gatherings-report.what-it-is.heading': 'À quoi il répond',
  'help.gatherings-report.what-it-is.b0':
    '[Rassemblements](/reporting/gatherings) sous **Rapports** est une ligne par '
    + 'rassemblement : combien de ses tâches sont approuvées, combien sont en retard, combien '
    + 'ne sont tenues par personne et — là où vous pouvez voir l’argent — ce que ses lignes '
    + 'de tâches totalisent face à ce qu’il a budgété.',
  'help.gatherings-report.what-it-is.b1':
    'Il ne change rien et ne crée rien. Chaque ligne mène à [Rassemblements](/gatherings), '
    + 'où la chose elle-même se trouve.',
  'help.gatherings-report.what-it-is.b2':
    '**Les rassemblements annulés sont entièrement exclus**, lignes comme totaux. Leurs '
    + 'tâches ouvertes ne sont pas un travail dû par quiconque, et les compter laisserait une '
    + 'famille ayant annulé une chose définitivement dans le rouge sur tous les chiffres '
    + 'présentés ici.',
  'help.gatherings-report.overdue.heading': 'Ce qui compte comme en retard',
  'help.gatherings-report.overdue.b0':
    'Une tâche est en retard quand **sa date est passée et que personne ne l’a approuvée**. '
    + 'Cela inclut une tâche soumise et pas encore tranchée — le travail est peut-être bien '
    + 'fait, mais il reste en suspens du côté de l’organisateur, et ceci est le rapport de '
    + 'l’organisateur. Une tâche renvoyée compte aussi.',
  'help.gatherings-report.overdue.b1':
    '**Une tâche sans date d’échéance n’est jamais en retard.** Rien n’a été promis pour un '
    + 'jour donné : il n’y a donc aucun jour par rapport auquel elle puisse être en retard.',
  'help.gatherings-report.money.heading': 'Les colonnes d’argent',
  'help.gatherings-report.money.b0':
    '**Affecté** est ce que réclament les lignes de tâches du rassemblement, montré face à '
    + 'ce que le rassemblement a mis de côté. C’est signalé quand les lignes réclament plus '
    + 'que le budget — ce qui est un plan à corriger plutôt qu’une erreur, et donc n’est pas '
    + 'montré en rouge.',
  'help.gatherings-report.money.b1':
    'Les deux chiffres d’argent n’apparaissent que si votre famille est sur un forfait '
    + 'incluant la bande budgétaire du rassemblement et qu’elle vous a été accordée. Sans '
    + 'l’un ou l’autre, les colonnes ne sont simplement pas là — une colonne de tirets '
    + 'affirmerait que la famille n’a rien budgété.',
  'help.elections-report.title': 'Rapport des élections',
  'help.elections-report.summary':
    'Participation par élection, combien de personnes se sont présentées, et pour quelles '
    + 'fonctions personne n’a proposé de nom.',
  'help.elections-report.what-it-is.heading': 'À quoi il répond',
  'help.elections-report.what-it-is.b0':
    '[Élections](/reporting/elections) sous **Rapports** est une ligne par élection publiée '
    + ': quel périmètre elle couvre, dans quelle phase elle se trouve, combien de nominations '
    + 'elle a suscitées et combien ont été acceptées, et quelle a été la participation.',
  'help.elections-report.what-it-is.b1':
    '**Les brouillons ne sont pas comptés.** Un brouillon n’a ni dates, ni bulletin, ni '
    + 'corps électoral : une ligne à 0 % de participation pour lui serait un rapport sur une '
    + 'élection dont personne n’a été informé.',
  'help.elections-report.turnout.heading': 'Comment la participation est calculée',
  'help.elections-report.turnout.b0':
    '**La participation compte des personnes, non des bulletins.** Quelqu’un qui vote pour '
    + 'trois fonctions dans une élection est un votant. La moitié inférieure du chiffre est '
    + 'qui aurait pu voter : tous les membres approuvés pour une élection nationale, les '
    + 'membres d’une section pour une élection de section, et les membres de toutes les '
    + 'sections d’une région pour une élection régionale — la même règle qui décide qui voit '
    + 'l’élection au départ.',
  'help.elections-report.turnout.b1':
    'Une élection dont le périmètre ne compte aucun membre approuvé affiche **s. o.** '
    + 'plutôt que 0 %. Personne n’aurait pu y voter, et 0 % se lirait comme une élection que '
    + 'tout le monde a ignorée.',
  'help.elections-report.unopposed.heading': 'Fonctions pour lesquelles personne ne s’est présenté',
  'help.elections-report.unopposed.b0':
    'Une fonction sans aucune nomination **acceptée** n’a rien sur le bulletin. Une '
    + 'nomination que la personne nommée n’a pas acceptée ne compte pas — elle ne met aucun '
    + 'nom devant personne.',
  'help.elections-report.unopposed.b1':
    'C’est le chiffre sur lequel il vaut la peine d’agir avant la fermeture de la fenêtre '
    + 'de nominations, et c’est pourquoi il figure parmi les quatre en haut de la page.',
  'help.meetings-report.title': 'Rapport des réunions',
  'help.meetings-report.summary':
    'À quelle fréquence la famille se réunit, combien de personnes chaque salle comptait, '
    + 'et qui répond quand un vote est appelé.',
  'help.meetings-report.what-it-is.heading': 'À quoi il répond',
  'help.meetings-report.what-it-is.b0':
    '[Réunions](/reporting/meetings) sous **Rapports** comporte deux tableaux. Le premier '
    + 'est une ligne par réunion : sa date, qui a tenu le procès-verbal, combien de personnes '
    + 'étaient dans la salle, combien de sujets ont été abordés et combien de votes ont été '
    + 'exprimés. Le second est une ligne par proche : à combien de réunions il a été convié, '
    + 'dans combien il a voté, et de combien il a rédigé le procès-verbal.',
  'help.meetings-report.what-it-is.b1':
    'Chaque ligne de réunion mène à [Procès-verbaux](/library/meeting-minutes), là où le '
    + 'compte rendu lui-même se trouve.',
  'help.meetings-report.not-attendance.heading': 'Pourquoi rien ici ne dit « présence »',
  'help.meetings-report.not-attendance.b0':
    '**Rien dans GENORRA n’enregistre qui s’est effectivement présenté.** Il n’y a pas de '
    + 'pointage. Ceci rapporte donc les deux choses qu’il peut compter, et aucune des deux '
    + 'n’est la présence :',
  'help.meetings-report.not-attendance.b1.i0.term': 'Conviés',
  'help.meetings-report.not-attendance.b1.i0.text':
    'La liste des participants — qui a été invité lorsque la réunion a été programmée.',
  'help.meetings-report.not-attendance.b1.i1.term': 'Ont voté dans',
  'help.meetings-report.not-attendance.b1.i1.text':
    'Dans combien de ces réunions la personne a répondu à un vote. C’est la seule preuve '
    + 'positive que quelqu’un était dans la salle, et c’est un plancher plutôt qu’un décompte '
    + ': une réunion calme, sans vote appelé, n’en produit aucune.',
  'help.meetings-report.not-attendance.b2':
    'Faire la moyenne des deux pour obtenir un taux de présence donnerait un chiffre '
    + 'qu’aucune ligne de la base ne soutient — et c’est exactement le genre de nombre qu’on '
    + 'cite dans une réunion un an plus tard.',
  'help.meetings-report.minuted.heading': 'Procès-verbaux rédigés face aux réunions tenues',
  'help.meetings-report.minuted.b0':
    '**Procès-verbaux** compte les réunions que quelqu’un a closes. La clôture est ce qui '
    + 'transforme une réunion en compte rendu — plus de sujets, plus de notes, plus de votes '
    + '— de sorte que l’écart entre les deux chiffres est l’arriéré de réunions que personne '
    + 'n’a validées.',
  'help.board-report.title': 'Rapport du conseil et des fonctions',
  'help.board-report.summary':
    'Chaque fonction que la famille a définie, qui l’occupe, et lesquelles sont vacantes.',
  'help.board-report.what-it-is.heading': 'À quoi il répond',
  'help.board-report.what-it-is.b0':
    '[Conseil et fonctions](/reporting/board) sous **Rapports** énumère chaque poste du '
    + 'conseil que la famille a défini, dans l’ordre propre à la famille, avec la personne '
    + 'qui l’occupe — et, là où personne ne l’occupe, le mot **Vacant**.',
  'help.board-report.what-it-is.b1':
    'Il ne change rien. Définir une fonction et l’attribuer relève de **Membres → '
    + 'Organisation**, qui est une autorisation distincte.',
  'help.board-report.what-it-is.b2':
    'Cette séparation est la raison même de l’existence de cet écran : on peut montrer à un '
    + 'comité de nominations où sont les manques sans lui donner le pouvoir de modifier la '
    + 'liste.',
  'help.board-report.vacancies.heading': 'Les vacances sont le constat',
  'help.board-report.vacancies.b0':
    '**Chaque fonction est une ligne, y compris les vides**, et **Vacant** est l’un des '
    + 'quatre chiffres du haut. Un rapport qui n’énumérerait que les fonctions pourvues ne '
    + 'pourrait pas énoncer son fait le plus utile.',
  'help.board-report.vacancies.b1':
    'Les lignes restent dans l’ordre propre à la famille plutôt que de placer les vacances '
    + 'en tête, afin que ceci se lise côte à côte avec la liste de **Membres → '
    + 'Organisation**. C’est la couleur qui rend un manque repérable.',
  'help.board-report.two-hats.heading': 'Occuper plus d’une fonction',
  'help.board-report.two-hats.b0':
    'Une section apparaît quand quelqu’un en occupe deux ou plus. Ce n’est pas un problème '
    + 'en soi — une petite section a souvent une personne qui fait deux travaux — mais c’est '
    + 'généralement le signe d’un manque que quelqu’un a discrètement comblé, ce qui vaut la '
    + 'peine d’être su avant la prochaine élection.',
  'help.board-report.two-hats.b1':
    'Une fonction occupée pour une région ou une section particulière l’indique à côté du '
    + 'nom. Le même titre à deux niveaux constitue deux fonctions distinctes : un président '
    + 'national et un président de section sont deux lignes séparées.',
  'help.part.reference.title': 'Référence',
  'help.part.reference.blurb':
    'Les deux choses qui expliquent la plupart des questions que les gens posent.',
  'help.who-can-do-what.title': 'Qui peut faire quoi',
  'help.who-can-do-what.summary':
    'Comment les autorisations sont décidées, et pourquoi une page dont vous avez entendu '
    + 'parler n’est pas dans votre menu latéral.',
  'help.who-can-do-what.one-template.heading': 'Un modèle par membre',
  'help.who-can-do-what.one-template.b0':
    'Tout ce que vous pouvez faire vient de l’unique modèle d’autorisations sur lequel vous '
    + 'êtes. Il n’y a rien d’autre à vérifier et rien à additionner — si ce n’est pas sur '
    + 'votre modèle, vous ne l’avez pas.',
  'help.who-can-do-what.one-template.b1':
    'Les administrateurs de votre famille décident des modèles et de qui est sur lequel, '
    + 'depuis [Membres](/admin/members).',
  'help.who-can-do-what.actions.heading': 'Quatre actions, trois portées',
  'help.who-can-do-what.actions.b0':
    'Chaque fonctionnalité s’accorde de quatre façons — **voir**, **créer**, **modifier** '
    + 'et **supprimer** — et chacune est réglée sur l’une de trois portées.',
  'help.who-can-do-what.actions.b1.i0.term': 'Aucune',
  'help.who-can-do-what.actions.b1.i0.text': 'Pas du tout.',
  'help.who-can-do-what.actions.b1.i1.term': 'Les siens',
  'help.who-can-do-what.actions.b1.i1.text':
    'Seulement vos propres enregistrements. Vos annonces, vos paiements.',
  'help.who-can-do-what.actions.b1.i2.term': 'Tous',
  'help.who-can-do-what.actions.b1.i2.text': 'Ceux de n’importe qui, dans toute la famille.',
  'help.who-can-do-what.actions.b2':
    'C’est cette distinction qui permet à une famille de dire « vous pouvez supprimer vos '
    + 'propres publications mais pas celles des autres », un arrangement courant et sensé.',
  'help.who-can-do-what.self-service.heading': 'Ce que personne n’a à accorder',
  'help.who-can-do-what.self-service.b0':
    'Certaines choses vous appartiennent du fait d’être membre et ne demandent aucune '
    + 'autorisation : envoyer un message de chat, confirmer sa présence, modifier son propre '
    + 'profil, choisir sa propre périodicité de cotisation. Exiger une autorisation pour cela '
    + 'voudrait dire qu’une famille pourrait s’exclure par accident de son propre chat.',
  'help.who-can-do-what.missing.heading': 'Pourquoi une page manque',
  'help.who-can-do-what.missing.b0':
    'Le menu latéral n’énumère que ce que vous pouvez ouvrir, et il y a trois raisons '
    + 'distinctes pour lesquelles quelque chose peut ne pas y être :',
  'help.who-can-do-what.missing.b1.i0':
    'Votre modèle ne vous accorde pas **voir** dessus. Demandez-le à un administrateur.',
  'help.who-can-do-what.missing.b1.i1':
    'Elle ne fait pas partie du forfait de votre famille — l’ouvrir directement affiche '
    + 'l’écran de changement de forfait plutôt que de la masquer. Voyez '
    + '[Forfaits](/help/plans).',
  'help.who-can-do-what.missing.b1.i2':
    'Elle n’est pas encore livrée. L’ouvrir directement affiche Bientôt disponible.',
  'help.who-can-do-what.missing.b2':
    'Ces trois mêmes raisons décident d’un ONGLET. Plusieurs écrans sont un menu de '
    + 'panneaux — Membres, Comptabilité, Annonces, Transactions — et chaque panneau s’accorde '
    + 'de son propre droit : un onglet qui n’est pas au menu est donc un onglet qu’on ne vous '
    + 'a pas donné plutôt qu’un onglet disparu. Un écran dont vous ne détenez aucun panneau '
    + 'n’est pas du tout dans le menu latéral.',
  'help.who-can-do-what.missing.b3':
    'Saisir l’adresse d’une page qui ne vous a pas été accordée donne un simple « '
    + 'introuvable ». C’est délibéré : une page restreinte ne devrait pas confirmer qu’elle '
    + 'existe.',
  'help.plans.title': 'Forfaits',
  'help.plans.summary': 'Ce que chaque forfait comprend, et ce qui se passe à la limite.',
  'help.plans.plans.heading': 'Les forfaits',
  'help.plans.plans.b0':
    'Gratuit, Standard, Plus et Premium, et ils sont inclusifs — chacun est tout ce qui se '
    + 'trouve en dessous et davantage. Ce que chacun comprend est listé dans la section '
    + '**Forfait** des [Paramètres](/admin/settings), qui est le texte tenu à jour.',
  'help.plans.plans.b1':
    'Chaque forfait payant y affiche un prix, par mois, de mois en mois. Aucun chiffre '
    + 'n’est écrit ici — le panneau lit le vrai, et un prix recopié dans un manuel est un '
    + 'prix qui se périme sans que personne ne le remarque.',
  'help.plans.plans.b2':
    'Gratuit est gratuit, et n’est pas un essai. Standard et Plus peuvent être achetés ; '
    + 'Premium a un prix et n’est pas encore en vente, et sa ligne porte la mention **Bientôt '
    + 'disponible**. Rien n’est jamais facturé pour un forfait qu’une famille n’a pas payé.',
  'help.plans.paying.heading': 'Payer un forfait',
  'help.plans.paying.b0':
    'Les forfaits payants se mettent en place dans la section **Facturation** des '
    + '[Paramètres](/admin/settings), sous les forfaits eux-mêmes, et seule une personne '
    + 'détenant l’autorisation Paramètres peut l’ouvrir. Il y a deux façons de payer : **au '
    + 'mois**, qui se renouvelle le 1er, ou **à l’avance**, qui achète un nombre fixe de mois '
    + 'd’un coup et ne renouvelle rien.',
  'help.plans.paying.b1':
    'Le paiement est encaissé par Stripe sur ses propres pages. Aucune donnée de carte '
    + 'n’est saisie dans GENORRA et aucune n’y est conservée. La section **Forfait** '
    + 'ci-dessus ne peut pas faire monter une famille d’elle-même — une montée en forfait est '
    + 'un paiement, donc ces lignes renvoient à Facturation.',
  'help.plans.paying.b2':
    'Passer à un forfait moins cher est gratuit et ne passe pas par Facturation. Un forfait '
    + 'mensuel peut aussi être arrêté, ce qui le laisse courir jusqu’à la fin du mois déjà '
    + 'payé plutôt que de le terminer le jour même.',
  'help.plans.paying.b3':
    'Un forfait ne change que lorsque le paiement a réellement abouti — c’est Stripe qui '
    + 'nous le dit et non le navigateur qui revient. Si vous fermez l’onglet en cours de '
    + 'paiement, rien n’est perdu : le forfait change quand l’argent change, et la section '
    + 'Facturation montre ce qui a été payé.',
  'help.plans.chosen-at-signup.heading': 'Un forfait choisi à la création de la famille',
  'help.plans.chosen-at-signup.b0':
    'Choisir Standard ou Plus sur la page des tarifs, ou sur le formulaire d’inscription, '
    + 'ne le paie pas — il n’y a encore ni famille à facturer ni compte à débiter. Le choix '
    + 'est plutôt retenu au nom de la famille.',
  'help.plans.chosen-at-signup.b1':
    'Une fois l’adresse courriel confirmée et la personne qui a créé la famille connectée, '
    + 'le tableau de bord commence par **Finir de payer** ce forfait, au-dessus de tout le '
    + 'reste. Il porte deux boutons.',
  'help.plans.chosen-at-signup.b2.i0.term': 'Payer maintenant',
  'help.plans.chosen-at-signup.b2.i0.text':
    'Vous mène directement à Stripe pour payer au mois, en commençant par le reste de ce '
    + 'mois-ci. Il n’y a pas d’écran séparé à trouver d’abord.',
  'help.plans.chosen-at-signup.b2.i1.term': 'Annuler',
  'help.plans.chosen-at-signup.b2.i1.text':
    'Abandonne le forfait demandé par la famille et la laisse sur Gratuit. Cela n’annule '
    + 'rien chez Stripe et n’achète rien — tous les forfaits restent en vente dans les '
    + 'Paramètres ensuite.',
  'help.plans.chosen-at-signup.b3':
    'Un lien sous les boutons mène plutôt à la section Facturation, là où des mois peuvent '
    + 'être achetés à l’avance. Jusqu’à ce qu’un paiement aboutisse, la famille est sur '
    + 'Gratuit et rien n’a été facturé.',
  'help.plans.boundary.heading': 'Deux murs différents',
  'help.plans.boundary.b0.i0.term': 'Bientôt disponible',
  'help.plans.boundary.b0.i0.text':
    'La fonctionnalité n’a pas encore été construite. Personne ne l’a, sur aucun forfait.',
  'help.plans.boundary.b0.i1.term': 'Changer de forfait',
  'help.plans.boundary.b0.i1.text':
    'La fonctionnalité est construite et opérationnelle, et le forfait de votre famille ne '
    + 'l’inclut pas.',
  'help.plans.boundary.b1':
    'Ils sont montrés séparément à dessein. Dire à une famille qui paie qu’une '
    + 'fonctionnalité finie est « bientôt disponible » serait faux, et dire à une famille '
    + 'gratuite d’attendre quelque chose qu’elle pourrait avoir cet après-midi serait pire.',
  'help.plans.data.heading': 'Changer de forfait ne supprime jamais de données',
  'help.plans.data.b0':
    'Une offre décide quelles pages une famille peut ouvrir. Une famille qui passe à une offre '
    + 'moins chère conserve toutes les données saisies pendant **soixante jours** : les pages '
    + 'qui les lisent cessent de s’ouvrir, et remonter dans ces soixante jours les ramène '
    + 'aussitôt. Après soixante jours, ce que l’offre moins chère n’inclut pas est supprimé. '
    + 'Quatre rappels arrivent avant, et [Facturation](/admin/settings) affiche la date en '
    + 'permanence.',
  'help.troubleshooting.title': 'Si quelque chose semble anormal',
  'help.troubleshooting.summary':
    'Les quelques choses qui surprennent, et ce qui se passe réellement.',
  'help.troubleshooting.cannot-sign-in.heading': 'Je ne peux pas me connecter du tout',
  'help.troubleshooting.cannot-sign-in.b0':
    'Si la page de connexion répond que votre adresse courriel n’est pas confirmée, le '
    + 'compte existe et votre mot de passe était bon — elle attend le lien envoyé lors de '
    + 'l’inscription. Appuyez sur **Renvoyer le lien** dans le panneau sous le formulaire, '
    + 'puis ouvrez le message le plus récent. Chaque lien fonctionne une fois et expire au '
    + 'bout d’une heure : un courriel plus ancien du même fil ne vous fera pas entrer.',
  'help.troubleshooting.cannot-sign-in.b1':
    'Rien ne nous dit si ce courriel est arrivé, donc le panneau dit ce qu’il a demandé '
    + 'plutôt que d’affirmer une livraison. Regardez dans les indésirables, et si rien '
    + 'n’arrive du tout, l’adresse n’est peut-être pas celle avec laquelle le compte a été '
    + 'créé — voyez [Confirmer votre adresse '
    + 'courriel](/help/joining-a-family#confirm-your-email).',
  'help.troubleshooting.cannot-sign-in.b2':
    'Un mauvais mot de passe répond différemment, et une adresse sans compte aussi : tous '
    + 'deux disent que les identifiants sont invalides plutôt que de nommer la confirmation. '
    + 'Si c’est ce que vous voyez, demandez plutôt un lien de réinitialisation depuis la page '
    + 'de connexion.',
  'help.troubleshooting.missing-page.heading':
    'Une page dont on m’a parlé n’est pas dans mon menu latéral',
  'help.troubleshooting.missing-page.b0':
    'Trois raisons possibles, et [Pourquoi une page manque](/help/who-can-do-what#missing) '
    + 'les distingue. La plus fréquente de loin est que votre modèle ne l’accorde pas.',
  'help.troubleshooting.wrong-family.heading': 'Je regarde la mauvaise famille',
  'help.troubleshooting.wrong-family.b0':
    'Vérifiez le changement de famille dans la barre du haut. Si vous arrivez régulièrement '
    + 'dans la mauvaise, définissez l’autre comme **Par défaut** sur [Mes '
    + 'familles](/my-families) — c’est la famille qui s’ouvre à votre connexion.',
  'help.troubleshooting.signed-out.heading': 'Je suis constamment déconnecté',
  'help.troubleshooting.signed-out.b0':
    'Soixante minutes sans rien saisir ni cliquer vous déconnectent de cet appareil. C’est '
    + 'une vraie déconnexion et non un écran de verrouillage : se reconnecter est donc toute '
    + 'la solution. Si cela se produit pendant que vous travaillez vraiment, l’onglet est '
    + 'peut-être resté sur un écran qui ne reçoit aucune saisie — le minuteur compte les '
    + 'touches et les clics, pas le fait que la page soit ouverte.',
  'help.troubleshooting.signed-out.b1':
    '**Sur un téléphone, réouvrir l’application après un moment vous dépose sur la page de '
    + 'connexion sans avertissement préalable.** C’est la même heure, mesurée de la seule '
    + 'façon possible : un téléphone ferme la page en arrière-plan, donc rien ne tournait '
    + 'pour vous avertir et la vérification a lieu à votre retour. Se reconnecter reprend là '
    + 'où vous en étiez.',
  'help.troubleshooting.empty-list.heading': 'Une liste dit qu’il n’y a rien ici',
  'help.troubleshooting.empty-list.b0':
    'D’ordinaire il n’y a réellement rien. Deux choses à vérifier d’abord : si vous êtes '
    + 'dans la bonne famille, et si le panneau où vous êtes est limité à vos propres '
    + 'enregistrements plutôt qu’à ceux de la famille — une autorisation de **voir** accordée '
    + 'avec la portée *les siens* vous montre vos lignes et celles de personne d’autre, ce '
    + 'qui est correct et peut sembler vide.',
  'help.troubleshooting.tree-empty.heading': 'L’arbre s’ouvre sur quelqu’un d’autre',
  'help.troubleshooting.tree-empty.b0':
    'Cela arrive quand vous n’avez ni parents ni enfants enregistrés — l’arbre s’ouvre sur '
    + 'le proche auquel vous êtes rattaché plutôt que sur une page vide, et le dit. **Centrer '
    + 'sur moi** vous ramène, et ajouter un parent ou un enfant fait qu’il s’ouvre sur vous '
    + 'dès lors.',
  'help.troubleshooting.approved-nothing.heading': 'J’ai été approuvé mais rien n’a changé',
  'help.troubleshooting.approved-nothing.b0':
    'Cela devrait changer de soi-même en moins d’une minute, ou dès que vous revenez à '
    + 'l’onglet — la page vérifie plutôt que de vous faire reconnecter. Si ce n’est pas le '
    + 'cas, recharger la page suffira.',
  'help.troubleshooting.what-is-this-screen.heading': 'Je ne comprends pas à quoi sert un écran',
  'help.troubleshooting.what-is-this-screen.b0':
    'Chaque écran doté d’un chapitre porte un point d’interrogation en haut à droite, à '
    + 'côté de la cloche, qui mène droit à ce chapitre. Quelques écrans portent aussi un '
    + 'point d’interrogation à côté d’un contrôle particulier — l’interrupteur Lignée sur '
    + 'l’[Arbre généalogique](/community/family-tree), le forfait dans '
    + '[Paramètres](/admin/settings) — et celui-là mène au paragraphe sur ce contrôle plutôt '
    + 'qu’au début du chapitre.',
  'help.troubleshooting.what-is-this-screen.b1':
    'Si le point d’interrogation n’y est pas, aucun chapitre ne documente encore cet écran. '
    + '[La page de sommaire](/help) énumère tout ce que le manuel couvre.',
  // ──── PART 6 — Administration (Members, Organization) ─────────────────────────
  'help.part.admin.title': 'Administration',
  'help.part.admin.blurb':
    'Les réglages qui gouvernent la famille : qui en fait partie, quelle forme elle a, et '
    + 'ce qu’elle paie.',
  'help.members-and-access.title': 'Membres',
  'help.members-and-access.summary':
    'La liste des membres, la file d’approbation, les invitations, et les modèles '
    + 'd’autorisations qui les sous-tendent.',
  'help.members-and-access.tabs.heading': 'Quatre onglets, quatre travaux',
  'help.members-and-access.tabs.b0.i0.term': 'Membres',
  'help.members-and-access.tabs.b0.i0.text':
    'Toutes les personnes ayant un compte : sur quel modèle de permissions chacune se '
    + 'trouve et quel poste du conseil elle occupe. Quatre colonnes — Nom, Poste, Section '
    + 'et Groupe — avec tout le reste au sujet d’une personne derrière son nom, exactement '
    + 'comme dans l’[Annuaire](/help/directory#columns). Un sélecteur au-dessus du tableau '
    + 'liste aussi les **Fiches** — voyez [fiches](#records).',
  'help.members-and-access.tabs.b0.i1.term': 'Organisation',
  'help.members-and-access.tabs.b0.i1.text':
    'Quelle forme la famille a : ses régions et sections, et les postes au conseil qu’elle '
    + 'entretient. Il vient en second parce que les régions et les sections sont ce contre '
    + 'quoi les colonnes Région et Section du tableau des Membres se lisent. Deux chapitres '
    + 'le couvrent : [Organisation](/help/regions-and-chapters) et [Postes au '
    + 'conseil](/help/board-positions).',
  'help.members-and-access.tabs.b0.i2.term': 'Approbations en attente',
  'help.members-and-access.tabs.b0.i2.text':
    'Les personnes qui demandent à se joindre, et les invitations que vous avez envoyées.',
  'help.members-and-access.tabs.b0.i3.term': 'Modèles d’autorisations',
  'help.members-and-access.tabs.b0.i3.text': 'Les modèles eux-mêmes, et ce que chacun accorde.',
  'help.members-and-access.tabs.b1':
    'Les quatre s’accordent séparément et la page s’ouvre pour n’importe lequel d’entre eux '
    + '— quelqu’un peut traiter la file d’approbation sans pouvoir modifier de modèles, et '
    + 'quelqu’un peut tenir les sections de la famille en ordre sans pouvoir voir la liste '
    + 'des membres du tout.',
  'help.members-and-access.records.b4':
    'Deux choses sont refusées plutôt que proposées. Une personne ayant un COMPTE ne peut '
    + 'pas être supprimée ici : désactivez-la depuis le menu de sa ligne, ce qui conserve '
    + 'tout ce qui lui est rattaché. Et une fiche à laquelle de l’ARGENT est rattaché — un '
    + 'paiement, une contribution ou un versement — est refusée en nommant ce qui y est '
    + 'rattaché, car le registre d’une famille ne s’édite ni ne se supprime jamais.',
  'help.members-and-access.records.b3':
    '**Supprimer une fiche est définitif et se fait ici.** Cela retire la personne et '
    + 'tout ce qui a été enregistré à son sujet : sa place dans l’arbre familial, les '
    + 'étiquettes de photographie qui la nomment, et toute réunion ou vérification où elle '
    + 'figurait. La confirmation la nomme avant que vous ne validiez. Cela requiert la '
    + 'permission de suppression sur Membres, distincte de celle de modification.',
  'help.members-and-access.records.b2':
    '**Toutes les fiches n’en ont pas.** Inviter quelqu’un depuis l’arbre familial lui '
    + 'donne aussitôt une adresse réelle, et il reste une fiche jusqu’à ce qu’il accepte — '
    + 'cette ligne montre donc l’adresse réelle et aucune étiquette.',
  'help.members-and-access.records.b1':
    'Le tableau montre autre chose à leur sujet, parce que presque tout ce que montre le '
    + 'tableau des Membres serait vide : une fiche n’occupe aucun poste du conseil, n’a pas '
    + 'de modèle de permissions, et n’a rien à désactiver. Ce qu’il montre à la place est '
    + 'leur **adresse**, et si c’est une adresse que le produit a **générée** pour eux — '
    + 'c’est ce que signifie **Adresse générée** dans cette colonne. Une adresse générée ne '
    + 'peut pas recevoir de courrier ; elle existe pour que la fiche ait quelque chose '
    + 'd’unique.',
  'help.members-and-access.records.b0':
    'Le sélecteur au-dessus du tableau a deux positions. **Avec un compte** est celle sur '
    + 'laquelle l’onglet s’ouvre et correspond à tout ce qui précède. **Fiches** est '
    + 'l’autre liste : des parents que quelqu’un a inscrits dans l’[arbre '
    + 'familial](/community/family-tree) et qui ne se sont jamais connectés — une '
    + 'grand-mère, un enfant, quiconque a été inscrit pour que l’arbre ait du sens.',
  'help.members-and-access.records.heading': 'Les personnes sans compte',
  'help.members-and-access.approving.heading': 'Admettre quelqu’un',
  'help.members-and-access.approving.b0.i0': 'Ouvrez **Approbations en attente**.',
  'help.members-and-access.approving.b0.i1':
    'Lisez la demande — le profil de la personne est ce par quoi vous la reconnaissez.',
  'help.members-and-access.approving.b0.i2': 'Approuvez, ou refusez avec un motif.',
  'help.members-and-access.approving.b1':
    'Un membre approuvé obtient tout le produit immédiatement ; son menu latéral se remplit '
    + 'de lui-même sans qu’il ait à se reconnecter. Un candidat refusé en est informé, et '
    + 'peut faire appel une fois.',
  'help.members-and-access.inviting.heading': 'Inviter quelqu’un',
  'help.members-and-access.inviting.b0':
    '**Inviter** envoie un lien à une seule adresse courriel. Une invitation peut '
    + 'pré-approuver, ce qui fait entrer la personne directement lorsqu’elle l’accepte — '
    + 'c’est la différence entre une invitation et la distribution du code familial.',
  'help.members-and-access.inviting.b1':
    'Les invitations peuvent être renvoyées et révoquées depuis le même onglet. Si le '
    + 'courriel lui-même n’arrive pas à partir, vous en êtes informé et le lien vous est '
    + 'remis pour que vous le transmettiez vous-même, plutôt que de vous montrer une réussite '
    + 'sur un message jamais parti.',
  'help.members-and-access.templates.heading': 'Modèles d’autorisations',
  'help.members-and-access.templates.b0':
    'Chaque membre est sur exactement un modèle, et ce modèle constitue tout ce qu’il peut '
    + 'faire. Il n’y a pas de seconde couche — aucun groupe à réunir, aucune exception par '
    + 'personne à réconcilier.',
  'help.members-and-access.templates.b1.i0':
    'Ouvrez **Modèles d’autorisations** et créez-en un, éventuellement à partir d’une copie '
    + 'd’un modèle existant.',
  'help.members-and-access.templates.b1.i1':
    'Trouvez la fonctionnalité que vous voulez modifier. Chacune est une ligne qui dit ce '
    + 'qu’elle accorde aujourd’hui — « Tout voir », « Modifier les siens », ou **Rien**.',
  'help.members-and-access.templates.b1.i2':
    'Cliquez sur la ligne pour l’ouvrir. Ses **voir**, **créer**, **modifier** et '
    + '**supprimer** apparaissent en dessous, et seulement ceux qui veulent dire quelque '
    + 'chose pour cette fonctionnalité.',
  'help.members-and-access.templates.b1.i3':
    'Réglez chacun sur **Tous**, **Les siens** ou **—**. Le changement est confirmé puis '
    + 's’applique immédiatement.',
  'help.members-and-access.templates.b1.i4':
    'Placez-y des personnes depuis le menu de la ligne sur l’onglet **Membres**.',
  'help.members-and-access.templates.b2':
    'Une seule fonctionnalité est ouverte à la fois : en ouvrir une autre referme la '
    + 'précédente. C’est délibéré — quarante fonctionnalités multipliées par quatre réglages '
    + 'font un mur d’interrupteurs, et un administrateur vient ici pour en changer un.',
  'help.members-and-access.templates.b3':
    'Une ligne fermée est déjà la réponse. Elle dit ce que le modèle accorde pour cette '
    + 'fonctionnalité : lire un modèle entier revient donc à parcourir la liste plutôt qu’à '
    + 'ouvrir chaque ligne — et **Rien** est écrit plutôt que laissé vide, car une ligne vide '
    + 'se lit comme une ligne qui n’a pas pu se charger.',
  'help.members-and-access.templates.b4':
    'Modifier un modèle le modifie pour toutes les personnes qui y sont, aussitôt.',
  'help.members-and-access.editing-a-profile.heading': 'Corriger le profil de quelqu’un',
  'help.members-and-access.editing-a-profile.b0':
    'Appuyez sur le nom d’un membre sur l’onglet **Membres** pour voir sa fiche en entier, '
    + 'puis **Modifier le profil** pour la changer — ou allez-y directement avec **Modifier '
    + 'le profil** sous **Profil** dans le menu au bout de sa ligne. Le formulaire reprend '
    + 'les trois mêmes sections qu’un membre voit sur son propre [Mon profil](/personal-info) '
    + '— Général, Adresse et Informations complémentaires — de sorte qu’un nom mal '
    + 'orthographié ou une adresse qui a changé peut être corrigé pendant que vous l’avez au '
    + 'téléphone.',
  'help.members-and-access.editing-a-profile.b1':
    'Deux choses ne sont volontairement pas modifiables ici, et toutes deux lui '
    + 'appartiennent plutôt qu’à vous :',
  'help.members-and-access.editing-a-profile.b2.i0.term': 'Son adresse courriel',
  'help.members-and-access.editing-a-profile.b2.i0.text':
    'Affichée, et en lecture seule. C’est avec elle qu’elle se connecte : elle seule peut '
    + 'donc la changer, depuis Connexion et sécurité sur son propre profil. Pour un proche '
    + 'qui ne s’est pas encore inscrit c’est une adresse provisoire générée, et elle devient '
    + 'une vraie adresse lorsqu’il accepte une invitation.',
  'help.members-and-access.editing-a-profile.b2.i1.term': 'Son mot de passe',
  'help.members-and-access.editing-a-profile.b2.i1.text':
    'Personne ne peut le voir ni le définir, vous y compris. **Envoyer une réinitialisation '
    + 'de mot de passe** lui envoie un lien par courriel et c’est elle qui choisit le nouveau '
    + '; son mot de passe actuel continue de fonctionner jusqu’à ce qu’elle s’en serve.',
  'help.members-and-access.editing-a-profile.b3':
    'Un membre n’est pas averti que vous avez modifié son profil : dites-le-lui. La '
    + '**Section** à laquelle il appartient n’est pas ici non plus — les membres la '
    + 'définissent eux-mêmes, et c’est l’onglet [Organisation](/help/regions-and-chapters) '
    + 'qui décide quelles sections existent.',
  'help.members-and-access.editing-a-profile.b4':
    'Ceci demande **modifier** sur Membres. Quelqu’un qui ne peut que voir la liste des '
    + 'membres voit la fiche et aucun bouton Modifier.',
  'help.members-and-access.disabling.heading': 'Désactiver un membre',
  'help.members-and-access.disabling.b0':
    '**Désactiver le membre**, depuis le menu de la ligne sur l’onglet **Membres**, est '
    + 'l’alternative au retrait de quelqu’un. Il garde sa fiche et son historique et perd '
    + 'l’accès — le bon geste pour une personne qui ne devrait plus se connecter mais dont '
    + 'les paiements et la place sur l’arbre font partie du registre de la famille. **Activer '
    + 'le membre** la remet.',
  'help.regions-and-chapters.title': 'Organisation',
  'help.regions-and-chapters.summary':
    'Diviser une grande famille en régions et sections, sur l’onglet Organisation des '
    + 'Membres, et ce que la section d’un membre décide.',
  'help.regions-and-chapters.what-it-is.heading': 'Deux niveaux, et National',
  'help.regions-and-chapters.what-it-is.b0':
    '**Organisation** est le quatrième onglet des '
    + '[Membres](/admin/members?tab=organization), et c’est ainsi qu’une famille dispersée '
    + 's’organise. Une **section** est là où un membre appartient réellement — Houston, '
    + 'Atlanta — et une **région** est un groupe de sections, comme le Texas ou l’Est. Une '
    + 'famille peut fonctionner avec les sections seules, avec les deux, ou avec aucune.',
  'help.regions-and-chapters.what-it-is.b1':
    'L’onglet a deux moitiés. Ce chapitre est celle du haut, la géographie ; celle du bas '
    + 'est les fonctions de la famille et a son propre chapitre, [Postes au '
    + 'conseil](/help/board-positions). Elles s’accordent séparément : quelqu’un peut donc '
    + 'recevoir une moitié et pas l’autre — un onglet qui n’en montre qu’une n’est pas un '
    + 'défaut.',
  'help.regions-and-chapters.what-it-is.b2':
    'C’était auparavant un écran à part dans le menu latéral et c’est maintenant un onglet, '
    + 'car qui est dans la famille et comment la famille se divise sont un seul travail. Un '
    + 'lien ou un signet pointant vers l’ancienne adresse arrive toujours ici.',
  'help.regions-and-chapters.what-it-is.b3':
    '**National** est la troisième chose sur l’écran et ce n’est pas une région que vous '
    + 'créez. C’est ce à quoi tout appartient jusqu’à ce que vous le classiez ailleurs : une '
    + 'section sans région est sous National, et tout membre qui n’a pas choisi de section '
    + 'l’est aussi. Il ne peut être renommé, supprimé ni désactivé, et chaque famille l’a.',
  'help.regions-and-chapters.what-it-is.b4':
    'Les membres choisissent leur propre section, sur [Mon profil](/personal-info). '
    + 'Personne n’en reçoit une d’ici — cet onglet décide quelles sections EXISTENT.',
  'help.regions-and-chapters.adding.heading': 'Ajouter et déplacer',
  'help.regions-and-chapters.adding.b0.i0':
    'Saisissez un nom sous **Ajouter une région** et appuyez sur **Ajouter la région**. « '
    + 'National » est refusé, car il existe déjà.',
  'help.regions-and-chapters.adding.b0.i1':
    'Saisissez un nom sous **Ajouter une section**, choisissez **Dans la région** — ou '
    + 'laissez-le sur National — et appuyez sur **Ajouter la section**.',
  'help.regions-and-chapters.adding.b0.i2':
    'Pour déplacer une section plus tard, changez la cellule **Région** sur sa ligne. Cela '
    + 's’enregistre immédiatement.',
  'help.regions-and-chapters.adding.b1':
    'Déplacer une section d’une région à l’autre change qui doit une cotisation régionale, '
    + 'aussitôt. C’est voulu : les membres sont réellement dans la nouvelle région '
    + 'maintenant, donc les cotisations de la nouvelle région sont réellement les leurs.',
  'help.regions-and-chapters.deleting.heading': 'En supprimer une, et quand c’est impossible',
  'help.regions-and-chapters.deleting.b0':
    'Supprimer une région déplace ses sections vers National. L’adhésion de personne ne '
    + 'change et aucun enregistrement n’est touché ; la confirmation dit combien de sections '
    + 'seront déplacées.',
  'help.regions-and-chapters.deleting.b1':
    'Une section ou une région ne peut être supprimée tant que quelque chose y pointe '
    + 'encore. Le bouton Supprimer de la ligne est indisponible et dit ce qui fait obstacle — '
    + 'des membres dans la section, un barème de cotisations qui lui est propre, une annonce '
    + 'qui lui est adressée, ou un poste au conseil occupé là.',
  'help.regions-and-chapters.deleting.b2':
    'Il s’agit d’un refus plutôt que d’un rangement fait à votre place, et c’est délibéré : '
    + 'la section de quelqu’un décide ce qu’il doit et qui le dirige, donc déplacer quatorze '
    + 'personnes comme effet secondaire d’une suppression n’est pas une décision à prendre '
    + 'par accident. Déplacez les membres, redéfinissez le périmètre des cotisations, puis '
    + 'supprimez.',
  'help.regions-and-chapters.deleting.b3':
    'Rien ici n’est une impasse. Redéfinissez le périmètre d’une cotisation à toute la '
    + 'famille dans [Comptabilité](/admin/accounting?section=dues) et la région se supprime.',
  'help.regions-and-chapters.dues.heading': 'Ce qu’une section décide au sujet de l’argent',
  'help.regions-and-chapters.dues.b0':
    'Un barème de cotisations est dû par toute la famille, par une région, ou par une '
    + 'section — défini avec **Dû par** sur le formulaire de cotisations dans '
    + '[Comptabilité](/admin/accounting?section=dues). Voyez '
    + '[Comptabilité](/help/accounting#dues).',
  'help.regions-and-chapters.dues.b1.i0.term': 'National',
  'help.regions-and-chapters.dues.b1.i0.text':
    'Tous les membres la doivent. C’est le choix par défaut, et le seul jusqu’à ce que vous '
    + 'ayez créé une région ou une section.',
  'help.regions-and-chapters.dues.b1.i1.term': 'Une région',
  'help.regions-and-chapters.dues.b1.i1.text':
    'Seuls les membres dont la SECTION est dans cette région la doivent.',
  'help.regions-and-chapters.dues.b1.i2.term': 'Une section',
  'help.regions-and-chapters.dues.b1.i2.text': 'Seuls les membres de cette section la doivent.',
  'help.regions-and-chapters.dues.b2':
    '**Un membre sans section est sous National** : une cotisation régionale ou de section '
    + 'ne s’applique donc pas du tout à lui — elle n’apparaît pas sur son écran '
    + '[Cotisations](/accounting/dues-and-donations) et il n’en est jamais facturé. C’est '
    + 'l’état dans lequel chaque famille commence, et c’est la raison la plus fréquente pour '
    + 'qu’une nouvelle cotisation de section ne collecte rien : [Projection des '
    + 'cotisations](/reporting/dues-projections) le dit sur la ligne du barème quand personne '
    + 'dans la famille n’est dans la partie qu’elle vise.',
  'help.regions-and-chapters.dues.b3':
    'La région d’un membre est déduite de sa section chaque fois qu’on la demande. Il n’y a '
    + 'pas de région distincte à définir sur une personne, et déplacer une section vers une '
    + 'autre région y déplace tout le monde sans autre étape.',
  // ──── PART 6 — Administration (Board Positions, Running an election) ──────────
  'help.board-positions.title': 'Postes au conseil',
  'help.board-positions.summary':
    'Les fonctions que votre famille entretient, qui occupe chacune, et pourquoi la liste '
    + 'commence vide.',
  'help.board-positions.what-it-is.heading': 'Les fonctions de votre famille',
  'help.board-positions.what-it-is.b0':
    '**Postes au conseil** est la liste des fonctions que votre famille entretient '
    + 'réellement — président, trésorier, un responsable du rassemblement — et le relevé de '
    + 'qui occupe chacune. C’est la moitié inférieure de l’onglet **Organisation** des '
    + '[Membres](/admin/members?tab=organization), sous les régions et les sections : un seul '
    + 'onglet répond aux deux moitiés de « quelle forme cette famille a-t-elle ? ».',
  'help.board-positions.what-it-is.b1':
    '**La liste commence vide, et c’est délibéré.** Deux familles ne fonctionnent jamais de '
    + 'la même façon : l’une a cinq membres du bureau et un responsable pour le '
    + 'rassemblement, l’autre a vingt commissions. Rien n’est donc mis en place pour vous et '
    + 'rien n’est suggéré — vous ajoutez les fonctions que vous avez, et celles que vous '
    + 'n’avez pas ne sont simplement pas là.',
  'help.board-positions.what-it-is.b2':
    'Chaque fonction appartient à votre famille seule. Qu’une autre famille nomme son '
    + 'trésorier de la même manière n’a aucun effet sur le vôtre, et aucune des deux familles '
    + 'ne peut voir la liste de l’autre.',
  'help.board-positions.adding.heading': 'Ajouter une fonction',
  'help.board-positions.adding.b0.i0':
    'Appuyez sur **Ajouter une fonction**. Une boîte s’ouvre par-dessus la page.',
  'help.board-positions.adding.b0.i1':
    'Saisissez le nom tel que vous le prononcez — c’est ce qui apparaît à côté du nom de '
    + 'quelqu’un partout ailleurs.',
  'help.board-positions.adding.b0.i2':
    'Choisissez une **Catégorie** : **Membre du bureau** pour une fonction élue, **Fonction '
    + 'nommée** pour une fonction que l’on attribue.',
  'help.board-positions.adding.b0.i3':
    'Choisissez une **Portée** — voyez ci-dessous — et appuyez sur **Ajouter une '
    + 'fonction**.',
  'help.board-positions.adding.b1.i0.term': 'National',
  'help.board-positions.adding.b1.i0.text':
    'Un seul titulaire pour toute la famille. Presque tout est de ce type.',
  'help.board-positions.adding.b1.i1.term': 'Régional',
  'help.board-positions.adding.b1.i1.text':
    'Un titulaire par région. Vous choisissez laquelle en l’attribuant à quelqu’un.',
  'help.board-positions.adding.b1.i2.term': 'Section',
  'help.board-positions.adding.b1.i2.text': 'Un titulaire par section, choisie de la même façon.',
  'help.board-positions.adding.b2':
    'Régional et Section ne veulent dire quelque chose qu’une fois que votre famille a mis '
    + 'en place des régions ou des sections, ce qui est la moitié supérieure de ce même '
    + 'onglet. En attendant, utilisez National.',
  'help.board-positions.adding.b3':
    '**Le même titre peut exister une fois à chaque portée.** Un **président** national et '
    + 'un **président** régional sont deux fonctions distinctes, et une famille de quatre '
    + 'régions a un président régional que quatre personnes occupent — un par région. Il n’y '
    + 'a donc pas besoin de nommer la seconde « président régional » pour les distinguer : la '
    + 'colonne Portée le fait.',
  'help.board-positions.adding.b4':
    'Ce qui ne peut être répété, c’est un titre à la MÊME portée. Ajoutez un second '
    + 'président national et l’écran le dit, plutôt que de créer discrètement un doublon que '
    + 'personne ne pourrait distinguer du premier.',
  'help.board-positions.renaming.heading': 'Corriger un nom',
  'help.board-positions.renaming.b0':
    'Le crayon sur la ligne d’une fonction transforme son nom en champ de saisie. '
    + '**Entrée** enregistre, **Échap** annule, et le nom change partout où il est imprimé — '
    + 'sous le nom des personnes dans le [Répertoire](/community/directory), sur leur '
    + '[Tableau de bord](/dashboard) et sur leur [Mon profil](/personal-info).',
  'help.board-positions.renaming.b1':
    'Seul le nom peut être changé. **Catégorie** et **Portée** ne peuvent pas l’être, car '
    + 'la portée d’une fonction est recopiée sur la fiche de chaque titulaire au moment de '
    + 'l’attribution, avec la région ou la section visée — changer la portée ensuite '
    + 'laisserait donc ces fiches décrire quelque chose que la fonction n’est plus. Une '
    + 'famille dont la portée est fausse retire la fonction et la rajoute, ce qui refait '
    + 'aussi les attributions qui étaient fausses.',
  'help.board-positions.renaming.b2':
    'Deux fonctions à la MÊME portée ne peuvent pas partager un nom. Renommer une fonction '
    + 'régionale avec un nom que votre liste nationale utilise déjà est permis ; la renommer '
    + 'avec le nom d’une autre fonction régionale est refusé, et rien n’est enregistré.',
  'help.board-positions.assigning.heading': 'Attribuer une fonction à quelqu’un',
  'help.board-positions.assigning.b0':
    '**Pas depuis ce panneau.** Mettre en place les fonctions que votre famille entretient '
    + 'se fait ici ; décider qui en occupe une se fait sur l’onglet **Membres**, depuis la '
    + 'ligne de cette personne.',
  'help.board-positions.assigning.b1.i0': 'Ouvrez l’onglet **Membres** et trouvez la personne.',
  'help.board-positions.assigning.b1.i1':
    'Ouvrez le menu au bout de sa ligne et choisissez **Attribuer un poste au conseil** '
    + 'sous **Profil**.',
  'help.board-positions.assigning.b1.i2':
    'Choisissez la fonction. Pour une fonction régionale ou de section, choisissez quelle '
    + 'région ou section elle vise.',
  'help.board-positions.assigning.b1.i3': 'Appuyez sur **Attribuer**.',
  'help.board-positions.assigning.b2':
    'Cela a été déplacé là le 20-08-2026, et la raison est ce que l’on a en tête en le '
    + 'faisant. Quelles fonctions existent est une décision sur la FAMILLE, prise une fois et '
    + 'revue chaque année, et elle appartient à côté des régions et des sections. Faire d’Ada '
    + 'la trésorière est une décision sur ADA — et tout ce que l’on décide d’autre au sujet '
    + 'd’Ada est déjà sur sa ligne : son modèle d’autorisations, si son accès est activé, son '
    + 'profil. Attribuer depuis la ligne de la fonction obligeait à trouver la fonction pour '
    + 'trouver la personne.',
  'help.board-positions.assigning.b3':
    'Plus d’une personne peut occuper la même fonction, ce dont une fonction régionale ou '
    + 'de section a besoin, et une personne peut en occuper plus d’une. Sa colonne '
    + '**Fonction** énumère ce qu’elle occupe, et la boîte qui s’ouvre depuis sa ligne aussi.',
  'help.board-positions.assigning.b4':
    'Seuls les proches ayant terminé leur inscription peuvent occuper une fonction. '
    + 'Quelqu’un inscrit sur l’arbre généalogique sans compte ne peut pas, car le relevé de '
    + 'qui occupe une fonction est rattaché à son compte — invitez-le d’abord, depuis '
    + 'l’[Arbre généalogique](/community/family-tree).',
  'help.board-positions.removing.heading': 'En retirer une, et supprimer une fonction',
  'help.board-positions.removing.b0':
    'La corbeille à côté d’un titre, dans la boîte qui s’ouvre depuis la ligne d’un membre '
    + 'sur l’onglet **Membres**, retire cette fonction à cette personne. Elle reste membre de '
    + 'la famille et rien d’autre ne change pour elle.',
  'help.board-positions.removing.b1':
    '**Une fonction que quelqu’un occupe ne peut pas être supprimée.** Son bouton de '
    + 'suppression est indisponible et dit combien de personnes l’occupent ; retirez-la à '
    + 'chacune et il devient disponible.',
  'help.board-positions.removing.b2':
    'Il s’agit d’un refus plutôt que d’un rangement fait à votre place, et pour la même '
    + 'raison que la suppression d’une section : la fonction de quelqu’un est sur son profil '
    + 'et dans le Répertoire, et retirer quatre titulaires comme effet secondaire de la '
    + 'suppression d’une ligne n’est pas une décision à prendre par accident.',
  'help.board-positions.where-it-shows.heading': 'Où une fonction apparaît',
  'help.board-positions.where-it-shows.b0':
    'Une fonction est publique au sein de la famille. Dès que quelqu’un en occupe une, elle '
    + 'apparaît :',
  'help.board-positions.where-it-shows.b1.i0':
    'sous son nom dans le [Répertoire](/community/directory),',
  'help.board-positions.where-it-shows.b1.i1': 'sur son propre [Mon profil](/personal-info),',
  'help.board-positions.where-it-shows.b1.i2':
    'et sur son [Tableau de bord](/dashboard) lorsqu’elle se connecte.',
  'help.board-positions.where-it-shows.b2':
    'Une fonction régionale ou de section est écrite en entier — « président de la section '
    + 'de Houston », « secrétaire régional du Texas » — de sorte que deux personnes occupant '
    + 'la même fonction à des endroits différents se lisent comme deux titres différents.',
  'help.board-positions.where-it-shows.b3':
    'Ces fonctions sont ce pour quoi une élection est tenue. Une élection à un niveau ne '
    + 'peut pourvoir que des fonctions enregistrées à ce niveau : une élection de section '
    + 'propose donc les fonctions de la section et rien d’autre — voyez [Tenir une '
    + 'élection](/help/running-an-election).',
  'help.running-an-election.title': 'Tenir une élection',
  'help.running-an-election.summary':
    'Fixer les deux fenêtres de dates, choisir quelle partie de la famille vote, mettre des '
    + 'fonctions sur le bulletin, et le publier.',
  'help.running-an-election.what-it-is.heading': 'Ce qu’est cet écran',
  'help.running-an-election.what-it-is.b0':
    'Chaque élection que la famille a, à tous les niveaux, brouillons compris. Chaque ligne '
    + 'montre où l’élection en est aujourd’hui, pour quelle partie de la famille elle est, '
    + 'ses deux fenêtres de dates, et combien de fonctions, de nominations et de votes elle '
    + 'compte.',
  'help.running-an-election.what-it-is.b1':
    '**Nouvelle élection** ouvre le formulaire dans un panneau au-dessus de la liste, et le '
    + 'contrôle de modification sur un brouillon fait de même. La liste reste derrière, et '
    + 'c’est le but — vous voyez ce que la famille tient déjà pendant que vous écrivez la '
    + 'suivante.',
  'help.running-an-election.what-it-is.b2':
    'Une élection est soit un **brouillon** — le vôtre, invisible pour la famille — soit '
    + '**publiée**, ce qui la place sur le calendrier de la famille. Il n’y a rien d’autre à '
    + 'régler : une fois publiée, les dates la conduisent.',
  'help.running-an-election.the-windows.heading': 'Les deux fenêtres de dates',
  'help.running-an-election.the-windows.b0':
    '**Nominations** et **Vote**, chacune avec une date d’ouverture et une date de '
    + 'fermeture. Ce sont elles qui font que l’élection a lieu ; personne n’a à revenir '
    + 'appuyer sur quoi que ce soit.',
  'help.running-an-election.the-windows.b1.i0':
    'Les nominations courent du jour de leur ouverture à la fin du jour de leur fermeture. '
    + 'Les deux jours comptent.',
  'help.running-an-election.the-windows.b1.i1':
    'Le vote court de la même façon, et ne peut pas ouvrir AVANT la fermeture des '
    + 'nominations — un bulletin n’est jamais voté tant que la liste des candidats peut '
    + 'encore changer.',
  'help.running-an-election.the-windows.b1.i2':
    'Il peut ouvrir le jour même de leur fermeture, et alors ce jour appartient au vote : '
    + 'les nominations se ferment à l’ouverture du bulletin. C’est l’élection la plus courte '
    + 'que le produit puisse décrire — un jour de nominations, un jour de vote. Donnez aux '
    + 'nominations la totalité de leur jour de fermeture en la fixant un jour plus tôt.',
  'help.running-an-election.the-windows.b1.i3':
    'Chaque fenêtre doit durer au moins un jour. Une date de fermeture au jour de '
    + 'l’ouverture ou avant est refusée au moment où vous la saisissez.',
  'help.running-an-election.the-windows.b1.i4':
    'Les sélecteurs de date grisent les jours qui briseraient l’enchaînement — dès que les '
    + 'nominations ouvrent le 1er, le sélecteur de fermeture n’offrira ni le 1er ni rien '
    + 'd’antérieur, et les sélecteurs de vote suivent. Le sélecteur d’ouverture du vote '
    + 'propose BIEN le jour de fermeture des nominations, car celui-là est permis.',
  'help.running-an-election.the-windows.b2':
    'Le lendemain de la fermeture du vote, l’élection est terminée et ses résultats '
    + 'apparaissent pour tous ceux qui pouvaient y voter. Rien ne les publie et rien ne ferme '
    + 'le scrutin.',
  'help.running-an-election.the-windows.b3':
    'Les quatre dates sont nécessaires pour publier. Un brouillon peut n’en avoir aucune, '
    + 'ou en avoir quelques-unes — c’est à cela qu’un brouillon sert.',
  'help.running-an-election.the-level.heading': 'Choisir qui vote',
  'help.running-an-election.the-level.b0':
    '**Qui vote** choisit le niveau : toute la famille, une région, ou une section. Cela '
    + 'décide de trois choses d’un coup, et elles ne sont pas séparables.',
  'help.running-an-election.the-level.b1.i0':
    'Qui peut VOIR l’élection. Une élection de section n’est pas listée pour le reste de la '
    + 'famille et son lien ne s’ouvre pas pour eux.',
  'help.running-an-election.the-level.b1.i1':
    'Qui peut être NOMMÉ. La liste des personnes éligibles sur le bulletin ne contient que '
    + 'celles à qui l’élection est destinée.',
  'help.running-an-election.the-level.b1.i2':
    'Quelles FONCTIONS elle peut pourvoir — seulement celles enregistrées au même niveau '
    + 'sous [Postes au conseil](/help/board-positions).',
  'help.running-an-election.the-level.b2':
    'Changer le niveau après avoir choisi des fonctions efface celles qui ne lui '
    + 'appartiennent plus, et dit lesquelles. Ce n’est pas le formulaire qui perd votre '
    + 'travail — c’est la règle selon laquelle une élection ne peut pas pourvoir une fonction '
    + 'd’un autre niveau.',
  'help.running-an-election.the-level.b3':
    'Une famille sans régions ni sections obtient National et rien d’autre, car il n’y a '
    + 'rien à viser. Les régions et les sections se mettent en place sous [Régions et '
    + 'sections](/help/regions-and-chapters).',
  'help.running-an-election.the-level.b4':
    'Les membres qui ne sont dans aucune section sont sous National. Ils prennent part aux '
    + 'élections nationales et à aucune élection restreinte : une élection réduite à une '
    + 'section est donc plus étroite qu’elle n’en a l’air — vérifiez qui y est réellement '
    + 'classé avant d’en publier une.',
  'help.running-an-election.positions.heading': 'Ce qui figure sur le bulletin',
  'help.running-an-election.positions.b0':
    '**Fonctions** est la liste des fonctions que cette élection pourvoit. Chacune est '
    + 'choisie dans la liste du conseil de la famille au niveau correspondant, et **Élus** '
    + 'est le nombre de personnes que la fonction accueille — d’ordinaire une.',
  'help.running-an-election.positions.b1':
    'Une fonction que vous attendiez et ne trouvez pas est soit enregistrée à un autre '
    + 'niveau, soit pas enregistrée du tout. Ajoutez-la ou redéfinissez sa portée sous '
    + '[Postes au conseil](/help/board-positions) d’abord.',
  'help.running-an-election.positions.b2':
    'Une élection a besoin d’au moins une fonction avant de pouvoir être publiée.',
  'help.running-an-election.publishing.heading': 'La publier',
  'help.running-an-election.publishing.b0.i0':
    'Remplissez le formulaire et appuyez sur **Créer un brouillon**. Rien n’est encore '
    + 'visible pour la famille.',
  'help.running-an-election.publishing.b0.i1':
    'Relisez la ligne — le niveau, les deux fenêtres, et le nombre de fonctions.',
  'help.running-an-election.publishing.b0.i2':
    'Laissez **Annoncer** coché si vous voulez que la famille soit prévenue, puis appuyez '
    + 'sur **Publier** et confirmez.',
  'help.running-an-election.publishing.b1':
    'L’annonce est adressée comme l’élection l’est : une élection de section est annoncée à '
    + 'cette section. Une élection régionale va à toute la famille et nomme la région, car '
    + 'une annonce peut être adressée à une section et non à une région.',
  'help.running-an-election.publishing.b2':
    '**L’avis est une porte d’entrée.** Son titre est un lien direct vers l’élection, sur '
    + 'le tableau comme dans la carte **Actualités récentes** du [Tableau de '
    + 'bord](/dashboard), de sorte que personne n’a à aller chercher le bulletin dont on '
    + 'vient de lui parler. Un membre dont la famille a désactivé les Élections, ou qui n’est '
    + 'pas sur un forfait qui les inclut, voit l’avis sans le lien plutôt qu’un lien qui le '
    + 'refuse.',
  'help.running-an-election.publishing.b3':
    'Après cela il n’y a rien à faire. Les nominations ouvrent à leur date, ferment à la '
    + 'leur, le vote ouvre et ferme de lui-même, et les résultats apparaissent.',
  'help.running-an-election.watching-it.heading': 'Suivre une élection en cours',
  'help.running-an-election.watching-it.b0':
    'La flèche au bout de n’importe quelle ligne ouvre l’écran propre à cette élection — la '
    + 'vue de l’organisateur, non le bulletin. Quatre chiffres en haut :',
  'help.running-an-election.watching-it.b1.i0.term': 'Peuvent voter',
  'help.running-an-election.watching-it.b1.i0.text':
    'Les membres approuvés de la partie de la famille visée par cette élection qui ont un '
    + 'compte. Quelqu’un inscrit sur l’arbre généalogique sans compte propre peut être nommé '
    + 'et ne peut pas voter : il n’est donc pas compté ici.',
  'help.running-an-election.watching-it.b1.i1.term': 'Ont voté',
  'help.running-an-election.watching-it.b1.i1.text':
    'Combien d’entre eux l’ont fait, et la participation qui en résulte.',
  'help.running-an-election.watching-it.b1.i2.term': 'N’ont pas voté',
  'help.running-an-election.watching-it.b1.i2.text':
    'La différence. C’est un nombre et jamais une liste — personne n’est nommé, ici ni '
    + 'ailleurs.',
  'help.running-an-election.watching-it.b1.i3.term': 'Sur le bulletin',
  'help.running-an-election.watching-it.b1.i3.text':
    'Les nominations acceptées face au total des nominations. Une nomination à laquelle '
    + 'personne n’a répondu n’est pas sur le bulletin, et seuls les candidats ayant accepté '
    + 'peuvent recevoir des voix.',
  'help.running-an-election.watching-it.b2':
    'En dessous, chaque fonction avec les personnes qui s’y présentent, leur nombre de voix '
    + 'et leur part. Ceux qui mènent portent un trophée, autant que la fonction accueille.',
  'help.running-an-election.watching-it.b3':
    '**Tant que le vote est ouvert ces chiffres sont un instantané, et l’écran le dit.** '
    + 'Rien ici ne déclare un vainqueur avant la fermeture de la fenêtre ; c’est là pour que '
    + 'vous voyiez si une élection va marcher — si quelqu’un a accepté, si quelqu’un vote — '
    + 'pendant qu’il est encore temps d’y faire quelque chose.',
  'help.running-an-election.watching-it.b4':
    'Cet écran ne montre jamais dans quel sens une personne nommée a voté, et rien nulle '
    + 'part ne le fait. Voyez [Élections](/help/elections#voting) pour le côté du membre.',
  'help.running-an-election.changing-it.heading': 'Modifier ou retirer une élection',
  'help.running-an-election.changing-it.b0':
    '**Un brouillon peut être modifié librement** — son titre, ses dates, son niveau, ses '
    + 'fonctions.',
  'help.running-an-election.changing-it.b1':
    '**Une élection publiée ne peut pas être modifiée.** Ses dates sont ce qui a été dit à '
    + 'la famille, et les déplacer changerait ce qu’un bulletin était plutôt que de corriger '
    + 'une coquille.',
  'help.running-an-election.changing-it.b2':
    '**Repasser en brouillon** ramène une élection publiée, et n’est proposé que tant que '
    + 'personne n’a été nommé et que rien n’a été voté. Dès que quelqu’un a agi, l’élection '
    + 'est le relevé de quelque chose que la famille a fait : laissez-la courir, ou '
    + 'supprimez-la.',
  'help.running-an-election.changing-it.b3':
    '**Supprimer** retire l’élection avec toutes les nominations et tous les votes qu’elle '
    + 'porte, et cela ne peut être annulé. La confirmation dit combien il y en a de chaque.',
  'help.running-an-election.changing-it.b4':
    'Supprimer une région ou une section à laquelle une élection est restreinte est refusé '
    + 'tant que l’élection existe — redéfinissez d’abord la portée de l’élection à toute la '
    + 'famille, ou supprimez-la. Rien sur la forme de la famille ne peut changer en silence '
    + 'qui avait le droit de voter.',
  // ──── PART 6 — Administration (Settings) ──────────────────────────────────────
  'help.family-settings.title': 'Paramètres',
  'help.family-settings.summary':
    'Le nom de la famille, le code avec lequel les proches se joignent, le forfait qu’elle '
    + 'a, et comment la désactiver.',
  'help.family-settings.bands.heading': 'Trois sections',
  'help.family-settings.bands.b0':
    'La page comporte trois sections, choisies dans le menu du haut. **Facturation** est ce '
    + 'que votre famille a payé à GENORRA, jusqu’à quand, et chaque reçu. **Forfait** est '
    + 'l’abonnement sur lequel cette famille se trouve, ce que chacun comprend, et où l’on '
    + 'passe de l’un à l’autre. **Famille** est la famille elle-même : son nom, le code avec '
    + 'lequel les proches se joignent, et sa désactivation.',
  'help.family-settings.bands.b1':
    'Paramètres s’ouvre sur **Forfait**, car c’est la section que la plupart des gens '
    + 'viennent consulter ou modifier.',
  'help.family-settings.bands.b2':
    'Payer un forfait est traité dans [Payer un forfait](/help/plans#paying) ; cette page '
    + 'est là où se trouvent les commandes.',
  'help.family-settings.name.heading': 'Le nom de la famille',
  'help.family-settings.name.b0':
    'Comment la famille s’appelle partout dans le produit. La renommer ne change rien '
    + 'd’autre — le code, les membres et chaque enregistrement restent exactement comme ils '
    + 'étaient.',
  'help.family-settings.code.heading': 'Le code familial',
  'help.family-settings.code.b0':
    'Six caractères, générés à la création de la famille, et permanents. Il ne peut être ni '
    + 'changé ni régénéré.',
  'help.family-settings.code.b1':
    'Quiconque détient le code peut demander à se joindre : traitez-le donc comme une '
    + 'invitation plutôt que comme un mot de passe — et rappelez-vous que demander n’est pas '
    + 'rejoindre. Chaque demande arrive dans la file d’approbation pour que quelqu’un décide.',
  'help.family-settings.plan.heading': 'Le forfait',
  'help.family-settings.plan.b0':
    'La section **Forfait**, sur laquelle Paramètres s’ouvre, montre sur quel forfait la '
    + 'famille se trouve, ce que chacun coûte par mois, et ce qu’il comprend. '
    + '**Fonctionnalités** sur n’importe quelle ligne ouvre la liste complète de ce forfait. '
    + 'Voyez [Forfaits](/help/plans).',
  'help.family-settings.plan.b1':
    '**Chaque ligne de forfait porte son propre bouton.** Une ligne au-dessus de celle où '
    + 'vous êtes indique **Passer à …** et démarre le paiement ; une ligne en dessous indique '
    + '**Descendre à …**. La ligne où vous êtes déjà indique **Forfait actuel** et ne fait '
    + 'rien. Un forfait qui a un prix mais n’est pas encore en vente affiche **Bientôt '
    + 'disponible** au lieu d’un bouton.',
  'help.family-settings.plan.b2':
    'Descendre demande votre mot de passe en plus d’une confirmation, car cela ferme des '
    + 'pages pour tous les membres de la famille d’un coup. Rien n’est supprimé dans un cas '
    + 'comme dans l’autre.',
  'help.family-settings.plan.b3':
    '**Descendre est aussi la façon d’arrêter de payer.** Descendre à Gratuit met fin à un '
    + 'forfait mensuel à la fin de la période déjà payée — il n’y a pas de commande « arrêter '
    + 'le renouvellement » à part, car arrêter le paiement et choisir où l’on s’arrête sont '
    + 'une seule décision. La confirmation nomme la date de prise d’effet.',
  'help.family-settings.billing.heading': 'Payer le forfait',
  'help.family-settings.billing.b0':
    '**Facturation** est ce que votre famille a réellement payé : quel forfait, le jour '
    + 'jusqu’auquel c’est payé, le jour où le prochain paiement est dû, et si quelque chose '
    + 'le renouvelle. Rien là-dessus ne démarre un paiement — les boutons qui le font sont '
    + 'sur les lignes de forfait dans **Forfait**, et ils ouvrent la page de Stripe '
    + 'elle-même. Rien sur cet écran ne reçoit de numéro de carte.',
  'help.family-settings.billing.b1':
    '**« Prochain paiement » veut dire deux choses différentes et la ligne à côté dit '
    + 'laquelle.** Sur un forfait mensuel c’est le jour où la carte est débitée '
    + 'automatiquement. Sur un forfait payé à l’avance rien ne le renouvelle : c’est donc le '
    + 'jour où les pages se ferment à moins que quelqu’un rachète.',
  'help.family-settings.billing.b2':
    '**Chaque famille est facturée le 1er.** Le premier paiement ne couvre que le reste du '
    + 'mois en cours, calculé au jour et arrondi vers le haut — arriver le 20 coûte donc '
    + 'quelques jours et non un mois, et chaque paiement suivant tombe le 1er.',
  'help.family-settings.billing.b3':
    '**Si le reste du mois représente moins de 5 $, le premier paiement couvre ce mois-ci '
    + 'et le suivant.** Un débit d’un ou deux dollars ne mérite pas de figurer sur un relevé '
    + 'de carte, et en dessous d’environ 50 cents un réseau de cartes ne l’accepte pas du '
    + 'tout. L’écran dit quelle option vous est proposée et pourquoi.',
  'help.family-settings.billing.b4':
    'Il y a deux façons de payer et un seul tarif. **Au mois** se renouvelle jusqu’à ce que '
    + 'vous l’arrêtiez. **À l’avance** est un paiement unique couvrant le reste de ce mois '
    + 'plus autant de mois entiers que vous voulez, jusqu’à 60 — que vous pouvez aussi '
    + 'modifier sur la page de Stripe. Il n’y a pas de remise pour payer d’avance et pas de '
    + 'prix annuel : un an à l’avance représente douze mois au tarif mensuel.',
  'help.family-settings.billing.b5.i0.term': 'Monter',
  'help.family-settings.billing.b5.i0.text':
    'Prend effet aussitôt. Si vous aviez payé d’avance sur un forfait moins cher, ce qu’il '
    + 'en restait est valorisé au tarif que vous avez payé et dépensé d’abord sur le nouveau '
    + 'forfait — il n’y a donc souvent rien à payer, et ce qui reste est conservé en crédit '
    + 'sur votre prochaine facture. La différence sur toute la période prépayée ne vous est '
    + 'jamais facturée.',
  'help.family-settings.billing.b5.i1.term': 'Descendre',
  'help.family-settings.billing.b5.i1.text':
    'Ne coûte rien et ne change rien aujourd’hui. Prend effet le 1er — le prochain si vous '
    + 'payez au mois, ou le 1er suivant l’épuisement de votre période prépayée. Six mois de '
    + 'Plus, descendus au deuxième mois, donnent Plus des mois deux à six et le forfait moins '
    + 'cher à partir du mois sept. Il n’y a pas de remboursement, et c’est exactement ce qui '
    + 'garde ces pages ouvertes jusqu’à la fin.',
  'help.family-settings.billing.b6':
    '**Rien n’est accordé en appuyant sur un bouton ici.** Le forfait change lorsque le '
    + 'paiement est réglé, ce qui peut être un instant plus tard — donc si le bandeau montre '
    + 'encore l’ancien forfait juste après le paiement, accordez-lui une minute et rechargez. '
    + 'Si un paiement échoue, cette section le dit et rien de ce que votre famille peut '
    + 'atteindre ne change pendant que Stripe continue d’essayer la carte.',
  'help.family-settings.billing.b7':
    '**Cartes et reçus** ouvre le portail de facturation de Stripe lui-même, où la carte '
    + 'enregistrée se change et chaque facture peut être téléchargée. **Ce que GENORRA a '
    + 'facturé** énumère les mêmes paiements ici — ce qui a été acheté, quand cela a été '
    + 'payé, ce que cela couvre et pour combien.',
  'help.family-settings.billing.b8':
    'Ce sont les frais de GENORRA à votre famille et ils sont délibérément très loin de '
    + 'l’argent de votre propre famille. Rien de cette section n’apparaît dans vos fonds, '
    + 'dans votre [Compte de résultat](/reporting/pl-summary), dans votre projection de '
    + 'cotisations ni dans l’historique de paiement d’aucun membre — ce que votre famille '
    + 'nous paie et ce que vos proches paient à votre famille sont deux registres séparés.',
  'help.family-settings.billing.b9':
    '**Pour cesser de payer, redescendez à Gratuit dans la section [Offre](/admin/settings).** '
    + 'Cela met fin à un forfait mensuel à la fin de la période déjà payée, jamais '
    + 'immédiatement. Toutes les pages restent ouvertes jusque-là.',
  'help.family-settings.billing.b10':
    '**Ce que l’offre moins chère n’inclut pas est ensuite conservé soixante jours, puis '
    + 'supprimé.** Rien ne disparaît le jour où vous redescendez. Vous êtes prévenu trente, '
    + 'quinze, cinq et un jour avant, et remonter dans ces soixante jours retrouve tout '
    + 'exactement où c’était — voir [ce qu’il advient de vos '
    + 'données](/help/family-settings#retention).',
  'help.family-settings.removal.heading': 'Retirer la famille',
  'help.family-settings.removal.b0':
    '**Retirer cette famille**, en bas de la section **Famille**, désactive la famille '
    + 'entière. Personne ne peut l’ouvrir, le code familial cesse de fonctionner, et toute '
    + 'invitation encore en cours cesse d’être acceptée. Ce n’est proposé qu’à quelqu’un dont '
    + 'le modèle d’autorisations accorde **Retirer la famille**, ce qui est distinct de celle '
    + 'qui vous laisse renommer la famille.',
  'help.family-settings.removal.b1':
    'Rien n’est supprimé. Chaque paiement, fonds, photographie, événement, message, '
    + 'document et personne reste exactement là où il est. Le retrait ferme les portes de la '
    + 'famille ; il ne détruit aucun enregistrement.',
  'help.family-settings.removal.b2':
    '**La facturation s’arrête, et cette partie est irréversible.** Votre forfait GENORRA ne sera pas renouvelé : il court jusqu’à la fin de la période déjà payée, et rien n’est remboursé. Chaque membre qui paie ses cotisations automatiquement voit ce paiement résilié sur Stripe immédiatement, et ces paiements ne peuvent pas être rétablis : rétablir la famille restaure tous les enregistrements, mais chaque proche qui payait automatiquement devra le reconfigurer. C’est le même compromis que [déconnecter Stripe](/help/accounting#processing), et pour la même raison : ce que vous pouvez annuler cache une chose que vous ne pouvez pas.',
  'help.family-settings.removal.b3':
    'Cela se fait en deux étapes. **M’envoyer un code de retrait** envoie six chiffres à '
    + 'l’adresse avec laquelle vous vous connectez — pas à une adresse que vous saisissez, et '
    + 'pas à quelqu’un d’autre. **Saisir le code et retirer** demande ensuite ces chiffres et '
    + 'une confirmation. Le code dure quinze minutes, fonctionne une fois, et s’annule de '
    + 'lui-même après cinq tentatives erronées ; demandez-en un autre avec **Envoyer un autre '
    + 'code**.',
  'help.family-settings.removal.b4':
    'Les membres d’une famille retirée ne sont pas laissés dans le doute. Se connecter '
    + 'affiche un écran disant que la famille a été retirée et que rien n’a été supprimé, '
    + '[Mes familles](/my-families) la liste avec une mention **Retirée**, et le menu de '
    + 'famille en haut de la page la marque aussi — de sorte qu’un compte appartenant à plus '
    + 'd’une famille continue dans les autres exactement comme avant.',
  'help.family-settings.removal.b5':
    '**Seul le soutien technique de GENORRA peut ramener une famille.** Il n’y a aucun '
    + 'bouton pour cela nulle part dans le produit, et c’est délibéré : une famille qui '
    + 'pourrait annuler son propre retrait n’aurait pas été retirée. S’il s’agissait d’une '
    + 'erreur, écrivez au soutien technique pour le demander.',
  // ──── PART 7 — Money (Summary, Payment history, Transactions, P&L Summary) ────
  'help.part.money.title': 'Argent',
  'help.part.money.blurb':
    'Ce que vous devez, ce que la famille a encaissé, et comment tout cela est configuré.',
  'help.summary.title': 'Résumé',
  'help.summary.summary':
    'Votre situation en un coup d’œil — ce que vous devez, ce que vous avez payé, quelles '
    + 'campagnes sont ouvertes, et ce que la famille détient.',
  'help.summary.what-it-is.heading': 'Un condensé, non un écran à part entière',
  'help.summary.what-it-is.b0':
    '[Résumé](/accounting/summary) affiche l’essentiel de chacune des quatre choses qui le '
    + 'suivent et nomme où trouver le reste. Rien ne vit ici seulement — chaque chiffre a un '
    + 'écran derrière lui, atteint depuis le lien à côté de son titre ou depuis la section '
    + '**Comptabilité** du menu latéral.',
  'help.summary.what-it-is.b1.i0.term': 'Situation du compte / Prochaines échéances',
  'help.summary.what-it-is.b1.i0.text':
    'Ce que vous devez et à combien se monte le prochain paiement. En entier sur '
    + '[Cotisations](/accounting/dues-and-donations).',
  'help.summary.what-it-is.b1.i1.term': 'Payé cette année',
  'help.summary.what-it-is.b1.i1.text':
    'Votre total pour l’année, ventilé par barème. En entier sur [Historique de '
    + 'paiement](/reporting/payment-history).',
  'help.summary.what-it-is.b1.i2.term': 'Campagnes de dons ouvertes',
  'help.summary.what-it-is.b1.i2.text':
    'Les campagnes encore en cours. Les campagnes closes sont comptées ici et listées sur '
    + '[Dons](/accounting/dues-and-donations?pane=donations).',
  'help.summary.what-it-is.b1.i3.term': 'Fonds de la famille',
  'help.summary.what-it-is.b1.i3.text':
    'Chaque fonds que la famille entretient et ce que chacun détient. Celui-ci n’a pas '
    + 'd’écran à part.',
  'help.summary.what-you-see.heading': 'Pourquoi une section peut manquer',
  'help.summary.what-you-see.b0':
    'Chacune des quatre s’accorde séparément, et Résumé n’affiche que celles que vous '
    + 'détenez. Une section que vous ne pouvez pas voir est une section que votre famille ne '
    + 'vous a pas donnée — voyez [Qui peut faire quoi](/help/who-can-do-what). Si vous n’en '
    + 'détenez aucune, la page le dit plutôt que de vous montrer des titres vides.',
  'help.summary.what-you-see.b1':
    'Quoi qu’il vous ait été accordé, les chiffres d’argent présentés ici sont les vôtres. '
    + 'Rien sur cette page ne montre les cotisations, les paiements ou les dons d’un autre '
    + 'membre. Fonds de la famille est l’exception par nature plutôt que par confidentialité '
    + ': le solde d’un fonds appartient à toute la famille, et il ne nomme personne.',
  'help.payment-history.title': 'Historique de paiement',
  'help.payment-history.summary':
    'Tout ce qui est enregistré à votre nom, avec sa date, son montant, son mode et son '
    + 'état.',
  'help.payment-history.the-list.heading': 'La liste',
  'help.payment-history.the-list.b0':
    '[Historique de paiement](/reporting/payment-history) est chaque paiement que la '
    + 'famille a enregistré à votre nom — cotisations et dons dans une seule liste, chaque '
    + 'ligne étiquetée selon ce qu’elle était. N’importe quel titre de colonne trie, et le '
    + 'champ **Filtrer** restreint par barème, mode ou état.',
  'help.payment-history.the-list.b1':
    'Il se trouve sous **Rapports** dans le menu latéral. '
    + '[Transactions](/accounting/transactions) est son équivalent pour toute la famille et a '
    + 'été déplacé sous **Comptabilité** en août 2026, à côté des écrans dont il porte les '
    + 'lignes. Les deux sont l’argent relu — celui-ci est le vôtre, celui-là est celui de la '
    + 'famille — tandis que [Comptabilité](/admin/accounting) est là où tout se configure au '
    + 'départ.',
  'help.payment-history.the-list.b2':
    'Cliquer sur une ligne ouvre l’écriture complète : le numéro de chèque ou la référence, '
    + 'les notes éventuelles, et la date de saisie — qui n’est pas la date du paiement, et '
    + 'qui explique généralement pourquoi quelque chose vient tout juste d’apparaître.',
  'help.payment-history.reversals.heading': 'Corrections',
  'help.payment-history.reversals.b0':
    'Un paiement saisi de travers n’est ni modifié ni supprimé. Une écriture correctrice '
    + 'est passée contre lui avec un montant négatif, et les deux restent dans la liste : le '
    + 'relevé s’explique ainsi de lui-même plutôt que de changer en silence.',
  'help.payment-history.reversals.b1':
    '**Exonéré** signifie que la famille a annulé ce qui était dû et non que de l’argent a '
    + 'bougé. Le montant s’affiche tout de même, car il vient en déduction de votre solde, et '
    + 'un solde qui baisse sans aucun chiffre nulle part pour y répondre est un solde que '
    + 'vous ne pouvez pas vérifier.',
  'help.transactions.title': 'Transactions',
  'help.transactions.summary':
    'Les cinq registres de la famille — l’argent qui entre, l’argent qui sort, et l’argent '
    + 'qui circule entre les fonds.',
  'help.transactions.ledgers.heading': 'Les cinq registres',
  'help.transactions.ledgers.b0':
    '[Transactions](/accounting/transactions) se trouve sous **Comptabilité** dans le menu '
    + 'latéral, sous **Cotisations et dons**. [Historique de '
    + 'paiement](/reporting/payment-history) est celui sous **Rapports** — le relevé complet '
    + 'de la famille plutôt que le vôtre. C’est un menu de cinq onglets, un par type '
    + 'd’écriture.',
  'help.transactions.ledgers.b1.i0.term': 'Cotisations',
  'help.transactions.ledgers.b1.i0.text': 'Cotisations payées par les membres.',
  'help.transactions.ledgers.b1.i1.term': 'Dons',
  'help.transactions.ledgers.b1.i1.text': 'Dons versés à une campagne.',
  'help.transactions.ledgers.b1.i2.term': 'Apports',
  'help.transactions.ledgers.b1.i2.text':
    'Argent arrivant dans un fonds — affecté là automatiquement, ou enregistré à la main.',
  'help.transactions.ledgers.b1.i3.term': 'Décaissements',
  'help.transactions.ledgers.b1.i3.text': 'Argent versé depuis un fonds.',
  'help.transactions.ledgers.b1.i4.term': 'Virements',
  'help.transactions.ledgers.b1.i4.text':
    'Argent déplacé d’un fonds à un autre. Le total est nul à l’échelle de la famille ; ce '
    + 'qui change est quelle poche le détient.',
  'help.transactions.ledgers.b2':
    'Chaque onglet s’accorde séparément : une famille peut donc laisser quelqu’un '
    + 'enregistrer des cotisations sans le laisser verser d’argent. Un onglet que vous ne '
    + 'pouvez pas voir est un onglet qu’on ne vous a pas donné.',
  'help.transactions.recording.heading': 'Enregistrer quelque chose',
  'help.transactions.recording.b0':
    'Chaque registre a son propre bouton en haut à droite — **Nouveau paiement de '
    + 'cotisation**, **Nouveau paiement de don**, **Nouvel apport**, **Nouveau '
    + 'décaissement**, **Nouveau virement** — qui ouvre un formulaire pour ce type d’écriture '
    + ': qui, combien, pour quoi, et comment cela a été payé. La personne et le fonds '
    + 'viennent de sélecteurs plutôt que de texte libre : rien n’atterrit donc au nom de '
    + 'quelqu’un qui n’existe pas.',
  'help.transactions.recording.b1':
    'Enregistrer est une autorisation à part sur chaque registre — pouvoir voir un registre '
    + 'ne vous permet pas d’y ajouter.',
  'help.transactions.reversals.heading': 'Corriger un paiement',
  'help.transactions.reversals.b0':
    'Un paiement enregistré n’est ni modifié ni supprimé — **Contrepasser** sur sa ligne '
    + 'passe une écriture correctrice contre lui, et l’original est marqué comme contrepassé. '
    + 'Les deux écritures restent, de sorte que l’historique s’explique de lui-même.',
  'help.transactions.reversals.b1':
    'Contrepasser est une autorisation à part, délibérément distincte de l’enregistrement.',
  'help.p-and-l-summary.title': 'Compte de résultat',
  'help.p-and-l-summary.summary':
    'Ce que la famille a encaissé, ce qu’elle a versé, et ce que chaque fonds détient.',
  'help.p-and-l-summary.what-it-is.heading': 'À quoi il répond',
  'help.p-and-l-summary.what-it-is.b0':
    'L’état de la famille, sur une page : tout ce qui est entré, tout ce qui est sorti, et '
    + 'l’écart entre les deux. [Transactions](/accounting/transactions) est le registre '
    + 'écriture par écriture dont ceci est un résumé, et [Projection des '
    + 'cotisations](/reporting/dues-projections) est ce qui reste dû — cet écran ne porte que '
    + 'sur l’argent qui a réellement bougé.',
  'help.p-and-l-summary.what-it-is.b1':
    '**Chaque chiffre couvre toute l’existence de la famille.** Il n’y a aucune plage de '
    + 'dates à fixer : la page compte chaque écriture que la famille a jamais enregistrée, '
    + 'depuis la première. La ligne en haut de la page le dit, et cela vaut la peine d’être '
    + 'lu avant qu’un chiffre n’entre dans un rapport.',
  'help.p-and-l-summary.what-it-is.b2':
    'Cet écran s’appelait **Finances familiales** jusqu’en août 2026. Rien n’a changé sauf '
    + 'le nom et sa place dans le menu latéral — il est sous **Rapports** maintenant, avec '
    + 'les autres écrans qui relisent l’argent.',
  'help.p-and-l-summary.three-lines.heading': 'Les trois chiffres du haut',
  'help.p-and-l-summary.three-lines.b0.i0.term': 'Produits',
  'help.p-and-l-summary.three-lines.b0.i0.text':
    'Tout ce qui a été encaissé. Cotisations et dons ensemble — tous deux sont des '
    + 'paiements enregistrés au nom d’un membre — plus les apports versés directement dans un '
    + 'fonds. Les deux sont ventilés sous le chiffre.',
  'help.p-and-l-summary.three-lines.b0.i1.term': 'Charges',
  'help.p-and-l-summary.three-lines.b0.i1.text':
    'Argent décaissé d’un fonds. C’est le seul type de sortie que ce produit enregistre : '
    + 'c’est donc la totalité de ce qui a été dépensé.',
  'help.p-and-l-summary.three-lines.b0.i2.term': 'Excédent net',
  'help.p-and-l-summary.three-lines.b0.i2.text':
    'Produits moins charges. Il affiche **Déficit net** et passe au rouge lorsqu’il est '
    + 'sorti plus qu’il n’est entré.',
  'help.p-and-l-summary.three-lines.b1':
    'Une contrepassation se corrige d’elle-même ici. Contrepasser un paiement dans '
    + '[Transactions](/accounting/transactions) passe une écriture opposée, et le paiement '
    + 'comme sa contrepassation sont comptés — les produits reviennent donc là où ils '
    + 'appartiennent plutôt que de compter la correction deux fois.',
  'help.p-and-l-summary.unrouted.heading': 'Encaissé, pas encore affecté à un fonds',
  'help.p-and-l-summary.unrouted.b0':
    'Les cotisations arrivent comme un paiement puis sont **affectées** à un ou plusieurs '
    + 'fonds selon les règles définies dans [Comptabilité](/admin/accounting). Là où aucune '
    + 'règle ne couvre un barème, l’argent est encaissé et ne se trouve dans aucun fonds — et '
    + 'cette ligne dit combien.',
  'help.p-and-l-summary.unrouted.b1':
    'Ce n’est pas une erreur et ce n’est pas montré comme telle. L’argent n’est pas affecté '
    + 'jusqu’à ce que quelqu’un l’affecte, et une famille qui fonctionne avec une seule poche '
    + 'et aucune affectation fonctionne parfaitement. C’est là pour qu’une famille qui '
    + '*voulait* affecter quelque chose puisse voir qu’elle ne l’a pas fait.',
  'help.p-and-l-summary.unrouted.b2':
    'Le chiffre peut afficher **Affecté au-delà des produits de cotisations**, ce qui est '
    + 'la même ligne à l’envers : un administrateur peut apporter directement dans un fonds, '
    + 'donc il peut être entré dans les fonds plus que les cotisations n’ont jamais rapporté.',
  'help.p-and-l-summary.funds.heading':
    'Les soldes des fonds, et pourquoi ils ne totalisent pas le chiffre net',
  'help.p-and-l-summary.funds.b0':
    '**Soldes des fonds aujourd’hui** est ce que chaque fonds détient à l’instant. '
    + '**Excédent net** est les produits moins les charges sur toute l’histoire de la '
    + 'famille. Ce sont deux sortes de nombres différentes et l’on n’attend pas qu’elles '
    + 'concordent.',
  'help.p-and-l-summary.funds.b1':
    'Trois choses ordinaires les séparent : des cotisations qui n’ont jamais été affectées '
    + 'à un fonds, des apports versés directement dans l’un, et des virements entre fonds. '
    + 'Aucune n’est un défaut, et la page le dit plutôt que de laisser quelqu’un rapprocher '
    + 'les deux et conclure que l’une est fausse.',
  'help.p-and-l-summary.funds.b2':
    '**Produits affectés aux fonds**, entre les deux, montre où l’argent affecté est allé, '
    + 'fonds par fonds ; ouvrir une ligne le ventile selon sa provenance.',
  // ──── PART 7 — Money (Dues & Donations) ───────────────────────────────────────
  'help.my-dues.title': 'Cotisations et dons',
  'help.my-dues.summary':
    'Chaque barème auquel vous êtes soumis et ce que le prochain paiement doit être, et '
    + 'chaque campagne que votre famille mène.',
  'help.my-dues.what-it-is.heading': 'Deux panneaux, un écran',
  'help.my-dues.what-it-is.b0':
    '[Cotisations et dons](/accounting/dues-and-donations) répond à une question dans deux '
    + 'directions : ce que votre famille vous demande, et ce à quoi elle vous invite à '
    + 'contribuer. **Cotisations** est chaque barème auquel vous êtes soumis ; **Dons** est '
    + 'chaque campagne que la famille mène. Appuyez sur l’un ou l’autre dans le menu du haut.',
  'help.my-dues.what-it-is.b1':
    'C’étaient deux écrans distincts jusqu’au 20-08-2026. Un lien ou un signet vers l’un ou '
    + 'l’autre retrouve toujours l’argent de la famille — partez de '
    + '[Résumé](/accounting/summary), qui commence par les deux.',
  'help.my-dues.what-it-is.b2':
    'Aucun des deux panneaux ne montre jamais les cotisations ou les dons de quelqu’un '
    + 'd’autre, quoi qu’il vous ait été accordé. Chaque chiffre de l’écran est soit un total '
    + 'familial, soit le vôtre. Ce que la famille dans son ensemble a payé est une autre '
    + 'question, posée sur [Transactions](/accounting/transactions).',
  'help.my-dues.schedules.heading': 'Vos barèmes',
  'help.my-dues.schedules.b0':
    'Le panneau **Cotisations** énumère chaque barème auquel vous êtes soumis, en deux '
    + 'tableaux : **Cotisations obligatoires**, que tous ceux qui y sont soumis doivent, et '
    + '**Cotisations facultatives**, qu’il vous revient d’assumer ou de refuser. Chaque ligne '
    + 'dit ce que le barème coûte par an, ce que le prochain paiement doit être, quand il '
    + 'tombe, et ce qu’il reste. Les deux cartes du haut sont celles par lesquelles '
    + '[Résumé](/accounting/summary) commence.',
  'help.my-dues.schedules.b1':
    'Vous ne voyez qu’un tableau où vous avez un barème. Une famille qui n’a aucune '
    + 'cotisation facultative affiche un seul tableau et aucun titre vide — un tableau '
    + '**Cotisations facultatives** absent signifie donc qu’il n’y en a aucune pour vous, non '
    + 'que quelque chose n’a pas pu se charger.',
  'help.my-dues.schedules.b2':
    '**Chaque barème auquel vous êtes soumis reste listé, y compris ceux que vous avez '
    + 'soldés.** Une cotisation payée en entier indique **Payée** et affiche un solde nul '
    + 'plutôt que de disparaître — les tableaux disent à quoi vous êtes soumis, et ce que '
    + 'vous devez encore est la carte **À payer maintenant** en dessous.',
  'help.my-dues.schedules.b3':
    'Une ligne ombrée et marquée **En retard** est une ligne que le calendrier a déjà '
    + 'demandée et que l’argent n’a pas couverte. C’est un repère plutôt qu’un avertissement '
    + ': être en retard n’est pas une erreur, et le prochain paiement porte simplement le '
    + 'rattrapage.',
  'help.my-dues.schedules.b4':
    'Deux autres repères apparaissent à côté du nom d’un barème. **Refusée** est une '
    + 'cotisation facultative dont vous vous êtes retiré. **Pas encore due** est une '
    + 'cotisation qui commence à un âge que vous n’avez pas atteint — voyez [Cotisations qui '
    + 'commencent à un âge](#age).',
  'help.my-dues.next-payment.heading': 'Votre prochain paiement',
  'help.my-dues.next-payment.b0': 'Deux chiffres sont côte à côte et ne sont pas la même chose.',
  'help.my-dues.next-payment.b1.i0.term': 'Échéance',
  'help.my-dues.next-payment.b1.i0.text': 'Ce qu’un paiement coûte une fois que vous êtes à jour.',
  'help.my-dues.next-payment.b1.i1.term': 'Prochain dû',
  'help.my-dues.next-payment.b1.i1.text':
    'Ce que le prochain paiement doit être, ce qui inclut tout ce que le calendrier a déjà '
    + 'demandé et que l’argent n’a pas couvert.',
  'help.my-dues.next-payment.b2':
    'Passer au mensuel à la moitié de l’année sur un barème de 600 $ rend donc le prochain '
    + 'paiement important et tous les suivants ordinaires — le rattrapage est pris une fois '
    + 'et vous êtes de nouveau à jour. Le rattrapage est signalé, et c’est un repère plutôt '
    + 'qu’un avertissement : être en retard n’est pas une erreur.',
  'help.my-dues.cadence.heading': 'Changer la fréquence à laquelle vous payez',
  'help.my-dues.cadence.b0':
    'Chaque barème a une fréquence de paiement que vous définissez pour vous-même — '
    + 'hebdomadaire, mensuelle, trimestrielle, annuelle, ou en une fois. Le total annuel ne '
    + 'change pas ; la fréquence le divise. Celle que vous avez est imprimée sous le montant '
    + 'sur la ligne.',
  'help.my-dues.cadence.b1':
    'Pour la changer, ouvrez le menu de la ligne — le bouton à l’extrémité droite — et '
    + 'appuyez sur **Changer la fréquence de paiement**. La boîte de dialogue chiffre les '
    + 'cinq avant que vous n’en choisissiez une : ce que chaque échéance coûte, et, là où un '
    + 'changement vous laisserait rattraper, ce que le tout prochain paiement serait.',
  'help.my-dues.cadence.b2':
    'C’est à vous de le définir et cela ne demande l’autorisation de personne. Personne '
    + 'd’autre ne peut le définir pour vous.',
  'help.my-dues.pay-online.heading': 'Payer par carte',
  'help.my-dues.pay-online.b0':
    'Une fois que votre famille a connecté un processeur de cartes, chaque cotisation que '
    + 'vous devez encore porte un bouton **Payer** sur sa ligne. Il s’ouvre avec le montant '
    + 'dû à l’instant déjà renseigné — modifiez-le si vous voulez payer davantage ou solder '
    + 'la cotisation entièrement — et vous mène à la page de Stripe elle-même pour saisir '
    + 'votre carte.',
  'help.my-dues.pay-online.b1':
    'Le paiement s’inscrit dans les registres de la famille dès qu’il est réglé. Il n’y a '
    + 'rien qu’un trésorier ait à saisir ensuite, et cela apparaît dans votre propre '
    + 'historique de paiement à côté de tout ce qui a été enregistré à la main.',
  'help.my-dues.pay-online.b2':
    '**Mettre en place des paiements automatiques**, dans le menu de la ligne, démarre un '
    + 'paiement par carte permanent pour cette cotisation à la fréquence que vous avez déjà '
    + 'choisie. Il suit cette fréquence plutôt que de redemander : [changer votre '
    + 'fréquence](#cadence) est donc la façon de changer ce qui est prélevé. Chaque '
    + 'cotisation est distincte — en mettre une en place ne dit rien des autres. Une '
    + 'cotisation que vous avez mise en place indique **Automatique** sur sa ligne, avec ce '
    + 'qui est prélevé et à quelle fréquence.',
  'help.my-dues.pay-online.b3':
    'Les paiements automatiques ne concernent que les cotisations. Une campagne de dons est '
    + 'un don, et accepter de donner une fois n’est pas accepter de donner chaque mois — les '
    + 'campagnes se reçoivent donc une à la fois depuis le panneau **Dons**.',
  'help.my-dues.pay-online.b4':
    '**Arrêter les paiements automatiques**, dans le même menu, y met fin aussitôt, et tout '
    + 'ce qui a déjà été payé reste à votre dossier. Il n’y a rien à annuler ailleurs.',
  'help.my-dues.pay-online.b5':
    'L’absence de tout bouton **Payer** signifie que votre famille n’a pas encore connecté '
    + 'de processeur, ou que Stripe vérifie encore le compte. Demandez à qui tient la '
    + 'comptabilité de votre famille — c’est la section **Encaissement** de '
    + '[Comptabilité](/admin/accounting) — et payez entre-temps par les moyens que votre '
    + 'famille utilise déjà.',
  'help.my-dues.due-now.heading': 'Tout payer d’un coup',
  'help.my-dues.due-now.b0':
    '**À payer maintenant**, sous les deux tableaux, énumère chaque cotisation ayant '
    + 'quelque chose à payer et à combien chacune se monte, puis le total. C’est ce que vous '
    + 'paieriez pour être entièrement à jour aujourd’hui, rattrapages compris — et une ligne '
    + 'qui en porte un le dit en dessous d’elle-même.',
  'help.my-dues.due-now.b1':
    '**Payer … par carte** prend le tout en un seul paiement par carte. La page de Stripe '
    + 'le détaille, une ligne par cotisation, de sorte que vous voyez à quoi chaque part du '
    + 'total correspond avant de vous engager — et cela arrive dans les registres de la '
    + 'famille réparti de la même façon, une écriture par barème.',
  'help.my-dues.due-now.b2':
    'La boîte de dialogue énumère chaque cotisation avec son propre montant : vous pouvez '
    + 'donc en modifier n’importe laquelle avant de payer. Mettez-en une à zéro pour '
    + 'l’exclure de ce paiement ; elle reste exactement où elle était.',
  'help.my-dues.due-now.b3':
    'Si votre famille n’a pas connecté de processeur de cartes, **À payer maintenant** '
    + 'additionne tout de même — il le dit simplement au lieu de proposer un bouton. Le '
    + 'chiffre est le même à remettre par chèque.',
  'help.my-dues.age.heading': 'Cotisations qui commencent à un âge',
  'help.my-dues.age.b0':
    'Une famille peut décider qu’une cotisation commence lorsqu’un membre atteint un âge '
    + 'donné. Jusque-là elle reste au bas de votre liste, marquée **Pas encore due**, avec la '
    + 'date de son début et rien à payer.',
  'help.my-dues.age.b1':
    'L’année où vous atteignez l’âge est facturée au mois, et le mois de votre anniversaire '
    + 'est gratuit : une cotisation annuelle de 120 $ et un dix-huitième anniversaire en '
    + 'juillet font 50 $ cette année-là, puis 120 $ chaque année ensuite. La ligne le dit — '
    + '**50 $ cette année · 120 $/an ensuite**.',
  'help.my-dues.age.b2':
    'Quelqu’un dont la date de naissance n’est pas enregistrée doit la cotisation en '
    + 'entier, car le produit ne devine pas un âge. Si une de vos cotisations devrait être '
    + 'réduite et ne l’est pas, vérifiez votre date de naissance sur [Mon '
    + 'profil](/personal-info).',
  'help.my-dues.bloodline-dues.heading': 'Cotisations que seule la lignée doit',
  'help.my-dues.bloodline-dues.b0':
    'Une famille peut restreindre une cotisation aux membres descendant de sa lignée — un '
    + 'fonds funéraire pour la lignée, une concession au cimetière. Si une cotisation de '
    + 'votre famille fonctionne ainsi et que vous êtes entré dans la famille par mariage, '
    + 'elle n’est pas la vôtre et n’apparaît pas du tout sur cet écran.',
  'help.my-dues.bloodline-dues.b1':
    'C’est délibéré plutôt qu’un oubli : une cotisation que vous ne devrez jamais, listée '
    + 'comme quelque chose que vous ne payez pas, serait une note permanente sur la façon '
    + 'dont vous êtes entré dans la famille, sur votre propre écran. Ce que vous devez est ce '
    + 'qui est ici.',
  'help.my-dues.chapter-dues.heading': 'Cotisations d’une région ou d’une section',
  'help.my-dues.chapter-dues.b0':
    'Une famille peut rattacher une cotisation à une région ou à une section — une salle '
    + 'que la section du Texas loue, une bourse que la région de l’Est finance. Si une '
    + 'cotisation de votre famille appartient à une partie de la famille où vous n’êtes pas, '
    + 'elle n’est pas la vôtre et n’apparaît pas sur cet écran, pour la même raison qu’une '
    + 'cotisation réservée à la lignée n’apparaît pas.',
  'help.my-dues.chapter-dues.b1':
    'Votre section est sur [Mon profil](/personal-info), et c’est vous qui la définissez. '
    + '**Si vous n’en avez choisi aucune vous êtes sous National** : vous devez chaque '
    + 'cotisation de toute la famille et aucune cotisation régionale ou de section. Donc si '
    + 'vous attendiez la cotisation d’une section ici et qu’elle n’y est pas, la première '
    + 'chose à vérifier est que votre profil dise dans quelle section vous êtes.',
  'help.my-dues.opt-out.heading': 'Se retirer',
  'help.my-dues.opt-out.b0':
    '**Se retirer**, dans le menu d’une ligne du tableau **Cotisations facultatives**, dit '
    + 'que le barème ne vous concerne pas — un fonds dont vous ne faites pas partie, une '
    + 'section à laquelle vous n’appartenez pas. Il vous demande de confirmer, et **Se '
    + 'réinscrire** dans le même menu l’annule. Seule une cotisation facultative le propose ; '
    + 'rien dans le tableau **Cotisations obligatoires** ne peut être refusé.',
  'help.my-dues.opt-out.b1':
    'Se retirer n’est pas la même chose qu’avoir payé. Cela retire le barème de votre solde '
    + 'pour l’avenir ; cela n’efface pas ce qui était déjà dû.',
  'help.my-dues.drives.heading': 'Ce qu’une campagne affiche',
  'help.my-dues.drives.b0':
    'Le panneau **Dons** de [Cotisations et '
    + 'dons](/accounting/dues-and-donations?pane=donations) énumère chaque campagne que la '
    + 'famille a menée, chacune avec une barre montrant sa progression. Sous la barre : ce '
    + 'qui a été recueilli, quel était l’objectif, et — seulement si vous y avez donné — '
    + 'quelle part venait de vous.',
  'help.my-dues.drives.b1':
    'Une campagne qui a dépassé son objectif continue au lieu de s’arrêter à 100 % : la '
    + 'barre se remet à l’échelle et l’excédent est montré comme son propre segment, car une '
    + 'campagne qui a doublé sa cible ne devrait pas ressembler à une campagne arrivée de '
    + 'justesse.',
  'help.my-dues.drives.b2':
    'Une campagne sans objectif fixé n’a pas de barre à tracer : elle affiche donc le total '
    + 'courant.',
  'help.my-dues.closed.heading': 'Campagnes closes',
  'help.my-dues.closed.b0':
    'Une campagne dont la date de fin est passée est marquée **Close** et atténuée, et elle '
    + 'reste sur cette page. [Résumé](/accounting/summary) n’énumère que les campagnes '
    + 'ouvertes et compte le reste — un condensé porte sur ce qu’il faut faire ensuite, et '
    + 'cette page est le relevé complet.',
  'help.my-dues.giving.heading': 'Donner à une campagne',
  'help.my-dues.giving.b0':
    '**Donner**, sur une campagne ouverte, vous mène à la page de Stripe elle-même pour '
    + 'saisir votre carte. Saisissez ce que vous voulez donner — il n’y a pas de montant fixé '
    + 'ni de maximum, et la campagne vous dit ce qui atteindrait son objectif si elle en a '
    + 'un. Cela s’inscrit dans les registres de la famille dès que c’est réglé, et apparaît '
    + 'dans votre [historique de paiement](/reporting/payment-history) à côté de tout ce qui '
    + 'a été enregistré à la main.',
  'help.my-dues.giving.b1':
    'On donne à une campagne à la fois et jamais de façon récurrente, et c’est la '
    + 'différence avec le paiement des cotisations. Accepter de donner une fois n’est pas '
    + 'accepter de donner chaque mois, et donner à une campagne ne dit rien des autres.',
  'help.my-dues.giving.b2':
    'Un don va en entier dans le fonds **Dons** de votre famille. Il n’est pas réparti '
    + 'entre les fonds comme l’est un paiement de cotisation — voyez '
    + '[Fonds](/help/accounting#funds).',
  'help.my-dues.giving.b3':
    'Une campagne qui a atteint son objectif continue d’accepter des dons, et une campagne '
    + '**Close** n’en accepte aucun. Une campagne close n’affiche aucun bouton **Donner** car '
    + 'son total ne peut plus bouger.',
  'help.my-dues.giving.b4':
    'L’absence de bouton **Donner** sur toute campagne signifie que votre famille n’a pas '
    + 'encore connecté de processeur de cartes. Remettez votre don à qui tient les registres '
    + 'et il apparaîtra ici dès qu’il l’aura enregistré.',
  'help.my-dues.giving.b5':
    'Rien sur cette page ne dit qui a donné quoi. Chaque chiffre est soit un total '
    + 'familial, soit le vôtre.',
  // ──── PART 7 — Money (Dues Projections) ───────────────────────────────────────
  'help.dues-projections.title': 'Projection des cotisations',
  'help.dues-projections.summary':
    'Ce que la famille devrait encaisser cette année, ce qui est entré, et qui doit encore.',
  'help.dues-projections.what-it-is.heading': 'À quoi il répond',
  'help.dues-projections.what-it-is.b0':
    '[Transactions](/accounting/transactions) est ce qui est entré. Ceci est ce qui devrait '
    + ': chaque barème de cotisations actif, multiplié sur les membres qui le doivent, face à '
    + 'ce qui a réellement été encaissé.',
  'help.dues-projections.what-it-is.b1':
    'Rien sur cet écran ne change quoi que ce soit. Enregistrer un paiement ou en exonérer '
    + 'un se fait sur [Transactions](/accounting/transactions) ; changer ce qu’une cotisation '
    + 'coûte se fait dans [Comptabilité](/admin/accounting).',
  'help.dues-projections.what-it-is.b2':
    '**Un proche décédé n’est pas compté.** Inscrire une **Date du décès** sur le profil de '
    + 'quelqu’un le retire entièrement de cet écran — il ne doit rien, donc ni le total dû à '
    + 'la famille ni la liste de qui doit encore payer ne l’incluent. Les paiements qu’il a '
    + 'faits par le passé comptent toujours dans ce qui a été encaissé.',
  'help.dues-projections.figures.heading': 'Les quatre chiffres',
  'help.dues-projections.figures.b0.i0.term': 'Prévu cette année',
  'help.dues-projections.figures.b0.i0.text':
    'Ce que les membres comptés ici doivent pour les périodes en cours de leurs barèmes. '
    + 'Tout le reste de l’écran est une fraction de ce chiffre.',
  'help.dues-projections.figures.b0.i1.term': 'Encaissé',
  'help.dues-projections.figures.b0.i1.text':
    'De l’argent réellement arrivé. Une contrepassation se compense d’elle-même : un '
    + 'paiement corrigé laisse donc le chiffre là où il appartient.',
  'help.dues-projections.figures.b0.i2.term': 'Exonéré',
  'help.dues-projections.figures.b0.i2.text':
    'Remis. Cela solde la cotisation et vient en déduction de ce qui reste dû — et ce n’est '
    + 'jamais compté comme de l’argent, car il n’en est arrivé aucun.',
  'help.dues-projections.figures.b0.i3.term': 'Reste à encaisser',
  'help.dues-projections.figures.b0.i3.text':
    'Le prévu, moins ce qui a été soldé d’une manière ou d’une autre. Le chiffre pour '
    + 'lequel l’écran existe.',
  'help.dues-projections.figures.b1':
    'Un cinquième n’apparaît que lorsqu’il y en a : de l’argent **en attente de '
    + 'règlement**, c’est-à-dire un paiement entamé et pas encore confirmé. Il n’est pas '
    + 'compté comme encaissé et n’a pas été déduit de ce qui est dû.',
  'help.dues-projections.year.heading': 'Quelle année',
  'help.dues-projections.year.b0':
    'Celle de chaque barème. Une cotisation ancrée au 1er avril et un prélèvement ancré au '
    + '1er janvier ont réellement deux années en cours : chaque ligne indique donc la période '
    + 'sur laquelle elle a été mesurée, et le total familial est leur somme.',
  'help.dues-projections.year.b1':
    'C’est pourquoi les totaux ici concordent avec ce que chaque membre voit sur son propre '
    + 'écran [Cotisations](/accounting/dues-and-donations). Une seule année civile aurait été '
    + 'plus nette et aurait été en désaccord avec le solde de chaque membre.',
  'help.dues-projections.who-is-counted.heading': 'Qui est compté',
  'help.dues-projections.who-is-counted.b0':
    'Toutes les personnes que la famille a approuvées — la même liste que le [Répertoire '
    + 'des membres](/community/directory) affiche. Quelqu’un inscrit sur l’[arbre '
    + 'généalogique](/community/family-tree) qui ne s’est jamais connecté doit ses '
    + 'cotisations exactement autant que n’importe qui d’autre : il est donc compté. Les '
    + 'laisser de côté n’a jamais réduit la dette — cela a fait que cet écran en rapportait '
    + 'une plus petite.',
  'help.dues-projections.who-is-counted.b1':
    'La colonne **État** répond à une question différente de celle de l’argent : y a-t-il '
    + 'quelqu’un à qui envoyer une facture.',
  'help.dues-projections.who-is-counted.b2.i0.term': 'Actif',
  'help.dues-projections.who-is-counted.b2.i0.text':
    'Il a un compte, et la cotisation apparaît sur son propre écran '
    + '[Cotisations](/accounting/dues-and-donations).',
  'help.dues-projections.who-is-counted.b2.i1.term': 'Invité',
  'help.dues-projections.who-is-counted.b2.i1.text':
    'Pas encore de compte, et une invitation est toujours en cours. La famille a demandé, '
    + 'et la balle est dans son camp.',
  'help.dues-projections.who-is-counted.b2.i2.term': 'Invitation à faire',
  'help.dues-projections.who-is-counted.b2.i2.text':
    'Inscrit dans la famille et jamais invité à se joindre. C’est le seul des trois sur '
    + 'lequel vous pouvez agir — invitez-le depuis l’[arbre '
    + 'généalogique](/community/family-tree).',
  'help.dues-projections.who-is-counted.b3':
    'Une invitation **expirée** se lit comme Invitation à faire plutôt que comme Invité. Un '
    + 'lien expiré ne peut pas être accepté : la famille doit donc redemander, et dire autre '
    + 'chose rapporterait un travail comme accompli.',
  'help.dues-projections.who-is-counted.b4':
    '**Reste à encaisser** indique en dessous quelle part de lui-même est due par des '
    + 'personnes sans compte. Cela fait partie du total et n’en est jamais une déduction : '
    + 'l’argent est dû à la famille qu’il y ait ou non une boîte à laquelle envoyer la '
    + 'facture.',
  'help.dues-projections.who-is-counted.b5':
    'Cinq choses réduisent ce que quelqu’un doit, et toutes les cinq sont respectées : une '
    + 'cotisation qui commence à un âge, une cotisation que seule la lignée doit, une '
    + 'cotisation d’une région ou d’une section, une cotisation facultative qu’il a refusée, '
    + 'et tout ce que la famille a exonéré.',
  'help.dues-projections.who-is-counted.b6':
    'Quiconque n’a pas de date de naissance enregistrée doit une cotisation limitée par '
    + 'l’âge en entier, car un âge n’est jamais deviné. Si un chiffre paraît trop élevé, '
    + 'c’est la première chose à vérifier.',
  'help.dues-projections.who-is-counted.b7':
    'Quelqu’un qui attend encore une approbation **n’est pas** compté. Il n’a pas encore '
    + 'rejoint la famille : rien n’est dû par lui.',
  'help.dues-projections.standings.heading': 'Où en est chaque membre',
  'help.dues-projections.standings.b0':
    'Le tableau des membres commence par les personnes à relancer. Une ligne rapporte la '
    + 'situation la **moins** soldée que ce membre présente sur un barème quelconque : '
    + 'quelqu’un à jour sur trois cotisations et devant une quatrième est donc listé comme '
    + 'devant.',
  'help.dues-projections.standings.b1.i0.term': 'Rien de payé',
  'help.dues-projections.standings.b1.i0.text': 'Doit le montant entier de cette période.',
  'help.dues-projections.standings.b1.i1.term': 'Partiellement payé',
  'help.dues-projections.standings.b1.i1.text': 'Quelque chose est entré, pas la totalité.',
  'help.dues-projections.standings.b1.i2.term': 'Soldé',
  'help.dues-projections.standings.b1.i2.text': 'Payé en entier, ou remis.',
  'help.dues-projections.standings.b1.i3.term': 'Refusé',
  'help.dues-projections.standings.b1.i3.text': 'S’est retiré d’une cotisation facultative.',
  'help.dues-projections.standings.b1.i4.term': 'Pas encore due',
  'help.dues-projections.standings.b1.i4.text':
    'En dessous de l’âge auquel cette cotisation commence. Ce n’est pas la même chose que '
    + 'soldé — il n’a rien payé et ne doit rien.',
  'help.dues-projections.standings.b1.i5.term': 'Pas la sienne',
  'help.dues-projections.standings.b1.i5.text':
    'La cotisation est réservée à la lignée et ce membre en est hors. Contrairement à « Pas '
    + 'encore due », elle ne deviendra jamais la sienne.',
  'help.dues-projections.standings.b1.i6.term': 'Ailleurs',
  'help.dues-projections.standings.b1.i6.text':
    'La cotisation est d’une région ou d’une section et cette personne est dans une autre — '
    + 'ou dans aucune, ce qui la place sous National. Contrairement à « Pas la sienne », '
    + 'celle-ci change s’il change de section.',
  'help.dues-projections.standings.b2':
    '**Situation** et **État** sont deux colonnes distinctes, et la ligne qui vaut la peine '
    + 'd’être regardée est celle qui est à la fois Rien de payé et Invitation à faire. La '
    + 'situation porte sur l’argent ; l’état porte sur le fait qu’il y ait quelqu’un à qui le '
    + 'demander.',
  'help.dues-projections.standings.b3':
    'Une cotisation réservée à la lignée dans une famille qui n’a pas nommé sa lignée n’est '
    + 'due par personne, et sa ligne le dit plutôt que d’afficher un 0,00 $ prévu sans '
    + 'explication.',
  'help.dues-projections.standings.b4':
    '**Seulement ceux qui doivent** restreint le tableau, et le champ de filtre cherche '
    + 'dans n’importe quelle partie de n’importe quel nom.',
  // ──── PART 7 — Money (Membership, Accounting) ─────────────────────────────────
  'help.membership.title': 'Adhésions',
  'help.membership.summary':
    'Les membres par région et par section, qui a terminé de se joindre, et adultes contre '
    + 'mineurs.',
  'help.membership.what-it-is.heading': 'À quoi il répond',
  'help.membership.what-it-is.b0':
    'De quoi la famille est composée aujourd’hui. Le [Répertoire des '
    + 'membres](/community/directory) énumère vos proches un par un ; ceci les compte — où '
    + 'ils sont, combien ont terminé de se joindre, et combien sont des enfants.',
  'help.membership.what-it-is.b1':
    'Rien ici n’est conservé. Chaque chiffre est calculé au chargement de la page : c’est '
    + 'donc toujours la réponse du jour, et il n’y a aucun historique auquel se comparer.',
  'help.membership.what-it-is.b2':
    '**Qui est compté :** chaque membre que la famille a approuvé, et personne d’autre. '
    + 'Quelqu’un qui attend encore dans [Approbations en attente](/admin/members) ne s’est '
    + 'pas encore joint, et un proche enregistré comme décédé n’est pas compté non plus. Un '
    + 'proche qui ne s’est jamais connecté *est* compté — il fait partie de la famille qu’il '
    + 'ait un compte ou non, ce qui est la même règle que [Projection des '
    + 'cotisations](/reporting/dues-projections) utilise : les deux écrans sont donc toujours '
    + 'd’accord sur la taille de la famille.',
  'help.membership.drilling-in.heading': 'Appuyer sur une ligne pour voir qui y est',
  'help.membership.drilling-in.b0':
    '**Chaque ligne à côté de chaque graphique s’ouvre.** Appuyez sur l’une et elle énumère '
    + 'les personnes qu’elle a comptées, avec un champ de filtre dès qu’il y en a plus d’une '
    + 'poignée. Cela comprend les lignes que le graphique a repliées dans **Autres** et '
    + 'celles qui sont à zéro, car le tableau à côté d’un graphique énumère toujours chaque '
    + 'segment.',
  'help.membership.drilling-in.b1':
    'C’est la LIGNE plutôt que la part de l’anneau : un anneau dessine cinq parts et replie '
    + 'le reste, donc la ligne est la seule chose qui puisse ouvrir chacune d’elles. C’est '
    + 'aussi un vrai bouton : on peut l’atteindre au tabulateur et l’actionner au clavier.',
  'help.membership.drilling-in.b2':
    '**Les noms sont demandés au moment où vous appuyez, et pas avant.** Les graphiques '
    + 'eux-mêmes portent des décomptes et des noms de lieux et aucun nom de personne, et '
    + 'c’est pourquoi ce rapport n’est pas un écran réservé aux administrateurs. Ouvrir une '
    + 'ligne demande ce seul groupe.',
  'help.membership.drilling-in.b3':
    'Il vous faut le [Répertoire des membres](/community/directory) en plus de ce rapport '
    + 'pour voir qui est dans un groupe. Une famille qui a restreint le Répertoire a décidé '
    + 'qui peut lire les noms de ses membres, et un graphique ne contourne pas cela — si vous '
    + 'détenez l’un et pas l’autre, les chiffres s’ouvrent et les noms non.',
  'help.membership.putting-it-right.heading': 'Corriger ce qu’un graphique signale',
  'help.membership.putting-it-right.b0':
    '**Trois des quatre graphiques proposent chacun une correction, sur la ligne qui en a '
    + 'besoin.** Chacune est la même action que l’écran qui la détient utilise : chaque règle '
    + 'que cet écran applique vaut donc ici aussi.',
  'help.membership.putting-it-right.b1.i0.term': 'Sans section, et National',
  'help.membership.putting-it-right.b1.i0.text':
    'Définissez la section de cette personne. Sa région suit — il n’y a pas de région '
    + 'distincte à définir, car une région est une propriété de la section. Ses fils et '
    + 'filles de moins de dix-huit ans sans compte propre se déplacent avec elle, exactement '
    + 'comme sur [Mon profil](/personal-info).',
  'help.membership.putting-it-right.b1.i1.term': 'Invitation à faire, et Invité',
  'help.membership.putting-it-right.b1.i1.text':
    'Envoyez-lui une invitation. Cela demande une vraie adresse courriel, car un proche '
    + 'sans compte en détient une provisoire qui ne peut pas recevoir de courrier. Appuyer '
    + 'sur une ligne Invité envoie une nouvelle invitation, ce qui est ce que relancer une '
    + 'invitation sans réponse veut dire.',
  'help.membership.putting-it-right.b1.i2.term': 'Date de naissance non enregistrée',
  'help.membership.putting-it-right.b1.i2.text':
    'Enregistrez sa date de naissance. Adulte ou mineur est calculé à partir d’elle chaque '
    + 'fois que le rapport se charge ; rien sur son âge n’est conservé.',
  'help.membership.putting-it-right.b2':
    '**Seules ces lignes proposent quelque chose**, et c’est délibéré : quelqu’un déjà dans '
    + 'la section d’Austin n’est pas un problème que le graphique signale, et **Actif** ne '
    + 'peut pas être invité puisqu’il peut déjà se connecter. Une ligne sans rien à corriger '
    + 's’ouvre tout de même et énumère tout de même.',
  'help.membership.putting-it-right.b3':
    '**Une personne à la fois.** Il n’y a pas de bouton « classer toutes celles-ci à Austin '
    + '», car chacune de ces actions est une affirmation sur une personne — dans quelle '
    + 'section elle est réellement, quand elle est réellement née, s’il faut lui demander de '
    + 'se joindre — et définir une section déplace ses jeunes enfants avec elle.',
  'help.membership.putting-it-right.b4':
    'Les deux corrections sont deux autorisations. Définir une section et enregistrer une '
    + 'date de naissance demandent l’autorisation de modifier les membres ; envoyer une '
    + 'invitation demande l’autorisation de modifier l’arbre généalogique. Si une ligne '
    + 'énumère des personnes et ne propose aucune commande, le panneau dit laquelle des deux '
    + 'ne vous a pas été donnée.',
  'help.membership.places.heading': 'Par région et par section',
  'help.membership.places.b0':
    'Deux ventilations, l’une au-dessus de l’autre dans la structure de la famille. **Au '
    + 'niveau national**, en haut, c’est toute la famille — ce chiffre est ce dont chaque '
    + 'pourcentage de la page est une part.',
  'help.membership.places.b1':
    '**National** apparaît aussi comme une part de la ventilation par régions, et cela y '
    + 'signifie la même chose : l’absence de région. Quelqu’un dans aucune section, et '
    + 'quelqu’un dont la section n’a pas été placée dans une région, sont tous deux sous '
    + 'National. **Sans section** est la part correspondante dans la ventilation par '
    + 'sections.',
  'help.membership.places.b2':
    '**Chaque section que la famille a créée est listée, y compris celles que personne n’a '
    + 'rejointes.** Une section à zéro est généralement la ligne à regarder — soit personne '
    + 'n’y a encore été placé, soit elle n’est plus nécessaire. Les régions et les sections '
    + 'se mettent en place sous [Membres](/admin/members), sur son onglet **Organisation**.',
  'help.membership.places.b3':
    'Lorsqu’il y a plus de lieux que le graphique ne peut montrer clairement, il dessine '
    + 'les cinq plus grands et replie le reste dans **Autres**, en disant combien cela '
    + 'représente. Le tableau à côté du graphique les énumère toujours tous.',
  'help.membership.invitations.heading': 'Qui a terminé de se joindre',
  'help.membership.invitations.b0':
    'Les trois mêmes états que rapporte [Projection des '
    + 'cotisations](/reporting/dues-projections), comptés plutôt que listés.',
  'help.membership.invitations.b1.i0.term': 'Actif',
  'help.membership.invitations.b1.i0.text': 'Il a un compte et peut se connecter.',
  'help.membership.invitations.b1.i1.term': 'Invité',
  'help.membership.invitations.b1.i1.text':
    'Pas encore de compte, et une invitation est ouverte et sans réponse. La famille a '
    + 'demandé ; la balle est dans son camp.',
  'help.membership.invitations.b1.i2.term': 'Invitation à faire',
  'help.membership.invitations.b1.i2.text':
    'Inscrit dans la famille et jamais invité à se joindre. C’est le seul sur lequel vous '
    + 'pouvez agir — appuyez sur la ligne et invitez-le depuis là, ou depuis l’[arbre '
    + 'généalogique](/community/family-tree).',
  'help.membership.invitations.b2':
    '**Peuvent se connecter**, en haut de la page, est le chiffre des Actifs sous un autre '
    + 'nom, et **Jamais invités**, à côté, n’apparaît que lorsqu’il y a quelqu’un dans le '
    + 'troisième groupe. À eux deux ils disent quelle part de la famille peut réellement être '
    + 'atteinte — c’est le chiffre à regarder avant d’envoyer quoi que ce soit à tout le '
    + 'monde.',
  'help.membership.invitations.b3':
    'Une invitation **expirée** compte comme Invitation à faire et non comme Invité. Un '
    + 'lien expiré ne peut pas être accepté : la famille doit donc redemander.',
  'help.membership.ages.heading': 'Adultes et mineurs',
  'help.membership.ages.b0':
    'Calculé à partir de la date de naissance de chaque membre, chaque fois que la page se '
    + 'charge — c’est donc juste le matin d’un anniversaire et cela ne demande rien à tenir à '
    + 'jour.',
  'help.membership.ages.b1':
    '**Date de naissance non enregistrée** est sa propre part, et elle n’est repliée dans '
    + 'aucune des deux autres. La plupart des arbres généalogiques comptent bien des proches '
    + 'sans date de naissance enregistrée, et les compter comme adultes rapporterait une '
    + 'précision que les registres n’ont pas.',
  'help.membership.ages.b2':
    'Cette part vaut la peine d’être surveillée si la famille a une cotisation qui commence '
    + 'à un âge : un membre sans date de naissance la doit en entier, car un âge n’est jamais '
    + 'deviné.',
  'help.accounting.title': 'Comptabilité',
  'help.accounting.summary':
    'Mettre en place les barèmes de cotisations, les campagnes de dons, les fonds, '
    + 'l’affectation et les jalons.',
  'help.accounting.what-it-is.heading': 'La configuration, non le travail du jour',
  'help.accounting.what-it-is.b0':
    '[Comptabilité](/admin/accounting) est là où l’argent se *configure*. Enregistrer un '
    + 'paiement réel se fait sur [Transactions](/accounting/transactions), sous '
    + '**Comptabilité** dans le menu latéral. Chaque section ici est sa propre autorisation : '
    + 'tenir le barème de cotisations et verser de l’argent sont donc des travaux différents.',
  'help.accounting.what-it-is.b1':
    'Le menu en haut de la page contient **Cotisations**, **Dons**, **Fonds**, '
    + '**Affectation**, **Jalons**, **Encaissement** et **Coordonnées bancaires**. Chacun '
    + 's’accorde séparément : vous voyez donc ceux qui vous ont été donnés et aucun autre — '
    + 'un menu à trois éléments n’est pas un défaut. Les boutons **Nouvelle cotisation** et '
    + '**Nouveau don** se trouvent à côté du menu sur leurs propres pages, et n’apparaissent '
    + 'que là où vous pouvez ajouter à cette liste.',
  'help.accounting.what-it-is.b2':
    '**Ce sont toujours deux autorisations distinctes, et partager un panneau n’y a rien '
    + 'changé.** Une famille qui laisse quelqu’un tenir le barème de cotisations mais pas '
    + 'mener les campagnes de dons accorde l’une et pas l’autre, et cette personne voit une '
    + 'liste, un bouton, et un élément de menu nommé d’après la moitié qu’elle détient. C’est '
    + 'un seul écran parce que les deux se lisent ensemble, non parce qu’ils sont un seul '
    + 'travail — voyez [Qui peut faire quoi](/help/who-can-do-what#one-template).',
  'help.accounting.dues.heading': 'Cotisations',
  'help.accounting.dues.b0':
    'Un barème de cotisations est ce qu’un membre doit sur une année : un nom, un montant, '
    + 'à quelle fréquence il est facturé à l’origine, et dans quel fonds il atterrit. Les '
    + 'membres choisissent ensuite leur propre fréquence à l’intérieur.',
  'help.accounting.dues.b1':
    'La date de début importe. Elle ancre l’échelle des dates d’échéance, et le formulaire '
    + 'préremplit aujourd’hui — ce qui convient, et mérite un instant de réflexion si vous '
    + 'saisissez le barème de l’an dernier.',
  'help.accounting.dues.b2':
    '**Les membres commencent à payer à l’âge de** est la façon dont une famille dit que '
    + 'les enfants ne paient pas. Laissez-le vide et tout le monde doit la cotisation quel '
    + 'que soit son âge. Mettez 18 et un membre ne doit rien jusqu’à ses 18 ans, puis les '
    + 'mois de cette année-là suivant son anniversaire, puis le montant entier chaque année '
    + 'ensuite — une cotisation de 120 $ et un anniversaire en juillet font 50 $ cette '
    + 'année-là. La ligne l’affiche comme **À partir de 18 ans**.',
  'help.accounting.dues.b3':
    'Un membre sans date de naissance enregistrée doit la cotisation en entier, car le '
    + 'produit ne devine pas un âge. Ajouter un enfant à l’[arbre '
    + 'généalogique](/community/family-tree) sans adresse courriel demande une date de '
    + 'naissance pour exactement cette raison.',
  'help.accounting.dues.b4':
    '**Lignée seulement** restreint une cotisation aux membres descendant de la lignée de '
    + 'la famille. Quiconque est entré par mariage, et tout proche par alliance, adopté ou '
    + 'placé, ne doit rien et ne la voit pas du tout sur son propre écran Cotisations — une '
    + 'cotisation qui n’est jamais la sienne n’est pas listée comme quelque chose qu’il ne '
    + 'paie pas.',
  'help.accounting.dues.b5':
    'Le contrôle n’est pas disponible tant que personne dans votre famille n’a été coché '
    + 'comme faisant partie de sa lignée, car jusque-là la cotisation ne serait due par '
    + 'personne. Cochez d’abord **fait partie de la lignée de la famille** sur la fiche '
    + 'd’un parent dans l’[arbre familial](/community/family-tree). Qui doit la cotisation '
    + 'est exactement qui est coché, donc cocher quelqu’un plus tard l’y ajoute.',
  'help.accounting.dues.b6':
    '**Dû par** dit quelle partie de la famille la doit : National — toute la famille — ou '
    + 'une région, ou une section. Cela n’apparaît qu’une fois que votre famille a une région '
    + 'ou une section à choisir ; jusque-là chaque cotisation est Nationale, ce qui est ce '
    + 'que National veut dire. Un membre sans section est sous National et ne doit rien de '
    + 'restreint : une cotisation de section ne facture donc que les personnes qui ont dit '
    + 'être dans cette section. Voyez [régions et sections](/help/regions-and-chapters#dues).',
  'help.accounting.dues.b7':
    'Un barème contre lequel des paiements ont été faits ne peut pas simplement être '
    + 'supprimé, et son montant, sa fréquence, sa date de début, son âge de début, son '
    + 'réglage de lignée et **Dû par** sont alors figés — chaque paiement déjà enregistré a '
    + 'été fait selon ces termes. Changer qui doit une cotisation reformulerait si les gens '
    + 'la devaient pour des périodes déjà facturées, et c’est pourquoi cela figure sur cette '
    + 'liste. La page vous dit quand un barème est en usage. La date de fin peut encore '
    + 'changer.',
  'help.accounting.donations.heading': 'Dons',
  'help.accounting.donations.b0':
    'Une campagne de dons est une cible à laquelle la famille contribue. Elle peut nommer '
    + 'pour qui elle est, et c’est ce qui lui donne un visage — « ceci est pour les frais '
    + 'médicaux de Martha » plutôt que « Fonds général ».',
  'help.accounting.funds.heading': 'Fonds',
  'help.accounting.funds.b0':
    'Les fonds sont les poches où l’argent se trouve. Chacun a un solde, ce qui est entré, '
    + 'et ce qui est sorti.',
  'help.accounting.funds.b1':
    'Le formulaire de nouveau fonds demande un **Solde minimal**, et c’est le seul nombre '
    + 'qui fasse réellement quelque chose : un paiement entrant remplit chaque fonds jusqu’à '
    + 'son minimum, dans l’ordre défini sous **Affectation**, avant que rien en dessous n’en '
    + 'reçoive une part. C’est la façon dont une famille dit « celui-ci n’est pas à dépenser '
    + '». Laissez-le vide pour un fonds sans plancher, et modifiez-le ensuite sur le panneau '
    + 'Affectation, où il se trouve à côté de l’ordre de remplissage des fonds.',
  'help.accounting.routing.heading': 'Affectation',
  'help.accounting.routing.b0':
    'L’affectation décide comment un paiement entrant est réparti entre les fonds — 70 % au '
    + 'Général, 30 % aux Bourses, et ainsi de suite. Définissez-la une fois et chaque '
    + 'paiement enregistré ensuite la suit, au lieu que quelqu’un le divise à la main chaque '
    + 'fois.',
  'help.accounting.routing.b1':
    '**Le fonds Dons intégré peut aussi prendre une part.** Il est sur la liste comme '
    + 'n’importe quel autre fonds : une famille qui veut qu’une part de ses cotisations aille '
    + 'à la poche générale peut donc le dire. Il vient dernier en priorité, ce qui importe '
    + 'quand rien n’a été défini — la part va au fonds en haut de la liste, et Dons n’est '
    + 'jamais en haut sauf s’il est le seul fonds que votre famille possède.',
  'help.accounting.routing.b2':
    'Un don est différent et ne suit pas ce tableau. Un don va en entier dans le fonds '
    + 'Dons, ce à quoi ce fonds sert ; l’affectation porte sur les COTISATIONS.',
  'help.accounting.milestones.heading': 'Jalons',
  'help.accounting.milestones.b0':
    'Ce que la famille verse pour une occasion — une remise de diplôme, un mariage, un '
    + 'décès — et de quel fonds cela provient. Le chiffrer d’avance est ce qui transforme « '
    + 'on donne généralement quelque chose » en un montant sur lequel le trésorier peut agir.',
  'help.accounting.processing.heading': 'Encaissement',
  'help.accounting.processing.b0':
    '**Encaissement** est là où votre famille connecte son propre compte Stripe, pour que '
    + 'les proches puissent payer leurs cotisations par carte au lieu d’écrire un chèque. '
    + 'Appuyez sur **Connecter un compte Stripe** et Stripe recueille tout ce dont il a '
    + 'besoin sur ses propres pages ; à votre retour, ce panneau dit si les paiements par '
    + 'carte sont activés.',
  'help.accounting.processing.b1':
    '**Le pays que vous choisissez décide de la devise dans laquelle votre famille '
    + 'encaisse.** Le contrôle **Pays** de ce panneau fixe les deux : choisissez le Canada et '
    + 'vos cotisations, vos fonds et les budgets de vos rassemblements sont enregistrés en '
    + 'dollars canadiens, et les proches sont débités en dollars canadiens. C’est un seul '
    + 'choix et non deux, de sorte que l’argent que votre famille demande et celui qui arrive '
    + 'sur son compte sont toujours le même montant.',
  'help.accounting.processing.b2':
    '**Les deux sont définitivement fixés dès qu’un paiement est enregistré ou que le compte '
    + 'Stripe est créé, et ni l’un ni l’autre ne peut être annulé.** Stripe ne peut pas '
    + 'déplacer un compte connecté vers un autre pays, et le registre de votre famille ne '
    + 'peut pas être redénominé après coup : cent lignes indiquant 40 $ devraient alors '
    + 'vouloir dire deux choses différentes. Le panneau indique laquelle des deux l’a fixé. '
    + 'Choisissez le pays avant d’enregistrer votre premier paiement.',
  'help.accounting.processing.b3':
    '**Le compte appartient à votre famille, non à GENORRA.** L’argent va directement à la '
    + 'banque de votre famille, les frais de traitement de Stripe sortent du côté de votre '
    + 'famille, et votre famille conserve son propre tableau de bord Stripe, son propre '
    + 'calendrier de versements et ses propres remboursements. GENORRA ne prend aucune part '
    + 'de ce que votre famille encaisse.',
  'help.accounting.processing.b4':
    '**On ne vous demandera jamais une clé Stripe, et vous ne devriez en donner aucune à '
    + 'personne.** GENORRA ne conserve que l’identifiant de votre compte — assez pour vous '
    + 'envoyer un paiement, et inutile à quiconque seul. Si un écran vous demande de coller '
    + 'une clé commençant par `sk_`, ce n’est pas ce produit.',
  'help.accounting.processing.b5':
    'Un paiement par carte s’inscrit dans les registres de la famille dès qu’il est réglé '
    + 'et se répartit entre vos fonds selon le même tableau d’**Affectation** qu’un paiement '
    + 'saisi à la main. Personne n’a à le saisir ensuite, et il apparaît dans '
    + '[Transactions](/accounting/transactions) à côté de tout le reste.',
  'help.accounting.processing.b6':
    '**Vérifier auprès de Stripe** demande à Stripe l’état actuel du compte, ce qui vaut la '
    + 'peine si vous venez de terminer quelque chose de leur côté. Jusqu’à ce qu’il indique '
    + 'que les paiements par carte sont activés, les membres ne voient aucune section **Payer '
    + 'en ligne** — mieux vaut cela qu’un bouton qui échoue une fois que quelqu’un a décidé '
    + 'de payer.',
  'help.accounting.processing.b7':
    '**Se déconnecter arrête aussi chaque paiement automatique des membres, et ceux-là ne '
    + 'peuvent pas être relancés.** Se reconnecter ramène le même compte Stripe avec son '
    + 'historique et ses coordonnées bancaires exactement comme ils étaient — mais chaque '
    + 'proche qui payait automatiquement doit remettre son paiement en place, car '
    + 'l’arrangement a été annulé chez Stripe plutôt que suspendu. Le panneau dit combien de '
    + 'personnes cela représente avant que vous ne confirmiez. Rien de ce qui est déjà '
    + 'enregistré n’est retiré, et le compte Stripe de votre famille lui-même n’est pas '
    + 'touché — ceci arrête seulement son usage par GENORRA.',
  'help.accounting.processing.b8':
    '**C’est pour cela que se déconnecter demande deux choses.** D’abord votre mot de passe '
    + 'de connexion, pour que cela ne puisse arriver par accident ni du fait de quelqu’un '
    + 'assis devant un écran déverrouillé. Ensuite un code à six chiffres envoyé à l’adresse '
    + 'avec laquelle vous vous connectez — pas à une adresse que vous saisissez, et pas à '
    + 'quelqu’un d’autre. Le code dure quinze minutes, fonctionne une fois, et s’annule de '
    + 'lui-même après cinq tentatives erronées. C’est la même barrière que [retirer une '
    + 'famille](/help/family-settings#removal), et elle est là pour la même raison : la '
    + 'partie que vous pouvez annuler en cache une que vous ne pouvez pas.',
  'help.accounting.processing.b9':
    'Si votre famille s’est déconnectée, le panneau le dit et le bouton indique '
    + '**Reconnecter Stripe** plutôt que **Connecter un compte Stripe** — car c’est '
    + 'réellement le même compte qui revient, non un nouveau qui se crée.',
  'help.accounting.not-yet.heading': 'Coordonnées bancaires',
  'help.accounting.not-yet.b0':
    'La section existe dans le menu et n’est pas encore raccordée. C’est là que vivront les '
    + 'coordonnées bancaires de la famille elle-même — le compte où les cotisations sont '
    + 'déposées, et depuis lequel les décaissements sont versés. Rien n’y est conservé '
    + 'aujourd’hui.',
  'help.accounting.not-yet.b1':
    'Connecter un processeur de cartes sous **Encaissement** n’a pas besoin de ceci, et ne '
    + 'le remplit pas : Stripe conserve les coordonnées bancaires que vous lui donnez, et '
    + 'cette section sert à noter les numéros qu’un trésorier devrait sinon aller chercher '
    + 'pour un chèque ou un virement.',
  // ──── PART 8 — Community (Chat, Directory, Updates) ───────────────────────────
  'help.part.community.title': 'Communauté',
  'help.part.community.blurb':
    'Parler à la famille, et savoir qui est chacun.',
  'help.chat.title': 'Chat',
  'help.chat.summary':
    'Le salon de la famille, les messages privés, et les groupes que vous créez vous-même.',
  'help.chat.rooms.heading': 'Les trois sortes de salon',
  'help.chat.rooms.b0.i0.term': 'Famille',
  'help.chat.rooms.b0.i0.text':
    'Un salon, tout le monde dedans, créé pour vous. On ne peut ni le quitter ni le '
    + 'supprimer.',
  'help.chat.rooms.b0.i1.term': 'Messages directs',
  'help.chat.rooms.b0.i1.text': 'Un fil privé entre vous et un autre membre.',
  'help.chat.rooms.b0.i2.term': 'Messages de groupe',
  'help.chat.rooms.b0.i2.text':
    'Un fil nommé avec les personnes que vous choisissez — une commission d’organisation, '
    + 'les cousins qui préparent un cadeau.',
  'help.chat.rooms.b1':
    'Les messages arrivent en direct. Un point à côté d’un salon signifie qu’il y a quelque '
    + 'chose que vous n’avez pas lu ; ouvrir le salon l’efface.',
  'help.chat.dm.heading': 'Démarrer un message privé',
  'help.chat.dm.b0.i0': 'Appuyez sur **Nouveau MD** en haut de la liste des salons.',
  'help.chat.dm.b0.i1': 'Choisissez la personne.',
  'help.chat.dm.b0.i2':
    'Écrivez et envoyez. Entrée envoie, Maj+Entrée commence une nouvelle ligne.',
  'help.chat.dm.b1':
    'Seuls les membres qui ont un compte apparaissent dans la liste. Quelqu’un inscrit sur '
    + 'l’arbre généalogique sans adresse courriel n’a nulle part où recevoir un message — '
    + 'voyez [Fiches et comptes](/help/family-tree#records).',
  'help.chat.group.heading': 'Démarrer un groupe',
  'help.chat.group.b0.i0': 'Appuyez sur **Nouveau** à côté du titre **Messages de groupe**.',
  'help.chat.group.b0.i1': 'Nommez-le — le nom est ce que tous les autres verront dans leur liste.',
  'help.chat.group.b0.i2': 'Cochez les personnes à inclure, et appuyez sur **Créer le groupe**.',
  'help.chat.group.b1':
    'La personne qui crée un groupe peut ajouter et retirer des membres ensuite, depuis la '
    + 'commande en haut à droite du fil.',
  'help.chat.deleting.heading': 'Retirer une conversation',
  'help.chat.deleting.b0':
    'Un fil de message direct peut être supprimé de votre liste. Le salon de la famille ne '
    + 'peut pas l’être — c’est le seul endroit où toute la famille peut toujours être '
    + 'atteinte.',
  'help.directory.title': 'Répertoire',
  'help.directory.summary':
    'Toutes les personnes de la famille, avec recherche, et comment les joindre.',
  'help.directory.searching.heading': 'Trouver quelqu’un',
  'help.directory.searching.b0':
    'Le champ de filtre correspond au prénom, au nom et au nom d’usage, et il ignore les '
    + 'accents et la ponctuation — saisir **jose** trouve José, et **oconnor** trouve '
    + 'O’Connor.',
  'help.directory.columns.heading': 'Ce que la liste affiche',
  'help.directory.columns.b0':
    'Quatre colonnes : **Nom**, **Fonction**, **Section**, et le **Groupe** sur lequel la '
    + 'personne se trouve — qui est le modèle d’autorisations décidant ce qu’elle peut faire. '
    + '**Fonction** est le poste au conseil qu’elle occupe, écrit en entier — « trésorier '
    + 'national », « président de la section d’Austin » — et un tiret pour la majeure partie '
    + 'de la famille, qui n’en occupe aucun. La section où quelqu’un se trouve est sur la '
    + 'ligne ; la RÉGION à laquelle cette section appartient est dans sa fiche de détail, car '
    + 'la région découle de la section plutôt que d’être une réponse distincte.',
  'help.directory.columns.b1':
    'Tout le reste concernant une personne est derrière son nom. **Appuyer sur un nom ouvre '
    + 'sa fiche** — téléphone, courriel, ville et État, sa section et sa région, son nom '
    + 'd’usage, son groupe, et si elle a déjà un compte. Le nom est un vrai bouton : '
    + 'l’atteindre au tabulateur et appuyer sur Entrée ouvre le même panneau qu’un clic.',
  'help.directory.columns.b2':
    'Téléphone, courriel et ville avaient chacun leur propre colonne jusqu’au 19-08-2026 et '
    + 'se trouvent maintenant dans ce panneau. Rien n’a été retiré et rien de nouveau n’est '
    + 'montré : les mêmes faits, à une pression au lieu de cinq colonnes de large, et c’est '
    + 'ce qui rend la liste lisible sur un téléphone.',
  'help.directory.columns.b3':
    'Sur un écran étroit, Fonction, Section et Groupe se replient sous le nom au lieu de '
    + 'glisser sur le côté : rien n’est donc jamais garé hors de vue.',
  'help.directory.columns.b4':
    'Les personnes inscrites sur l’arbre généalogique sans adresse courriel apparaissent '
    + 'ici aussi. Un grand-oncle inscrit est membre de la famille ; il n’a simplement pas de '
    + 'compte, et sa fiche le dit.',
  'help.directory.tree.heading': 'D’un nom à l’arbre',
  'help.directory.tree.b0':
    'Le bouton **Arbre généalogique** vous mène à l’arbre, où vous pouvez centrer sur '
    + 'n’importe qui et voir comment il se rattache. C’est la même question depuis l’autre '
    + 'côté : le Répertoire répond *qui*, l’arbre répond *comment ils sont liés*.',
  'help.updates.title': 'Actualités',
  'help.updates.summary':
    'L’archive de tout ce que la famille a annoncé et de tout ce qui vous a été envoyé, et '
    + 'comment la recherche fonctionne.',
  'help.updates.what-it-is.heading': 'Une liste, deux sortes de choses',
  'help.updates.what-it-is.b0':
    'Actualités est le panneau **Actualités** des [Annonces](/community/announcements), et '
    + 'la version longue de la carte **Actualités récentes** de votre [Tableau de '
    + 'bord](/dashboard). Cette carte montre les quelques plus récentes ; ceci les montre '
    + 'toutes, de la plus récente à la plus ancienne, et vous permet de chercher.',
  'help.updates.what-it-is.b1':
    'Il avait sa propre rangée de menu jusqu’au 19-08-2026 et ne l’a plus — les nouvelles '
    + 'de la famille vivent sur un seul écran. L’ancienne adresse fonctionne toujours et '
    + 'arrive sur le panneau : un lien que quelqu’un a envoyé ouvre donc toujours la bonne '
    + 'liste.',
  'help.updates.what-it-is.b2': 'Deux sortes de lignes apparaissent :',
  'help.updates.what-it-is.b3.i0.term': 'Annonce',
  'help.updates.what-it-is.b3.i0.text':
    'Nouvelles de la famille que quelqu’un a publiées sur le tableau. L’ouvrir mène aux '
    + '[Annonces](/community/announcements), qui portent le texte entier — sauf pour un avis '
    + 'd’élection, qui mène à l’élection elle-même, car vous en avez déjà lu la totalité dans '
    + 'la ligne.',
  'help.updates.what-it-is.b3.i1.term': 'Envoyé à vous',
  'help.updates.what-it-is.b3.i1.text':
    'Quelque chose qui vous est adressé personnellement — une tâche, une approbation, un '
    + 'message en attente. Ce sont les mêmes lignes que la cloche de la barre du haut.',
  'help.updates.what-it-is.b4':
    'Rien ici n’est le courrier de quelqu’un d’autre. Les lignes « envoyé à vous » sont les '
    + 'vôtres seules, et ce sont la même liste que la cloche affiche.',
  'help.updates.what-it-is.b5':
    'Ouvrir une ligne ne la marque pas comme lue. C’est la cloche qui s’en charge : le '
    + 'nombre qu’elle porte et cette page ne peuvent donc jamais être en désaccord.',
  'help.updates.searching.heading': 'Chercher',
  'help.updates.searching.b0':
    'Le champ unique cherche dans le titre et dans le corps des deux sortes de lignes, et '
    + 'il cherche dans la base de données plutôt que sur la page — il atteint donc tout, '
    + 'aussi loin en arrière que ce soit.',
  'help.updates.searching.b1.i0':
    'Les mots peuvent être dans n’importe quel ordre. Chercher **bloc hôtel** trouve « le '
    + 'bloc à l’hôtel ».',
  'help.updates.searching.b1.i1':
    'Les terminaisons sont gérées : **chambres** trouve « chambre », **réservation** trouve '
    + '« réservé », et **paiement** trouve « paiements ».',
  'help.updates.searching.b1.i2':
    'Les mots irréguliers ne le sont pas — **payant** ne trouve pas « payé ». Cherchez le '
    + 'mot tel qu’il aurait été écrit.',
  'help.updates.searching.b1.i3':
    'Mettez un **-** devant un mot pour exclure les lignes qui le contiennent — '
    + '**rassemblement -annulé**.',
  'help.updates.searching.b1.i4':
    'Une partie de mot ne correspond pas : **rassembl** ne trouve rien. Saisissez le mot '
    + 'entier.',
  'help.updates.searching.b2':
    'Les accents sont comparés exactement ici, contrairement aux recherches de noms '
    + 'ailleurs dans le produit — chercher « jose » ne trouvera pas « José » sur cette page.',
  'help.updates.searching.b3':
    'Une recherche est un lien. La barre d’adresse porte ce que vous avez cherché : vous '
    + 'pouvez donc l’envoyer à quelqu’un ou utiliser le bouton retour pour en parcourir '
    + 'plusieurs.',
  'help.updates.older.heading': 'Aller plus loin en arrière',
  'help.updates.older.b0':
    '**Afficher 25 plus anciennes** ajoute une page au bas de la liste, et continue jusqu’à '
    + 'ce qu’il n’y ait plus rien de plus ancien. Remonter finit par s’arrêter, et la page le '
    + 'dit lorsque cela arrive — à ce moment c’est la recherche qui atteint le reste, car '
    + 'elle regarde chaque ligne plutôt que seulement celles à l’écran.',
  'help.updates.older.b1':
    'Le décompte sous la liste dit toujours combien de lignes vous regardez : une liste '
    + 'courte n’est donc jamais une liste qui s’est arrêtée en silence.',
  'help.updates.missing.heading': 'Si les annonces ne sont pas dans votre liste',
  'help.updates.missing.b0':
    'La page le dira, au-dessus de la liste. Les annonces sont le tableau de la famille et '
    + 's’accordent séparément de vos propres messages : un membre à qui le tableau n’a pas '
    + 'été donné ne voit donc que ce qui lui a été envoyé — voyez [Qui peut faire '
    + 'quoi](/help/who-can-do-what#missing).',
  'help.updates.missing.b1':
    'Ce panneau peut aussi être désactivé entièrement, et dans ce cas Annonces s’ouvre sans '
    + 'lui. Vos propres messages restent dans la cloche, et le tableau reste le panneau '
    + '**Général** ; celui-ci est les deux réunis.',
  // ──── PART 8 — Community (Announcements, Distributions) ───────────────────────
  'help.announcements.title': 'Annonces',
  'help.announcements.summary':
    'Les nouvelles de la famille, l’archive de tout ce qui a été envoyé, ce qu’épingler '
    + 'fait réellement, et qui a bientôt son anniversaire.',
  'help.announcements.reading.heading': 'Le tableau',
  'help.announcements.reading.b0':
    '[Annonces](/community/announcements) comporte trois panneaux. **Général** est le '
    + 'tableau et c’est ce sur quoi l’écran s’ouvre ; **Actualités** est l’archive de tout ce '
    + 'que la famille a annoncé et de tout ce qui vous a été envoyé, traitée dans '
    + '[Actualités](/help/updates#what-it-is) ; **Anniversaires** est à qui écrire ensuite, '
    + 'et c’est la dernière section de ce chapitre.',
  'help.announcements.reading.b1':
    'Le tableau est une pile de publications, de la plus récente à la plus ancienne, '
    + 'chacune montrant qui l’a écrite et quand. Les publications épinglées sont marquées et '
    + 'se placent aussi en haut des Actualités récentes de tout le monde sur le tableau de '
    + 'bord.',
  'help.announcements.reading.b2':
    'Les trois panneaux s’accordent séparément : une famille peut donc distribuer la liste '
    + 'des anniversaires sans distribuer le tableau, ou l’inverse. Un panneau qui n’y est pas '
    + 'est un panneau qu’on ne vous a pas donné — voyez [Qui peut faire '
    + 'quoi](/help/who-can-do-what#missing).',
  'help.announcements.posting.heading': 'Publier',
  'help.announcements.posting.b0.i0': 'Ouvrez le rédacteur en haut du tableau.',
  'help.announcements.posting.b0.i1': 'Donnez-lui un titre et un message.',
  'help.announcements.posting.b0.i2':
    'Choisissez le destinataire — **Toute la famille**, **Région**, ou une seule '
    + '**Section**.',
  'help.announcements.posting.b0.i3': 'Publiez.',
  'help.announcements.posting.b1':
    'Les options de section et de région ne veulent dire quelque chose qu’une fois que '
    + 'votre famille a mis en place des sections. Si elle ne l’a pas fait, tout est pour '
    + 'toute la famille.',
  'help.announcements.posting.b2':
    '**Toutes les personnes concernées reçoivent une notification dans la cloche**, et le '
    + 'tableau se met à jour pour quiconque l’a déjà ouvert : sans rechargement. Un avis de '
    + 'section ne fait sonner la cloche que de cette section, si bien que la cloche et le '
    + 'tableau ne sont jamais en désaccord sur les destinataires d’un avis. Vous n’êtes pas '
    + 'notifié de votre propre avis.',
  'help.announcements.pinning.heading': 'Épingler',
  'help.announcements.pinning.b0':
    '**Il y a une seule épingle, et elle appartient à la famille.** À côté d’elle, sur une '
    + 'publication que la famille a épinglée, chaque membre a un œil — qui masque cette '
    + 'publication du haut de ses propres actualités et ne change rien à ce que voit '
    + 'quiconque d’autre. Deux symboles, car ce sont deux actes différents.',
  'help.announcements.pinning.b1.i0.term': 'Épingler pour tous (une épingle)',
  'help.announcements.pinning.b1.i0.text':
    'Place la publication en haut des actualités de chaque membre. C’est un acte pour toute '
    + 'la famille, et une autorisation distincte de la publication — une famille peut laisser '
    + 'tout le monde publier et laisser une seule personne épingler. On peut lui donner une '
    + 'expiration, ce qui est la bonne façon d’épingler « le rassemblement est dans trois '
    + 'semaines » : elle se décroche d’elle-même. L’épingle est pleine et de la couleur '
    + 'd’accent tant qu’elle est active.',
  'help.announcements.pinning.b1.i1.term': 'Masquer ceci du haut de mes actualités (un œil)',
  'help.announcements.pinning.b1.i1.text':
    'Votre propre copie, et chaque membre l’a. Elle n’apparaît que sur une publication que '
    + 'la famille a épinglée — il n’y a rien à masquer du haut de vos actualités avant que la '
    + 'famille n’y ait mis quelque chose.',
  'help.announcements.pinning.b2':
    'Si vous pouvez faire les deux, prenez garde à celui sur lequel vous appuyez : '
    + 'désépingler pour tous retire la publication du haut des actualités de toute la '
    + 'famille, alors que l’œil ne change rien à ce que voit quiconque d’autre.',
  'help.announcements.dismissing.heading':
    'Masquer une publication épinglée de vos propres actualités',
  'help.announcements.dismissing.b0':
    'Appuyer sur l’œil la retire du haut de *vos* actualités seulement. Elle reste épinglée '
    + 'pour tous les autres, et elle reste sur ce tableau — le tableau est le registre, le '
    + 'tableau de bord est le rappel.',
  'help.announcements.dismissing.b1':
    'Elle ne masque pas la publication. Elle sort du bloc épinglé et retombe dans la liste '
    + 'par ordre de date : vous pouvez donc toujours la retrouver — et la publication le dit '
    + 'en dessous dans les deux cas : **Épinglée pour la famille — elle se place en haut de '
    + 'vos actualités**, ou **Épinglée pour la famille — vous l’avez masquée du haut de vos '
    + 'actualités.**',
  'help.announcements.dismissing.b2':
    '**Les deux écrans sont d’accord.** Masquez-la ici ou sur le tableau de bord et l’autre '
    + 'suit, car les deux lisent la même réponse — l’épingle de la famille restreinte par '
    + 'votre propre masquage. Ce n’était pas vrai avant le 21-08-2026 : ce tableau montrait '
    + 'l’épingle de la famille et le tableau de bord montrait la vôtre, donc une publication '
    + 'que vous aviez masquée restait en haut de l’un et pas de l’autre.',
  'help.announcements.deleting.heading': 'Supprimer',
  'help.announcements.deleting.b0':
    'Supprimer retire la publication pour tout le monde. Selon ce que votre famille a '
    + 'accordé, vous pourrez peut-être supprimer seulement vos propres publications, celles '
    + 'de n’importe qui, ou aucune.',
  'help.announcements.birthdays.heading': 'Anniversaires',
  'help.announcements.birthdays.b0':
    'Le panneau **Anniversaires** est chaque proche dont l’anniversaire tombe dans les 60 '
    + 'prochains jours, du plus proche au plus lointain. C’est une liste sur laquelle agir '
    + 'plutôt qu’un relevé : **rien n’est envoyé automatiquement**, et écrire le message '
    + 'reste le travail de quelqu’un — c’est pourquoi elle se trouve à un clic du rédacteur.',
  'help.announcements.birthdays.b1.i0.term': 'Nom',
  'help.announcements.birthdays.b1.i0.text':
    'De qui il s’agit. **Chercher par nom** restreint la liste, en ignorant les accents et '
    + 'la ponctuation comme le fait le Répertoire — saisir « jose » trouve José.',
  'help.announcements.birthdays.b1.i1.term': 'Date',
  'help.announcements.birthdays.b1.i1.text': 'Le jour où il tombe cette fois-ci.',
  'help.announcements.birthdays.b1.i2.term': 'Jour',
  'help.announcements.birthdays.b1.i2.text':
    'Le jour de la semaine. Il est là parce qu’une carte se poste et un appel se passe en '
    + 'fonction d’un week-end plutôt que du 14.',
  'help.announcements.birthdays.b1.i3.term': 'Décompte',
  'help.announcements.birthdays.b1.i3.text':
    '**Aujourd’hui**, **Demain**, ou dans combien de jours. Aujourd’hui est signalé, car '
    + 'c’est la seule ligne pour laquelle la liste existe et, en texte simple, elle se lit '
    + 'comme n’importe quelle autre.',
  'help.announcements.birthdays.b1.i4.term': 'Atteint',
  'help.announcements.birthdays.b1.i4.text': 'L’âge qu’il atteint ce jour-là.',
  'help.announcements.birthdays.b2':
    'Chaque personne que la famille a approuvée y figure, qu’elle ait un compte ou non : un '
    + 'grand-oncle inscrit sur l’[arbre généalogique](/community/family-tree) a donc un '
    + 'anniversaire comme n’importe qui. Quelqu’un enregistré comme décédé n’y figure pas, et '
    + 'personne dont le profil n’a pas de date de naissance non plus — un anniversaire dont '
    + 'personne n’a parlé au produit n’est pas un anniversaire qu’il devinera. La ligne sous '
    + 'le tableau dit combien de lignes il y a, et combien d’entre elles une recherche '
    + 'masque.',
  'help.announcements.birthdays.b3':
    'Un âge est omis — un tiret, et une ligne sous le tableau le disant — là où l’année '
    + 'enregistrée est une année à laquelle le produit ne se fie pas, ce qui aujourd’hui veut '
    + 'dire une année qui n’est pas encore arrivée : 1962 saisi comme 2062. Le jour et le '
    + 'mois s’affichent tout de même, car un dérapage de quatre chiffres est un dérapage sur '
    + 'l’année. Corrigez **Date de naissance** sur le [profil](/personal-info) de cette '
    + 'personne et l’âge apparaît.',
  'help.announcements.birthdays.b4':
    'Quelqu’un né le 29 février est listé le 28 février dans une année sans jour bissextile '
    + ': il ne disparaît donc jamais de la liste trois années de suite. L’âge se compte '
    + 'toujours en années entières : aucune n’est sautée.',
  'help.announcements.birthdays.b5':
    'Rien sur ce panneau ne peut être modifié et rien de lui n’est conservé. Chaque date '
    + 'est lue depuis **Date de naissance** sur le profil de la personne à chaque ouverture '
    + 'du panneau : c’est donc le seul endroit où en corriger une.',
  'help.distributions.title': 'Envois',
  'help.distributions.summary':
    'Envoyer un courriel à toute la famille d’un coup, sans aucune liste à tenir à jour.',
  'help.distributions.what-it-is.heading': 'Ce que c’est',
  'help.distributions.what-it-is.b0':
    'Un envoi est un courriel adressé à toute la famille, ou à tout le monde dans une '
    + 'région ou une section. Vous écrivez un objet et un message, choisissez à qui cela va, '
    + 'et appuyez sur envoyer.',
  'help.distributions.what-it-is.b1':
    'La différence entre ceci et les [Annonces](/community/announcements) est là où le '
    + 'message atterrit. Une annonce attend sur le tableau de bord de chacun jusqu’à ce qu’il '
    + 'regarde ; un envoi arrive dans sa boîte de réception. Utilisez une annonce pour les '
    + 'nouvelles de la famille, et un envoi pour ce qui doit être lu cette semaine.',
  'help.distributions.what-it-is.b2':
    'Il n’y a aucune liste à construire et rien à tenir à jour. Les personnes qui le '
    + 'reçoivent sont lues depuis les adhésions à chaque envoi : un proche qui s’est joint '
    + 'hier y est donc, et un proche qui n’a jamais été dans la famille n’y est jamais.',
  'help.distributions.what-it-is.b3':
    'Il n’y a pas de brouillon. Un envoi part dès que vous l’envoyez, et il ne peut pas '
    + 'être annulé — relisez-le donc en entier avant d’appuyer sur le bouton.',
  'help.distributions.who-gets-it.heading': 'Choisir qui le reçoit',
  'help.distributions.who-gets-it.b0':
    'La liste **À qui cela va** propose toute la famille, puis chacune de vos régions, puis '
    + 'chacune de vos sections. Chaque option porte le nombre de proches qu’elle atteint : '
    + 'vous pouvez donc vérifier le destinataire contre ce que vous vouliez avant que rien ne '
    + 'soit envoyé.',
  'help.distributions.who-gets-it.b1':
    'Une région atteint les proches des sections de cette région, et personne d’autre. Ce '
    + 'n’est pas la même chose qu’une annonce régionale, que tout le monde voit — le courrier '
    + 'ne peut pas être reprise, donc un destinataire ici veut dire exactement ce qu’il dit.',
  'help.distributions.who-gets-it.b2.i0':
    'Un proche qui n’est dans aucune section n’est dans aucune région : un envoi régional '
    + 'ne l’atteint donc pas. Il est tout de même atteint par « Toute la famille ».',
  'help.distributions.who-gets-it.b2.i1':
    'Seuls les membres approuvés reçoivent jamais un courriel. Quelqu’un qui attend encore '
    + 'd’être admis n’est sur aucun envoi.',
  'help.distributions.who-gets-it.b2.i2':
    'Personne ne reçoit deux copies. Là où un couple partage une adresse courriel, le '
    + 'message part une fois, et le second proche est listé comme partageant une adresse.',
  'help.distributions.who-gets-it.b3':
    'La ligne sous le sélecteur dit à combien de personnes le courriel partira réellement, '
    + 'ce qui peut être moins que le nombre entre parenthèses — voyez ci-dessous.',
  'help.distributions.no-email-address.heading': 'Proches sans adresse courriel',
  'help.distributions.no-email-address.b0':
    'Quelqu’un inscrit sur l’[Arbre généalogique](/community/family-tree) qui n’a jamais eu '
    + 'de compte n’a pas d’adresse courriel propre. GENORRA lui donne une adresse de '
    + 'remplacement pour que la fiche fonctionne, et cette adresse ne mène nulle part.',
  'help.distributions.no-email-address.b1':
    'Ces proches sont comptés dans le destinataire et ne reçoivent jamais de courriel. Le '
    + 'sélecteur comme le rapport de livraison disent combien il y en a, avec les mots '
    + '**Aucune adresse courriel enregistrée** — ce qui n’est pas un échec de livraison et '
    + 'n’est rien à relancer. Si vous voulez les inclure, invitez-les depuis l’arbre '
    + 'généalogique, ou transmettez le message vous-même.',
  'help.distributions.sending.heading': 'Pendant l’envoi',
  'help.distributions.sending.b0':
    'Un envoi vers une grande famille part par lots : l’écran montre donc sa progression — '
    + '**Envoi en cours — 24 sur 118 livrés**. Cela continue tant que la page est ouverte.',
  'help.distributions.sending.b1':
    'Vous pouvez quitter la page. L’envoi reprend là où il en était, et la liste montre ce '
    + 'qui reste en suspens à votre retour. Rien n’est envoyé deux fois, quel que soit le '
    + 'nombre de fois où la page est réouverte.',
  'help.distributions.sending.b2':
    '**Arrêter** met fin à un envoi en cours. Tout ce qui a déjà été envoyé est parti et ne '
    + 'peut pas être rappelé ; le reste n’est pas envoyé, et le rapport indique **Arrêté** '
    + 'avec les deux chiffres. Quiconque peut envoyer peut arrêter un envoi, y compris celui '
    + 'de quelqu’un d’autre.',
  'help.distributions.what-happened.heading': 'Ce qui est arrivé à chaque message',
  'help.distributions.what-happened.b0':
    'Appuyer sur l’objet ouvre le message envoyé et la liste de tous ceux à qui il est '
    + 'allé, avec une ligne pour chacun :',
  'help.distributions.what-happened.b1.i0.term': 'Envoyé',
  'help.distributions.what-happened.b1.i0.text':
    'Le message a été remis au fournisseur de courriel de cette adresse.',
  'help.distributions.what-happened.b1.i1.term': 'N’a pas pu être livré',
  'help.distributions.what-happened.b1.i1.text':
    'Quelque chose a mal tourné. **Réessayer** les remet dans la file et fait une nouvelle '
    + 'tentative — un problème temporaire se résout généralement.',
  'help.distributions.what-happened.b1.i2.term': 'Aucune adresse courriel enregistrée',
  'help.distributions.what-happened.b1.i2.text':
    'Un proche de l’arbre généalogique sans adresse. Rien n’a mal tourné et il n’y a rien à '
    + 'réessayer.',
  'help.distributions.what-happened.b1.i3.term': 'Partage une adresse',
  'help.distributions.what-happened.b1.i3.text':
    'Un autre proche a la même adresse courriel et a reçu le message.',
  'help.distributions.what-happened.b1.i4.term': 'Non envoyé — arrêté',
  'help.distributions.what-happened.b1.i4.text': 'L’envoi a été arrêté avant de l’atteindre.',
  'help.distributions.what-happened.b2':
    'L’écran ne dit jamais qu’un message a été envoyé quand il ne l’a pas été. Si le '
    + 'rapport dit « 8 envoyés, 2 n’ont pas pu être livrés », c’est ce qui est arrivé — cela '
    + 'vaut donc la peine d’y jeter un œil après avoir envoyé quelque chose d’important.',
  'help.distributions.what-happened.b3':
    '« Envoyé » signifie que le message a quitté GENORRA. Cela ne peut pas vous dire si '
    + 'quelqu’un l’a ouvert, ni si son fournisseur de courriel l’a classé comme indésirable.',
  'help.distributions.replies.heading': 'Les réponses, et à quoi le message ressemble',
  'help.distributions.replies.b0':
    'Le message arrive de GENORRA, avec votre nom dessus, et une réponse va à **votre '
    + 'propre adresse courriel** plutôt qu’à nous. Un proche qui répond à un envoi vous écrit '
    + 'donc, ce qui est presque toujours ce qu’il veut faire.',
  'help.distributions.replies.b1':
    'Le message est en texte simple. Laissez une ligne vide entre les paragraphes et ils '
    + 'arrivent comme des paragraphes ; il n’y a pas de mise en forme, pas de pièces jointes '
    + 'et aucun lien ajouté pour vous. Pour partager un document, mettez-le dans '
    + '[Documents](/library/documents) et dites où il est.',
  'help.distributions.replies.b2':
    'Chaque message dit en bas de quelle famille il venait et qui l’a envoyé : personne n’a '
    + 'donc à deviner. Il n’y a pas de lien de désinscription — ceci est votre famille qui '
    + 'écrit à ses propres membres, non une liste de diffusion.',
  'help.distributions.who-can.heading': 'Qui peut l’utiliser',
  'help.distributions.who-can.b0':
    'Envois est désactivé pour tout le monde jusqu’à ce qu’un administrateur l’accorde, et '
    + 'il s’accorde séparément des Annonces — pouvoir publier sur le tableau ne permet pas '
    + 'd’envoyer un courriel à toute la famille. Voyez [Qui peut faire '
    + 'quoi](/help/who-can-do-what).',
  'help.distributions.who-can.b1':
    'Il y a trois autorisations distinctes. **Voir** montre le relevé de ce qui a été '
    + 'envoyé. **Créer** est ce qui permet à quelqu’un d’en écrire et d’en envoyer un, et '
    + 'd’arrêter un envoi. **Supprimer** retire le relevé d’un envoi, ce qui est plus lourd à '
    + 'pouvoir faire — c’est la seule copie de qui a été contacté et de ce qui est arrivé à '
    + 'chaque message.',
  'help.distributions.who-can.b2':
    'Supprimer le relevé n’annule aucun envoi. Un envoi qui n’est pas terminé doit d’abord '
    + 'être arrêté.',
  // ──── PART 8 — Community (Safety Check-Ins) ───────────────────────────────────
  'help.safety-check-ins.title': 'Demandes de sécurité',
  'help.safety-check-ins.summary':
    'Demander aux proches d’un secteur s’ils sont en sécurité, et voir qui a répondu.',
  'help.safety-check-ins.what-it-is.heading': 'Ce que c’est',
  'help.safety-check-ins.what-it-is.b0':
    'Une tempête, un incendie, une inondation. Quelqu’un lance une demande adressée aux '
    + 'proches susceptibles d’être touchés, et il est posé à chacun d’eux une seule question '
    + '— êtes-vous en sécurité ? Ils répondent d’une pression, et la personne qui l’a lancée '
    + 'voit les réponses arriver.',
  'help.safety-check-ins.what-it-is.b1':
    'L’intérêt de l’écran, ce sont les personnes qui n’ont **pas** répondu. Tout le reste '
    + 'sur lui existe pour raccourcir cette liste.',
  'help.safety-check-ins.what-it-is.b2':
    'Rien sur cet écran ne surveille la météo. GENORRA ne sait pas ce qui se passe près de '
    + 'vos proches et ne le prétend jamais — une demande est une personne qui demande, avec '
    + 'ses propres mots, et elle dit qui a demandé.',
  'help.safety-check-ins.raising.heading': 'En lancer une',
  'help.safety-check-ins.raising.b0':
    'Appuyez sur **Lancer une demande**. Il vous faut trois choses, et seules les deux '
    + 'premières sont obligatoires.',
  'help.safety-check-ins.raising.b1.i0':
    'Dites ce qui se passe — « Ouragan Delia ». Cela devient l’objet du courriel que vos '
    + 'proches reçoivent : mettez donc quelque chose qu’ils reconnaîtront dans une boîte '
    + 'encombrée.',
  'help.safety-check-ins.raising.b1.i1':
    'Ajoutez tout ce qui vaut la peine de leur être dit : où aller, qui appeler, ce que '
    + 'vous savez. Facultatif.',
  'help.safety-check-ins.raising.b1.i2': 'Choisissez à qui demander.',
  'help.safety-check-ins.raising.b2':
    'Puis appuyez sur **Leur demander**. Il n’y a pas d’étape de confirmation — la boîte '
    + 'au-dessus du bouton dit déjà exactement combien de proches cela atteint, et c’est cela '
    + 'qui vaut la peine d’être vérifié.',
  'help.safety-check-ins.who-to-ask.heading': 'Choisir à qui demander',
  'help.safety-check-ins.who-to-ask.b0':
    'Quatre sortes de destinataires, et chacune montre combien de proches elle atteint '
    + 'avant que vous n’envoyiez.',
  'help.safety-check-ins.who-to-ask.b1.i0.term': 'Toute la famille',
  'help.safety-check-ins.who-to-ask.b1.i0.text': 'Chaque membre approuvé.',
  'help.safety-check-ins.who-to-ask.b1.i1.term': 'Une région',
  'help.safety-check-ins.who-to-ask.b1.i1.text':
    'Tout le monde dans les sections qui composent cette région.',
  'help.safety-check-ins.who-to-ask.b1.i2.term': 'Une section',
  'help.safety-check-ins.who-to-ask.b1.i2.text':
    'Tout le monde enregistré comme étant dans cette section.',
  'help.safety-check-ins.who-to-ask.b1.i3.term': 'Seulement les proches que je nomme',
  'help.safety-check-ins.who-to-ask.b1.i3.text':
    'Une liste que vous choisissez à la main, avec un champ de recherche. C’est celle à '
    + 'utiliser lorsque les sections de la famille ne correspondent pas à l’endroit où le '
    + 'problème se trouve réellement.',
  'help.safety-check-ins.who-to-ask.b2':
    'Un proche qui n’a pas dit à la famille dans quelle section il est n’est dans aucune '
    + 'région non plus : une demande régionale ne l’atteint donc pas. C’est délibéré — le '
    + 'produit ne devine pas où quelqu’un habite. Utilisez **Seulement les proches que je '
    + 'nomme** pour l’inclure.',
  'help.safety-check-ins.who-to-ask.b3':
    'Une section est la façon dont votre famille s’est organisée. Une tempête ne la suit '
    + 'pas, et le proche qui a déménagé l’an dernier est précisément celui qu’un destinataire '
    + 'organisé laisse discrètement de côté — la liste choisie à la main est là exactement '
    + 'pour cette personne.',
  'help.safety-check-ins.answering.heading': 'Y répondre',
  'help.safety-check-ins.answering.b0':
    'Si votre famille demande après vous, c’est la première chose sur votre [Tableau de '
    + 'bord](/dashboard) et la première chose sur cet écran. Deux boutons : **Je suis en '
    + 'sécurité** et **J’ai besoin d’aide**. L’un ou l’autre est enregistré aussitôt — il n’y '
    + 'a rien à confirmer et rien à saisir.',
  'help.safety-check-ins.answering.b1':
    'Ensuite vous pouvez ajouter une note — où vous êtes, ce dont vous avez besoin — et '
    + 'vous pouvez changer votre réponse autant de fois que vous voulez tant que la demande '
    + 'est ouverte. Dire que vous avez besoin d’aide puis dire que vous êtes en sécurité est '
    + 'exactement ce à quoi ceci sert.',
  'help.safety-check-ins.answering.b2':
    'Répondre ne demande aucune autorisation, et aucun forfait. Même si votre famille a '
    + 'désactivé cet écran pour vous — ou est passée à un forfait qui ne l’inclut plus — la '
    + 'demande apparaît toujours sur votre Tableau de bord et vous pouvez toujours y '
    + 'répondre.',
  'help.safety-check-ins.the-roster.heading': 'Lire les réponses',
  'help.safety-check-ins.the-roster.b0':
    '**Voir à qui il a été demandé** ouvre la liste. Chacun est dans l’un de quatre états, '
    + 'et la liste est ordonnée selon celui qui requiert l’attention en premier.',
  'help.safety-check-ins.the-roster.b1.i0.term': 'A besoin d’aide',
  'help.safety-check-ins.the-roster.b1.i0.text': 'Il l’a dit. Toujours en haut.',
  'help.safety-check-ins.the-roster.b1.i1.term': 'Non atteint',
  'help.safety-check-ins.the-roster.b1.i1.text':
    'Soit il n’a pas d’adresse courriel enregistrée, soit le courriel n’est pas passé. '
    + 'Ceux-là ont besoin d’une personne, non d’une nouvelle tentative.',
  'help.safety-check-ins.the-roster.b1.i2.term': 'En attente',
  'help.safety-check-ins.the-roster.b1.i2.text':
    'Il lui a été demandé et il n’a pas encore répondu. C’est le nombre à ramener à zéro.',
  'help.safety-check-ins.the-roster.b1.i3.term': 'En sécurité',
  'help.safety-check-ins.the-roster.b1.i3.text': 'Il l’a dit.',
  'help.safety-check-ins.the-roster.b2':
    '**Non atteint** et **En attente** sont délibérément différents. Quelqu’un à qui il a '
    + 'été demandé et qui n’a rien dit est peut-être simplement occupé ; quelqu’un sans '
    + 'adresse courriel enregistrée n’a jamais été interrogé du tout, et aucune attente n’y '
    + 'changera rien. L’écran dit lequel est lequel, et combien il y en a.',
  'help.safety-check-ins.the-roster.b3':
    'Là où un courriel a réellement échoué — une vraie adresse qui a rebondi — **Réessayer '
    + 'ceux qui ont échoué** renvoie à ceux-là seuls. Cela ne touche pas les proches qui '
    + 'n’ont pas d’adresse, car il n’y a rien à quoi envoyer.',
  'help.safety-check-ins.reaching-people.heading': 'Ce que ceci peut promettre et ne peut pas',
  'help.safety-check-ins.reaching-people.b0':
    'Que ceci soit clair, car cela importe plus ici que partout ailleurs dans le produit : '
    + '**une demande est un courriel et une notification, et aucun des deux n’est une '
    + 'garantie.**',
  'help.safety-check-ins.reaching-people.b1.i0':
    'Le courriel va à l’adresse du profil de chaque proche. Si cette adresse est erronée, '
    + 'périmée, ou une adresse de remplacement générée par la famille, il n’est pas interrogé '
    + '— et l’écran le dit plutôt que de le compter comme silencieux.',
  'help.safety-check-ins.reaching-people.b1.i1':
    'La notification n’atteint que quelqu’un qui a le produit ouvert.',
  'help.safety-check-ins.reaching-people.b1.i2':
    'Rien ici n’envoie de texto ni ne fait sonner un téléphone.',
  'help.safety-check-ins.reaching-people.b2':
    'L’écran ne dit donc jamais que tout le monde a été interrogé. Il dit combien l’ont '
    + 'été, combien n’ont pas pu l’être, et pourquoi — et les proches que personne n’a pu '
    + 'atteindre sont nommés comme un travail à faire par une personne.',
  'help.safety-check-ins.closing.heading': 'En clore une',
  'help.safety-check-ins.closing.b0':
    '**Clore la demande** met fin à la mobilisation. Cela arrête toute nouvelle demande à '
    + 'partir et retire le bandeau du Tableau de bord de tout le monde.',
  'help.safety-check-ins.closing.b1':
    'Clore ne détruit rien. Chaque réponse, et chaque proche que personne n’a pu atteindre, '
    + 'reste au dossier exactement comme elle était — une demande close est toujours le '
    + 'compte rendu de ce que la famille a demandé et de ce qui est revenu.',
  'help.safety-check-ins.closing.b2':
    '**Supprimer** la détruit bel et bien, et c’est une autorisation distincte pour cette '
    + 'raison. Il n’y a pas d’autre copie de qui a répondu.',
  'help.safety-check-ins.who-can.heading': 'Qui peut faire quoi',
  'help.safety-check-ins.who-can.b0':
    'Lancer une demande réveille beaucoup de monde d’un coup : c’est donc accordé plutôt '
    + 'que supposé. Il y a trois autorisations distinctes.',
  'help.safety-check-ins.who-can.b1.i0.term': 'Voir',
  'help.safety-check-ins.who-can.b1.i0.text':
    'Lire les demandes et, au réglage le plus large, la liste complète de qui a répondu.',
  'help.safety-check-ins.who-can.b1.i1.term': 'Créer',
  'help.safety-check-ins.who-can.b1.i1.text':
    'Lancer une demande, interroger le reste d’une file, et en clore une. Qui peut donner '
    + 'l’alerte peut aussi sonner la fin de l’alerte.',
  'help.safety-check-ins.who-can.b1.i2.term': 'Supprimer',
  'help.safety-check-ins.who-can.b1.i2.text':
    'Retirer le relevé entièrement. Plus lourd que les deux autres, car cela détruit le '
    + 'seul compte rendu de qui n’a jamais été atteint.',
  'help.safety-check-ins.who-can.b2':
    'Par défaut un membre ordinaire peut ouvrir cet écran, voir les demandes qu’il a '
    + 'lancées, et répondre à tout ce dont on lui a demandé — mais pas la liste de qui '
    + 'd’autre a répondu. Cette liste est un ensemble de proches avec leur situation et leur '
    + 'joignabilité à côté, et elle reste entre les mains des personnes à qui la famille l’a '
    + 'donnée. Voyez [Qui peut faire quoi](/help/who-can-do-what).',
  // ──── PART 8 — Community (Family Tree) ────────────────────────────────────────
  'help.family-tree.title': 'Arbre généalogique',
  'help.family-tree.summary':
    'Un arbre pour toute la famille — comment le lire, y ajouter, et le corriger.',
  'help.family-tree.how-it-reads.heading': 'Comment le canevas se lit',
  'help.family-tree.how-it-reads.b0':
    'L’arbre dessine les générations autour d’une personne, la plus ancienne en haut : ses '
    + 'ancêtres, puis cette personne et son conjoint, puis ses descendants. Chaque bande est '
    + 'étiquetée — **Grands-parents**, **Enfants**, **Arrière-petits-enfants** — et au-delà '
    + 'd’arrière- elle compte, de sorte que cinq générations plus bas se lit '
    + '**Arrière-petits-enfants au 3e degré** plutôt qu’une file d’« arrière » que personne '
    + 'ne peut totaliser. Les frères et sœurs sont listés en dessous plutôt que dessinés dans '
    + 'la rangée, car ils partagent la génération de la personne au centre et '
    + 'l’encombreraient.',
  'help.family-tree.how-it-reads.b1':
    '**Sa profondeur dépend du mode.** En lecture, vous avez trois générations au-dessus et '
    + 'cinq en dessous. En modification cela se réduit à deux au-dessus et une en dessous — '
    + 'les générations de part et d’autre de la personne sur laquelle vous travaillez — car '
    + 'chaque bande supplémentaire est une rangée de plus de cartes **+** pour des proches '
    + 'que vous n’ajoutez pas en ce moment.',
  'help.family-tree.how-it-reads.b2':
    'Une génération très nombreuse s’arrête à vingt-quatre cartes et dit combien il en '
    + 'reste. Personne n’est perdu : **Tout le monde dans cette famille**, sous le canevas, '
    + 'énumère la liste entière et chaque nom recentre l’arbre.',
  'help.family-tree.how-it-reads.b3':
    'Il s’ouvre sur vous. Si vous êtes entré par mariage et n’avez ni parents ni enfants '
    + 'enregistrés, il s’ouvre plutôt sur le proche auquel vous êtes rattaché et le dit, avec '
    + 'un lien **Centrer sur moi**.',
  'help.family-tree.how-it-reads.b4':
    'Là où quelqu’un a plus d’un mariage, chaque carte de conjoint porte le mot qui '
    + 'convient — **Épouse**, **Ex-épouse**, **Partenaire** — et les enfants en dessous sont '
    + 'répartis en un panneau par mariage, plus **Autres enfants** pour ceux dont l’autre '
    + 'parent n’en est aucun. La répartition vient des liens de parenté que les enfants '
    + 'portent déjà ; rien n’est deviné.',
  'help.family-tree.moving.heading': 'Se déplacer',
  'help.family-tree.moving.b0':
    'Cliquez sur n’importe qui pour recentrer l’arbre sur cette personne. Ses '
    + 'grands-parents, parents, conjoint et enfants sont alors dessinés autour d’elle, et '
    + 'vous continuez de là.',
  'help.family-tree.moving.b1':
    'Sous le canevas, **Tout le monde dans cette famille** énumère la liste entière. Chaque '
    + 'nom recentre l’arbre : personne n’est donc jamais à plus d’un clic. **Pas encore sur '
    + 'l’arbre** est une liste différente — ce sont les personnes reliées à personne, ce qui '
    + 'est du travail à faire.',
  'help.family-tree.view-vs-edit.heading': 'Voir et Modifier',
  'help.family-tree.view-vs-edit.b0':
    'L’arbre s’ouvre en **Voir**. Passer à **Modifier** active les boutons **+**, l’éditeur '
    + 'de fiches et les commandes de retrait. Chaque membre commence en pouvant modifier, car '
    + 'bâtir l’arbre de la famille est quelque chose que la famille fait ensemble — mais '
    + 'c’est désormais une autorisation comme une autre, et vos administrateurs peuvent la '
    + 'restreindre depuis [Membres](/admin/members). Si l’interrupteur **Modifier** n’y est '
    + 'pas, c’est pourquoi.',
  'help.family-tree.view-vs-edit.b1':
    'Cliquer sur une carte ouvre le panneau où la fiche de cette personne et ses liens se '
    + 'gèrent. **Ce panneau suit votre autorisation du Répertoire, non celle de l’arbre** — '
    + 'une famille qui a restreint le [Répertoire des membres](/community/directory) a dit '
    + 'que la liste n’est pas pour tout le monde, et le panneau est là où une fiche se lit '
    + 'une personne à la fois. Le canevas lui-même dessine toujours chaque nom et montre '
    + 'comment tout le monde se rattache.',
  'help.family-tree.view-vs-edit.b2':
    '**Modifier** change aussi la portion de l’arbre qui est dessinée, et c’est '
    + 'délibéré. **Voir** affiche trois générations vers le haut et cinq vers le bas, ce qui '
    + 'vous permet de suivre une longue lignée depuis une seule fiche. **Modifier** en '
    + 'affiche deux vers le haut et une vers le bas — chaque case qui revient à la personne '
    + 'au centre, et rien de plus, car chaque bande supplémentaire est une rangée de plus de '
    + 'boutons **+** pour des proches que vous n’êtes pas en train de placer. Si le plan se '
    + 'raccourcit quand vous appuyez sur **Modifier**, c’est cela, et non un problème.',
  'help.family-tree.view-vs-edit.b3':
    'Rien sur l’arbre ne retire personne de la famille. Retirer un lien retire le *lien* '
    + 'entre deux personnes, non l’une ou l’autre.',
  'help.family-tree.adding.heading': 'Ajouter un proche',
  'help.family-tree.adding.b0.i0':
    'Passez en **Modifier** et centrez sur la personne à laquelle vous ajoutez.',
  'help.family-tree.adding.b0.i1':
    'Appuyez sur le **+** du lien — **Père**, **Mère**, **Mari**, **Épouse**, '
    + '**Partenaire**, **Fils**, **Fille**, **Frère** ou **Sœur**.',
  'help.family-tree.adding.b0.i2': 'Donnez son nom.',
  'help.family-tree.adding.b0.i3': 'Dites s’il a une adresse courriel.',
  'help.family-tree.adding.b1':
    'S’il en a une, il reçoit une vraie invitation et rejoint la file d’approbation '
    + 'lorsqu’il l’accepte. S’il n’en a pas, il vous est demandé un bref motif dans vos '
    + 'propres mots — « décédé en 1998 », « trop jeune pour un compte », « téléphone '
    + 'seulement » — et la fiche est créée sans adresse.',
  'help.family-tree.adding.b2':
    '**Ajouter un enfant sans courriel demande sa date de naissance, et cela ne passe pas '
    + 'sans elle.** Une famille peut fixer un âge auquel ses cotisations commencent, et une '
    + 'fiche sans date de naissance est traitée comme adulte partout dans le produit — un '
    + 'enfant saisi sans elle serait donc facturé dès le jour où vous l’avez ajouté. Tout '
    + 'autre proche peut être enregistré avec ou sans date de naissance.',
  'help.family-tree.adding.b3':
    'Les grands-parents ont leurs propres cartes **+** dans la rangée du haut, une paire '
    + 'par parent, nommées selon à qui ils appartiennent — **Ajouter le père de Martha**. '
    + 'Elles pendent d’un parent plutôt que de la personne au centre, car un grand-parent est '
    + 'la mère ou le père de quelqu’un et l’arbre n’a aucune autre façon de dire de quel côté '
    + 'il est. Enregistrez d’abord un parent et les emplacements apparaissent.',
  'help.family-tree.adding.b4':
    'Un mariage antérieur s’enregistre en ajoutant le conjoint puis en renommant le lien en '
    + '**Ex-mari**, **Ex-épouse** ou **Ex-partenaire** dans la boîte de gestion. Un ex est '
    + 'dessiné à côté de la personne exactement là où va un conjoint actuel, et c’est '
    + 'délibéré — c’est souvent de là que la moitié des enfants sont venus.',
  'help.family-tree.adding.b5':
    'Chaque lien est enregistré des deux côtés : ajouter votre mère lui donne donc aussi un '
    + 'enfant, qui est vous. Chaque personne peut porter plus d’un mariage ; le **+** d’un '
    + 'conjoint reste disponible après le premier.',
  'help.family-tree.records.heading': 'Fiches et comptes',
  'help.family-tree.records.b0':
    'Il n’y a qu’une sorte de personne sur l’arbre. Certaines ont un compte et d’autres '
    + 'non, et c’est toute la différence.',
  'help.family-tree.records.b1.i0.term': 'Fiche seulement',
  'help.family-tree.records.b1.i0.text':
    'Quelqu’un saisi par un proche, sans adresse courriel. Une grand-mère, un enfant, un '
    + 'grand-oncle décédé en 1998. Tout membre approuvé peut corriger ses informations.',
  'help.family-tree.records.b1.i1.term': 'Invité',
  'help.family-tree.records.b1.i1.text':
    'Invité mais pas encore admis — il est dans la file d’approbation.',
  'help.family-tree.records.b1.i2.term': 'Un membre',
  'help.family-tree.records.b1.i2.text':
    'Il a un compte. Lui seul peut changer son propre nom et ses coordonnées, depuis [Mon '
    + 'profil](/personal-info).',
  'help.family-tree.records.b2':
    'Une fiche cesse d’être une fiche le jour où quelqu’un l’invite, ce qui est la commande '
    + '**Inviter** de l’éditeur de fiches. Il n’y a pas d’étape séparée « convertir en adulte '
    + '» — un enfant qui obtient une adresse courriel est simplement invité comme n’importe '
    + 'qui.',
  'help.family-tree.blood.heading': 'Qui fait partie de la lignée',
  'help.family-tree.blood.b0':
    'Une case à cocher par personne : **fait partie de la lignée de la famille**, ou non. '
    + 'Elle est sur la PERSONNE et non sur l’une de ses relations, et c’est quelque chose '
    + 'que votre famille déclare, pas quelque chose que le produit déduit.',
  'help.family-tree.blood.b1':
    'Cochez-la pour un parent par le sang. Laissez-la décochée pour quelqu’un qui a '
    + 'épousé un membre de la famille, et pour un parent par alliance, adoptif ou '
    + 'd’accueil. La boîte de dialogue le demande lorsque vous ajoutez un nouveau parent ; '
    + 'ensuite, ouvrez la fiche de n’importe qui et cochez-la là. C’est enregistré dès que '
    + 'vous cochez.',
  'help.family-tree.blood.b2':
    'Cela décide deux choses, et la seconde est de l’argent : qui apparaît sous '
    + '**Lignée** dans l’arbre, et qui doit une cotisation réglée sur **Lignée '
    + 'uniquement**. Si un parent dont vous attendez qu’il doive une cotisation de lignée '
    + 'ne la doit pas, c’est la première chose à vérifier.',
  'help.family-tree.blood.b3':
    '**Personne n’est coché au départ.** C’est délibéré et non un oubli : une cotisation '
    + 'réservée à la lignée est due par les personnes cochées, donc une famille qui n’a '
    + 'touché à rien ne facture personne au lieu de facturer un parent qui a épousé un '
    + 'membre de la famille.',
  'help.family-tree.blood.b4':
    '**C’étaient auparavant quatre mots sur la relation** — sang, alliance, adoption ou '
    + 'accueil — et la lignée était calculée en remontant ces relations depuis un ancêtre '
    + 'nommé. Cela n’existe plus. Le parcours avait raison sur le graphe et continuait '
    + 'd’avoir tort sur la famille : dans une famille créée par un fils, il remontait par '
    + 'sa mère, si bien que l’ancienne épouse de son père revenait comme parente par le '
    + 'sang, et le seul levier disponible était de marquer une véritable mère comme '
    + 'belle-mère — ce qui rendait l’arbre faux à son sujet et au sujet de chaque parent à '
    + 'elle ajouté ensuite.',
  'help.family-tree.blood.b5':
    'Une chose a vraiment disparu avec cela : l’arbre n’imprime plus **Beau-fils** ni '
    + '**Fille adoptive** sur une fiche. Une relation est un lien et un nom ; la manière '
    + 'dont quelqu’un est entré dans la famille ne s’imprime pas sur son visage.',
  'help.family-tree.bloodline.heading': 'L’interrupteur Lignée',
  'help.family-tree.bloodline.b0':
    '**Famille entière** montre tout le monde. **Lignée** ne montre que les personnes '
    + 'cochées comme faisant partie de la lignée de la famille, et masque les autres.',
  'help.family-tree.bloodline.b1':
    'C’est une seule réponse pour toute la famille, non une par lecteur : deux membres ne '
    + 'peuvent pas être en désaccord sur qui fait partie de la lignée de la famille. '
    + 'Quiconque peut modifier l’arbre peut changer une case, et cela change ce que voit '
    + 'chaque membre.',
  'help.family-tree.bloodline.b2':
    'Le sélecteur n’apparaît que lorsque votre famille a coché CERTAINS de ses parents et '
    + 'pas tous. Sans personne de coché il masquerait toute la famille, et avec tout le '
    + 'monde coché il ne ferait rien — il n’est donc pas proposé dans l’un ni l’autre cas.',
  'help.family-tree.bloodline.b3':
    'Un parent non coché est MASQUÉ par le sélecteur, non absent de l’arbre. Revenez à '
    + '**Famille entière** et il est là ; la case décide de ce que montre cette vue, et de '
    + 'rien d’autre concernant sa fiche.',
  'help.family-tree.bloodline.b4':
    '**Un parent qui devrait y être et n’y est pas n’a simplement pas encore été coché.** '
    + 'Ouvrez sa fiche et cochez-la. Il n’y a rien à déduire et rien d’autre qui puisse '
    + 'être faux — ce qui n’était pas vrai du réglage auquel ceci succède : là, quelqu’un '
    + 'apparaissant à tort comme parent par le sang était un problème de l’ancêtre depuis '
    + 'lequel le parcours commençait, non d’une relation que vous pouviez voir.',
  'help.family-tree.bloodline.b5':
    'Une cotisation réglée sur **Lignée uniquement** est due par exactement les personnes '
    + 'cochées ici, donc cet écran et ce chiffre ne peuvent pas être en désaccord.',
  'help.family-tree.fixing.heading': 'Corriger une erreur',
  'help.family-tree.fixing.b0.i0':
    'Mauvaise relation : ouvrez la boîte de dialogue de gestion de la relation. Un '
    + 'mariage peut y être renommé, **Mari** en **Ex-mari**. Le fait que quelqu’un fasse '
    + 'partie de la lignée est une case sur sa propre fiche, dans la même boîte de '
    + 'dialogue.',
  'help.family-tree.fixing.b0.i1':
    'Informations erronées sur une fiche — la commande de modification de la carte. Elle '
    + 'n’est proposée que pour les personnes sans compte propre ; un membre est maître de son '
    + 'propre nom et le change sur [Mon profil](/personal-info).',
  'help.family-tree.fixing.b0.i2':
    'Rattaché à la mauvaise personne — retirez le lien. Les deux personnes restent dans la '
    + 'famille.',
  // ──── PART 8 — Community (Elections) ──────────────────────────────────────────
  'help.elections.title': 'Élections',
  'help.elections.summary':
    'Comment une élection court sur ses propres dates, qui a le droit d’y prendre part, et '
    + 'comment nommer, accepter et voter.',
  'help.elections.what-it-is.heading': 'Ce qu’est cet écran',
  'help.elections.what-it-is.b0':
    'Chaque élection que votre partie de la famille tient. **Actives** est tout ce qui '
    + 'n’est pas encore terminé — une qui n’a pas ouvert, une qui reçoit des nominations, une '
    + 'qui attend l’ouverture de son bulletin, et une où l’on vote. **Passées** sont celles '
    + 'qui ont fermé.',
  'help.elections.what-it-is.b1':
    'Les élections qui n’ont pas encore été publiées ne sont pas listées. Un organisateur '
    + 'écrit d’abord une élection en brouillon, et un brouillon n’est pas un bulletin.',
  'help.elections.what-it-is.b2':
    'Ouvrez-en une pour voir ses fonctions, ses deux fenêtres de dates, et ce que vous '
    + 'pouvez y faire aujourd’hui.',
  'help.elections.the-dates.heading': 'Les dates la conduisent',
  'help.elections.the-dates.b0':
    'Une élection a deux fenêtres, et personne n’appuie sur rien pour la faire passer de '
    + 'l’une à l’autre.',
  'help.elections.the-dates.b1.i0.term': 'Nominations',
  'help.elections.the-dates.b1.i0.text':
    'Du jour de leur ouverture au jour de leur fermeture. Présentez-vous, ou présentez '
    + 'quelqu’un d’autre.',
  'help.elections.the-dates.b1.i1.term': 'Vote',
  'help.elections.the-dates.b1.i1.text':
    'Du jour de son ouverture au jour de sa fermeture. Exprimez un vote, ou changez-en un.',
  'help.elections.the-dates.b2':
    '**Les deux bornes comptent.** Une élection dont les nominations indiquent « 1er '
    + 'janvier – 5 janvier » est ouverte le 5, jusqu’à la fin de la journée. Cela vaut aussi '
    + 'pour le vote — avec une exception, ci-dessous.',
  'help.elections.the-dates.b3':
    'Le vote n’ouvre jamais avant la fermeture des nominations : la liste des candidats sur '
    + 'laquelle vous votez ne peut donc pas changer sous vos yeux. Il y a souvent un '
    + 'intervalle entre les deux, et l’écran dit ce qu’il attend.',
  'help.elections.the-dates.b4':
    '**Le vote peut ouvrir le jour même de la fermeture des nominations, et alors ce jour '
    + 'appartient au vote.** Les nominations courent jusqu’à leur date de fermeture, ou '
    + 'jusqu’à l’ouverture du vote, selon ce qui arrive en premier — donc sur un jour partagé '
    + 'le formulaire de nomination est déjà fermé et le bulletin est actif. Si votre famille '
    + 'veut la totalité de ce jour pour les nominations, la date de fermeture se place un '
    + 'jour plus tôt.',
  'help.elections.the-dates.b5':
    'Rien ici ne se produit à une heure de la journée. Une fenêtre s’ouvre à sa date et se '
    + 'ferme à la fin de sa date de fermeture, et l’écran montre les mêmes dates à tout le '
    + 'monde.',
  'help.elections.the-dates.b6':
    '**« La fin de la journée » veut dire la fin de la journée là où votre famille se '
    + 'trouve.** Une élection enregistre le fuseau horaire dans lequel elle a été programmée, '
    + 'et les dates à l’écran comme le moment où le bulletin ferme réellement sont lus dans '
    + 'ce seul fuseau — de sorte qu’un proche à l’autre bout du monde voit la même date de '
    + 'fermeture que tout le monde, et que le bulletin reste ouvert jusqu’à minuit chez votre '
    + 'famille plutôt que chez quelqu’un d’autre.',
  'help.elections.who-votes.heading': 'À qui une élection est destinée',
  'help.elections.who-votes.b0':
    'Une élection appartient à un niveau de la famille, et l’écran le nomme sous le titre.',
  'help.elections.who-votes.b1.i0.term': 'National',
  'help.elections.who-votes.b1.i0.text':
    'Toute la famille. Tout le monde peut la voir, être nommé, et voter.',
  'help.elections.who-votes.b1.i1.term': 'Une région',
  'help.elections.who-votes.b1.i1.text': 'Seuls les membres dont la section est dans cette région.',
  'help.elections.who-votes.b1.i2.term': 'Une section',
  'help.elections.who-votes.b1.i2.text': 'Seuls les membres de cette section.',
  'help.elections.who-votes.b2':
    'Les niveaux ne se mélangent pas. Une élection de section est invisible pour le reste '
    + 'de la famille — elle n’est pas listée, et son lien ne s’ouvre pas — et elle ne peut '
    + 'pourvoir que des fonctions que la famille enregistre au niveau de la section. Voyez '
    + '[Régions et sections](/help/regions-and-chapters) pour la façon dont la famille se '
    + 'divise, et [Postes au conseil](/help/board-positions) pour les fonctions elles-mêmes.',
  'help.elections.who-votes.b3':
    '**Si vous n’êtes dans aucune section, vous êtes sous National.** Vous voyez les '
    + 'élections nationales et y prenez part, et les élections régionales et de section ne '
    + 'sont pas les vôtres. Votre section est sur [Mon profil](/personal-info) — un '
    + 'administrateur peut aussi la définir pour vous.',
  'help.elections.nominating.heading': 'Nommer quelqu’un',
  'help.elections.nominating.b0':
    'Tant que les nominations sont ouvertes, l’élection énumère chaque fonction du '
    + 'bulletin, et sous chacune les personnes qui y ont été nommées. Tout membre peut '
    + 'nommer.',
  'help.elections.nominating.b1.i0':
    'Trouvez la fonction pour laquelle vous voulez nommer et appuyez sur **Nommer** à côté.',
  'help.elections.nominating.b1.i1':
    'Pour vous présenter, appuyez sur **Me présenter**. Vous êtes sur le bulletin aussitôt '
    + '— personne n’a à accepter sa propre nomination.',
  'help.elections.nominating.b1.i2':
    'Pour présenter quelqu’un d’autre, trouvez-le dans **Qui nommez-vous ?** et appuyez sur '
    + '**Nommer**.',
  'help.elections.nominating.b2':
    'Le champ de nom cherche dans n’importe quelle partie de n’importe quel nom : saisir « '
    + 'allen » trouve donc Martha Allen. Il n’énumère que les personnes à qui cette élection '
    + 'est destinée, et c’est pourquoi une élection de section propose moins de noms que la '
    + 'famille n’en compte.',
  'help.elections.nominating.b3':
    '**Plusieurs membres peuvent nommer la même personne pour la même fonction.** Elle '
    + 'apparaît une seule fois dans la liste, et il est dit combien de personnes l’ont '
    + 'présentée — « nommée par vous et 2 autres ». Une seconde nomination n’est pas un '
    + 'doublon ; c’est un autre membre qui dit qu’il la veut.',
  'help.elections.nominating.b4':
    'Une personne peut être nommée une fois par fonction par vous, et peut être nommée pour '
    + 'autant de fonctions que vous voulez.',
  'help.elections.withdrawing.heading': 'Retirer une nomination',
  'help.elections.withdrawing.b0':
    'Une nomination que vous avez faite affiche **Retirer mon nom** à côté, et une que vous '
    + 'avez faite pour vous-même affiche **Me retirer**. Dans les deux cas vous ne retirez '
    + 'jamais que votre propre nom.',
  'help.elections.withdrawing.b1':
    '**Si d’autres membres ont nommé la même personne, elle reste sur le bulletin.** Seul '
    + 'votre nom est retiré, et le décompte à côté d’elle baisse d’un. Si vous étiez la seule '
    + 'personne à l’avoir nommée, elle sort entièrement du bulletin — l’écran dit laquelle '
    + 'des deux choses va arriver avant que vous ne confirmiez.',
  'help.elections.withdrawing.b2':
    'Deux choses l’empêchent, et toutes deux tiennent au fait de ne pas changer un bulletin '
    + 'sous les yeux de ceux qui le lisent :',
  'help.elections.withdrawing.b3.i0.term': 'Il a déjà accepté',
  'help.elections.withdrawing.b3.i0.text':
    'Une nomination acceptée reste sur le bulletin. La façon d’en sortir est qu’il la '
    + 'refuse — voyez Accepter ou refuser ci-dessous. L’exception est la vôtre : vous pouvez '
    + 'toujours vous retirer.',
  'help.elections.withdrawing.b3.i1.term': 'Les nominations ont fermé',
  'help.elections.withdrawing.b3.i1.text':
    'Une fois la fenêtre terminée, rien ne sort du bulletin. Refuser est la seule sortie '
    + 'dès lors.',
  'help.elections.withdrawing.b4':
    'Vous ne pouvez pas retirer la nomination de quelqu’un d’autre, même si vous êtes '
    + 'administrateur de la famille. Une nomination est quelque chose qu’un membre a dit, et '
    + 'lui seul peut le dédire.',
  'help.elections.accepting.heading': 'Accepter ou refuser',
  'help.elections.accepting.b0':
    'Si quelqu’un vous nomme, l’élection s’ouvre avec **Vous avez été nommé !** en haut, '
    + 'une ligne par fonction. **Accepter** vous met sur le bulletin ; **Refuser** vous en '
    + 'retire.',
  'help.elections.accepting.b1':
    'Cela ne peut pas être changé ensuite : l’écran vous demande donc de confirmer. Seules '
    + 'les nominations que vous avez acceptées apparaissent comme candidatures à l’ouverture '
    + 'du vote — une nomination à laquelle personne n’a répondu n’est pas sur le bulletin.',
  'help.elections.accepting.b2':
    'Vous pouvez encore répondre après la fermeture des nominations. La fenêtre gouverne '
    + 'qui peut être nommé, non le temps que vous avez pour répondre.',
  'help.elections.voting.heading': 'Voter',
  'help.elections.voting.b0':
    'Tant que le vote est ouvert, chaque fonction énumère les candidats qui ont accepté. '
    + 'Appuyez sur l’un, confirmez, et votre vote est enregistré.',
  'help.elections.voting.b1':
    'Vous pouvez changer votre vote aussi souvent que vous voulez jusqu’à la fermeture de '
    + 'la fenêtre — appuyer sur un autre candidat remplace votre vote antérieur plutôt que de '
    + 's’y ajouter. Une voix par fonction.',
  'help.elections.voting.b2':
    '**Votre bulletin est le vôtre.** Vous pouvez voir vos propres voix et personne d’autre '
    + 'ne peut, et rien nulle part ne montre à un autre membre pour qui il a voté.',
  'help.elections.results.heading': 'Résultats',
  'help.elections.results.b0':
    'Une fois la fenêtre de vote fermée, **Résultats** apparaît au pied de l’élection avec '
    + 'le nombre de voix de chaque candidat, classé par nombre, sur autant de lignes que la '
    + 'fonction compte d’élus.',
  'help.elections.results.b1':
    'Rien n’est publié tant que le vote est ouvert, et il n’y a rien à appuyer pour le '
    + 'publier — le lendemain de la fermeture du vote, les résultats sont là.',
  // ──── PART 8 — Community (Officer Notes) ──────────────────────────────────────
  'help.journal.title': 'Notes de fonction',
  'help.journal.summary':
    'Un carnet pour chaque fonction que votre famille entretient, comment un sujet '
    + 'recueille des notes au fil du temps, et pourquoi tout reste avec la fonction plutôt '
    + 'qu’avec vous.',
  'help.journal.what-it-is.heading': 'Ce qu’est cet écran',
  'help.journal.what-it-is.b0':
    'Chaque fonction que la famille enregistre — trésorier, secrétaire, responsable des '
    + 'événements — a un carnet. Il contient ce que la personne qui fait le travail a besoin '
    + 'd’avoir noté : comment le rapprochement bancaire fonctionne réellement, quelle salle '
    + 'répond au téléphone, ce qui a mal tourné l’an dernier.',
  'help.journal.what-it-is.b1':
    'C’est **Bibliothèque > Notes de fonction** dans le menu latéral, à côté des '
    + '[Procès-verbaux](/library/meeting-minutes), des [Documents](/library/documents) et des '
    + '[Statuts](/library/bylaws) — les quatre choses que la famille note et auxquelles elle '
    + 'revient. Une famille qui enregistre des fonctions pour ses sections et ses régions '
    + 'autant qu’au niveau national les trouvera toutes ici.',
  'help.journal.what-it-is.b2':
    '**Les notes appartiennent à la fonction, non à vous.** C’est tout. Quand vous passez '
    + 'le travail à quelqu’un d’autre, tout ce que vous avez écrit y est encore pour celui '
    + 'qui le reprend, et tout ce que la personne avant vous a écrit y était pour vous.',
  'help.journal.what-it-is.b3':
    '**Une entrée est un sujet, non une page.** Elle a un titre puis une suite de notes en '
    + 'dessous, de la plus ancienne à la plus récente, chacune signée et datée. Ainsi « '
    + 'Comment le rapprochement bancaire fonctionne » est une entrée à laquelle un paragraphe '
    + 's’ajoute chaque fois qu’il y a quelque chose à ajouter, plutôt que quatre entrées aux '
    + 'noms voisins — et l’argument expliquant pourquoi on procède ainsi est le fil entier, '
    + 'non sa dernière version.',
  'help.journal.what-it-is.b4':
    'Si vous n’occupez aucune fonction, l’écran le dit et il n’y a rien à voir. Rien n’a '
    + 'mal tourné — les notes de fonction sont pour les titulaires, et les fonctions '
    + 's’enregistrent sous [Postes au conseil](/help/board-positions).',
  'help.journal.who-can-read-it.heading': 'Qui peut le lire',
  'help.journal.who-can-read-it.b0':
    '**Celui qui occupe la fonction aujourd’hui, et personne d’autre.** Ni les autres '
    + 'titulaires, ni les administrateurs de la famille, ni la personne qui l’occupait l’an '
    + 'dernier.',
  'help.journal.who-can-read-it.b1':
    'C’est inhabituel dans ce produit et c’est délibéré. Ce sont des notes de travail '
    + 'plutôt qu’un registre que la famille conserve, et un carnet que tout le monde pourrait '
    + 'lire est un carnet que les gens tiendraient ailleurs.',
  'help.journal.who-can-read-it.b2':
    'Si vous occupez plus d’une fonction, chacune a son propre carnet et une bande en haut '
    + 'passe de l’une à l’autre. Rien de l’une n’apparaît dans l’autre.',
  'help.journal.who-can-read-it.b3':
    '**Chacun est nommé en entier — la fonction et le lieu.** « Trésorier national », « '
    + 'président de la section d’Austin », « secrétaire de la région de l’Est » : la même '
    + 'formule que le [Répertoire](/community/directory) et [Membres](/admin/members) '
    + 'impriment pour la même fonction, de sorte que vous ne devinez jamais laquelle de deux '
    + 'fonctions de section un élément de la bande désigne.',
  'help.journal.who-can-read-it.b4':
    '**Un carnet appartient à la FONCTION plutôt qu’au lieu**, et une fonction restreinte '
    + 'le dit à l’écran : tous ceux qui occupent « président de section » lisent les mêmes '
    + 'notes, quelle que soit la section qu’ils président. Si votre famille veut qu’une '
    + 'section ait ses propres notes, c’est une fonction distincte par section plutôt qu’une '
    + 'fonction occupée dans plusieurs.',
  'help.journal.who-can-read-it.b5':
    'Si vous êtes deux à occuper la même fonction, vous écrivez tous les deux dans le même '
    + 'carnet. L’un ou l’autre peut ajouter une note à n’importe quelle entrée qui y figure, '
    + 'et c’est ce qui fait d’une entrée une conversation — mais une note reste la propriété '
    + 'de celui qui l’a écrite. Voyez [changer quelque chose](#editing).',
  'help.journal.who-can-read-it.b6':
    'Une famille peut désactiver cet écran entièrement sous [Qui peut faire '
    + 'quoi](/help/who-can-do-what), comme n’importe quel autre écran. Ce qu’elle ne peut pas '
    + 'faire, c’est ouvrir le carnet d’une fonction à quelqu’un qui ne l’occupe pas.',
  'help.journal.writing.heading': 'Démarrer une entrée, et y ajouter',
  'help.journal.writing.b0.i0': 'Appuyez sur **Nouvelle entrée**.',
  'help.journal.writing.b0.i1': 'Donnez-lui un titre — c’est ce que la liste affiche.',
  'help.journal.writing.b0.i2':
    'Écrivez la première note si vous avez quelque chose à dire maintenant. Vous pouvez la '
    + 'laisser vide et y revenir.',
  'help.journal.writing.b0.i3': 'Appuyez sur **Ajouter l’entrée**.',
  'help.journal.writing.b1':
    'Après cela, **Ajouter une note** sur l’entrée est la façon dont elle grandit. Écrivez '
    + 'autant ou aussi peu que vous voulez ; les retours à la ligne sont conservés, donc une '
    + 'liste reste une liste. Les notes apparaissent dans l’ordre où elles ont été écrites, '
    + 'chacune avec un nom et une date, et une note modifiée depuis le dit.',
  'help.journal.writing.b2':
    'Les entrées elles-mêmes sont listées de la plus récente à la plus ancienne, avec qui a '
    + 'démarré chacune et quand.',
  'help.journal.writing.b3':
    'Quiconque occupe la fonction peut ajouter une note à n’importe quelle entrée, y '
    + 'compris une entrée que quelqu’un d’autre a démarrée. C’est délibéré — c’est ainsi '
    + 'qu’un successeur répond à un prédécesseur sous ce qu’il a écrit plutôt que de démarrer '
    + 'une entrée rivale.',
  'help.journal.meetings.heading': 'Notes de réunion',
  'help.journal.meetings.b0':
    '**Notes de réunion** est le second bouton, et il crée une entrée d’un genre '
    + 'particulier : une qui enregistre un jour, qui était dans la salle, et ce qui a été '
    + 'dit.',
  'help.journal.meetings.b1.i0': 'Appuyez sur **Notes de réunion**.',
  'help.journal.meetings.b1.i1':
    'Vérifiez le titre et le **Jour de la réunion** — les deux sont préremplis avec '
    + 'aujourd’hui pour commencer.',
  'help.journal.meetings.b1.i2':
    'Sous **Qui a assisté**, cherchez chaque proche qui était présent et cochez-le. Les '
    + 'noms que vous avez choisis restent listés au-dessus du champ de recherche : une '
    + 'recherche qui en masque un ne le perd donc pas.',
  'help.journal.meetings.b1.i3': 'Écrivez ce qui a été discuté et décidé dans le champ de notes.',
  'help.journal.meetings.b1.i4': 'Appuyez sur **Ajouter l’entrée**.',
  'help.journal.meetings.b2':
    'Une réunion apparaît dans la liste marquée **Notes de réunion**, avec le jour où elle '
    + 'a eu lieu et toutes les personnes qui y ont assisté. Quiconque occupe la fonction peut '
    + 'y ajouter une note ensuite, comme à n’importe quelle autre entrée — c’est ainsi qu’une '
    + 'correction, ou quelque chose dont on se souvient plus tard, s’enregistre.',
  'help.journal.meetings.b3':
    '**Qui a assisté ne peut être changé que par la personne qui a enregistré la réunion.** '
    + 'Une liste de participants est une affirmation sur une salle et ne porte le nom de '
    + 'personne contre elle : ce n’est donc pas quelque chose que deux titulaires peuvent '
    + 'discrètement se réécrire. Si vous étiez présent et avez été oublié, ajoutez une note '
    + 'le disant — le relevé montre alors les deux.',
  'help.journal.meetings.b4':
    '**Le vote sur les tâches n’est pas encore développé.** Chaque entrée de réunion porte '
    + 'un panneau qui le dit. Quand il existera, il transformera ce qu’une réunion a décidé '
    + 'en tâches et laissera les personnes présentes voter dessus ; en attendant, écrivez ce '
    + 'qui a été convenu dans une note.',
  'help.journal.editing.heading': 'Changer ou retirer quelque chose',
  'help.journal.editing.b0':
    'Il y a deux règles, et laquelle s’applique dépend de ce que vous changez.',
  'help.journal.editing.b1.i0.term': 'Une note',
  'help.journal.editing.b1.i0.text':
    'Seule la personne qui l’a écrite peut la modifier ou la supprimer — n’importe laquelle '
    + 'de ses notes, où qu’elle se trouve dans le fil, pas seulement la plus récente. Le '
    + 'crayon et la corbeille apparaissent à côté des notes qui sont les vôtres et sur aucune '
    + 'autre.',
  'help.journal.editing.b1.i1.term': 'L’entrée elle-même',
  'help.journal.editing.b1.i1.text':
    'Son titre, le jour d’une réunion et qui y a assisté appartiennent à la personne qui '
    + 'l’a démarrée. Tous les autres ajoutent des notes.',
  'help.journal.editing.b2':
    'Dans les deux cas cela ne dure que tant que vous occupez encore la fonction. Un ancien '
    + 'titulaire ne conserve ni l’une ni l’autre — et tout ce qu’il a écrit reste, et c’est '
    + 'bien l’idée.',
  'help.journal.editing.b3':
    'Une note laissée par la personne avant vous est donc à vous pour la lire et non pour '
    + 'la réécrire. Si elle est fausse ou périmée, ajoutez une note le disant — cela conserve '
    + 'à la fois l’original et la correction, et c’est ce qui rend le carnet digne d’être lu '
    + 'des années plus tard.',
  'help.journal.editing.b4':
    'Supprimer une note laisse le reste de l’entrée intact. Supprimer une **entrée** '
    + 'emporte chaque note en dessous, pour toutes les personnes qui occupent la fonction, '
    + 'maintenant et plus tard. Les deux sont définitives et l’écran vous demande de '
    + 'confirmer.',
  'help.journal.editing.b5':
    'Si une fonction est retirée des postes au conseil de la famille, son carnet part avec '
    + 'elle. Il ne reste aucune fonction que les notes puissent suivre.',
  // ──── PART 9 — Gatherings (Documents, Bylaws, Gallery, Calendar) ──────────────
  'help.part.gatherings.title': 'Rassemblements',
  'help.part.gatherings.blurb':
    'Mettre le rassemblement au calendrier, et faire répartir le travail qu’il demande.',
  'help.documents.title': 'Documents',
  'help.documents.summary':
    'Les archives classées de la famille — ce qui peut être téléversé, comment en trouver '
    + 'un, et qui peut le retirer.',
  'help.documents.what-it-is.heading': 'Le classeur',
  'help.documents.what-it-is.b0':
    '[Documents](/library/documents) est là où les archives de la famille vivent — '
    + 'formulaires, dépôts, copies signées. Cela a été déplacé sous **Bibliothèque** le '
    + '22-08-2026, à côté des carnets que ses titulaires tiennent et des procès-verbaux et '
    + 'statuts de la famille, car le lecteur qui veut l’un est le lecteur qui veut les '
    + 'autres.',
  'help.documents.what-it-is.b1':
    '**Excel, Word, PDF ou CSV seulement**, jusqu’à 25 Mo. Les deux générations des formats '
    + 'Office, car un document écrit en 2004 est réellement un `.doc`. Une photographie va '
    + 'dans la [Galerie](/community/gallery), qui fait des albums et de l’étiquetage que '
    + 'cette liste ne fera jamais.',
  'help.documents.uploading.heading': 'Classer quelque chose',
  'help.documents.uploading.b0.i0': 'Appuyez sur **Téléverser un document**.',
  'help.documents.uploading.b0.i1':
    'Choisissez le fichier. Le nom se remplit de lui-même à partir du nom du fichier ; '
    + 'changez-le si vous voulez.',
  'help.documents.uploading.b0.i2':
    'Ajoutez une description si nécessaire, et choisissez une catégorie.',
  'help.documents.uploading.b0.i3': 'Appuyez sur **Téléverser**.',
  'help.documents.uploading.b1':
    '**Trois catégories : Statuts, Formulaires et Autres.** Il y en avait cinq. *Photos* '
    + 'est partie car la [Galerie](/community/gallery) est l’écran pour une image, et '
    + '*Procès-verbaux* est parti car [Procès-verbaux](/library/meeting-minutes) est un vrai '
    + 'écran maintenant. Un PDF du procès-verbal d’une réunion tenue en dehors du produit est '
    + '**Autres**.',
  'help.documents.uploading.b2':
    'Un document déjà classé sous une des catégories retirées la garde et l’affiche '
    + 'toujours. Rien ne réécrit la décision de classement de quelqu’un d’autre.',
  'help.documents.finding-and-removing.heading': 'En trouver un, et en retirer un',
  'help.documents.finding-and-removing.b0':
    'Le champ de recherche correspond au nom et à la description ; la liste déroulante de '
    + 'catégorie restreint à une seule sorte. Appuyer sur le nom d’un document l’ouvre.',
  'help.documents.finding-and-removing.b1':
    '**Quiconque a téléversé un document peut le supprimer.** Supprimer celui de n’importe '
    + 'qui demande l’autorisation sans restriction — voyez [Qui peut faire '
    + 'quoi](/help/who-can-do-what). Le fichier est retiré en même temps que la ligne.',
  'help.bylaws.title': 'Statuts',
  'help.bylaws.summary':
    'Les règles que la famille a convenu de suivre, et la recherche à l’intérieur — y '
    + 'compris ce que la recherche ne peut pas encore atteindre.',
  'help.bylaws.what-it-is.heading': 'Ce qu’est cet écran',
  'help.bylaws.what-it-is.b0':
    '[Statuts](/library/bylaws) contient les documents qui régissent la famille, article '
    + 'par article, et permet à quiconque de les chercher. Chaque membre approuvé peut les '
    + 'lire — une règle que personne ne peut lire n’en est pas une.',
  'help.bylaws.what-it-is.b1':
    'Un article a un numéro (« Article IV »), un titre, un résumé facultatif, et soit le '
    + 'texte saisi, soit un document téléversé, soit les deux.',
  'help.bylaws.not-finished.heading': 'Ce que la recherche peut atteindre et ne peut pas',
  'help.bylaws.not-finished.b0':
    '**Cet écran est un échafaudage, et une partie de lui n’est réellement pas '
    + 'construite.** Lire le texte d’un PDF ou d’un fichier Word n’est pas implémenté, donc :',
  'help.bylaws.not-finished.b1.i0':
    'Un article dont vous avez **saisi ou collé** le texte est cherchable mot par mot.',
  'help.bylaws.not-finished.b1.i1':
    'Un article qui n’est **qu’un PDF ou un fichier Word téléversé** est cherchable par son '
    + 'titre, son numéro d’article et son résumé — non par ce qu’il contient. Il se téléverse '
    + 'toujours et se télécharge toujours.',
  'help.bylaws.not-finished.b2':
    'Chaque article porte une mention disant lequel des deux il est, et une recherche qui '
    + 'n’a rien trouvé le dit aussi. C’est délibéré : « aucun résultat » et « non indexé » '
    + 'sont des faits différents, et un lecteur qui ne peut les distinguer conclut que les '
    + 'statuts ne disent pas une chose qu’ils disent.',
  'help.bylaws.not-finished.b3':
    'Jusqu’à ce que cela soit construit, **coller le texte est ce qui rend un article '
    + 'trouvable**. Le formulaire le dit là où vous n’y penseriez pas autrement.',
  'help.bylaws.searching.heading': 'Chercher',
  'help.bylaws.searching.b0':
    'Des mots entiers, et il comprend les terminaisons — chercher « réunion » trouve « '
    + 'réunions ». Mettez une expression entre guillemets pour qu’elle corresponde d’un bloc, '
    + 'et mettez un moins devant un mot pour l’exclure.',
  'help.bylaws.searching.b1':
    'Laissez le champ vide et appuyez sur **Effacer** pour les relire dans l’ordre, ce à '
    + 'quoi la numérotation propre à la famille sert.',
  'help.gallery.title': 'Galerie',
  'help.gallery.summary':
    'Des albums des photographies de la famille — téléverser un lot, étiqueter qui est sur '
    + 'chacune, et les retrouver.',
  'help.gallery.what-it-is.heading': 'Des albums, non un tas',
  'help.gallery.what-it-is.b0':
    'La [Galerie](/community/gallery) garde les photographies dans des **albums** — un '
    + 'rassemblement, un mariage, une année. Un album a un nom, une description facultative, '
    + 'et un nombre quelconque d’images.',
  'help.gallery.what-it-is.b1':
    '**Les deux peuvent être changés par la suite.** Appuyez sur le crayon à côté du '
    + 'titre de l’album, ou sur celui dans le coin de sa vignette sur la page Galerie, et '
    + 'modifiez l’un ou l’autre. Les photographies qu’il contient ne sont pas touchées : '
    + 'voyez [qui peut changer quoi](#who-can-change-what).',
  'help.gallery.what-it-is.b2':
    'Elle s’appelait Photos et se trouvait sous Ressources jusqu’au 22-08-2026. Le même '
    + 'écran, avec davantage dedans.',
  'help.gallery.what-it-is.b3':
    'Uniquement des fichiers image : JPEG, PNG, WebP ou GIF, jusqu’à 10 Mo chacun. Un HEIC '
    + 'sorti tout droit d’un iPhone est refusé, car aucun navigateur sauf Safari ne peut en '
    + 'afficher un — iOS convertit en JPEG lorsque vous choisissez un fichier, donc en '
    + 'pratique cela ne gêne qu’un fichier que vous avez copié du téléphone vous-même.',
  'help.gallery.uploading.heading': 'Ajouter des photographies',
  'help.gallery.uploading.b0.i0': 'Ouvrez l’album.',
  'help.gallery.uploading.b0.i1': 'Appuyez sur **Ajouter des photographies**.',
  'help.gallery.uploading.b0.i2':
    'Appuyez sur **Choisir des fichiers** et sélectionnez-en autant que vous voulez d’un '
    + 'coup.',
  'help.gallery.uploading.b0.i3':
    'Donnez-leur une légende si elles en partagent une — elle s’applique à tout le lot.',
  'help.gallery.uploading.b0.i4': 'Appuyez sur **Téléverser**.',
  'help.gallery.uploading.b1':
    '**Un lot n’est pas tout ou rien.** Si un fichier est du mauvais type ou trop gros, le '
    + 'reste se téléverse tout de même et le panneau nomme ceux qui ne l’ont pas fait, et '
    + 'pourquoi. Vous n’avez pas à trouver le fichier fautif et à recommencer.',
  'help.gallery.uploading.b2':
    '**Un grand lot part par douze**, et le bouton les compte à mesure qu’ils arrivent : '
    + '« Envoi de 27 sur 200 ». Laissez le panneau ouvert jusqu’à la fin : fermer l’onglet '
    + 'à mi-chemin conserve ce qui est déjà arrivé et arrête le reste.',
  'help.gallery.uploading.b3':
    'La légende s’applique à chaque photographie du lot, ce qui convient pour « samedi, au '
    + 'lac » et ne convient pas à une image qui a besoin de la sienne. Corrigez-en une en '
    + 'particulier ensuite dans la vue en liste — voyez [changer une légende](#tidying).',
  'help.gallery.tidying.heading': 'Légendes, étiquettes, et la vue en liste',
  'help.gallery.tidying.b0':
    'Il y a deux façons de regarder un album, et l’interrupteur est au-dessus. **Grille** '
    + 'est pour regarder : des vignettes carrées, et appuyer sur l’une l’ouvre en pleine '
    + 'taille. **Liste** est pour ranger : des images plus petites, une par ligne, avec la '
    + 'légende et les étiquettes modifiables sur place.',
  'help.gallery.tidying.b1':
    '**Étiqueter** dit qui est sur une photographie. Appuyez sur **Étiqueter quelqu’un** '
    + 'sur une ligne et cherchez dans la famille ; la recherche trouve « José » si vous '
    + 'saisissez « jose » et « O’Connor » si vous saisissez « oconnor ». Appuyez sur le × '
    + 'd’une étiquette pour la retirer.',
  'help.gallery.tidying.b2':
    'Aucune des deux vues ne masque quoi que ce soit : les filtres au-dessus de l’album '
    + 'sont ce qui le restreint, et ils restreignent les deux — voyez [Trouver une '
    + 'photographie](#finding).',
  'help.gallery.finding.heading': 'Trouver une photographie',
  'help.gallery.finding.b0':
    'Deux filtres se trouvent au-dessus d’un album, et ils restreignent ensemble.',
  'help.gallery.finding.b1.i0.term': 'Chercher dans les légendes',
  'help.gallery.finding.b1.i0.text':
    'Saisissez n’importe quelle partie d’une légende. Plusieurs mots correspondent dans '
    + 'n’importe quel ordre : « rassemblement lac » trouve donc « Trois jours au lac — '
    + 'rassemblement 2026 ». Les accents et la ponctuation sont ignorés des deux côtés : « '
    + 'jose » trouve « José » et « grand-meres » trouve « Grand-mère ». Une photographie sans '
    + 'légende ne correspond jamais à une recherche.',
  'help.gallery.finding.b1.i1.term': 'Qui est dessus',
  'help.gallery.finding.b1.i1.text':
    'Choisissez autant de personnes étiquetées que vous voulez. Une photographie s’affiche '
    + 'quand N’IMPORTE LAQUELLE d’entre elles y figure : en choisir trois élargit donc le '
    + 'résultat plutôt que de le restreindre. Le bouton porte un décompte tant que le filtre '
    + 'est actif, et n’apparaît que lorsque quelqu’un est étiqueté dans cet album.',
  'help.gallery.finding.b2':
    'Une ligne sous la barre dit combien des photographies de l’album s’affichent et '
    + 'pourquoi, avec **Effacer les filtres** pour toutes les remettre. Aucun des deux '
    + 'filtres ne change quoi que ce soit pour quiconque d’autre — c’est ce que vous '
    + 'regardez, non ce que l’album contient.',
  'help.gallery.who-can-change-what.heading': 'Qui peut changer quoi',
  'help.gallery.who-can-change-what.b0':
    '**Une photographie appartient à celui qui l’a téléversée.** Il peut changer sa légende '
    + 'et la supprimer. Quiconque d’autre a besoin de l’autorisation sans restriction sur la '
    + 'Galerie — voyez [Qui peut faire quoi](/help/who-can-do-what).',
  'help.gallery.who-can-change-what.b1.i0.term': 'Légende',
  'help.gallery.who-can-change-what.b1.i0.text':
    'Celui qui l’a téléversée, ou quelqu’un ayant l’autorisation de modifier celle de '
    + 'n’importe qui.',
  'help.gallery.who-can-change-what.b1.i1.term': 'Étiquettes',
  'help.gallery.who-can-change-what.b1.i1.text':
    'Quiconque peut modifier la galerie. Étiqueter ne porte pas sur à qui la photographie '
    + 'appartient — cela porte sur qui est dessus, et la personne qui reconnaît un cousin '
    + 'n’est souvent pas celle qui a pris l’image.',
  'help.gallery.who-can-change-what.b1.i2.term': 'Supprimer une photographie',
  'help.gallery.who-can-change-what.b1.i2.text':
    'Celui qui l’a téléversée, ou quelqu’un ayant l’autorisation sans restriction. Le '
    + 'fichier image est retiré en plus de la ligne.',
  'help.gallery.who-can-change-what.b1.i3.term': 'Renommer un album',
  'help.gallery.who-can-change-what.b1.i3.text':
    'Son créateur, ou quelqu’un ayant la permission de modifier ceux de tout le monde : '
    + 'le même niveau qu’une légende, et délibérément un cran en dessous de la suppression. '
    + 'Le contrôle est le crayon à côté du titre de l’album, et celui dans le coin de sa '
    + 'vignette sur la page Galerie. Il change le nom et la description, et rien d’autre.',
  'help.gallery.who-can-change-what.b1.i4.term': 'Supprimer un album',
  'help.gallery.who-can-change-what.b1.i4.text':
    'Celui qui l’a créé, ou quelqu’un ayant l’autorisation sans restriction — ce qu’un '
    + 'administrateur détient. La commande est la corbeille dans le coin de la tuile de '
    + 'l’album sur la page de la Galerie. Elle emporte chaque photographie de l’album, et les '
    + 'fichiers image aussi ; la confirmation dit combien avant que vous ne vous engagiez.',
  'help.gallery.who-can-change-what.b2':
    'Supprimer un album n’est pas réversible ni partiellement réversible. L’avertissement '
    + 'compte les photographies pour exactement cette raison.',
  'help.calendar.title': 'Calendrier',
  'help.calendar.summary':
    'La grille du mois qui place chaque rassemblement, réunion et fenêtre d’élection au '
    + 'jour où il tombe, comment passer d’un mois à l’autre, et ce qu’elle fait sur un '
    + 'téléphone.',
  'help.calendar.what-it-is.heading': 'Un mois à la fois',
  'help.calendar.what-it-is.b0':
    '[Calendrier](/gatherings/calendar) est une vraie grille de mois — les semaines vers le '
    + 'bas, les jours de la semaine en travers, dimanche en premier — avec trois choses aux '
    + 'jours où elles tombent : les **rassemblements** de la famille, les **réunions** '
    + 'auxquelles vous êtes convié, et les fenêtres ouvertes de **nomination et de vote** de '
    + 'ses élections. Elle ne crée rien. Chaque entrée est un lien vers l’écran qui la '
    + 'détient — [Rassemblements](/gatherings), [Procès-verbaux](/library/meeting-minutes) ou '
    + '[Élections](/community/elections) — là où la chose elle-même vit et se modifie.',
  'help.calendar.what-it-is.b1':
    'La légende ne nomme que ce qui est effectivement sur la grille ce mois-ci, et chaque '
    + 'entrée dit de quelle sorte elle est en mots autant qu’en couleur — la distinction '
    + 'survit donc à la fois à un lecteur d’écran et à un lecteur qui ne peut pas séparer les '
    + 'teintes. **Rassemblement à la une** est doré, **Rassemblement** est bordeaux doux, '
    + '**Réunion** est bordeaux plein, et une élection est terre cuite chaude : en contour '
    + 'tant que les **Nominations** sont ouvertes, pleine dès que le **Vote** l’est. Il y en '
    + 'avait une sixième pour un Événement jusqu’au 19-08-2026 ; ce produit est retiré.',
  'help.calendar.reading.heading': 'Lire une journée',
  'help.calendar.reading.b0':
    'Aujourd’hui est marqué. **Tout ce qui court sur plusieurs jours est dessiné comme une '
    + 'seule barre à travers eux**, avec son nom à l’extrémité gauche — un rassemblement de '
    + 'trois jours est une barre de trois jours de large, et une quinzaine de vote est une '
    + 'barre dans chacune des deux semaines qu’elle traverse. C’est toute la raison de '
    + 'l’existence d’une date de fermeture. Une élection apporte deux barres plutôt qu’une : '
    + 'la fenêtre de nomination et, après un intervalle, la fenêtre de vote. Les jours entre '
    + 'elles sont délibérément vides, car ces jours-là la liste est close et il n’y a rien '
    + 'encore à faire.',
  'help.calendar.reading.b1':
    '**Une barre à l’extrémité carrée est coupée, non terminée.** Une série qui traverse un '
    + 'samedi doit être dessinée comme une barre par semaine : les bords plats sont donc là '
    + 'où elle se poursuit dans la rangée du dessus ou du dessous ; les extrémités arrondies '
    + 'sont là où la chose elle-même commence et s’arrête.',
  'help.calendar.reading.b2':
    'La grille montre toujours des semaines entières : la première et la dernière rangée '
    + 'portent donc quelques jours des mois voisins. Ces jours gardent leurs entrées — un '
    + 'rassemblement commençant le 1er est visible dans la dernière rangée du mois précédent, '
    + 'là où vous le chercheriez une semaine plus tôt.',
  'help.calendar.reading.b3':
    'C’était une puce par jour jusqu’au 22-08-2026 — une fenêtre d’élection de deux jours '
    + 'se lisait comme deux choses distinctes portant le même nom.',
  'help.calendar.moving.heading': 'Passer d’un mois à l’autre',
  'help.calendar.moving.b0':
    'Les liens de part et d’autre du titre sont le mois précédent et le mois suivant, '
    + 'chacun nommé, avec **Ce mois-ci** entre eux. Les trois sont de vrais liens : cmd-clic, '
    + 'clic du bouton central et copier l’adresse du lien fonctionnent donc dessus.',
  'help.calendar.moving.b1':
    'Le mois est dans l’adresse, ce qui veut dire qu’un lien vers un mois est un lien vers '
    + 'ce mois — [juin 2027](/gatherings/calendar?month=2027-06) ouvre juin 2027 pour '
    + 'quiconque vous l’envoyez, et il peut être mis en signet. Une adresse que la page ne '
    + 'peut pas lire retombe sur le mois en cours plutôt que de dessiner un mois qui n’existe '
    + 'pas.',
  'help.calendar.phone.heading': 'Sur un téléphone',
  'help.calendar.phone.b0':
    'En dessous de la largeur qu’une grille de sept colonnes exige, le calendrier devient '
    + 'une liste des jours qui portent quelque chose, dans l’ordre, avec le jour de la '
    + 'semaine et la date à côté de chacun. Un jour emprunté à un mois voisin est étiqueté '
    + '**Mois précédent** ou **Mois suivant**, puisqu’il n’a plus de colonne pour le dire.',
  'help.calendar.phone.b1':
    'C’est une seconde vue du même mois plutôt qu’un second calendrier — les mêmes entrées, '
    + 'les mêmes liens. C’est un choix délibéré face au fait de comprimer la grille : à la '
    + 'largeur d’un téléphone un jour est trop étroit pour contenir une date et un titre, et '
    + 'un mois de cellules majoritairement vides est un écran de rien quand la question est '
    + 'ce qui arrive.',
  'help.calendar.phone.b2':
    '**Une série de jours est une ligne par jour ici, non une barre.** La liste n’a pas '
    + 'd’axe de gauche à droite le long duquel une barre pourrait s’étirer : un rassemblement '
    + 'de trois jours apparaît donc sous chacune de ses trois dates avec son nom sur chacune '
    + '— ce que l’on attend d’une liste de jours.',
  'help.calendar.missing.heading': 'Quand quelque chose n’y est pas',
  'help.calendar.missing.b0':
    'Une ligne apparaît au-dessus de la grille lorsque l’une des trois sources y manque, et '
    + 'elle nomme laquelle — rassemblements, réunions ou élections. Elle ne peut pas dire '
    + 'POURQUOI, et ne le devine pas : cela veut dire soit que l’écran ne vous a pas été '
    + 'partagé, soit qu’il n’a pas pu être lu à l’instant.',
  'help.calendar.missing.b1':
    'Dans les deux cas le mois que vous regardez n’est pas le mois entier, et c’est la '
    + 'raison même de la présence de cette ligne — un août vide dont rien n’est dit se lit '
    + 'comme un fait sur la famille. Un mois qui n’a réellement rien le dit à la place.',
  // ──── PART 9 — Gatherings (Gatherings) ────────────────────────────────────────
  'help.gatherings.title': 'Rassemblements',
  'help.gatherings.summary':
    'Ce qu’est un rassemblement, comment on en programme un, comment lire ses tâches et son '
    + 'budget, et où sont vos propres tâches.',
  'help.gatherings.what-it-is.heading': 'Un rassemblement, et en quoi il diffère d’un événement',
  'help.gatherings.what-it-is.b0':
    '[Rassemblements](/gatherings) est la famille qui organise le travail de se réunir. Un '
    + 'rassemblement est une occasion nommée — une retrouvaille, un hommage, un banquet — '
    + 'décomposée en les travaux qu’elle demande, avec le nom d’un proche en face de chacun '
    + 'et une réponse que quelqu’un accepte. Sa question est qui fait quoi, et si cela a été '
    + 'fait et accepté.',
  'help.gatherings.what-it-is.b1':
    'L’écran comporte deux panneaux. **Rassemblements** est tout ce que la famille '
    + 'organise, traité par ce chapitre ; **Mes tâches** est votre propre part, traitée par '
    + '[Mes tâches de rassemblement](/help/gathering-tasks#what-it-is). Les deux s’accordent '
    + 'séparément : une famille peut donc donner à quelqu’un ses propres tâches sans lui '
    + 'donner la liste de toute la famille.',
  'help.gatherings.what-it-is.b2':
    'Il y avait un produit Événements distinct jusqu’au 19-08-2026 — des confirmations de '
    + 'présence par foyer, des blocs de chambres d’hôtel et un pointage le jour même — et il '
    + 'a disparu. Rassemblements l’a remplacé, et ces trois choses ne sont pas dans le '
    + 'produit aujourd’hui : une étape d’un rassemblement peut DEMANDER n’importe laquelle '
    + 'd’entre elles à un proche, mais il n’y a ni décompte de présents, ni bloc de chambres, '
    + 'ni liste de pointage. Tout ce que la famille avait enregistré est conservé ; rien de '
    + 'nouveau ne peut y être ajouté.',
  'help.gatherings.what-it-is.b3':
    'Un rassemblement peut être bâti à partir d’un ou plusieurs modèles — une liste '
    + 'ordonnée et nommée d’étapes que quelqu’un a rédigée une fois. Chaque étape de chaque '
    + 'modèle dont il est bâti devient une tâche du rassemblement : rien n’est donc oublié '
    + 'd’une année à l’autre. La bibliothèque est [Modèles de '
    + 'rassemblement](/admin/gatherings/templates).',
  'help.gatherings.what-it-is.b4':
    'Un rassemblement sans modèle est une date sur [le calendrier](/gatherings/calendar) '
    + 'avec un lieu et une description et aucune tâche — ce dont certaines occasions ont '
    + 'uniquement besoin, et c’est souvent là qu’on commence. Un organisateur peut lui '
    + 'ajouter un modèle plus tard, et les étapes deviennent alors des tâches.',
  'help.gatherings.what-it-is.b5':
    'Chacun de ces modèles est un **segment** : une partie de l’occasion avec son propre '
    + 'jour et son propre lieu. C’est ce qui permet à un rassemblement d’être une '
    + 'retrouvaille de trois jours — l’Accueil le vendredi soir à une adresse, le Pique-nique '
    + 'le samedi à une autre, les Adieux le dimanche matin — plutôt qu’un bloc de dates avec '
    + 'tout classé dessous. Un rassemblement qui a lieu d’un seul coup en un seul endroit '
    + 'n’indique simplement ni l’un ni l’autre, et se lit comme il l’a toujours fait.',
  'help.gatherings.browsing.heading': 'À venir, et déjà tenus',
  'help.gatherings.browsing.b0':
    'La page comporte deux listes. **À venir** contient tout ce qui n’est pas terminé, du '
    + 'plus proche au plus lointain ; **Déjà tenus** contient le reste, du plus récent au '
    + 'plus ancien. Un rassemblement qui court sur plusieurs jours reste sous À venir chacun '
    + 'de ces jours et est marqué **En cours** tant qu’il l’est.',
  'help.gatherings.browsing.b1':
    'Chaque carte porte les dates, le lieu, l’avancement du travail — « 4 tâches sur 9 '
    + 'approuvées », ou **Aucune tâche pour l’instant** pour un rassemblement auquel rien n’a '
    + 'été ajouté — et un statut. Le statut est fixé par l’organisateur plutôt que déduit du '
    + 'calendrier, car un rassemblement peut être annulé sans que ses dates bougent :',
  'help.gatherings.browsing.b2.i0.term': 'En préparation',
  'help.gatherings.browsing.b2.i0.text':
    'Il se met en place. Les dates peuvent encore bouger. Seul un rassemblement bâti à '
    + 'partir de modèles commence ici — un rassemblement qui n’est qu’une date commence à '
    + 'Programmé, car il n’y a rien à préparer.',
  'help.gatherings.browsing.b2.i1.term': 'Programmé',
  'help.gatherings.browsing.b2.i1.text': 'Arrêté, et il aura lieu.',
  'help.gatherings.browsing.b2.i2.term': 'Terminé',
  'help.gatherings.browsing.b2.i2.text': 'Achevé, et déclaré achevé par la personne qui l’a mené.',
  'help.gatherings.browsing.b2.i3.term': 'Annulé',
  'help.gatherings.browsing.b2.i3.text': 'Décommandé. Rien n’est supprimé et cela peut être remis.',
  'help.gatherings.browsing.b3':
    '**À la une** marque un rassemblement que la famille devrait voir en premier : il '
    + 'reçoit un bandeau en haut du [tableau de bord](/dashboard). Plusieurs peuvent porter '
    + 'la marque à la fois, et le tableau de bord affiche le plus proche encore à venir — la '
    + 'retrouvaille de l’an dernier ne bloque donc jamais celle de cette année.',
  'help.gatherings.scheduling.heading': 'En programmer un',
  'help.gatherings.scheduling.b0':
    '**Programmer un rassemblement** apparaît lorsque vous pouvez en démarrer un. Le '
    + 'formulaire demande les modèles avant le titre, car en cocher un change ce à quoi le '
    + 'reste du formulaire sert :',
  'help.gatherings.scheduling.b1.i0': 'Appuyez sur **Programmer un rassemblement**.',
  'help.gatherings.scheduling.b1.i1':
    'Cochez les modèles que vous voulez sous **Bâti à partir de**. Chaque étape de chacun '
    + 'que vous cochez devient une tâche, prête à répartir, et chaque modèle coché devient un '
    + 'segment du rassemblement. N’en cochez aucun et le rassemblement est une date sans '
    + 'tâches.',
  'help.gatherings.scheduling.b1.i2': 'Remplissez **Titre**.',
  'help.gatherings.scheduling.b1.i3':
    'Remplissez **Quand** — voyez ci-dessous. Une date est tout ce qui est exigé.',
  'help.gatherings.scheduling.b1.i4': '**Où** et **Ce que c’est** sont facultatifs.',
  'help.gatherings.scheduling.b1.i5':
    'Appuyez sur **Programmer le rassemblement**. Vous arrivez sur le rassemblement '
    + 'lui-même, où les tâches qu’il vient de créer vous attendent.',
  'help.gatherings.scheduling.b2':
    'Chaque modèle décide lui-même qui peut programmer à partir de lui : la liste proposée '
    + 'ici n’est donc pas toute la bibliothèque — un modèle réservé aux Administrateurs n’y '
    + 'figure pas à moins que vous puissiez gérer les rassemblements, et un modèle archivé ne '
    + 'peut rien démarrer de nouveau. Là où rien n’est proposé du tout, le formulaire dit que '
    + 'le rassemblement sera une date sans tâches et renvoie à la bibliothèque pour qui peut '
    + 'en rédiger un : rien ne va mal avec votre accès.',
  'help.gatherings.when.heading': 'Quand cela a lieu',
  'help.gatherings.when.b0':
    '**Quand** est le même ensemble de commandes partout où un rassemblement est créé ou '
    + 'modifié. Une date est la seule chose sur laquelle il insiste ; tout le reste est là '
    + 'quand vous en avez besoin.',
  'help.gatherings.when.b1.i0.term': 'Commence',
  'help.gatherings.when.b1.i0.text':
    'Le jour où il commence et — si vous voulez le dire — l’heure. Laissez l’heure vide et '
    + 'le rassemblement est simplement « ce jour-là », ce qui est la façon dont la plupart '
    + 'sont saisis.',
  'help.gatherings.when.b1.i1.term': 'Heure de fin',
  'help.gatherings.when.b1.i1.text':
    'Quand il se termine. Sur une seule journée c’est une heure et rien d’autre : un '
    + 'pique-nique qui va de 11 h à 16 h a une heure de fin et aucune date de fin.',
  'help.gatherings.when.b1.i2.term': 'S’étend sur plus d’une journée',
  'help.gatherings.when.b1.i2.text':
    'Cochez ceci et une question de plus apparaît, car deux choses très différentes '
    + 'prennent toutes deux plus d’une journée.',
  'help.gatherings.when.b2': 'Cette question est celle qui compte :',
  'help.gatherings.when.b3.i0.term': 'Un bloc continu',
  'help.gatherings.when.b3.i0.text':
    'Une retrouvaille du vendredi soir au dimanche midi. Donnez le jour où il se termine '
    + 'et, si vous voulez, l’heure. Cela se dessine comme une seule barre couvrant ces jours '
    + 'sur [le calendrier](/gatherings/calendar).',
  'help.gatherings.when.b3.i1.term': 'Des jours séparés, le même rassemblement',
  'help.gatherings.when.b3.i1.text':
    'Une réunion de commission trois samedis. Ajoutez une ligne pour chaque jour, chacune '
    + 'avec ses propres horaires. Chacune se dessine comme sa propre entrée sur le '
    + 'calendrier, toutes portant le titre de ce rassemblement.',
  'help.gatherings.when.b4':
    'La différence compte plus qu’il n’y paraît. Avant que cela n’existe, trois samedis '
    + 'devaient être saisis comme un premier jour et un dernier jour — ce qui posait une '
    + 'barre sur toute la quinzaine et disait à la famille qu’elle se réunissait pendant deux '
    + 'semaines. Les jours séparés disent ce qui se passe réellement.',
  'help.gatherings.when.b5':
    '**La fin ne peut jamais précéder le début.** Les sélecteurs de date grisent les jours '
    + 'impossibles, et si vous y arrivez autrement le formulaire le dit plutôt que de '
    + 'l’enregistrer. Cela vaut aussi pour les horaires à l’intérieur d’une journée — 14 h à '
    + '9 h n’est pas un rassemblement — alors que sur plusieurs jours c’est parfaitement '
    + 'ordinaire : vendredi 18 h à dimanche 11 h est donc accepté.',
  'help.gatherings.when.b6':
    '**Donnez une heure et il vous est demandé dans quel fuseau horaire elle est**, en '
    + 'commençant par le vôtre. L’heure est ensuite affichée exactement comme vous l’avez '
    + 'saisie, avec ce fuseau nommé à côté — 11 h 00 CDT.',
  'help.gatherings.when.b7':
    'Rien n’est jamais converti. Une heure ici veut dire ce qu’elle dit là où le '
    + 'rassemblement a lieu, exactement comme sur une invitation imprimée, et chaque proche '
    + 'voit le même chiffre — le fuseau est nommé pour que quelqu’un d’ailleurs sache quoi en '
    + 'faire, non pour que le produit le déplace discrètement.',
  'help.gatherings.the-page.heading': 'La page propre à un rassemblement',
  'help.gatherings.the-page.b0':
    'Le titre, les dates, le lieu, puis **Tâches** : chaque travail du rassemblement, '
    + 'groupé par le segment auquel il appartient, dans l’ordre où ils seront répartis. '
    + 'Chaque groupe est coiffé du nom de ce segment, et sous lui le jour et le lieu propres '
    + 'au segment là où l’organisateur les a indiqués ; un segment qui n’indique ni l’un ni '
    + 'l’autre est coiffé de son nom seul. Une tâche dont le modèle a depuis été détaché est '
    + 'groupée sous **Sans modèle** plutôt que d’être écartée, car c’est toujours quelque '
    + 'chose qui a été demandé à un proche.',
  'help.gatherings.the-page.b1':
    'Chaque ligne donne à la tâche sa personne, son statut, sa date d’échéance, sa ligne '
    + 'budgétaire et la réponse acceptée. Dès qu’il y en a plus d’une poignée, **Trouver une '
    + 'tâche** restreint par travail ou par nom, et **Affichage** restreint à un seul statut.',
  'help.gatherings.the-page.b2.i0.term': 'Pas commencée',
  'help.gatherings.the-page.b2.i0.text': 'Personne n’a encore rien envoyé.',
  'help.gatherings.the-page.b2.i1.term': 'En attente d’examen',
  'help.gatherings.the-page.b2.i1.text': 'Une réponse est là et personne ne l’a tranchée.',
  'help.gatherings.the-page.b2.i2.term': 'Approuvée',
  'help.gatherings.the-page.b2.i2.text':
    'Acceptée. Cette réponse est le relevé qu’en garde la famille et la personne qui l’a '
    + 'envoyée ne peut pas la changer.',
  'help.gatherings.the-page.b2.i3.term': 'À revoir',
  'help.gatherings.the-page.b2.i3.text':
    'Renvoyée avec des notes. Les notes sont sur la ligne, et la personne qui tient la '
    + 'tâche les lit sur [Mes tâches de rassemblement](/gatherings/my-tasks).',
  'help.gatherings.the-page.b3':
    '**Organiser ce rassemblement** apparaît pour quelqu’un qui peut le mener et conduit au '
    + 'même rassemblement sur [Gestion des rassemblements](/admin/gatherings), là où le '
    + 'travail se répartit et se tranche. Sur le forfait Gratuit il indique **Modifier ce '
    + 'rassemblement** et mène au même endroit — il n’y a pas de travail à répartir, donc la '
    + 'console est là où le titre, les dates, le lieu et le statut se changent.',
  'help.gatherings.free-plan.heading': 'Les rassemblements sur le forfait Gratuit',
  'help.gatherings.free-plan.b0':
    'Un rassemblement est une date, un lieu et une description sur le forfait Gratuit, et '
    + 'c’est une fonctionnalité complète : il va sur [le calendrier](/gatherings/calendar), '
    + 'chaque proche peut le voir, et il peut être modifié ou annulé à tout moment.',
  'help.gatherings.free-plan.b1':
    'Ce que Gratuit n’inclut pas, c’est la moitié organisation — les listes de contrôle à '
    + 'partir desquelles un rassemblement est bâti, les tâches réparties à des proches '
    + 'nommément, et le budget tiré d’un fonds. Il n’y a donc pas de statut **En '
    + 'préparation**, pas de **Segments**, pas de **Tâches**, et rien à organiser ; la page '
    + 'du rassemblement dit ce que celles-ci apporteraient plutôt que d’afficher des panneaux '
    + 'vides pour elles.',
  'help.gatherings.free-plan.b2':
    'Rien n’est perdu en restant sur Gratuit et rien n’est perdu en le quittant. Une '
    + 'famille qui monte peut commencer à répartir du travail sur des rassemblements qu’elle '
    + 'a déjà, et une famille qui redescend garde chaque tâche et chaque réponse déjà '
    + 'enregistrées — elle ne peut simplement plus en ajouter.',
  'help.gatherings.budget.heading': 'Le bandeau Budget',
  'help.gatherings.budget.b0':
    'Un rassemblement peut porter un budget tiré de l’un des fonds de la famille. Là où '
    + 'c’est le cas, le bandeau **Budget** se place au-dessus des tâches avec quatre chiffres '
    + ':',
  'help.gatherings.budget.b1.i0.term': 'Budgété',
  'help.gatherings.budget.b1.i0.text': 'Ce que ce rassemblement prévoit de dépenser en tout.',
  'help.gatherings.budget.b1.i1.term': 'Réclamé par les tâches',
  'help.gatherings.budget.b1.i1.text':
    'Les lignes budgétaires de chaque tâche additionnées — ce qui a été réservé pour un '
    + 'travail particulier.',
  'help.gatherings.budget.b1.i2.term': 'Non affecté',
  'help.gatherings.budget.b1.i2.text':
    'Budgété moins réclamé : ce qu’il reste à répartir. Il indique Au-delà du budget dès '
    + 'que les lignes l’ont dépassé.',
  'help.gatherings.budget.b1.i3.term': 'Dans le fonds',
  'help.gatherings.budget.b1.i3.text':
    'Ce que le fonds détient réellement, et quelle part d’entre elle d’autres '
    + 'rassemblements réclament déjà.',
  'help.gatherings.budget.b2':
    'Un budget peut être plus grand que le fonds dont il est tiré, car une famille organise '
    + 'une retrouvaille avant d’avoir réuni l’argent pour une. Quand c’est le cas, une ligne '
    + 'rouge dit de combien — et une seconde ligne rouge apparaît là où ce rassemblement '
    + 'tient dans le fonds à lui seul mais plus une fois comptés les autres rassemblements '
    + 'tirant du même fonds. Aucune des deux n’est un refus. Ce sont les chiffres qui disent '
    + 'ce que le plan coûte.',
  'help.gatherings.budget.b3':
    'La ligne plus discrète en dessous est autre chose et n’est délibérément pas rouge : '
    + 'elle dit que les lignes des tâches réclament ensemble plus que le rassemblement n’a '
    + 'budgété. Rien n’a été dépensé, et cela se règle en augmentant le budget ou en rognant '
    + 'une ligne.',
  'help.gatherings.budget.b4':
    'Le bandeau est absent sur certains rassemblements, et absent n’est pas vide. Là où '
    + 'l’argent d’un rassemblement ne vous a pas été partagé, il n’y a aucun bandeau du tout '
    + 'plutôt qu’un bandeau disant qu’il est masqué — ce qui est autre chose qu’un '
    + 'rassemblement que personne n’a budgété, et celui-là affiche le bandeau sans rien '
    + 'dedans. Voyez [Qui peut faire quoi](/help/who-can-do-what#one-template).',
  // ──── PART 9 — Gatherings (My Gathering Tasks) ────────────────────────────────
  'help.gathering-tasks.title': 'Mes tâches de rassemblement',
  'help.gathering-tasks.summary':
    'Les tâches de rassemblement qui vous ont été confiées, le genre de réponse que chacune '
    + 'demande, et quoi faire quand l’une revient avec des notes.',
  'help.gathering-tasks.what-it-is.heading': 'Votre part d’un rassemblement',
  'help.gathering-tasks.what-it-is.b0':
    '**Mes tâches** est le second panneau des [Rassemblements](/gatherings), et c’est tout '
    + 'ce que quiconque vous a demandé de faire pour un rassemblement, tous rassemblements '
    + 'confondus, échéance la plus proche en premier — une tâche sans échéance se place en '
    + 'bas. L’onglet porte le décompte de ce qui vous attend, et la ligne du haut dit '
    + 'séparément combien sont revenues pour être revues.',
  'help.gathering-tasks.what-it-is.b1':
    'Il avait sa propre rangée de menu jusqu’au 19-08-2026 et est un panneau maintenant. '
    + 'L’ancienne adresse fonctionne toujours et arrive sur le panneau, et c’est ce qui garde '
    + 'un lien d’une ancienne notification pointant au bon endroit. Une Action rapide du '
    + '[Tableau de bord](/dashboard) apparaît quand quelque chose vous attend et disparaît '
    + 'quand il n’y a rien.',
  'help.gathering-tasks.what-it-is.b2':
    'Chaque carte nomme le rassemblement, le modèle dont la tâche est venue, quand elle est '
    + 'due et ce qu’elle peut dépenser. Une tâche dont l’échéance est passée est signalée '
    + 'plutôt que discrètement oubliée. Le texte d’aide que l’étape portait est imprimé sous '
    + 'le titre : c’est la personne qui l’a rédigé qui vous dit ce qui compte comme fait.',
  'help.gathering-tasks.what-it-is.b3':
    'CE QUI REND UNE TÂCHE DIFFÉRENTE D’UN FORMULAIRE QUE VOUS REMPLISSEZ, c’est ce qui se '
    + 'passe après votre réponse. Elle va à l’organisateur, qui l’accepte ou la renvoie avec '
    + 'des notes — une tâche est donc terminée quand quelqu’un l’a dit, non quand vous avez '
    + 'saisi quelque chose.',
  'help.gathering-tasks.what-it-is.b4':
    'Le panneau est toujours là et un panneau vide dit que rien ne vous est assigné. C’est '
    + 'l’état prévu pour la plupart des membres la plupart du temps plutôt qu’un défaut — et '
    + 'il est toujours là pour qu’une tâche confiée ce matin puisse être trouvée ce matin.',
  'help.gathering-tasks.answering.heading': 'Ce qu’une tâche demande',
  'help.gathering-tasks.answering.b0':
    'Une étape dit quel genre de réponse elle veut et vous recevez le champ qui correspond. '
    + 'Il n’y a pas de champ libre pour tout : une réponse qui ne convient pas au genre est '
    + 'refusée, avec le motif et une ligne disant ce que le champ attend.',
  'help.gathering-tasks.answering.b1.i0.term': 'Réponse courte',
  'help.gathering-tasks.answering.b1.i0.text':
    'Une ligne — un nom, un numéro de téléphone, une salle.',
  'help.gathering-tasks.answering.b1.i1.term': 'Réponse longue',
  'help.gathering-tasks.answering.b1.i1.text':
    'Un paragraphe — des notes, une description, une explication.',
  'help.gathering-tasks.answering.b1.i2.term': 'Une date',
  'help.gathering-tasks.answering.b1.i2.text': 'Une date du calendrier, depuis un champ de date.',
  'help.gathering-tasks.answering.b1.i3.term': 'Une liste',
  'help.gathering-tasks.answering.b1.i3.text':
    'Un nombre quelconque de lignes. Le champ indique **Un élément par ligne**, et une '
    + 'ligne vide est écartée plutôt qu’enregistrée comme un élément vierge.',
  'help.gathering-tasks.answering.b1.i4.term': 'Oui ou non',
  'help.gathering-tasks.answering.b1.i4.text':
    'Une décision, sous forme de deux choix. Vous devez en choisir un — ne rien toucher '
    + 'n’est pas une réponse, et rien n’est lu comme Non à votre place.',
  'help.gathering-tasks.answering.b1.i5.term': 'Un nombre',
  'help.gathering-tasks.answering.b1.i5.text':
    'Un décompte ou une quantité. Une fraction est permise, car « combien de kilos de '
    + 'brisket » est une vraie question.',
  'help.gathering-tasks.answering.b1.i6.term': 'Une somme d’argent',
  'help.gathering-tasks.answering.b1.i6.text':
    'Une somme en dollars avec les cents après le point : saisissez 450.00 pour quatre cent '
    + 'cinquante dollars. Le champ est précédé d’un signe dollar, et un champ vide est sans '
    + 'réponse plutôt que rien de dépensé.',
  'help.gathering-tasks.answering.b2':
    'Un champ vide n’est jamais envoyé. Appuyer sur le bouton sans rien dans la réponse dit '
    + 'qu’il n’y a encore rien à envoyer, et c’est ce qui empêche un champ d’argent non '
    + 'touché d’être classé comme zéro et de se lire comme répondu sur tous les écrans '
    + 'ensuite.',
  'help.gathering-tasks.sending.heading': 'Envoyer une réponse',
  'help.gathering-tasks.sending.b0.i0': 'Remplissez **Votre réponse**.',
  'help.gathering-tasks.sending.b0.i1':
    'Ajoutez ce qui vaut la peine d’être dit sous **Quelque chose à dire à l’organisateur '
    + '?**. C’est facultatif, et cela voyage avec la réponse plutôt que de la remplacer.',
  'help.gathering-tasks.sending.b0.i2': 'Appuyez sur **Envoyer pour examen**.',
  'help.gathering-tasks.sending.b1':
    'Ce que vous avez envoyé vous est ensuite montré au-dessus du formulaire, coiffé de '
    + '**Envoyé pour examen** avec la date. Jusqu’à ce que quelqu’un le tranche vous pouvez '
    + 'envoyer autre chose — le bouton indique **Remplacer ma réponse** — et chaque version '
    + 'est conservée : l’échange peut donc être relu en entier plutôt que seulement sa '
    + 'dernière ligne.',
  'help.gathering-tasks.sending.b2':
    'La personne qui peut la trancher en est informée dans ses notifications à l’instant où '
    + 'elle entre : vous n’avez donc à le dire à personne séparément.',
  'help.gathering-tasks.sent-back.heading': 'Quand elle revient',
  'help.gathering-tasks.sent-back.b0':
    'Une tâche peut être renvoyée, et son statut indique alors **À revoir**. Cette '
    + 'formulation est délibérée : ce n’est pas un rejet ni une marque contre vous, c’est la '
    + 'tâche renvoyée avec des consignes, et les consignes sont tout l’intérêt du renvoi.',
  'help.gathering-tasks.sent-back.b1':
    'Elles apparaissent en haut de la carte sous **Ce que l’organisateur a demandé**, '
    + 'au-dessus du formulaire, pour que vous les lisiez avant de saisir. Corrigez ce qu’ils '
    + 'ont demandé et appuyez sur **La renvoyer**.',
  'help.gathering-tasks.sent-back.b2':
    'Il n’y a pas de limite au nombre d’allers-retours d’une tâche, et une tâche qui a pris '
    + 'deux essais est la même tâche achevée qu’une qui en a pris un. Renvoyer est la façon '
    + 'ordinaire dont cela fonctionne plutôt qu’un échec à éviter.',
  'help.gathering-tasks.sent-back.b3':
    'Personne ne peut renvoyer une tâche sans dire ce qui doit changer — l’écran qu’ils '
    + 'utilisent ne l’envoie pas autrement. Si l’une arrive un jour sans notes, la carte le '
    + 'dit, et la chose à faire est de leur demander : il n’y a réellement rien là sur quoi '
    + 'agir.',
  'help.gathering-tasks.approved.heading': 'Une fois qu’elle est approuvée',
  'help.gathering-tasks.approved.b0':
    'Une réponse approuvée est définitive des deux côtés. La carte passe en lecture seule '
    + 'et montre ce qui a été accepté ; il n’y a aucun moyen d’en envoyer une autre, et '
    + 'essayer est refusé avec cette phrase plutôt que de sembler s’enregistrer. Elle cesse '
    + 'aussi d’être en retard, car l’échéance ne s’applique plus à rien.',
  'help.gathering-tasks.approved.b1':
    'Si une réponse approuvée doit vraiment changer, demandez à l’organisateur du '
    + 'rassemblement. Il a un bouton **Réouvrir…** de son côté, et l’utiliser remet la tâche '
    + 'entre vos mains : elle revient au formulaire ordinaire avec votre dernière réponse '
    + 'déjà dedans, de sorte qu’une correction d’un mot est une correction d’un mot. Vous ne '
    + 'pouvez pas le faire vous-même, et c’est tout ce que « définitive des deux côtés » veut '
    + 'dire.',
  'help.gathering-tasks.approved.b2':
    'Une tâche réouverte arrive de la même façon qu’une tâche renvoyée — dans vos '
    + 'notifications, et en haut de [Mes tâches de rassemblement](/gatherings/my-tasks) — '
    + 'avec le motif qu’il a donné, s’il en a donné un. Rien de ce que vous avez envoyé n’en '
    + 'est supprimé, et chaque version reste lisible.',
  // ──── PART 9 — Gatherings (Meeting Minutes) ───────────────────────────────────
  'help.meeting-minutes.title': 'Procès-verbaux',
  'help.meeting-minutes.summary':
    'Programmer une réunion par conseil ou par fonction, qui peut rédiger le procès-verbal, '
    + 'et comment la salle vote sur un sujet.',
  'help.meeting-minutes.what-it-is.heading': 'Ce qu’est cet écran',
  'help.meeting-minutes.what-it-is.b0':
    '[Procès-verbaux](/library/meeting-minutes) est le relevé par la famille de ce dont '
    + 'elle a débattu et de ce qu’elle a décidé. Une réunion a une date, une liste de qui est '
    + 'attendu, un **secrétaire** qui la rédige, et un nombre quelconque de **sujets**, '
    + 'chacun pouvant porter des notes et un vote.',
  'help.meeting-minutes.what-it-is.b1':
    '**Chaque personne de la famille peut lire les procès-verbaux.** C’est délibéré et '
    + 'c’est l’inverse du [carnet de fonction](/help/journal), que seul le titulaire lit : '
    + 'les procès-verbaux sont le relevé des décisions que la famille a prises, donc '
    + 'quelqu’un qui n’était pas dans la salle apprend tout de même ce qui a été décidé.',
  'help.meeting-minutes.what-it-is.b2':
    'Cela faisait partie des [Notes de fonction](/library/officer-notes) jusqu’au '
    + '22-08-2026, comme un genre d’entrée « réunion ». Une réunion a débordé de ce cadre : '
    + 'elle appartient à la famille plutôt qu’à une fonction, elle a un secrétaire, et elle a '
    + 'des votes — rien de quoi un carnet ne peut exprimer.',
  'help.meeting-minutes.scheduling.heading': 'En programmer une',
  'help.meeting-minutes.scheduling.b0':
    'Cela se fait en **trois étapes**, avec **Suivant** et **Retour**, et rien n’est '
    + 'enregistré avant la dernière.',
  'help.meeting-minutes.scheduling.b1.i0': 'Appuyez sur **Programmer une réunion**.',
  'help.meeting-minutes.scheduling.b1.i1':
    '**Étape 1 — les bases.** Un titre, une date, et **qui rédige le procès-verbal**. Ce '
    + 'dernier commence sur vous, car la personne qui programme une réunion la rédige '
    + 'd’ordinaire ; changez-le pour quelqu’un d’autre sinon. Seul le secrétaire peut écrire '
    + 'dans la réunion, et il doit être adulte.',
  'help.meeting-minutes.scheduling.b1.i2':
    '**Étape 2 — qui vient.** Dites d’abord quel genre de réunion c’est, puis choisissez au '
    + 'sein de ce genre. Voyez ci-dessous.',
  'help.meeting-minutes.scheduling.b1.i3':
    '**Étape 3 — quelqu’un d’autre.** Ajoutez des personnes individuelles par-dessus le '
    + 'corps que vous avez choisi, et vérifiez le décompte de la salle.',
  'help.meeting-minutes.scheduling.b1.i4': 'Appuyez sur **Programmer la réunion**.',
  'help.meeting-minutes.scheduling.b2':
    '**Chaque personne dans la salle est prévenue et l’a sur son calendrier.** Une '
    + 'notification part à chaque participant, et la réunion apparaît sur [le '
    + 'calendrier](/gatherings/calendar) pour eux — non pour toute la famille, car une '
    + 'réunion de commission sur le calendrier de tout le monde est un calendrier que '
    + 'personne ne lit. La liste des participants est aussi ce qui décide qui peut voter.',
  'help.meeting-minutes.scheduling.b3':
    'Le secrétaire est ajouté à la salle automatiquement, que vous l’ayez coché ou non. '
    + 'Quelqu’un qui rédige le procès-verbal y était.',
  'help.meeting-minutes.scheduling.b4':
    '**Retour ne perd jamais rien.** Revenir en arrière pour corriger une date puis '
    + 'repartir laisse vos choix là où ils étaient — avec une exception délibérée : changez '
    + 'le GENRE de réunion à l’étape 2 et la salle suit le nouveau genre, de sorte qu’un '
    + 'conseil coché avant de passer à une réunion de section ne suit pas discrètement.',
  'help.meeting-minutes.who-is-coming.heading': 'Qui vient : cinq genres de réunion',
  'help.meeting-minutes.who-is-coming.b0':
    'Une réunion familiale est presque toujours une réunion de **corps** plutôt qu’une '
    + 'liste de onze noms — toute la famille, une section, le conseil national, tous les '
    + 'présidents de section. L’étape 2 demande donc de quel genre il s’agit, ne montre que '
    + 'les options de ce genre, et calcule qui est dans le corps au moment où vous '
    + 'programmez.',
  'help.meeting-minutes.who-is-coming.b1.i0.term': 'Une réunion générale de la famille',
  'help.meeting-minutes.who-is-coming.b1.i0.text':
    'Chaque adulte de la famille. Rien à choisir — l’étape vous dit combien de personnes '
    + 'cela représente avant que vous ne vous y engagiez.',
  'help.meeting-minutes.who-is-coming.b1.i1.term': 'Une réunion de section',
  'help.meeting-minutes.who-is-coming.b1.i1.text':
    'Toutes les personnes enregistrées dans une section, titulaires ou non. **Ce n’est pas '
    + 'le conseil de la section** ; c’est la section entière. Seules les sections où '
    + 'quelqu’un se trouve sont proposées.',
  'help.meeting-minutes.who-is-coming.b1.i2.term': 'Une réunion de conseil',
  'help.meeting-minutes.who-is-coming.b1.i2.text':
    'Toutes les personnes occupant une fonction à un niveau en un lieu — **Conseil '
    + 'national**, **Conseil de la région du Texas**, **Conseil de la section d’Austin**. '
    + 'Seuls les conseils où quelqu’un siège réellement sont listés, et le nombre à côté de '
    + 'chacun dit combien de personnes cela représente.',
  'help.meeting-minutes.who-is-coming.b1.i3.term': 'Une réunion de fonctions',
  'help.meeting-minutes.who-is-coming.b1.i3.text':
    'Une seule fonction prise dans chaque région ou section qui la pourvoit. Choisir '
    + '**Président de section** invite le président de chaque section d’un coup.',
  'help.meeting-minutes.who-is-coming.b1.i4.term': 'Seulement les personnes que je nomme',
  'help.meeting-minutes.who-is-coming.b1.i4.text':
    'Personne au départ — pour une commission improvisée de trois, où il n’y a aucun corps '
    + 'à viser. Vous les ajoutez à l’étape 3.',
  'help.meeting-minutes.who-is-coming.b2':
    '**Un genre sans rien à choisir ne peut pas être choisi, et dit pourquoi.** Une famille '
    + 'qui n’a pas encore mis ses fonctions en place n’a aucun conseil à inviter ; cette '
    + 'ligne est grisée avec une phrase renvoyant à **Membres → Organisation** plutôt que '
    + 'masquée, pour qu’il soit clair que le produit peut le faire dès que la famille l’aura '
    + 'fait.',
  'help.meeting-minutes.who-is-coming.b3':
    '**Un corps est résolu au moment où vous programmez, non au moment où il a été mis en '
    + 'place.** Si la section d’Austin élit un nouveau trésorier le mois prochain, le conseil '
    + 'que vous avez choisi aujourd’hui a invité le trésorier qui l’occupait aujourd’hui — ce '
    + 'qui est juste, car la réunion est celle dont on l’a informé. Il en va de même pour une '
    + 'section : c’est qui y est enregistré ce jour-là.',
  'help.meeting-minutes.who-is-coming.b4':
    '**L’étape 3 ajoute des personnes par-dessus.** Quoi que le corps donne, vous pouvez en '
    + 'nommer davantage ; les deux s’additionnent, et quelqu’un qui apparaît dans les deux '
    + 'est un seul participant. La ligne sous le sélecteur compte la salle et la liste '
    + 'derrière **voir qui**, pour que vous puissiez vérifier ce qu’un choix vient d’ajouter '
    + 'avant de vous engager.',
  'help.meeting-minutes.adults.heading': 'Adultes seulement, et l’unique exception',
  'help.meeting-minutes.adults.b0':
    '**Le secrétaire doit être adulte**, et toute personne ajoutée à la salle **nommément** '
    + 'aussi. Les deux sélecteurs ne proposent que des adultes, et l’action en refuse un de '
    + 'toute façon si elle en est chargée directement.',
  'help.meeting-minutes.adults.b1':
    '**Une réunion de section et une réunion générale de la famille sont d’adultes aussi.** '
    + 'Personne de moins de dix-huit ans n’est dans l’une ou l’autre : aucune n’est donc un '
    + 'moyen de contourner la règle ci-dessus.',
  'help.meeting-minutes.adults.b2':
    '**Les personnes invitées au titre d’un conseil ou d’une fonction ne sont pas vérifiées '
    + 'quant à l’âge**, et c’est l’exception. Quelqu’un qui occupe une fonction est quelqu’un '
    + 'que la famille y a placé, et le retirer discrètement de la salle à cause d’une date de '
    + 'naissance enregistrée serait le produit passant outre cette décision, dans une liste '
    + 'que personne ne relit.',
  'help.meeting-minutes.adults.b3':
    'L’âge est calculé à partir de la date de naissance du profil de la personne, et un '
    + 'membre **sans** date de naissance enregistrée compte comme adulte. « Moins de dix-huit '
    + 'ans » est quelque chose que la famille a noté sur quelqu’un, non quelque chose à '
    + 'supposer sur un champ vide.',
  'help.meeting-minutes.writing.heading': 'Pendant la réunion',
  'help.meeting-minutes.writing.b0':
    '**Seul le secrétaire écrit.** Tous les autres lisent. Ajoutez un **sujet** pour chaque '
    + 'chose que la salle aborde, puis écrivez des notes en dessous à mesure — la même forme '
    + 'qu’un carnet de fonction : un titre, et un fil en dessous.',
  'help.meeting-minutes.writing.b1':
    'Les notes s’affichent de la plus ancienne à la plus récente, chacune avec l’heure à '
    + 'laquelle elle a été écrite, et une note modifiée depuis le dit.',
  'help.meeting-minutes.writing.b2':
    'Si vous êtes le secrétaire et que les commandes manquent, vérifiez si la réunion a été '
    + 'close. Une réunion close est en lecture seule.',
  'help.meeting-minutes.voting.heading': 'Voter sur un sujet',
  'help.meeting-minutes.voting.b0':
    'Le secrétaire appuie sur **Appeler un vote** sur un sujet. Chaque personne de la liste '
    + 'des participants peut alors répondre **Pour**, **Contre** ou **Abstention**, et le '
    + 'décompte courant est sur le sujet.',
  'help.meeting-minutes.voting.b1':
    '**Un vote ne peut être ni changé ni retiré par quiconque.** Ni par la personne qui l’a '
    + 'exprimé, ni par le secrétaire, ni par un administrateur. C’est la base de données qui '
    + 'l’impose plutôt que l’écran, et c’est pourquoi il n’y a aucune commande qui semble '
    + 'pouvoir le faire.',
  'help.meeting-minutes.voting.b2':
    '**Comment chaque personne a voté figure au relevé**, nommément. Un vote de réunion '
    + 'n’est pas un scrutin secret — les procès-verbaux existent pour dire qui a décidé quoi. '
    + 'C’est différent des [Élections](/help/elections), où le vote d’un membre n’appartient '
    + 'qu’à lui.',
  'help.meeting-minutes.voting.b3.i0.term': 'Seuls les participants votent',
  'help.meeting-minutes.voting.b3.i0.text':
    'La liste que vous avez choisie en programmant. Quelqu’un qui n’y est pas peut lire le '
    + 'sujet et le décompte et ne peut pas répondre.',
  'help.meeting-minutes.voting.b3.i1.term': 'Un vote clos reste clos',
  'help.meeting-minutes.voting.b3.i1.text':
    'Il n’est pas réouvert. Si la question doit être reposée, le secrétaire supprime le '
    + 'sujet et le rajoute — ce qui est visible, là où réouvrir discrètement un scrutin ne '
    + 'l’est pas.',
  'help.meeting-minutes.voting.b3.i2.term': 'Supprimer un sujet',
  'help.meeting-minutes.voting.b3.i2.text':
    'La seule façon dont un vote soit jamais retiré, et cela retire la question entière '
    + 'avec ses notes. La confirmation dit combien de votes partent avec elle.',
  'help.meeting-minutes.voting.b4':
    'Quelqu’un qui a déjà voté ne peut pas être retiré de la liste des participants — son '
    + 'bulletin est au relevé, donc le retirer laisserait un vote exprimé par quelqu’un dont '
    + 'le procès-verbal dit qu’il n’était pas là.',
  'help.meeting-minutes.closing.heading': 'Clore le procès-verbal',
  'help.meeting-minutes.closing.b0':
    '**Clore le procès-verbal** est ce qui transforme une réunion en relevé : plus de '
    + 'sujets, plus de notes, plus de votes. C’est ce qui rend digne de foi la chose que la '
    + 'famille citera l’an prochain.',
  'help.meeting-minutes.closing.b1':
    'Il peut être réouvert, par le secrétaire ou par quelqu’un ayant l’autorisation de '
    + 'modifier les réunions — clore trop tôt est une erreur ordinaire et l’alternative est '
    + 'un relevé définitivement faux. Réouvrir ne défait rien de ce qui a été décidé : les '
    + 'votes restent exactement tels qu’ils sont.',
  // ──── PART 9 — Gatherings (Gathering Management) ──────────────────────────────
  'help.gathering-management.title': 'Gestion des rassemblements',
  'help.gathering-management.summary':
    'Programmer un rassemblement, fixer son fonds et son budget, répartir les tâches, '
    + 'trancher les réponses qui reviennent, et rédiger les modèles dont tout est bâti.',
  'help.gathering-management.what-it-is.heading': 'Trois panneaux, et à quoi ils servent',
  'help.gathering-management.what-it-is.b0':
    '[Rassemblements](/admin/gatherings) sous Administration est le côté organisateur des '
    + '[Rassemblements](/gatherings), sur un menu à trois panneaux :',
  'help.gathering-management.what-it-is.b1.i0':
    '**Rassemblements** — chaque rassemblement que la famille a, avec ses dates, son '
    + 'statut, son budget face au fonds dont il est tiré, et la part de son travail qui a été '
    + 'approuvée.',
  'help.gathering-management.what-it-is.b1.i1':
    '**File d’examen** — chaque réponse en attente d’une décision, tous rassemblements '
    + 'confondus. Le panneau porte le décompte tant que quelque chose attend.',
  'help.gathering-management.what-it-is.b1.i2':
    '**Modèles** — la bibliothèque dont chaque rassemblement est bâti, traitée par [Modèles '
    + 'de rassemblement](/help/gathering-templates#what-it-is).',
  'help.gathering-management.what-it-is.b2':
    'Modèles avait sa propre rangée de menu jusqu’au 19-08-2026 et est un panneau ici '
    + 'maintenant ; son ancienne adresse fonctionne toujours et arrive sur le panneau. Il '
    + 's’accorde séparément des deux autres : une famille peut donc laisser quelqu’un rédiger '
    + 'les listes de contrôle sans le laisser engager la famille dans un rassemblement — ou '
    + 'l’inverse, qui est l’arrangement le plus courant.',
  'help.gathering-management.creating.heading': 'Programmer un rassemblement',
  'help.gathering-management.creating.b0.i0': 'Appuyez sur **Nouveau rassemblement**.',
  'help.gathering-management.creating.b0.i1':
    'Cochez les modèles que vous voulez sous **Bâti à partir de**. Leurs étapes deviennent '
    + 'ses tâches, dans l’ordre où les modèles sont nommés. N’en cochez aucun et le '
    + 'rassemblement est une date sans tâches, à laquelle un modèle peut être ajouté plus '
    + 'tard.',
  'help.gathering-management.creating.b0.i2':
    'Remplissez **Titre** et **Commence**, et **Se termine** seulement s’il dure plus d’une '
    + 'journée.',
  'help.gathering-management.creating.b0.i3':
    '**Lieu** et **Résumé** sont facultatifs — le résumé est ce que liront les personnes à '
    + 'qui l’on demandera d’aider.',
  'help.gathering-management.creating.b0.i4':
    'Choisissez un **Fonds** et un **Budget ($)** s’il dépense de l’argent, et cochez '
    + '**Afficher ceci en haut du Tableau de bord** s’il est celui que la famille devrait '
    + 'voir en premier.',
  'help.gathering-management.creating.b0.i5':
    'Appuyez sur **Créer le rassemblement**, puis **Ouvrir le rassemblement** pour '
    + 'commencer à répartir ses tâches.',
  'help.gathering-management.creating.b1':
    'Chaque modèle que vous cochez devient un segment du rassemblement, ce qui est la '
    + 'section suivante. Un rassemblement sans aucun est l’occasion elle-même — ses dates, '
    + 'son lieu et sa description — et c’est ce que le calendrier de la famille affiche dans '
    + 'les deux cas.',
  'help.gathering-management.segments.heading': 'Les segments, et leurs jours et lieux',
  'help.gathering-management.segments.b0':
    'Un rassemblement est rarement une seule occasion. Une retrouvaille est l’Accueil, le '
    + 'Pique-nique et les Adieux, à leurs propres jours dans leurs propres lieux, et chaque '
    + 'modèle dont le rassemblement a été bâti est l’une de ces parties. Le panneau '
    + '**Segments** de la page propre à un rassemblement est là où ils sont listés, et où le '
    + 'jour et le lieu de chacun se fixent.',
  'help.gathering-management.segments.b1.i0.term': 'Segment',
  'help.gathering-management.segments.b1.i0.text':
    'Le modèle dont cette partie est venue, avec combien de tâches sont venues avec lui.',
  'help.gathering-management.segments.b1.i1.term': 'Jour',
  'help.gathering-management.segments.b1.i1.text':
    'La date à laquelle cette partie a lieu. Facultatif — laissez-le vide pour un '
    + 'rassemblement qui a lieu d’un seul coup.',
  'help.gathering-management.segments.b1.i2.term': 'Lieu',
  'help.gathering-management.segments.b1.i2.text':
    'Où cette partie se tient. Facultatif, et cela commence vide — un modèle n’indique plus '
    + 'de lieu habituel.',
  'help.gathering-management.segments.b1.i3.term': 'Tâches',
  'help.gathering-management.segments.b1.i3.text':
    'Combien des tâches du rassemblement sont venues de ce modèle.',
  'help.gathering-management.segments.b2':
    'Saisissez dans l’un ou l’autre champ et un bouton **Enregistrer** apparaît sur cette '
    + 'ligne, de sorte que rien n’est écrit à chaque frappe et qu’une ligne qui s’enregistre '
    + 'ne bloque pas les autres. Les deux sont ce que les proches à qui l’on demande d’aider '
    + 'lisent réellement : le jour et le lieu d’un segment sont imprimés sous son titre sur '
    + 'la page propre au rassemblement.',
  'help.gathering-management.segments.b3.i0':
    'Choisissez un modèle sous **Ajouter un autre segment**.',
  'help.gathering-management.segments.b3.i1':
    'Fixez **Jour** et **Lieu**, ou laissez l’un ou l’autre vide.',
  'help.gathering-management.segments.b3.i2':
    'Appuyez sur **Ajouter ses étapes**. Chaque étape de ce modèle devient une tâche de ce '
    + 'rassemblement, et rien des tâches déjà présentes ne change.',
  'help.gathering-management.segments.b4':
    'Un jour hors des dates propres au rassemblement **est enregistré et signalé plutôt que '
    + 'refusé**, et la remarque est une ligne discrète sur la ligne et non une rouge : rien '
    + 'n’a échoué, il y a simplement une date à rapprocher. C’est délibéré — les dates '
    + 'bougent, et un organisateur qui décale le week-end ne devrait pas être arrêté par un '
    + 'segment qu’il ne regardait pas. La ligne apparaît quand le segment est enregistré : un '
    + 'rassemblement dont les dates ont bougé ensuite mérite donc un coup d’œil à ce panneau.',
  'help.gathering-management.segments.b5':
    'Le lieu d’un segment appartient au segment et à rien d’autre. Les modèles indiquaient '
    + 'auparavant un **Lieu habituel** recopié sur chaque segment bâti à partir d’eux, et '
    + 'cela n’existe plus (19-08-2026) : une salle appartient à une seule occasion, et un '
    + 'modèle qui en a besoin la demande avec une étape du genre **Un lieu** — confiée à un '
    + 'proche nommé, avec une échéance, et examinée comme toute autre réponse.',
  'help.gathering-management.premier.heading': 'Le bandeau du Tableau de bord',
  'help.gathering-management.premier.b0':
    '**Afficher ceci en haut du Tableau de bord** se trouve sur le panneau **Bandeau du '
    + 'Tableau de bord** de la page propre à un rassemblement. Un rassemblement marqué reçoit '
    + 'le bandeau sous le message d’accueil du [tableau de bord](/dashboard) — son titre, ses '
    + 'dates, son lieu, combien de ses tâches sont approuvées, et un accès direct.',
  'help.gathering-management.premier.b1':
    'Plusieurs rassemblements peuvent être marqués à la fois, délibérément. Le tableau de '
    + 'bord affiche le plus proche qui n’est pas terminé — la retrouvaille de l’an dernier ne '
    + 'bloque donc jamais celle de cette année, et rien n’y apparaît du tout quand aucun '
    + 'rassemblement marqué n’est encore à venir.',
  'help.gathering-management.premier.b2':
    '**Photo du bandeau**, sur le même panneau, fixe l’image autour de laquelle le bandeau '
    + 'est bâti — une photographie par rassemblement, recadrée à la forme du bandeau. Choisir '
    + 'un fichier le téléverse aussitôt ; **Retirer la photo** l’enlève. Sans elle, le '
    + 'bandeau dessine l’arbre GENORRA : il paraît donc fini dans les deux cas.',
  'help.gathering-management.premier.b3':
    'Une photo de bandeau téléversée peut être vue par quiconque a son adresse, exactement '
    + 'comme une photographie de la [Galerie](/community/gallery). En mettre une ici la '
    + 'publie auprès de quiconque le lien atteint : choisissez donc une image que la famille '
    + 'serait heureuse de partager.',
  'help.gathering-management.money.heading': 'Le fonds, le budget et la ligne rouge',
  'help.gathering-management.money.b0':
    'Un budget est toujours tiré d’un fonds, et les deux s’enregistrent ensemble — effacer '
    + 'le fonds efface le budget avec lui, et le champ du montant n’accepte pas de chiffre '
    + 'avant qu’un fonds soit choisi. Les fonds se mettent en place dans '
    + '[Comptabilité](/admin/accounting?section=funds) ; voyez '
    + '[Comptabilité](/help/accounting#funds).',
  'help.gathering-management.money.b1':
    'Plusieurs rassemblements peuvent tirer d’un seul fonds : un solde n’est donc pas à un '
    + 'rassemblement seul de le dépenser. Le bandeau de chaque rassemblement dit ce qui '
    + 'd’autre le réclame.',
  'help.gathering-management.money.b2':
    'Un budget plus grand que le fonds est permis et n’est pas une erreur. Les chiffres le '
    + 'disent par une ligne rouge plutôt qu’en refusant le nombre, car une famille organise '
    + 'une retrouvaille avant d’avoir réuni l’argent pour une — le refuser voudrait dire que '
    + 'le plan ne pourrait pas être écrit du tout.',
  'help.gathering-management.money.b3':
    'Chaque tâche peut porter sa propre **Ligne budgétaire ($)**, fixée dans la boîte de '
    + 'cette tâche : ce que ce seul travail est censé coûter, un champ vide voulant dire '
    + 'qu’il ne coûte rien à la famille. Les lignes ensemble sont ce que le bandeau compare '
    + 'au budget, et le budget suggéré d’une étape de modèle n’est que le chiffre auquel une '
    + 'ligne commence. Lorsque les lignes dépassent le budget, le bandeau le dit dans un '
    + 'traitement plus discret et délibérément différent — rien n’a été dépensé, et cela se '
    + 'règle en augmentant le budget ou en rognant une ligne.',
  'help.gathering-management.assigning.heading': 'Répartir le travail',
  'help.gathering-management.assigning.b0':
    'Appuyez sur **Gérer** sur une tâche — **Examiner** quand quelque chose y attend — et '
    + 'une seule boîte contient tout au sujet de cette tâche.',
  'help.gathering-management.assigning.b1.i0':
    'Choisissez quelqu’un sous **Assignée à**. Le sélecteur cherche dans n’importe quelle '
    + 'partie de n’importe quel nom, et c’est ce qui le rend utilisable dans une famille de '
    + 'cent quarante personnes.',
  'help.gathering-management.assigning.b1.i1': 'Fixez **Échéance** si elle a une date limite.',
  'help.gathering-management.assigning.b1.i2': 'Appuyez sur **Enregistrer qui et quand**.',
  'help.gathering-management.assigning.b2':
    'Toute personne que la famille a approuvée peut tenir une tâche, qu’elle ait un compte '
    + 'propre ou non : on peut donc tout de même demander à un proche inscrit sur l’arbre '
    + 'sans identifiants d’apporter les photographies. Quelqu’un dont l’adhésion est encore '
    + 'en attente ne peut pas, et l’écran le dit plutôt que d’échouer en silence. **La '
    + 'laisser non assignée** retire une tâche à quelqu’un.',
  'help.gathering-management.assigning.b3':
    'La personne que vous assignez est prévenue dans ses notifications, et la tâche '
    + 'apparaît dans ses [Mes tâches de rassemblement](/gatherings/my-tasks) avec votre '
    + 'échéance dessus.',
  'help.gathering-management.reviewing.heading': 'Trancher une réponse',
  'help.gathering-management.reviewing.b0':
    'Une réponse arrive dans la **File d’examen** avec ce qui a été envoyé, toute note que '
    + 'l’expéditeur a ajoutée, qui l’a envoyée et quand. Il y a deux décisions :',
  'help.gathering-management.reviewing.b1.i0':
    '**Approuver** — acceptée, et définitive. La réponse devient le relevé qu’en garde la '
    + 'famille et la personne qui l’a envoyée ne peut plus la changer, et c’est pourquoi cela '
    + 'est confirmé d’abord.',
  'help.gathering-management.reviewing.b1.i1':
    '**Renvoyer…** — renvoyée avec des consignes. Cela ouvre **Ce qui doit changer**, et ce '
    + 'champ est obligatoire : une tâche renvoyée avec rien dedans dit à un proche que sa '
    + 'réponse n’a pas été acceptée alors qu’aucun écran nulle part ne dit quoi en faire. Ce '
    + 'que vous écrivez est envoyé avec la tâche et est la première chose qu’il voit.',
  'help.gathering-management.reviewing.b2':
    'Une tâche renvoyée indique **À revoir** sur chaque écran et peut être répondue de '
    + 'nouveau autant de fois qu’il le faut. Chaque envoi est conservé : l’échange entier est '
    + 'donc lisible depuis la tâche plutôt que seulement sa dernière ligne.',
  'help.gathering-management.reviewing.b3':
    'Une réponse approuvée peut être reprise, et seulement d’ici. Ouvrez la tâche et '
    + 'appuyez sur **Réouvrir…**, ajoutez une ligne sous **Pourquoi, si vous voulez le dire '
    + '(facultatif)** s’il y a quelque chose à expliquer, puis appuyez sur **Réouvrir** pour '
    + 'confirmer. La tâche retourne à la personne qui la tient avec sa réponse encore dessus, '
    + 'elle est prévenue dans ses notifications, et le motif voyage avec elle. Rien n’est '
    + 'effacé : la réponse reste son point de départ et chaque envoi reste au relevé, y '
    + 'compris l’approbation que vous venez de reprendre.',
  'help.gathering-management.reviewing.b4':
    'Le motif est facultatif ici et obligatoire sur **Renvoyer…**, ce qui paraît incohérent '
    + 'et ne l’est pas. Renvoyer du travail sans consignes ne laisse à un proche rien sur '
    + 'quoi agir ; reprendre votre propre approbation est d’ordinaire une correction de votre '
    + 'propre lecture, et il n’y a souvent rien à dire au-delà du fait que cela doit changer.',
  'help.gathering-management.reviewing.b5':
    'Réouvrir est le seul retour depuis une approbation : approuvez donc délibérément même '
    + 'si cela peut être défait. La personne qui a envoyé la réponse ne peut pas la réouvrir '
    + 'et ne peut pas la remplacer tant qu’elle tient — de son côté, approuvée est réellement '
    + 'définitive, et chaque écran lui dit de venir vous voir.',
  'help.gathering-management.changing.heading': 'En modifier une ou y mettre fin',
  'help.gathering-management.changing.b0':
    '**Statut** se fixe à la main — **En préparation**, **Programmé**, **Terminé** ou '
    + '**Annulé** — car aucun des quatre n’est quelque chose que le calendrier sache : un '
    + 'rassemblement peut être annulé sans que ses dates bougent, et terminé est '
    + 'l’affirmation de quelqu’un plutôt qu’une date qui passe. **Enregistrer les '
    + 'modifications** le valide en même temps que le titre, les dates et le lieu.',
  'help.gathering-management.changing.b1':
    '**Supprimer le rassemblement** est refusé dès qu’une de ses réponses a été approuvée. '
    + 'Le refus dit combien et propose Annulé à la place, ce qui ne supprime rien et peut '
    + 'être remis.',
  'help.gathering-management.changing.b2':
    'Retirer un segment — la corbeille sur sa ligne, confirmée comme **Retirer le modèle** '
    + '— est refusé de la même façon dès qu’une tâche venue de lui a été assignée ou '
    + 'répondue. Les tâches venues d’un modèle sont ce qui a réellement été demandé aux '
    + 'proches et elles survivent au lien : détacher un modèle n’efface donc jamais que les '
    + 'tâches que personne n’a touchées.',
  // ──── PART 9 — Gatherings (Gathering Templates) ───────────────────────────────
  'help.gathering-templates.title': 'Modèles de rassemblement',
  'help.gathering-templates.summary':
    'Rédiger les listes pas à pas dont un rassemblement est bâti, y compris une étape qui '
    + 'est un autre modèle, décider qui peut programmer à partir de l’un, et archiver un '
    + 'modèle déjà utilisé.',
  'help.gathering-templates.what-it-is.heading': 'Ce qu’est un modèle',
  'help.gathering-templates.what-it-is.b0':
    'Le panneau **Modèles** des [Rassemblements](/admin/gatherings) sous Administration est '
    + 'la bibliothèque dont un rassemblement est bâti. Un modèle est un nom et une liste '
    + 'ordonnée d’étapes — une par chose que quelqu’un doit faire ou décider — et programmer '
    + 'un rassemblement à partir de lui transforme chaque étape en une tâche en attente '
    + 'd’être confiée à un proche.',
  'help.gathering-templates.what-it-is.b1':
    'Il avait sa propre rangée de menu jusqu’au 19-08-2026 et est un panneau maintenant. '
    + 'L’ancienne adresse fonctionne toujours et y arrive.',
  'help.gathering-templates.what-it-is.b2':
    'Modifier un modèle ne change jamais un rassemblement déjà bâti à partir de lui. Chaque '
    + 'tâche garde sa propre copie de ce qu’elle demandait : une étape renommée ici atteint '
    + 'donc la retrouvaille de l’an prochain et non celle en cours, et la réponse de personne '
    + 'n’est jamais réécrite sous ses yeux. C’est ce qui rend la bibliothèque sûre à '
    + 'continuer de ranger, et la carte le dit.',
  'help.gathering-templates.adding.heading': 'Ajouter un modèle',
  'help.gathering-templates.adding.b0.i0': 'Appuyez sur **Ajouter un modèle** en haut du panneau.',
  'help.gathering-templates.adding.b0.i1':
    'Donnez-lui un **Nom de modèle** — nommez-le d’après l’occasion : « Retrouvailles '
    + 'familiales », « Hommage », « Banquet des bourses ».',
  'help.gathering-templates.adding.b0.i2':
    'Écrivez une **Description** si vous en voulez une, et choisissez **Qui peut programmer '
    + 'à partir de ceci**.',
  'help.gathering-templates.adding.b0.i3': 'Appuyez sur **Ajouter le modèle**.',
  'help.gathering-templates.adding.b0.i4':
    'La carte qui apparaît est fermée. Appuyez sur son nom pour l’ouvrir, puis donnez-lui '
    + 'une étape par chose que quelqu’un doit faire.',
  'help.gathering-templates.adding.b1':
    '**Chaque carte de modèle est fermée jusqu’à ce que vous l’ouvriez.** Ouverte, une '
    + 'carte montre la description, qui peut programmer à partir d’elle, et une ligne par '
    + 'étape — ce qui fait une page entière dès qu’une famille en a une demi-douzaine. '
    + 'Fermée, chacune montre son nom et combien d’étapes elle a, de sorte que la '
    + 'bibliothèque se lit comme une liste de ce que vous avez plutôt que comme tout sur '
    + 'tout. Appuyez sur un nom pour l’ouvrir ; appuyez de nouveau pour la fermer.',
  'help.gathering-templates.adding.b2':
    '**On ne saisit directement dans rien sur une carte.** La carte dit ce qu’est le modèle '
    + '; **Modifier** à côté de son nom ouvre une boîte contenant le nom, la description et '
    + 'qui peut programmer, et chaque étape a son propre bouton **Modifier**. C’est ce qui '
    + 'garde la bibliothèque lisible — un écran de cent champs actifs ne se parcourt pas d’un '
    + 'regard, et parcourir d’un regard est à quoi cette page sert.',
  'help.gathering-templates.adding.b3':
    'Une boîte ouverte s’enregistre ou est abandonnée : il n’existe donc pas de modèle à '
    + 'demi enregistré. Appuyez sur **Annuler** ou **Échap** et rien n’a changé.',
  'help.gathering-templates.adding.b4':
    'Un nom doit être unique dans la famille : une seconde « Retrouvailles familiales » est '
    + 'donc refusée plutôt qu’ajoutée discrètement à côté de la première. La description est '
    + 'ce qu’un organisateur lit avant de programmer à partir d’elle, et elle est montrée à '
    + 'côté du modèle lorsqu’il en choisit un.',
  'help.gathering-templates.adding.b5':
    'Il y avait ici un champ **Lieu habituel** jusqu’au 19-08-2026 et il n’y en a plus. Un '
    + 'modèle qui indiquait où ses rassemblements se tiennent d’habitude était un auteur '
    + 'devinant un fait qui appartient à une seule occasion, et la devinette devait ensuite '
    + 'être corrigée sur chaque segment où elle avait été recopiée. Demandez plutôt la salle '
    + ': une étape du genre **Un lieu**, confiée à un proche nommé avec une échéance.',
  'help.gathering-templates.steps.heading': 'Les étapes',
  'help.gathering-templates.steps.b0.i0':
    'Appuyez sur **Ajouter une étape** à côté du titre Étapes.',
  'help.gathering-templates.steps.b0.i1':
    'Saisissez le libellé sous **Étape** — « Réserver la salle », « Décompte des présents '
    + '», « Traiteur ».',
  'help.gathering-templates.steps.b0.i2':
    'Choisissez **Ce qu’elle demande**. La ligne sous le sélecteur dit ce que la personne '
    + 'qui tient la tâche recevra à remplir.',
  'help.gathering-templates.steps.b0.i3':
    'Mettez tout ce qu’il doit savoir dans **Texte d’aide** — qui appeler, ce qui compte '
    + 'comme fait. Il le lit sous la tâche elle-même.',
  'help.gathering-templates.steps.b0.i4':
    'Cochez **Obligatoire** si le rassemblement n’est pas terminé avant que celle-ci soit '
    + 'répondue et approuvée.',
  'help.gathering-templates.steps.b0.i5':
    'Fixez un **Budget suggéré ($)** si le travail coûte de l’argent.',
  'help.gathering-templates.steps.b0.i6': 'Appuyez sur **Ajouter l’étape**.',
  'help.gathering-templates.steps.b1':
    'Il y a neuf genres d’étape. Huit d’entre eux décident ce que la personne qui répond '
    + 'reçoit :',
  'help.gathering-templates.steps.b2.i0.term': 'Réponse courte',
  'help.gathering-templates.steps.b2.i0.text':
    'Une ligne — un nom, un numéro de téléphone, une réponse en quelques mots.',
  'help.gathering-templates.steps.b2.i1.term': 'Réponse longue',
  'help.gathering-templates.steps.b2.i1.text':
    'Un paragraphe — des notes, une description, une explication.',
  'help.gathering-templates.steps.b2.i2.term': 'Une date',
  'help.gathering-templates.steps.b2.i2.text':
    'Une seule date du calendrier, choisie dans un champ de date.',
  'help.gathering-templates.steps.b2.i3.term': 'Un lieu',
  'help.gathering-templates.steps.b2.i3.text':
    'Une salle, une adresse, une pièce. Une ligne, et un téléphone proposera les adresses '
    + 'qu’il connaît déjà.',
  'help.gathering-templates.steps.b2.i4.term': 'Une liste',
  'help.gathering-templates.steps.b2.i4.text':
    'Un nombre quelconque de lignes, un élément chacune, ajoutées et retirées à mesure.',
  'help.gathering-templates.steps.b2.i5.term': 'Oui ou non',
  'help.gathering-templates.steps.b2.i5.text':
    'Une décision. Il doit choisir ; laisser vide n’est pas une réponse.',
  'help.gathering-templates.steps.b2.i6.term': 'Un nombre',
  'help.gathering-templates.steps.b2.i6.text':
    'Un décompte ou une quantité. L’argent a son propre genre — utilisez celui-là pour '
    + 'l’argent.',
  'help.gathering-templates.steps.b2.i7.term': 'Une somme d’argent',
  'help.gathering-templates.steps.b2.i7.text': 'Une somme en dollars, enregistrée au cent près.',
  'help.gathering-templates.steps.b3':
    'Le neuvième est celui qui sort du lot et fait l’objet de la section suivante.',
  'help.gathering-templates.steps.b4':
    'Chaque ligne dit ce qu’est l’étape : son libellé, son texte d’aide en dessous, ce '
    + 'qu’elle demande, si elle est obligatoire et ce qu’elle suggère de dépenser. Pour '
    + 'changer l’un de ces éléments, appuyez sur le crayon de la ligne et la même boîte '
    + 's’ouvre avec l’étape dedans.',
  'help.gathering-templates.steps.b5':
    'Les flèches d’une ligne déplacent une étape plus tôt ou plus tard, et cet ordre est '
    + 'l’ordre dans lequel les tâches sont réparties. Supprimer une étape laisse chaque tâche '
    + 'déjà créée à partir d’elle exactement là où elle est.',
  'help.gathering-templates.steps.b6':
    'Un budget suggéré n’est qu’un chiffre de départ recopié sur la tâche. Il peut être '
    + 'changé sur le rassemblement, et ce qui compte face au fonds est le budget propre au '
    + 'rassemblement — voyez [Gestion des rassemblements](/help/gathering-management#money).',
  'help.gathering-templates.nested.heading': 'Une étape qui est un autre modèle',
  'help.gathering-templates.nested.b0':
    'Le neuvième genre est **Un autre modèle**, et personne n’y répond. Choisissez un '
    + 'modèle et chaque étape de CE modèle devient une tâche à part entière, à cet endroit de '
    + 'la liste, chaque fois qu’un rassemblement est bâti à partir de celui-ci.',
  'help.gathering-templates.nested.b1':
    'C’est pour la liste de contrôle que votre famille utilise à l’intérieur de plusieurs '
    + 'occasions différentes. Rédigez les cinq étapes de « Traiteur » une fois, puis donnez à '
    + '« Retrouvailles familiales », « Hommage » et « Banquet des bourses » une étape '
    + 'Traiteur chacun — et corriger la liste du traiteur l’an prochain corrige les trois.',
  'help.gathering-templates.nested.b2.i0':
    'Appuyez sur **Ajouter une étape**, et saisissez un libellé — il ne coiffe rien par '
    + 'lui-même, donc nommez-le d’après ce que le lecteur de ce modèle devrait voir : « La '
    + 'liste du traiteur ».',
  'help.gathering-templates.nested.b2.i1':
    'Choisissez **Un autre modèle** sous **Ce qu’elle demande**.',
  'help.gathering-templates.nested.b2.i2': 'Choisissez celui à inclure sous **Modèle à inclure**.',
  'help.gathering-templates.nested.b2.i3': 'Appuyez sur **Ajouter l’étape**.',
  'help.gathering-templates.nested.b3':
    '**Texte d’aide**, **Obligatoire** et **Budget suggéré** ne sont pas proposés pour ce '
    + 'genre et c’est délibéré : personne n’y répondra, donc il n’y a personne à conseiller, '
    + 'rien à exiger et aucun travail unique à chiffrer. Les étapes qu’il apporte portent les '
    + 'leurs.',
  'help.gathering-templates.nested.b4':
    'Un modèle ne peut pas s’inclure lui-même, et il ne peut pas inclure quelque chose qui '
    + 'y ramène — A dans B dans A est refusé avec une phrase le disant. Seuls les autres '
    + 'modèles de la famille sont proposés, et un modèle archivé peut tout de même être '
    + 'inclus : archiver veut dire « ne rien démarrer de NOUVEAU à partir de ceci », ce qui '
    + 'porte sur la programmation d’un rassemblement et non sur la composition d’une liste de '
    + 'contrôle.',
  'help.gathering-templates.nested.b5':
    'Modifier le modèle inclus change ce que le PROCHAIN rassemblement reçoit et jamais un '
    + 'rassemblement déjà en cours — la même règle que suit chaque autre étape, pour la même '
    + 'raison. Ceci est donc sûr à continuer de ranger, et corriger une liste de contrôle '
    + 'partagée atteint réellement chaque modèle qui l’inclut.',
  'help.gathering-templates.who-may-schedule.heading': 'Qui peut programmer à partir de ceci',
  'help.gathering-templates.who-may-schedule.b0':
    '**Qui peut programmer à partir de ceci** se fixe par modèle, et c’est la seule chose '
    + 'sur cet écran qu’un membre en dehors des pages d’administration ressente jamais :',
  'help.gathering-templates.who-may-schedule.b1.i0.term': 'Administrateurs seulement',
  'help.gathering-templates.who-may-schedule.b1.i0.text':
    'Seule une personne qui peut gérer les rassemblements peut en démarrer un à partir de '
    + 'ce modèle.',
  'help.gathering-templates.who-may-schedule.b1.i1.term': 'N’importe quel membre',
  'help.gathering-templates.who-may-schedule.b1.i1.text':
    'Tout membre qui peut programmer un rassemblement peut en démarrer un à partir de ce '
    + 'modèle. Il ne peut toujours pas modifier le modèle lui-même.',
  'help.gathering-templates.who-may-schedule.b2':
    'Modifier un modèle est un travail d’administration quelle que soit celle des deux qui '
    + 'est fixée. Une famille peut donc distribuer « n’importe qui peut organiser un '
    + 'anniversaire » sans distribuer aussi « n’importe qui peut changer en quoi consiste un '
    + 'anniversaire », et c’est la raison pour laquelle le réglage se trouve sur le modèle '
    + 'plutôt que sur la personne.',
  'help.gathering-templates.archiving.heading': 'Archiver, et supprimer',
  'help.gathering-templates.archiving.b0':
    '**Archiver** retire un modèle de la liste de ceux à partir desquels on peut programmer '
    + 'et laisse chaque rassemblement bâti à partir de lui exactement tel qu’il est. Rien en '
    + 'cours ne change et rien n’est supprimé ; la carte dit qu’il est archivé et que rien de '
    + 'nouveau ne peut être démarré à partir de lui, et **Restaurer** le remet.',
  'help.gathering-templates.archiving.b1':
    'Un modèle à partir duquel un rassemblement a été bâti ne peut pas être supprimé. Le '
    + 'refus dit combien de rassemblements l’ont utilisé et propose de l’archiver à la place, '
    + 'avec un bouton **L’archiver plutôt** à côté du message. La raison est le relevé : les '
    + 'tâches de ces rassemblements disent de quel modèle elles sont venues, et le supprimer '
    + 'emporterait cela. Un modèle que rien n’a encore utilisé se supprime proprement, avec '
    + 'ses étapes.',
  'help.gathering-templates.archiving.b2':
    'Le décompte des usages est imprimé sur la carte à côté de la commande de suppression : '
    + 'le refus est donc rarement une surprise. Il est arrivé avec la page, cela dit, et un '
    + 'rassemblement programmé depuis n’y figurera pas — c’est le refus lui-même qui décide.',

  // ── Family Settings · What happens to your records (20260901000002) ──────────────
  'help.family-settings.retention.heading': 'Ce qu’il advient de vos données',
  'help.family-settings.retention.b0':
    '**Passer à une offre moins chère ne supprime rien le jour où vous le faites.** Les pages '
    + 'que cette offre incluait cessent de s’ouvrir, et tout ce qui se trouve derrière est '
    + 'conservé pendant **soixante jours**. Remontez dans ces soixante jours et chaque donnée '
    + 'est exactement là où vous l’avez laissée.',
  'help.family-settings.retention.b1':
    '**Facturation** affiche la date en permanence, et quatre rappels sont envoyés à la '
    + 'personne qui s’occupe de la facturation : trente jours avant, quinze, cinq et un.',
  'help.family-settings.retention.b2.i0.term': 'La conserver',
  'help.family-settings.retention.b2.i0.text':
    'Revenez à l’offre que vous avez quittée. Cela couvre les mois d’absence ainsi que le mois '
    + 'à venir, afin que l’offre n’ait aucun trou, et le montant figure dans la section '
    + 'Facturation avant tout engagement.',
  'help.family-settings.retention.b2.i1.term': 'La laisser partir',
  'help.family-settings.retention.b2.i1.text':
    'Ne faites rien et elle sera supprimée à la date indiquée, sans frais supplémentaires. Si '
    + 'votre décision est prise, **Supprimer ces données…** dans la section Facturation le fait '
    + 'aujourd’hui plutôt que de vous le rappeler trois fois de plus : un code à six chiffres '
    + 'vous est d’abord envoyé par courriel, et la liste exacte de ce qui sera retiré s’affiche.',
  'help.family-settings.retention.b3':
    '**Les données supprimées ne peuvent pas être récupérées.** Ni par vous, ni par le support '
    + 'GENORRA, ni depuis une sauvegarde. C’est la raison d’être des soixante jours et des '
    + 'quatre rappels, et c’est la seule phrase de cette page qui mérite d’être lue deux fois.',
  'help.family-settings.retention.b4':
    '**Ce qui n’est jamais supprimé :** vos proches, l’Annuaire, les annonces, la messagerie, le '
    + 'calendrier et tout ce que l’offre Gratuite inclut. Une famille qui cesse complètement de '
    + 'payer conserve tout cela.',

  // ── Family Settings · If a payment fails ─────────────────────────────────────────
  'help.family-settings.overdue.heading': 'Si un paiement échoue',
  'help.family-settings.overdue.b0':
    'Une carte est refusée pour des raisons ordinaires : elle a expiré, la banque l’a signalée, '
    + 'l’adresse de facturation a changé. Rien ne change le jour où cela arrive, et mettre la '
    + 'carte à jour dans **Facturation** règle la situation.',
  'help.family-settings.overdue.b1':
    'Si l’impayé persiste, l’accès est limité par étapes afin que la personne capable de le '
    + 'régler le puisse toujours :',
  'help.family-settings.overdue.b2.i0.term': 'Au bout de 5 jours',
  'help.family-settings.overdue.b2.i0.text':
    'Toutes les personnes chargées de la facturation reçoivent un courriel. Rien n’est limité '
    + 'et chacun continue comme d’habitude.',
  'help.family-settings.overdue.b2.i1.term': 'Au bout de 10 jours',
  'help.family-settings.overdue.b2.i1.text':
    'Les proches ne peuvent plus utiliser le site. Les administrateurs conservent l’accès '
    + 'complet, et le paiement le rétablit pour tout le monde d’un coup.',
  'help.family-settings.overdue.b2.i2.term': 'Au bout de 30 jours',
  'help.family-settings.overdue.b2.i2.text':
    'Seule la section Facturation reste ouverte, pour les administrateurs aussi. Rien n’a été '
    + 'retiré et tout se rouvre au paiement.',
  'help.family-settings.overdue.b2.i3.term': 'Au bout de 60 jours',
  'help.family-settings.overdue.b2.i3.text':
    'La famille passe à l’offre Gratuite, et ce que l’offre Gratuite n’inclut pas est supprimé. '
    + 'Deux avertissements sont envoyés avant : à 45 jours et la veille.',
  'help.family-settings.overdue.b3':
    '**Rien n’est supprimé avant le 60e jour, et rien de l’offre ne change avant non plus.** '
    + 'Payez le 59e jour et chaque écran et chaque donnée sont exactement là où ils étaient. Ce '
    + 'qui est supprimé le 60e jour ne peut pas être récupéré.',
  'help.family-settings.overdue.b4':
    'Un membre qui voit « temporairement indisponible » reçoit tout le message à dessein : ce '
    + 'qu’une famille doit à GENORRA ne regarde pas chacun de ses proches. On lui demande de '
    + 'contacter la personne qui tient la comptabilité de la famille, celle qui peut réellement '
    + 'régler la situation.',
}
