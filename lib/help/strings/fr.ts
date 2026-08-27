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
  'help.finding-your-way-around.the-top-bar.b1.i3.term': 'Apparence',
  'help.finding-your-way-around.the-top-bar.b1.i3.text':
    'Clair, Sombre ou Système. C’est retenu dans ce navigateur.',
  'help.finding-your-way-around.the-top-bar.b1.i4.term': 'Votre nom',
  'help.finding-your-way-around.the-top-bar.b1.i4.text':
    'Ouvre le menu du compte : [Mon profil](/personal-info), [Mes familles](/my-families), '
    + 'l’apparence et la déconnexion.',
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
    + '**Courriel**, **SMS** et **Notification push**. Chaque case est une pression, '
    + '**Activé** ou **Désactivé**, et elle s’enregistre au moment où vous appuyez. Il n’y a '
    + 'rien à soumettre.',
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
    '**Notification push** indique **Pas encore développé** sur chaque ligne. La colonne '
    + 'est là pour que vous voyiez ce qui arrive plutôt que d’en être surpris plus tard ; '
    + 'rien dans le produit n’en envoie aujourd’hui.',
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
    'Désactiver la case **SMS** les arrête immédiatement, sans rien à confirmer et sans '
    + 'qu’on vous demande pourquoi. Vous pouvez la réactiver quand vous le voulez.',
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
    'Un forfait décide quels écrans une famille peut ouvrir, et rien d’autre. Une famille '
    + 'qui passe à un forfait moins cher conserve chaque enregistrement qu’elle a jamais '
    + 'saisi — les pages qui les lisent cessent simplement de s’ouvrir. Y revenir les ramène '
    + 'aussitôt.',
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
    'Toutes les personnes de la famille, sur quel modèle d’autorisations chacune se trouve, '
    + 'et quel poste au conseil chacune occupe. Quatre colonnes — Nom, Fonction, Section et '
    + 'Groupe — avec tout le reste concernant une personne derrière son nom, exactement comme '
    + 'sur le [Répertoire](/help/directory#columns).',
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
    '**Pour arrêter de payer, descendez à Gratuit dans la section '
    + '[Forfait](/admin/settings).** Cela met fin à un forfait mensuel à la fin de la période '
    + 'déjà payée, jamais immédiatement. Chaque page reste ouverte jusque-là et chaque '
    + 'enregistrement est conservé ensuite — remonter plus tard retrouve tout là où il était.',
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
    'Cela se fait en deux étapes. **M’envoyer un code de retrait** envoie six chiffres à '
    + 'l’adresse avec laquelle vous vous connectez — pas à une adresse que vous saisissez, et '
    + 'pas à quelqu’un d’autre. **Saisir le code et retirer** demande ensuite ces chiffres et '
    + 'une confirmation. Le code dure quinze minutes, fonctionne une fois, et s’annule de '
    + 'lui-même après cinq tentatives erronées ; demandez-en un autre avec **Envoyer un autre '
    + 'code**.',
  'help.family-settings.removal.b3':
    'Les membres d’une famille retirée ne sont pas laissés dans le doute. Se connecter '
    + 'affiche un écran disant que la famille a été retirée et que rien n’a été supprimé, '
    + '[Mes familles](/my-families) la liste avec une mention **Retirée**, et le menu de '
    + 'famille en haut de la page la marque aussi — de sorte qu’un compte appartenant à plus '
    + 'd’une famille continue dans les autres exactement comme avant.',
  'help.family-settings.removal.b4':
    '**Seul le soutien technique de GENORRA peut ramener une famille.** Il n’y a aucun '
    + 'bouton pour cela nulle part dans le produit, et c’est délibéré : une famille qui '
    + 'pourrait annuler son propre retrait n’aurait pas été retirée. S’il s’agissait d’une '
    + 'erreur, écrivez au soutien technique pour le demander.',
}
