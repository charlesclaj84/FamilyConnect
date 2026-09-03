import type { Catalogue } from '@/lib/i18n/t'

export const marketingFr: Catalogue = {

  // ──── THE CHROME — nav, the two calls to action, the footer ─────────────────────
  'mkt.nav./features': 'Fonctionnalités',
  'mkt.nav./how-it-works': 'Comment ça marche',
  // *Pourquoi GENORRA* for the same reason as the Spanish — *Pourquoi nous* reads as
  // the opening of a sentence rather than as a destination.
  'mkt.nav./why-us': 'Pourquoi GENORRA',
  'mkt.nav./pricing': 'Tarifs',
  'mkt.nav./about': 'À propos',
  'mkt.signIn': 'Se connecter',
  'mkt.getStarted': 'Commencer gratuitement',
  'mkt.openMenu': 'Ouvrir le menu',
  'mkt.closeMenu': 'Fermer le menu',
  'mkt.footer.blurb':
    'Où chaque génération a sa place. Un seul espace privé pour toute votre famille — le '
    + 'rassemblement, la trésorerie, les photographies et l’arbre généalogique.',
  'mkt.footer.product': 'Produit',
  'mkt.footer.account': 'Compte',
  'mkt.footer.createAccount': 'Créez votre compte gratuit',
  'mkt.footer.rights':
    'Tous droits réservés. Les données de votre famille ne sont jamais partagées ni '
    + 'vendues.',
  'mkt.language': 'Langue',

  // ──── THE SHARED BANDS — the closing ask, and the roadmap pill ──────────────────
  'mkt.comingSoon': 'Bientôt disponible',
  'mkt.faqEyebrow': 'Questions',
  'mkt.cta.title': 'Rassemblez votre famille',
  'mkt.cta.lede':
    'Créez votre compte gratuit et ayez votre premier rassemblement, votre répertoire et '
    + 'votre arbre généalogique en route cette semaine.',
  'mkt.cta.primary': 'Créez votre compte gratuit',
  'mkt.cta.secondary': 'Voyez comment ça marche',
  'mkt.cta.reassure':
    'Gratuit pour commencer. Aucune carte requise. Les données de votre famille ne sont '
    + 'jamais partagées ni vendues.',

  // ──── HOW IT WORKS ──────────────────────────────────────────────────────────────
  'mkt.hiw.metaTitle': 'Créez le portail de votre famille en une soirée',
  'mkt.hiw.metaDescription':
    'Créez votre famille, partagez un code, et vos proches s’inscrivent d’eux-mêmes. Voyez '
    + 'exactement comment GENORRA passe du vide à l’organisation d’un rassemblement en cinq '
    + 'étapes.',
  'mkt.hiw.graphName': 'Comment ça marche — créez le portail de votre famille en une soirée',
  'mkt.hiw.eyebrow': 'Comment ça marche',
  'mkt.hiw.title': 'De rien à un rassemblement en route, en une soirée',
  'mkt.hiw.lede':
    'Aucun projet de migration. Aucun week-end de saisie. Une personne le démarre, et la '
    + 'famille le remplit d’elle-même.',
  'mkt.hiw.heroCta': 'Commencez par l’étape un',
  'mkt.hiw.stepsEyebrow': 'Cinq étapes',
  'mkt.hiw.stepsTitle': 'Ce que vous faites concrètement',
  'mkt.hiw.stepsLede':
    'Dans l’ordre. Les étapes quatre et cinq sont facultatives le premier jour — bien des '
    + 'familles commencent avec le répertoire seul.',
  'mkt.hiw.stepN': 'Étape {n}',
  'mkt.hiw.step0.title': 'Créez votre famille',
  'mkt.hiw.step0.detail':
    'Une personne s’inscrit, nomme la famille, et en devient le premier administrateur. '
    + 'Cela prend environ une minute et ne coûte rien.',
  'mkt.hiw.step0.aside':
    'Vous en êtes le fondateur : vous détenez donc toutes les autorisations dès le départ.',
  'mkt.hiw.step1.title': 'Partagez un code familial',
  // *code familial* and *file d’approbation*, both from the shell catalogue.
  'mkt.hiw.step1.detail':
    'Votre famille reçoit un code court. Mettez-le dans le fil de discussion. Vos proches '
    + 's’inscrivent avec lui et arrivent dans votre file d’approbation — vous ne saisissez '
    + 'pas cent personnes à la main.',
  'mkt.hiw.step1.aside':
    'Vous préférez inviter directement ? Envoyez une invitation par courriel et le code est '
    + 'sauté.',
  'mkt.hiw.step2.title': 'Approuvez qui en fait partie',
  'mkt.hiw.step2.detail':
    'Chaque candidat attend qu’un administrateur le reconnaisse. Personne ne voit une seule '
    + 'photographie, adresse ou somme avant que vous ne disiez oui.',
  'mkt.hiw.step2.aside':
    'Refusé par erreur ? Il peut vous demander de regarder à nouveau, par écrit.',
  'mkt.hiw.step3.title': 'Annoncez le rassemblement',
  'mkt.hiw.step3.detail':
    'Rédigez la liste de contrôle une fois, programmez le rassemblement à partir d’elle, et '
    + 'chaque étape devient le travail de quelqu’un avec une date en face. Ce qui revient est '
    + 'accepté ou renvoyé avec des notes.',
  'mkt.hiw.step3.aside': '',
  'mkt.hiw.step4.title': 'Activez la trésorerie',
  // *barème de cotisations* and *règles d’affectation* — `acct.section.routing` is
  // *Affectation*. *Routage* is a network word.
  'mkt.hiw.step4.detail':
    'Fixez un barème de cotisations que les membres peuvent payer par échéances, créez les '
    + 'fonds auxquels l’argent appartient, et laissez les règles d’affectation placer chaque '
    + 'paiement où il va.',
  // *compte de résultat*, matching `page./reporting/pl-summary.title`.
  'mkt.hiw.step4.aside': 'Votre trésorier obtient un vrai compte de résultat à l’autre bout.',
  'mkt.hiw.wholeSetup': 'Voilà toute l’installation',
  'mkt.hiw.wholeSetupLede':
    'Tout le reste — chat, photos, documents, élections, sections, rapports — est déjà '
    + 'activé dans le même compte, en attente du moment où vous le voudrez.',
  'mkt.hiw.seeEverything': 'Voyez tout ce qui est inclus',
  'mkt.hiw.faqTitle': 'Ce que les familles demandent d’abord',
  'mkt.hiw.faq0.q': 'Combien de temps faut-il pour créer un portail familial ?',
  'mkt.hiw.faq0.a':
    'Créer la famille prend environ une minute. Chez la plupart des familles, les proches '
    + 's’inscrivent d’eux-mêmes le soir même, car ils se joignent avec un code familial '
    + 'plutôt qu’en étant saisis à la main.',
  'mkt.hiw.faq1.q': 'Dois-je ajouter moi-même chaque membre de la famille ?',
  'mkt.hiw.faq1.a':
    'Non. Vous partagez un code familial court et vos proches s’inscrivent avec lui, '
    + 'arrivant dans une file d’approbation qu’un administrateur examine. Vous pouvez aussi '
    + 'envoyer des invitations par courriel directement, ce qui permet de sauter entièrement '
    + 'le code.',
  'mkt.hiw.faq2.q':
    'Quelqu’un peut-il voir les informations de notre famille avant que nous l’approuvions '
    + '?',
  'mkt.hiw.faq2.a':
    'Non. Un candidat ne voit rien de la famille avant qu’un administrateur l’approuve — '
    + 'pas de répertoire, pas de photographies, pas de chiffres financiers. La séparation '
    + 'entre familles est imposée par la base de données à chaque requête, non par un '
    + 'réglage.',
  'mkt.hiw.faq3.q': 'Que se passe-t-il si nous refusons quelqu’un par erreur ?',
  'mkt.hiw.faq3.a':
    'La décision est conservée plutôt que supprimée : elle peut donc être annulée. Un '
    + 'administrateur peut l’admettre après tout, n’importe quel membre peut lui envoyer une '
    + 'nouvelle invitation, et la personne elle-même peut répondre une fois par écrit pour '
    + 'demander aux administrateurs de regarder à nouveau.',
  'mkt.hiw.faq4.q': 'GENORRA est-il gratuit pour commencer ?',
  'mkt.hiw.faq4.a':
    'Oui. Créer votre famille, inviter vos proches et organiser votre premier rassemblement '
    + 'ne coûte rien, et aucune carte n’est requise pour commencer.',
  'mkt.hiw.testimonials': 'Ce que les familles nous disent ensuite',
  'mkt.hiw.ctaTitle': 'Commencez par l’étape un',
  'mkt.hiw.ctaLede':
    'Créez votre famille, partagez le code, et voyez quelle part de tout ceci se remplit '
    + 'd’elle-même.',
  'mkt.hiw.ctaPrimary': 'Créez votre famille gratuitement',

  // ──── THE /features CATALOGUE — 42 cards, keyed on their own route ──────────────
  'mkt.also./community/family-tree.title': 'L’arbre généalogique',
  'mkt.also./community/family-tree.blurb':
    'Chaque branche remontée à travers les générations, le sang et le mariage distingués, '
    + 'et un proche sans courriel encore inscrit exactement comme tout le monde.',
  'mkt.also./accounting/dues-and-donations.title': 'Cotisations et campagnes de dons',
  'mkt.also./accounting/dues-and-donations.blurb':
    'Ce que vous devez cette année et ce que vous avez payé, et les campagnes que la '
    + 'famille mène — le côté du membre dans le registre.',
  'mkt.also./reporting/transactions.title': 'Le registre complet',
  'mkt.also./reporting/transactions.blurb':
    'Chaque apport enregistré et chaque décaissement versé, sur un seul registre, avec qui '
    + 'l’a saisi et quand.',
  'mkt.also./admin/accounting.title': 'Configurez le fonctionnement de l’argent',
  'mkt.also./admin/accounting.blurb':
    'Des cotisations à toute fréquence avec paiement par échéances, les fonds que votre '
    + 'famille entretient, et l’affectation qui remplit le fonds du rassemblement avant celui '
    + 'des études.',
  'mkt.also./accounting/summary.title': 'Votre situation',
  'mkt.also./accounting/summary.blurb':
    'Vos cotisations, vos dons et ce qu’il reste à payer, avec les soldes des fonds de la '
    + 'famille à côté.',
  'mkt.also./admin/gatherings/templates.title': 'La liste de contrôle, rédigée une fois',
  'mkt.also./admin/gatherings/templates.blurb':
    'Rédigez la liste des étapes que votre famille répète chaque année. Programmez un '
    + 'rassemblement à partir d’elle et chaque étape devient le travail de quelqu’un, avec '
    + 'une date dessus.',
  'mkt.also./gatherings/my-tasks.title': 'Les travaux qu’on vous a confiés',
  'mkt.also./gatherings/my-tasks.blurb':
    'Chaque étape d’un rassemblement qui vous revient, ce qu’elle demande, et si la réponse '
    + 'que vous avez envoyée est revenue acceptée ou avec des notes.',
  'mkt.also./gatherings/budget.title': 'Ce que le rassemblement coûte',
  'mkt.also./gatherings/budget.blurb':
    'Un budget tiré de l’un de vos fonds, ce que chaque tâche a réclamé dessus, et un '
    + 'repère dès qu’il dépasse l’un ou l’autre.',
  'mkt.also./community/directory.title': 'Le répertoire de la famille',
  'mkt.also./community/directory.blurb':
    'Tout le monde dans une liste avec recherche et les coordonnées dont vous avez '
    + 'réellement besoin — et une recherche qui gère les vrais noms, accents compris.',
  'mkt.also./gatherings.title': 'Chaque rassemblement, sur une page',
  'mkt.also./gatherings.blurb':
    'Ce que la famille a devant elle, avec la date, le lieu et les détails — et un '
    + 'rassemblement à la une en haut du tableau de bord de chacun.',
  'mkt.also./admin/gatherings.title': 'Mettez un rassemblement au calendrier',
  'mkt.also./admin/gatherings.blurb':
    'Programmez-le, donnez-lui ses dates et son lieu, et voyez ce qui en est revenu. '
    + 'Gratuit n’a besoin d’aucune liste de contrôle — une date, un lieu et une description '
    + 'font un rassemblement.',
  'mkt.also./personal-info.title': 'Votre propre fiche, tenue par vous',
  'mkt.also./personal-info.blurb':
    'Coordonnées, date de naissance, taille de t-shirt — ce que la famille a besoin de '
    + 'savoir de vous, tenu par vous plutôt que par la personne qui tient la liste.',
  'mkt.also./admin/members/approvals.title':
    'Personne n’entre avant que vous ne le laissiez entrer',
  'mkt.also./admin/members/approvals.blurb':
    'Chaque demande d’adhésion attend dans une file jusqu’à ce que quelqu’un l’admette, et '
    + 'ne voit rien de la famille entre-temps.',
  'mkt.also./reporting/pl-summary.title': 'Un compte de résultat pour votre trésorier',
  'mkt.also./reporting/pl-summary.blurb':
    'L’argent entré face à l’argent sorti, directement depuis le registre, dans l’état que '
    + 'le conseil demande.',
  'mkt.also./community/chat.title': 'Chat de la famille',
  'mkt.also./community/chat.blurb':
    'Fils de groupe et messages privés, pour que la famille continue de se parler entre les '
    + 'rassemblements.',
  'mkt.also./community/announcements.title': 'Annonces',
  'mkt.also./community/announcements.blurb':
    'N’importe qui peut partager des nouvelles ; les administrateurs épinglent l’essentiel '
    + 'en haut du tableau de bord de chacun.',
  'mkt.also./community/distributions.title': 'Écrivez à toute la famille',
  'mkt.also./community/distributions.blurb':
    'Un message à tout le monde, ou à une région ou une section, tiré directement de vos '
    + 'adhésions — personne n’est oublié, personne ne le reçoit deux fois, et vous voyez '
    + 'exactement qui il a atteint.',
  'mkt.also./community/safety-check-ins.title': 'Vérifiez que tout le monde est en sécurité',
  'mkt.also./community/safety-check-ins.blurb':
    'Quand une tempête ou un incendie frappe, posez une seule question aux proches de cette '
    + 'région — ou à une liste que vous choisissez vous-même. Ils répondent d’une pression, '
    + 'et vous voyez qui est en sécurité, qui a besoin d’aide, et qui n’a pas encore répondu.',
  'mkt.also./community/elections.title': 'Élections des fonctions',
  'mkt.also./community/elections.blurb':
    'Nommez quelqu’un, acceptez ou refusez votre propre nomination, puis votez — à '
    + 'l’intérieur des fenêtres de nomination et de vote que votre famille a fixées, les '
    + 'résultats étant comptés à la fermeture du scrutin.',
  'mkt.also./community/gallery.title': 'Galerie',
  'mkt.also./community/gallery.blurb':
    'Des albums pour chaque rassemblement, téléversés en lot, avec un étiquetage qui trouve '
    + 'le bon cousin parmi cent.',
  'mkt.also./library/documents.title': 'Documents',
  'mkt.also./library/documents.blurb':
    'Formulaires, dépôts et archives dans un lieu partagé qui ne vit pas dans une boîte de '
    + 'réception.',
  'mkt.also./admin/members/organization.title': 'Régions et sections',
  'mkt.also./admin/members/organization.blurb':
    'Divisez une grande famille en régions et sections, chacune avec ses propres membres et '
    + 'ses propres responsables.',
  'mkt.also./reporting/membership.title': 'Rapports pour le conseil',
  'mkt.also./reporting/membership.blurb':
    'Les membres par région et par section, combien ont terminé de se joindre, et adultes '
    + 'contre mineurs.',
  'mkt.also./community/updates.title': 'L’archive des actualités',
  'mkt.also./community/updates.blurb':
    'Tout ce que la famille a jamais annoncé, et tout ce qui vous a été envoyé, cherchable '
    + 'longtemps après avoir quitté le tableau de bord.',
  'mkt.also./accounting/payment-history.title': 'Votre propre historique de paiement',
  'mkt.also./accounting/payment-history.blurb':
    'Chaque paiement enregistré à votre nom, avec sa date, son montant, son mode et son '
    + 'état — pour que personne n’ait à croire le trésorier sur parole.',
  'mkt.also./reporting/dues-projections.title': 'Projection des cotisations',
  'mkt.also./reporting/dues-projections.blurb':
    'Ce que la famille devrait encaisser cette année, ce qui est entré, et qui doit encore '
    + '— en comptant les proches qui n’ont jamais terminé leur inscription.',
  'mkt.also./reporting/transactions/fund-transfers.title': 'Virements entre fonds',
  'mkt.also./reporting/transactions/fund-transfers.blurb':
    'Déplacez de l’argent d’un fonds à un autre et gardez les deux côtés au relevé.',
  'mkt.also./admin/members/templates.title': 'Qui peut faire quoi',
  'mkt.also./admin/members/templates.blurb':
    'Une grille d’autorisations par fonctionnalité, pour qu’enregistrer des cotisations ne '
    + 'soit pas la même chose que verser de l’argent — et les administrateurs décident qui '
    + 'voit la trésorerie.',
  'mkt.also./admin/members/board-positions.title': 'Les fonctions que votre famille entretient',
  'mkt.also./admin/members/board-positions.blurb':
    'Définissez les fonctions que votre famille a réellement — nationales, régionales ou '
    + 'par section — et notez qui occupe chacune. La liste commence vide à dessein : deux '
    + 'familles ne tiennent jamais le même conseil.',
  'mkt.also./admin/elections.title': 'Tenir l’élection',
  'mkt.also./admin/elections.blurb':
    'Fixez quand les nominations et le vote ouvrent et ferment, et ils se conduisent tout '
    + 'seuls. Choisissez si toute la famille vote ou seulement une région ou une section. Les '
    + 'fonctions sont tirées de votre liste du conseil au niveau correspondant.',
  'mkt.also./library/officer-notes.title': 'La fonction tient son propre carnet',
  'mkt.also./library/officer-notes.blurb':
    'Des notes de travail qui restent avec la FONCTION plutôt qu’avec la personne : trois '
    + 'trésoriers plus tard, celui qui l’occupe ouvre le même carnet. Seuls les titulaires de '
    + 'cette fonction peuvent le lire — pas même un administrateur.',
  'mkt.also./library/meeting-minutes.title': 'Les procès-verbaux, et comment la salle a voté',
  'mkt.also./library/meeting-minutes.blurb':
    'Programmez une réunion, nommez son secrétaire, et choisissez qui vient par CORPS — le '
    + 'conseil national, le conseil d’une section — plutôt qu’en cochant onze noms. Les '
    + 'sujets sont mis aux voix, et un vote enregistré ne peut être modifié par personne.',
  'mkt.also./library/bylaws.title': 'Vos statuts, avec recherche',
  'mkt.also./library/bylaws.blurb':
    'Les règles que la famille a convenu de suivre, tenues par article avec les '
    + 'modifications qui les ont changées. Ce qui est téléversé en texte simple se cherche '
    + 'mot par mot ; un PDF se cherche par titre, article et résumé, et chaque entrée dit '
    + 'lequel des deux il est.',
  'mkt.also./reporting/gatherings.title': 'Le travail du rassemblement est-il vraiment fait',
  'mkt.also./reporting/gatherings.blurb':
    'Chaque rassemblement avec la part de son travail revenue, ce qui est en retard, qui '
    + 'aide, et ce que les tâches ont réclamé sur le budget.',
  'mkt.also./reporting/elections.title': 'Une participation digne d’être appelée un mandat',
  'mkt.also./reporting/elections.blurb':
    'Combien de personnes ont voté à chaque élection, combien se sont présentées, et pour '
    + 'quelles fonctions personne n’a proposé de nom.',
  'mkt.also./reporting/meetings.title': 'À quelle fréquence vous vous réunissez réellement',
  'mkt.also./reporting/meetings.blurb':
    'Réunions tenues, combien de personnes chaque salle comptait, combien de décisions ont '
    + 'été mises aux voix, et qui répond quand un vote est appelé. Il compte qui a été convié '
    + 'et qui a voté, et refuse d’appeler l’un ou l’autre une présence — rien dans le produit '
    + 'n’enregistre qui a franchi la porte.',
  'mkt.also./reporting/board.title': 'Quelles fonctions sont vacantes',
  'mkt.also./reporting/board.blurb':
    'Chaque fonction que votre famille a définie, qui l’occupe, et les vacances — la seule '
    + 'chose qu’une liste de ce qui existe ne peut pas vous dire.',
  'mkt.also./gatherings/calendar.title': 'Un calendrier, pas trois',
  'mkt.also./gatherings/calendar.blurb':
    'Une vraie grille de mois portant chaque rassemblement aux jours où il court, les '
    + 'réunions auxquelles vous êtes convié, et les jours où les nominations et le vote sont '
    + 'ouverts. Un rassemblement de trois jours remplit trois jours.',
  'mkt.also./help.title': 'Un manuel, écrit pour vos proches',
  'mkt.also./help.blurb':
    'Chaque écran expliqué par son nom — les boutons, les colonnes, ce que fait chaque '
    + 'contrôle et où regarder quand quelque chose manque. Un point d’interrogation dans la '
    + 'barre du haut ouvre la page de l’endroit où vous vous trouvez.',
  'mkt.also./my-families.title': 'Une seule connexion, plus d’une famille',
  'mkt.also./my-families.blurb':
    'Entré par mariage dans une seconde famille, ou vous tenez à la fois celle de votre '
    + 'père et celle de votre mère ? Un compte appartient à autant de familles que vous '
    + 'voulez, et passer de l’une à l’autre change tout à l’écran d’un coup.',
  'mkt.also./admin/members.title': 'Tenez la liste des membres',
  'mkt.also./admin/members.blurb':
    'Corrigez la fiche d’un proche, envoyez à quelqu’un une réinitialisation de mot de '
    + 'passe, ou désactivez un membre sans supprimer quoi que ce soit de ce qu’il a fait.',
  'mkt.also./personal-info/photo.title': 'Un visage pour chaque nom',
  'mkt.also./personal-info/photo.blurb':
    'Une photographie à côté de chaque proche — dans le répertoire, sur l’arbre '
    + 'généalogique, dans la barre du haut et sur chaque écran où il est listé. Sans elle, ce '
    + 'sont ses initiales.',

  // ──── FEATURES — the page, the roadmap table and the privacy card ───────────────
  'mkt.feat.metaTitle': 'Tout ce qui fait tourner votre organisation familiale',
  'mkt.feat.metaDescription':
    'Organisation du rassemblement, cotisations et trésorerie, arbre généalogique, photos, '
    + 'élections et chat — tous les outils dont une organisation familiale a besoin, dans un '
    + 'seul portail privé GENORRA.',
  'mkt.feat.graphName': 'Tout ce qui fait tourner votre organisation familiale',
  'mkt.feat.eyebrow': 'Fonctionnalités',
  'mkt.feat.title': 'Tout ce qui fait tourner votre organisation familiale',
  'mkt.feat.lede':
    'La plupart des familles organisent un rassemblement depuis un fil de discussion, une '
    + 'trésorerie depuis un tableur et un arbre généalogique depuis la mémoire d’un proche. '
    + 'GENORRA remplace les trois — et les garde au même endroit privé.',
  'mkt.feat.heroPrimary': 'Commencer gratuitement',
  'mkt.feat.heroSecondary': 'Voir les tarifs',
  'mkt.feat.coreEyebrow': 'L’essentiel',
  'mkt.feat.coreTitle': 'Trois travaux, bien faits',
  'mkt.feat.coreLede':
    'Non pas trente demi-fonctionnalités. Les trois choses dont une organisation familiale '
    + 'dépend réellement.',
  'mkt.feat.gridEyebrow': 'Écran par écran',
  'mkt.feat.gridTitle': 'Tout ce qu’il fait, et sur quel forfait',
  'mkt.feat.gridLede':
    'Chaque écran du produit, découpé par forfait, pour que vous puissiez lire une bande et '
    + 'vous arrêter. Une carte à bord plein est livrée aujourd’hui ; une carte à bord '
    + 'pointillé est une promesse que le forfait fait et qui le dit sur son visage. Le palier '
    + 'sous lequel une carte se trouve est lu depuis le registre même avec lequel le produit '
    + 'se limite.',
  'mkt.feat.screenOne': '1 écran',
  'mkt.feat.screenMany': '{n} écrans',
  'mkt.feat.onTheWay': '{n} à venir',
  // L,M,M,J,V,S,D — la semaine commence le lundi, comme dans le dessin.
  'mkt.vignette.dayLetters': 'L,M,M,J,V,S,D',
  'mkt.vignette.reunionDates': '15–17 août',
  'mkt.vignette.reunionTitle': 'Réunion d’été',
  'mkt.vignette.bookHall': 'Réserver la salle',
  'mkt.vignette.orderShirts': 'Commander les tee-shirts',
  'mkt.vignette.collectPhotos': 'Rassembler les photographies',
  'mkt.vignette.budgetClaimed': 'Budget engagé',
  'mkt.vignette.reunionFund': 'Caisse de la réunion',
  'mkt.vignette.scholarshipFund': 'Caisse des bourses',
  'mkt.vignette.emergencyFund': 'Caisse d’urgence',
  'mkt.vignette.thisYear': 'Cette année',
  'mkt.vignette.moneyWent': 'Où est allé l’argent',
  'mkt.vignette.duesCollected': 'Cotisations encaissées',
  'mkt.vignette.againstOutstanding': 'par rapport au restant dû',
  'mkt.vignette.routed': 'Réparti automatiquement, par ordre de priorité',
  'mkt.vignette.oneLedger': 'Chaque contribution et chaque dépense dans un seul registre',
  'mkt.vignette.threeGenerations': 'Trois générations',
  'mkt.vignette.familyRecord': 'Le registre de la famille',

  'mkt.quotes.eyebrow': 'Dans leurs mots',
  'mkt.quotes.heading': 'Les familles ne reviennent pas en arrière',
  'mkt.quotes.verbatim':
    'Ces familles sont citées dans la langue dans laquelle elles ont écrit. Nous ne '
    + 'traduisons pas un témoignage, car la traduction serait des mots qu’elles n’ont '
    + 'jamais approuvés.',
  'mkt.quotes.railLabel': 'Témoignages de familles, défilement possible',
  'mkt.quotes.prev': 'Témoignage précédent',
  'mkt.quotes.next': 'Témoignage suivant',

  'mkt.social.follow': 'Suivez-nous',
  'mkt.social.soon': 'Profils à venir.',

  'mkt.price.availableNow': 'Disponible maintenant',
  'mkt.ladder.bestFirstStep': 'Le meilleur premier pas',
  'mkt.price.whyFreeHeading': 'Pourquoi donner tout le produit ?',
  'mkt.price.whyFreeBody':
    'Parce qu’un portail familial où ne figure que la moitié de la famille ne vaut rien, et '
    + 'qu’un prix par membre garantit que l’autre moitié restera dehors. Réunir tout le monde '
    + 'est donc gratuit et le restera toujours : l’annuaire, la messagerie, les annonces et la '
    + 'réunion sur un calendrier partagé, pour chacun de vos proches et sans carte bancaire. '
    + 'Nous facturons quand une famille commence à se DIRIGER plutôt qu’à simplement se '
    + 'réunir : tenir l’arbre, encaisser les cotisations, répartir le travail — et, plus haut, '
    + 'accepter les paiements par carte, élire des responsables et rendre compte à un conseil.',
  'mkt.feat.spansPlans':
    'Chacun de ces trois volets couvre plus d’un forfait. Ce qui suit est la réponse exacte, '
    + 'écran par écran, avec le forfait auquel il appartient au-dessus de chaque groupe.',
  'mkt.feat.seeCosts': 'Ou voyez ce que coûte chaque forfait',
  'mkt.feat.perMonth': '{amount} par mois',
  'mkt.feat.noCharge': 'Sans frais',
  'mkt.feat.seePlan': ' — voyez ce que contient le forfait {plan}',
  'mkt.price.perMonth': '/mois',

  'mkt.feat.soon0.title': 'Encaissez comme votre famille paie',
  'mkt.feat.soon0.blurb':
    'Carte, débit, PayPal, Apple Pay, Google Pay et Cash App, affectés à vos fonds dès leur '
    + 'arrivée. En attendant, le registre enregistre les espèces et les chèques que vous '
    + 'encaissez comme vous les encaissez aujourd’hui.',
  'mkt.feat.soon1.title': 'Cessez de courir après vos proches pour leurs cotisations',
  'mkt.feat.soon1.blurb':
    'Un rappel part à chaque échéance et s’arrête dès qu’elle est payée — personne n’est '
    + 'donc relancé pour de l’argent déjà envoyé.',
  'mkt.feat.soon2.title': 'Des nouvelles qui arrivent, au lieu d’attendre qu’on les trouve',
  'mkt.feat.soon2.blurb':
    'Des notifications sur le téléphone et dans le navigateur pour les annonces, les '
    + 'messages et les tâches qui vous sont confiées, plutôt qu’un tableau de bord que '
    + 'quelqu’un doit penser à ouvrir.',
  'mkt.feat.soon3.title': 'La famille dans la poche de chacun',
  'mkt.feat.soon3.blurb':
    'Des applications pour iPhone et Android, connectées au même compte familial, montrant '
    + 'la même famille que vous voyez ici.',
  'mkt.feat.privacyTitle': 'Une famille ne peut pas voir une autre. Jamais.',
  'mkt.feat.privacyLede':
    'La séparation entre familles n’est pas un réglage — elle est imposée par la base de '
    + 'données à chaque requête, et chaque action qui lit ou écrit des données familiales a '
    + 'un test qui essaie d’entrer depuis une autre famille et qui doit échouer.',
  'mkt.feat.privacy0': 'Les nouveaux membres sont examinés avant de voir quoi que ce soit',
  'mkt.feat.privacy1': 'Des comptes à adresse courriel vérifiée',
  'mkt.feat.privacy2': 'Jamais partagé, jamais vendu, aucune publicité',
  'mkt.feat.whyUsLink': 'Pourquoi les familles nous choisissent face aux solutions de rechange',

  // ──── THE THREE PILLARS — shared by Home and /features ──────────────────────────
  'mkt.pillar.0.eyebrow': 'Organisez tout',
  'mkt.pillar.0.title': 'Des rassemblements qui se conduisent tout seuls',
  'mkt.pillar.0.short':
    'Bâtissez le rassemblement à partir d’une liste de contrôle, confiez chaque étape au '
    + 'proche à qui elle revient, et voyez d’un coup d’œil ce qui est revenu — sans personne '
    + 'à courir après un tableur la semaine d’avant.',
  'mkt.pillar.0.blurb':
    'Un rassemblement est plus qu’une date. Rédigez la liste de contrôle une fois, '
    + 'programmez le rassemblement à partir d’elle, et chaque étape devient le travail de '
    + 'quelqu’un avec une échéance en face.',
  'mkt.pillar.0.b0':
    'Des modèles réutilisables : la liste que votre famille répète chaque année, rédigée '
    + 'une fois',
  'mkt.pillar.0.b1': 'Chaque étape assignée à un proche nommé, avec une échéance',
  'mkt.pillar.0.b2':
    'Les réponses reviennent à un organisateur, qui les accepte ou les renvoie avec des '
    + 'notes',
  'mkt.pillar.0.b3': 'Un budget tiré d’un vrai fonds, chaque tâche réclamant sa propre ligne',
  'mkt.pillar.0.b4': 'Un rassemblement à la une, en haut du tableau de bord de chacun',
  'mkt.pillar.0.b5':
    'Le calendrier du mois, avec chaque rassemblement aux jours où il court réellement',
  'mkt.pillar.1.eyebrow': 'L’argent, réglé',
  'mkt.pillar.1.title': 'Une vraie trésorerie, pas une boîte à chaussures',
  'mkt.pillar.1.short':
    'Des cotisations que vos membres peuvent réellement payer, chaque dollar affecté '
    + 'automatiquement au bon fonds, et un compte de résultat que votre trésorier peut '
    + 'remettre au conseil.',
  'mkt.pillar.1.blurb':
    'Encaissez des cotisations que vos membres peuvent réellement payer, affectez chaque '
    + 'dollar automatiquement au bon fonds, et répondez à « où est passé l’argent » par un '
    + 'rapport plutôt que par une dispute.',
  'mkt.pillar.1.b0':
    'Des cotisations à toute fréquence, avec des paiements par échéances que les membres '
    + 'peuvent suivre',
  'mkt.pillar.1.b1':
    'Affectation automatique : le fonds du rassemblement se remplit d’abord, celui des '
    + 'études suit',
  'mkt.pillar.1.b2':
    'Des cascades de solde minimal, pour qu’aucun fonds ne reste discrètement à court',
  'mkt.pillar.1.b3': 'Apports et décaissements sur un seul registre complet',
  'mkt.pillar.1.b4': 'Des soldes de fonds qui se mettent à jour dès que les cotisations entrent',
  'mkt.pillar.1.b5': 'Un compte de résultat que votre trésorier peut remettre au conseil',
  'mkt.pillar.2.eyebrow': 'Connaissez votre famille',
  'mkt.pillar.2.title': 'Le registre de la famille, bien tenu',
  'mkt.pillar.2.short':
    'L’arbre généalogique et le répertoire — un registre vivant que toute la famille tient, '
    + 'plutôt qu’un seul historien épuisé.',
  'mkt.pillar.2.blurb':
    'Qui est lié à qui, comment le joindre, et chaque branche remontée à travers les '
    + 'générations — tenu par la famille plutôt que par un seul historien épuisé.',
  'mkt.pillar.2.b0':
    'Un arbre sur plusieurs générations : parents, grands-parents, enfants et conjoints',
  'mkt.pillar.2.b1': 'Les liens par alliance et les ex-partenaires traités avec soin',
  'mkt.pillar.2.b2':
    'Remontez n’importe quelle branche à travers les générations, un clic à la fois',
  'mkt.pillar.2.b3':
    'Inscrivez un proche qui n’a pas encore de courriel, et invitez-le quand il en aura',
  'mkt.pillar.2.b4':
    'Des profils que la famille tient : coordonnées, dates de naissance, tailles de t-shirt',
  'mkt.pillar.2.b5': 'Un répertoire avec une recherche qui gère les vrais noms — accents compris',

  // ──── HOME — the product band ───────────────────────────────────────────────────
  // The three brand values as a finished phrase, for APP_PROMISE’s reason — see the
  // Spanish note. *Legs* rather than *Héritage* for Legacy, because Heritage
  // already took that word and the two must stay distinct.
  'mkt.showcase.eyebrow': 'Héritage · Communauté · Legs',
  'mkt.showcase.title': 'Tout ce qu’il faut pour faire tourner une famille',
  'mkt.showcase.lede':
    'GENORRA remplace les fils de discussion, les tableurs et les boîtes à chaussures de '
    + 'reçus par un seul foyer privé pour votre famille, vos projets et votre argent.',
  'mkt.showcase.andAlso':
    'Et le chat de la famille, les annonces, les élections des fonctions, les collections '
    + 'de photos, les documents, les sections régionales et les rapports pour le conseil.',
  'mkt.showcase.moreLink':
    'Tout ce qu’il fait, ce que contient chaque forfait, et ce qui est encore à venir',

  // ──── HOME — the family website, on the roadmap ─────────────────────────────────
  'mkt.living.eyebrow': 'Sur la feuille de route',
  'mkt.living.title': 'Le site web de votre famille, qui se construit tout seul',
  'mkt.living.lede':
    'Tous les autres sites familiaux d’internet sont abandonnés en mars, car quelqu’un doit '
    + 'les tenir à jour. Celui-ci prend ce que votre famille fait déjà dans GENORRA — le '
    + 'prochain événement, les photographies les plus récentes, la dernière annonce — et se '
    + 'tient à jour tout seul.',
  'mkt.living.src0.label': 'Votre prochain rassemblement',
  'mkt.living.src0.detail':
    'Le rassemblement que vous organisez déjà devient la page où tout le monde arrive — la '
    + 'date, le lieu, et qui fait quoi.',
  'mkt.living.src1.label': 'Les photographies',
  'mkt.living.src1.detail':
    'Les collections que votre famille a déjà téléversées deviennent la galerie, de la plus '
    + 'récente à la plus ancienne, sans que personne la reconstruise.',
  'mkt.living.src2.label': 'Ce qui se passe',
  'mkt.living.src2.detail':
    'Les annonces et les jalons remontent comme des nouvelles : le site n’a donc jamais un '
    + 'an de retard.',
  'mkt.living.illustration':
    'Illustration d’une fonctionnalité en développement — ce n’est pas une capture d’écran, '
    + 'et ce n’est pas définitif.',

  // ──── THE PLAN LADDER — the cards on /pricing ───────────────────────────────────
  'mkt.ladder.chooseAria': 'Choisissez un forfait à lire',
  'mkt.ladder.everythingIn': 'Tout ce que contient {tier}',
  'mkt.ladder.undecided': 'Ce que ce palier ajoute est encore en cours de décision.',
  'mkt.ladder.startWith': 'Commencer avec {tier}',
  'mkt.ladder.accountFirst':
    'Créez d’abord votre compte — vous choisissez comment payer une fois votre famille '
    + 'créée.',
  'mkt.ladder.notYet': 'Pas encore disponible',
  'mkt.ladder.hearFirst': 'Créez un compte gratuit et vous en serez informé en premier.',

  // ──── WHY US ────────────────────────────────────────────────────────────────────
  // Same budget as the Spanish, same trim. See that note.
  'mkt.why.metaTitle': 'Pourquoi les familles nous choisissent',
  'mkt.why.metaDescription':
    'Un fil de discussion perd le plan, un tableur perd l’argent, un groupe sur les réseaux '
    + 'perd la confidentialité. Voyez pourquoi les familles passent à GENORRA.',
  'mkt.why.graphName':
    'Pourquoi les familles nous choisissent face aux fils de discussion et aux tableurs',
  'mkt.why.eyebrow': 'Pourquoi nous choisir',
  'mkt.why.title': 'Votre famille mérite mieux qu’un fil de discussion et un tableur',
  'mkt.why.lede':
    'Vous faites déjà tout ce travail. Vous le faites simplement dans quatre outils qui ne '
    + 'se parlent pas, en perdant quelque chose dans chaque interstice.',
  'mkt.why.heroPrimary': 'Migrez votre famille gratuitement',
  'mkt.why.heroSecondary': 'Voyez ce que vous obtenez',
  'mkt.why.altEyebrow': 'Soyons honnêtes',
  'mkt.why.altTitle': 'Ce qui fait tourner votre famille en ce moment',
  'mkt.why.altLede': 'Si l’un d’eux fait le travail, vous savez déjà où il casse.',
  'mkt.why.alt0.what': 'Le fil de discussion de la famille',
  'mkt.why.alt0.problem':
    'Quatre-vingt-dix messages plus bas, quatre personnes ont dit oui, deux ont dit « '
    + 'peut-être », et une a redemandé quelle était la date. Rien de tout cela n’est un '
    + 'relevé.',
  'mkt.why.alt0.cost':
    'Personne ne peut dire qui a accepté de faire quoi, alors les trois mêmes personnes '
    + 'font tout.',
  'mkt.why.alt1.what': 'Un tableur',
  'mkt.why.alt1.problem':
    'Une seule personne le possède, une seule le comprend, et il vit sur son portable. Les '
    + 'cotisations payées en espèces sont mémorisées plutôt qu’enregistrées.',
  'mkt.why.alt1.cost':
    'Quand cette personne s’en va, l’histoire financière de la famille s’en va avec elle.',
  'mkt.why.alt2.what': 'Un groupe sur les réseaux sociaux',
  'mkt.why.alt2.problem':
    'Les photographies, les adresses et les prénoms des enfants de votre famille se '
    + 'trouvent sur une plateforme dont le métier est la publicité, mêlés à la politique de '
    + 'tout le monde.',
  'mkt.why.alt2.cost':
    'Vous ne pouvez pas réserver la trésorerie au trésorier, car il n’y a pas de '
    + 'trésorerie.',
  'mkt.why.alt3.what': 'Un outil d’événements générique',
  'mkt.why.alt3.problem':
    'Conçu pour des inconnus achetant des billets pour un seul événement. Il n’a aucune '
    + 'idée de qui est lié à qui, et il oublie votre famille le lendemain.',
  'mkt.why.alt3.cost': 'Des frais par billet sur vos propres proches, et rien qui reste ensuite.',
  'mkt.why.reasonsEyebrow': 'La différence',
  'mkt.why.reasonsTitle': 'Six raisons pour lesquelles les familles migrent et restent',
  'mkt.why.reasonsLede':
    'Chacune d’elles est vérifiable dans le produit le jour même de votre inscription.',
  'mkt.why.reason0.title': 'C’est un seul endroit, pas cinq',
  'mkt.why.reason0.detail':
    'Le rassemblement, les cotisations, le répertoire, les photographies et l’arbre '
    + 'généalogique sont le même compte : la personne à qui vous confiez un travail est déjà '
    + 'sur l’arbre et le paiement sait déjà à quel fonds il appartient. Rien n’est exporté '
    + 'puis réimporté.',
  'mkt.why.reason1.title': 'Conçu pour cent cinquante proches, pas pour une équipe de huit',
  'mkt.why.reason1.detail':
    'Chaque liste qui nomme des membres de la famille est conçue pour une famille de cette '
    + 'taille : une recherche qui correspond au prénom, au nom et au surnom, qui gère les '
    + 'accents et les apostrophes, et qui distingue deux Martha Allen. La plupart des outils '
    + 'sont conçus pour une petite équipe et se défont discrètement à l’échelle.',
  'mkt.why.reason2.title': 'Une famille ne peut pas voir une autre. Imposé, non configuré',
  'mkt.why.reason2.detail':
    'La séparation entre familles est appliquée par la base de données à chaque requête, et '
    + 'chaque action qui touche aux données familiales porte un test qui essaie d’entrer '
    + 'depuis une autre famille et qui doit échouer. Ce n’est pas une case que quelqu’un peut '
    + 'laisser décochée.',
  'mkt.why.reason3.title': 'Une trésorerie qu’un trésorier acceptera',
  'mkt.why.reason3.detail':
    'Des barèmes de cotisations payables par échéances, des fonds avec de vrais registres, '
    + 'une affectation automatique pour que chaque dollar atterrisse où il appartient, et un '
    + 'compte de résultat que vous pouvez remettre au conseil. Pas un bouton de paiement et '
    + 'un espoir.',
  'mkt.why.reason4.title':
    'Des autorisations par travail, pas un seul interrupteur d’administrateur',
  // *séparation des tâches*, matching `lib/plans.ts`.
  'mkt.why.reason4.detail':
    'Enregistrer des cotisations sans pouvoir verser d’argent. Voir le répertoire sans voir '
    + 'les comptes. Approuver de nouveaux membres sans toucher à la trésorerie. Une '
    + 'séparation des tâches élémentaire, qu’un seul drapeau grossier « administrateur » ne '
    + 'peut pas exprimer.',
  'mkt.why.reason5.title': 'C’est pour les familles, et seulement les familles',
  'mkt.why.reason5.detail':
    'Ce n’est pas un CRM habillé en famille. Chaque écran présuppose des proches, des '
    + 'générations, des branches et la personne qui organise ce rassemblement depuis vingt '
    + 'ans — car c’est la seule chose pour laquelle il est conçu.',
  'mkt.why.switchTitle': 'Et migrer vous coûte une soirée',
  'mkt.why.switchLede':
    'Il n’y a pas de projet de migration, car vous ne migrez rien. Vous créez la famille, '
    + 'partagez un code court, et vos proches s’inscrivent d’eux-mêmes — c’est la partie qui '
    + 'vous prendrait sinon un week-end de saisie. Vous approuvez qui en fait partie. Le '
    + 'rassemblement est annoncé. C’est tout.',
  'mkt.why.switchSteps': 'Voyez les cinq étapes',
  'mkt.why.switchCost': 'Et ce que cela coûte',
  'mkt.why.testimonials': 'Des familles qui ne reviendront pas en arrière',
  'mkt.why.testimonialsLede':
    'Demandez-nous une référence avant de faire migrer votre famille — nous préférons que '
    + 'vous parliez à quelqu’un plutôt que de nous croire sur parole.',
  'mkt.why.ctaTitle': 'Donnez à votre famille un seul endroit',
  'mkt.why.ctaLede':
    'Gratuit pour commencer, sans carte, et vos proches font l’essentiel de l’installation '
    + 'eux-mêmes.',
  'mkt.why.ctaPrimary': 'Faites migrer votre famille gratuitement',

  // ──── ABOUT ─────────────────────────────────────────────────────────────────────
  'mkt.about.metaTitle': 'À propos — pourquoi GENORRA existe',
  'mkt.about.metaDescription':
    'Pourquoi GENORRA existe, ce qu’il refuse de faire avec les données de votre famille, '
    + 'et qui est derrière. Conçu pour des familles entières, jamais vendu à des annonceurs.',
  'mkt.about.graphName': 'À propos de GENORRA — conçu pour des familles entières',
  'mkt.about.eyebrow': 'À propos',
  'mkt.about.title': 'Où chaque génération a sa place.',
  'mkt.about.lede': 'Générations organisées, ressources enregistrées, ascendance archivée',
  'mkt.about.missionTitle': 'Pourquoi nous l’avons construit',
  // THE ENGLISH ABOVE IS THE OWNER’S OWN WORDS, supplied 2026-08-12 and set verbatim.
  // What follows is a RENDERING of them and is not the owner’s French. That is a
  // normal thing for a marketing site to have and worth being precise about: it is
  // somebody’s account of their own family, put into another language by somebody
  // else. If the owner ever supplies their own, it REPLACES this rather than being
  // reconciled with it.
  // 
  // The six one-line beats — *Nous ne l’avons pas trouvé.* *Alors nous l’avons construit.* — are
  // kept as their own paragraphs and must stay that way. `LETTER_STRONG` in the page
  // marks them, and the file’s own comment argues that each is a PAUSE: joining two
  // of them into a tidier sentence would remove the reason they work, and would
  // silently take the emphasis with it.
  'mkt.about.letter0':
    'Pendant des années, notre famille a fait ce que tant de familles font. Nous '
    + 'organisions les retrouvailles par messages de groupe, suivions les cotisations dans '
    + 'des tableurs, gardions les adresses à différents endroits, nous passions les '
    + 'photographies de main en main, et nous comptions sur une poignée de personnes pour se '
    + 'rappeler comment chacun était lié.',
  'mkt.about.letter1': 'Et notre famille n’est pas petite.',
  'mkt.about.letter2':
    'Nous avons six générations vivantes et plus de quatre cents membres. Chaque année '
    + 'amenait les mêmes questions : Qui a payé ses cotisations ? Qui vient aux retrouvailles '
    + '? Quel anniversaire venons-nous de manquer ? Où est cette vieille photo de famille ? '
    + 'Et, de temps à autre, qui est exactement ce cousin et comment sommes-nous liés ?',
  'mkt.about.letter3':
    'D’une manière ou d’une autre, les réponses vivaient d’ordinaire chez une ou deux '
    + 'personnes.',
  'mkt.about.letter4': 'C’est la partie qui m’est restée.',
  'mkt.about.letter5':
    'On m’a élevé en me faisant comprendre que la famille est quelque chose que l’on garde '
    + 'volontairement. On apprend les noms. On se présente. On conserve les histoires et les '
    + 'traditions. On écrit les choses pour que les générations qui viennent derrière sachent '
    + 'qui les a précédées, d’où elles venaient, et quelles mains ont aidé à bâtir ce '
    + 'qu’elles ont aujourd’hui.',
  'mkt.about.letter6':
    'Mais une trop grande part de cette histoire, et une trop grande part du travail '
    + 'nécessaire pour garder une famille reliée, vivait dans la mémoire de quelqu’un.',
  'mkt.about.letter7':
    'Et les souvenirs devraient faire partie du legs, non en être le système de stockage.',
  'mkt.about.letter8':
    'Nous nous sommes mis à chercher quelque chose qui pourrait nous aider à organiser '
    + 'notre famille, à rester reliés d’une génération à l’autre, à gérer les choses '
    + 'pratiques et à conserver l’histoire en même temps.',
  'mkt.about.letter9': 'Nous ne l’avons pas trouvé.',
  'mkt.about.letter10': 'Alors nous l’avons construit.',
  'mkt.about.letter11':
    'GENORRA a commencé avec notre propre famille parce qu’il nous fallait une meilleure '
    + 'façon de porter plus loin ce que nos anciens nous avaient donné. Un endroit pour les '
    + 'retrouvailles et les cotisations, oui. Mais aussi pour les noms, les liens, les '
    + 'photographies, les histoires, les traditions, et les morceaux de notre famille qui '
    + 'méritent de survivre longtemps après que l’un de nous sera parti.',
  'mkt.about.letterClose': 'Voilà pourquoi nous avons construit GENORRA.',
  'mkt.about.principlesEyebrow': 'Ce que nous ferons et ne ferons pas',
  'mkt.about.principlesTitle': 'Quatre engagements, tenus dans le code',
  'mkt.about.principlesLede':
    'Ce n’est pas une déclaration de valeurs. Chacun d’eux est vérifiable.',
  'mkt.about.principle0.title': 'Nous ne vendons pas votre famille',
  'mkt.about.principle0.detail':
    'Nous ne gagnons pas d’argent sur les adresses de vos proches ni sur les prénoms de vos '
    + 'enfants. Votre famille n’est pas un stock. Aucune publicité, aucun courtage de '
    + 'données, rien de revendu à personne. Nous gagnons auprès des familles qui choisissent '
    + 'de payer davantage, et de rien d’autre.',
  'mkt.about.principle1.title': 'La séparation est imposée, non promise',
  'mkt.about.principle1.detail':
    'Une famille ne peut pas voir les données d’une autre, et cela est appliqué par la base '
    + 'de données à chaque requête plutôt que par du code applicatif qui se souvient de '
    + 'demander. Chaque action qui lit ou écrit des données familiales porte un test qui '
    + 'l’attaque depuis une autre famille et qui doit échouer.',
  'mkt.about.principle2.title': 'Conçu pour la taille que les familles ont réellement',
  'mkt.about.principle2.detail':
    'Cent vingt adultes dans une seule famille élargie est une famille ordinaire ici, non '
    + 'un cas limite. Chaque écran qui liste des membres est conçu pour cela — car contenir '
    + 'une famille élargie entière est toute la prémisse, et un outil qui se dégrade à '
    + 'quarante personnes l’a manquée.',
  'mkt.about.principle3.title': 'Nous disons quand quelque chose n’est pas prêt',
  'mkt.about.principle3.detail':
    'Les fonctionnalités encore en développement sont étiquetées comme telles, ici et dans '
    + 'le produit. Un élément de feuille de route présenté comme livré est la façon la plus '
    + 'rapide de perdre la confiance d’une famille, et nous préférons être plus lents que '
    + 'd’être pris.',
  'mkt.about.publisherTitle': 'Qui est derrière GENORRA',
  'mkt.about.publisherLede':
    'GENORRA est construit et publié par {publisher}. C’est un produit à but unique plutôt '
    + 'qu’une fonctionnalité annexe de quelque chose de plus vaste — et c’est pourquoi chaque '
    + 'écran présuppose des proches, des générations et des branches plutôt que des clients, '
    + 'des équipes et des comptes.',
  'mkt.about.whatItDoes': 'Ce qu’il fait',
  'mkt.about.whySwitch': 'Pourquoi les familles migrent',
  'mkt.about.ctaTitle': 'Un seul endroit, pour chaque génération',
  'mkt.about.ctaLede': 'Créez votre compte gratuit et faites entrer toute la famille.',

  // ──── HOME — the hero, and the founding family ──────────────────────────────────
  'mkt.home.metaTitle': 'Organisez vos retrouvailles familiales en privé — GENORRA',
  'mkt.home.lead': 'Où chaque génération a sa place.',
  'mkt.home.heroLede':
    'Le portail unique pour organiser des événements, partager des souvenirs et garder '
    + 'votre famille proche — quelle que soit la distance.',
  'mkt.home.heroPrimary': 'Rejoignez votre famille',
  'mkt.home.heroReassure':
    'Privé et sécurisé — les données de votre famille ne sont jamais partagées ni vendues.',
  'mkt.home.ctaTitle': 'Prêt à vous retrouver ?',
  'mkt.founding.eyebrow': 'À propos de ce chiffre',
  'mkt.founding.title': 'Nous préférons vous montrer comment ça marche',
  'mkt.founding.ledeBefore':
    'Des milliers de familles fonctionnent avec GENORRA. Nous pourrions ouvrir sur ce '
    + 'chiffre et nous en tenir là, mais il ne vous dit rien sur la capacité du produit à '
    + 'porter',
  // THE HINGE — see the Spanish note. *votre* is the possessive itself rather than a
  // separate word, which is the clearest case for why this could not have been
  // a JSX tag inside one translated sentence.
  'mkt.founding.ledeEm': 'votre',
  'mkt.founding.ledeAfter':
    'famille. Tout ce qui précède est ce qu’il fait réellement. Ci-dessous se trouve le '
    + 'seul décompte qui l’a façonné.',
  'mkt.founding.statsTitle': 'La famille pour laquelle nous l’avons construit',
  'mkt.founding.stat0': 'générations vivantes',
  'mkt.founding.stat1': 'membres de la famille',
  'mkt.founding.stat2': 'endroit où tout cela vit maintenant',
  'mkt.founding.statsFoot':
    'Notre propre famille — non un décompte de clients. GENORRA a été construit pour la '
    + 'porter, puis ouvert à d’autres familles qui avaient le même problème.',

  // ──── THE BRAND LOCKUP, READ ALOUD ──────────────────────────────────────────────
  'mkt.bannerAlt':
    'GENORRA — générations organisées, ressources enregistrées, ascendance archivée. '
    + 'Héritage · Communauté · Legs',

  // ──── THE /pricing PLAN BULLETS — 30 claims, keyed on their own id ──────────────
  // THIS IS /pricing’s LIST AND IT IS DELIBERATELY NOT `plan.adds.*`. The two are
  // separately WORDED — one is what a BUYER reads and the other what a MEMBER
  // reads on /admin/settings — and `lib/plans.ts` argues that at length. What
  // holds them together is the claim id, which `marketing:check` asserts matches
  // per tier. So a bullet re-priced here and not there is a finding, in every
  // language at once, and neither wording is derived from the other.
  'mkt.claim.free/every-relative-free.label': 'Chaque proche, absolument tous, sans frais',
  'mkt.claim.free/every-relative-free.detail':
    'Membres illimités. Aucun frais par personne : personne n’est laissé de côté pour '
    + 'alléger une facture.',
  'mkt.claim.free/directory.label': 'Tout le monde en un seul endroit, et joignable',
  'mkt.claim.free/directory.detail':
    'Un répertoire dans lequel vous pouvez chercher, avec les coordonnées dont vous avez '
    + 'réellement besoin.',
  'mkt.claim.free/shared-calendar.label': 'Mettez le rassemblement sur un calendrier partagé',
  'mkt.claim.free/shared-calendar.detail':
    'La date, le lieu et les détails, sur une page que toute la famille peut voir.',
  'mkt.claim.free/announcements.label': 'Des nouvelles qui atteignent toute la famille',
  'mkt.claim.free/announcements.detail':
    'Des annonces épinglées sur le tableau de bord de chacun plutôt qu’enfouies dans un fil '
    + 'de discussion.',
  'mkt.claim.free/chat.label': 'Continuez à vous parler entre les rassemblements',
  'mkt.claim.free/chat.detail': 'Chat pour toute la famille et messages privés.',
  'mkt.claim.free/one-account-many-families.label':
    'Un compte, quel que soit le nombre de familles',
  'mkt.claim.free/one-account-many-families.detail':
    'Entré par mariage dans une seconde famille, ou vous tenez les deux côtés de vos '
    + 'parents ? Passez de l’un à l’autre sans seconde connexion — tout à l’écran change d’un '
    + 'coup.',
  'mkt.claim.free/nothing-scrolls-away.label': 'Rien n’est perdu quand cela disparaît de l’écran',
  'mkt.claim.free/nothing-scrolls-away.detail':
    'Chaque annonce, et tout ce qui vous a été envoyé, cherchable longtemps après avoir '
    + 'quitté le tableau de bord.',
  'mkt.claim.free/manual.label': 'Un manuel que vos proches utiliseront vraiment',
  'mkt.claim.free/manual.detail':
    'Chaque écran expliqué par son nom, avec un point d’interrogation dans le coin qui '
    + 'ouvre la page de l’endroit où ils se trouvent.',
  'mkt.claim.standard/ledger.label': 'Un vrai registre pour l’argent que vous encaissez',
  'mkt.claim.standard/ledger.detail':
    'Des barèmes de cotisations, un registre d’apports et des fonds — enregistrés plutôt '
    + 'que mémorisés. Espèces sur ce forfait.',
  'mkt.claim.standard/family-tree.label': 'L’arbre généalogique, remonté',
  'mkt.claim.standard/family-tree.detail':
    'Comment chacun est lié, génération par génération, le sang et le mariage distingués.',
  'mkt.claim.standard/duties.label': 'Chacun connaît ses tâches',
  'mkt.claim.standard/duties.detail':
    'Un rassemblement bâti à partir d’une liste de contrôle, chaque étape confiée à un '
    + 'proche nommé, et une décision sur ce qui revient.',
  'mkt.claim.standard/gathering-budget.label': 'Prévoyez ce que le rassemblement coûte',
  'mkt.claim.standard/gathering-budget.detail':
    'Un budget tiré de l’un de vos fonds, et ce que chaque tâche a réclamé dessus.',
  'mkt.claim.standard/separation-of-duties.label': 'Séparation des tâches',
  'mkt.claim.standard/separation-of-duties.detail':
    'Des autorisations par fonctionnalité, pour qu’enregistrer des cotisations ne soit pas '
    + 'la même chose que verser de l’argent.',
  'mkt.claim.standard/profile-pictures.label': 'Un visage pour chaque nom',
  'mkt.claim.standard/profile-pictures.detail':
    'Des photos de profil, dans le répertoire, sur l’arbre et partout où un membre est '
    + 'listé.',
  'mkt.claim.plus/card-payments.label': 'Encaissez comme votre famille paie réellement',
  'mkt.claim.plus/card-payments.detail':
    'Carte, débit, PayPal, Apple Pay, Google Pay et Cash App, avec des fonds et un registre '
    + 'complet derrière.',
  'mkt.claim.plus/dues-projections.label': 'Sachez ce qui reste dû, avant d’avoir à le demander',
  'mkt.claim.plus/dues-projections.detail':
    'Chaque proche qui doit cette année, ce qui est entré, et qui doit encore payer.',
  'mkt.claim.plus/pnl.label': 'Un compte de résultat pour votre trésorier',
  'mkt.claim.plus/pnl.detail':
    'L’état que le conseil demande, directement depuis le registre — plus les virements '
    + 'entre vos fonds, les deux côtés au relevé.',
  'mkt.claim.plus/membership-report.label': 'Les chiffres que le conseil ne cesse de demander',
  'mkt.claim.plus/membership-report.detail':
    'Les cotisations encaissées face aux impayées, et vos adhésions par région, par section '
    + 'et selon jusqu’où chaque proche est allé dans son inscription.',
  'mkt.claim.plus/activity-reports.label': 'Des rapports sur autre chose que l’argent',
  'mkt.claim.plus/activity-reports.detail':
    'Si le travail du rassemblement est revenu, la participation aux élections, à quelle '
    + 'fréquence vous vous réunissez, et quelles fonctions sont vacantes.',
  'mkt.claim.plus/elections.label': 'Élisez vos responsables comme il faut',
  'mkt.claim.plus/elections.detail':
    'Nommer, accepter ou refuser, puis voter — toute la famille, une région ou une section.',
  'mkt.claim.plus/library.label': 'La paperasse, et la structure qui va avec',
  'mkt.claim.plus/library.detail':
    'Des statuts cherchables, et des procès-verbaux qui consignent comment la salle a voté '
    + '— plus des régions et des sections avec leurs propres responsables.',
  'mkt.claim.plus/officer-notes.label': 'Chaque fonction tient son propre carnet',
  'mkt.claim.plus/officer-notes.detail':
    'Des notes de travail qui restent avec la fonction plutôt qu’avec la personne, lisibles '
    + 'seulement par son titulaire.',
  'mkt.claim.plus/gallery.label': 'Chaque photographie, trouvable',
  'mkt.claim.plus/gallery.detail': 'Des collections par rassemblement, avec étiquetage.',
  'mkt.claim.premium/dues-reminders.label':
    'Cessez de courir après vos proches pour leurs cotisations',
  'mkt.claim.premium/dues-reminders.detail':
    'Les rappels partent à chaque échéance, et s’arrêtent dès qu’elle est payée.',
  'mkt.claim.premium/notifications.label':
    'Des nouvelles qui arrivent, au lieu d’attendre qu’on les trouve',
  'mkt.claim.premium/notifications.detail':
    'Des notifications sur le téléphone et dans le navigateur pour les annonces, les '
    + 'messages et les tâches qui vous sont confiées.',
  'mkt.claim.premium/mobile-apps.label': 'La famille dans la poche de chacun',
  'mkt.claim.premium/mobile-apps.detail':
    'Des applications pour iPhone et Android, connectées au même compte familial.',
  'mkt.claim.premium/email-distributions.label':
    'Écrivez à toute la famille sans construire de liste',
  'mkt.claim.premium/email-distributions.detail':
    'Des envois tirés directement de vos adhésions : personne n’est oublié et personne n’y '
    + 'est deux fois.',
  'mkt.claim.premium/safety-check-ins.label':
    'Vérifiez que tout le monde est en sécurité, d’une pression chacun',
  'mkt.claim.premium/safety-check-ins.detail':
    'Quand une tempête ou un incendie frappe, demandez aux proches de cette région — ou à '
    + 'une liste que vous choisissez — s’ils sont en sécurité. Ils répondent d’une pression, '
    + 'et vous voyez une liste se remplir : qui est en sécurité, qui a besoin d’aide, et qui '
    + 'n’a pas encore répondu.',
  'mkt.claim.premium/family-website.label': 'Le site web de votre famille, qui se tient à jour',
  'mkt.claim.premium/family-website.detail':
    'Il se construit à partir de votre prochain rassemblement, de vos photographies les '
    + 'plus récentes et de votre dernière annonce. Tous les autres sites familiaux sont '
    + 'abandonnés en mars parce que quelqu’un doit les mettre à jour. Celui-ci, personne n’a '
    + 'à le faire.',
  'mkt.claim.premium/custom-domain.label': 'Une vraie adresse pour lui, prête à l’emploi',
  'mkt.claim.premium/custom-domain.detail':
    'Aucune facture d’hébergement, aucune extension, et aucun proche « qui s’y connaît en '
    + 'informatique » à l’entretenir.',

  // ──── PRICING — the chrome, the derived price answer and the FAQ ────────────────
  'mkt.price.metaTitle': 'Tarifs — commencez gratuitement, sans carte',
  'mkt.price.metaDescription':
    'Créez votre famille, invitez vos proches et organisez votre premier rassemblement sur '
    + 'GENORRA gratuitement. Sans carte de crédit, sans compte à rebours d’essai, sans frais '
    + 'par membre.',
  'mkt.price.graphName': 'Tarifs — commencez gratuitement, sans carte',
  'mkt.price.eyebrow': 'Tarifs',
  'mkt.price.title': 'Gratuit. Pas gratuit-pendant-trente-jours.',
  'mkt.price.lede':
    'Aucun compte à rebours d’essai, aucune carte de crédit, aucun frais par proche. Amenez '
    + 'toute la famille — c’est tout l’intérêt du produit.',
  'mkt.price.plansEyebrow': 'Forfaits',
  'mkt.price.plansTitle': 'Quatre forfaits. Le gratuit n’est pas un essai',
  'mkt.price.plansLede':
    'Faites entrer chaque proche et parlez-vous — gratuitement, pour toujours. Payez quand '
    + 'vous commencez à mener la famille comme une organisation.',
  'mkt.price.freeAmount': '0 $',
  'mkt.price.freePeriod': 'pour toujours',
  'mkt.price.noCard': 'Sans carte. Sans période d’essai.',
  'mkt.price.paidEyebrow': 'Quand la famille a besoin de plus qu’un endroit où être',
  'mkt.price.paidTitle': 'Trois marches vers le haut, chacune contenant la précédente',
  'mkt.price.paidLede':
    'Aucun d’eux ne peut encore être acheté — il n’y a pas de facturation dans le produit. '
    + 'Les prix sont fixés, et ce sont ceux que vous paierez.',
  'mkt.price.sizeEyebrow': 'Quel que soit votre nombre',
  'mkt.price.sizeTitle': 'Le prix ne sait pas quelle taille votre famille a',
  'mkt.price.sizeLede':
    'La plupart des outils facturent au siège : la première chose que vous faites est donc '
    + 'de décider pour quels proches il vaut la peine de payer. Déplacez le curseur et '
    + 'regardez : rien ne se passe.',
  'mkt.price.compareLink': 'Voyez comment cela se compare aux solutions de rechange',
  // See the Spanish note: the sentence is copy, the figure is derived.
  'mkt.price.rateSentence': 'Le forfait {tier} coûte {amount} par mois.',
  'mkt.price.rateFooter':
    'Aucun forfait annuel et aucun contrat — de mois en mois, pour toute la famille quelle '
    + 'que soit sa taille. Aucun d’eux n’est encore en vente — il n’y a pas de facturation '
    + 'dans le produit, donc chaque carte payante indique Bientôt disponible. Créez un compte '
    + 'gratuit et vous serez prévenu de leur ouverture.',
  'mkt.price.noneAnnounced':
    'Aucun n’a encore été annoncé. Créez un compte gratuit et vous serez prévenu en '
    + 'premier.',
  'mkt.price.faqTitle': 'Des réponses claires sur l’argent',
  'mkt.price.faq0.q': 'GENORRA est-il vraiment gratuit ?',
  'mkt.price.faq0.a':
    'Oui, et pas comme un essai. Des membres illimités, le répertoire des membres, le chat '
    + 'de la famille, les annonces et vos rassemblements sur un calendrier familial partagé '
    + 'ne coûtent rien, sans carte requise et sans date d’expiration. Ce qui est payé, c’est '
    + 'de MENER la famille plutôt que d’en avoir une — l’arbre généalogique, le registre des '
    + 'cotisations et la répartition du travail relèvent de Standard, et le prix figure sur '
    + 'la carte ci-dessus, pour toute la famille quelle que soit sa taille.',
  'mkt.price.faq1.q': 'Y a-t-il une limite au nombre de membres que nous pouvons ajouter ?',
  'mkt.price.faq1.a':
    'Non, sur aucun palier, Gratuit compris. Le produit est conçu pour une famille de cent '
    + 'adultes ou plus — c’est le cas ordinaire et non l’exception — et il n’y a jamais de '
    + 'frais par membre. Un prix qui grandit avec votre famille est un prix qui laisse des '
    + 'proches dehors, ce qui va contre tout l’intérêt.',
  'mkt.price.faq2.q': 'Où s’arrête Gratuit et où commence Standard ?',
  'mkt.price.faq2.a':
    'Gratuit fait entrer toute votre famille en un seul endroit : un répertoire où chacun '
    + 'peut chercher, un chat pour toute la famille et privé, des annonces sur le tableau de '
    + 'bord de chacun, et vos rassemblements sur un calendrier partagé avec la date, le lieu '
    + 'et les détails. Standard sert à MENER la famille — l’arbre généalogique remonté à '
    + 'travers les générations, un vrai registre de cotisations et de dons, des '
    + 'rassemblements organisés comme il faut avec une liste de contrôle et chaque étape '
    + 'confiée à un proche nommé, des autorisations par fonctionnalité, et une photographie '
    + 'pour chaque nom.',
  'mkt.price.faq3.q': 'Qu’ajoute Plus par-dessus Standard ?',
  'mkt.price.faq3.a':
    'L’organisation autour de la famille. Accepter les paiements par carte, débit, PayPal, '
    + 'Apple Pay, Google Pay et Cash App au lieu des espèces seules ; voir ce que chaque '
    + 'proche doit encore pour l’année ; les élections des fonctions ; des collections de '
    + 'photos avec étiquetage ; des documents ; des régions et sections avec leurs propres '
    + 'responsables ; un compte de résultat et des rapports pour le conseil.',
  'mkt.price.faq4.q': 'Sur Standard, ne pouvons-nous enregistrer que des paiements en espèces ?',
  'mkt.price.faq4.a':
    'Oui. Standard comprend des barèmes de cotisations, des fonds et un registre d’apports, '
    + 'et vous y enregistrez les paiements en espèces — ce que la plupart des familles font '
    + 'aujourd’hui dans un carnet. Accepter les paiements par carte, débit, PayPal, Apple '
    + 'Pay, Google Pay et Cash App, avec une affectation automatique dans vos fonds derrière, '
    + 'fait partie de Plus.',
  'mkt.price.faq5.q':
    'Les fonctionnalités gratuites que nous utilisons aujourd’hui vont-elles devenir '
    + 'payantes ?',
  'mkt.price.faq5.a':
    'Non. Ce qui figure sous Gratuit sur cette page reste gratuit — chaque proche, le '
    + 'répertoire, le chat, les annonces et le calendrier partagé — et il n’y a de frais par '
    + 'membre sur aucun forfait. Les paliers payants sont de la capacité ajoutée par-dessus, '
    + 'non un péage sur ce dont votre famille dépend déjà.',
  'mkt.price.faq6.q': 'Combien coûteront les forfaits payants ?',
  'mkt.price.faq7.q': 'Vendez-vous les données de notre famille ?',
  'mkt.price.faq7.a':
    'Non. Il n’y a aucune publicité dans le produit et les données familiales ne sont '
    + 'jamais partagées ni vendues, sur aucun palier. Une famille ne peut pas voir les '
    + 'données d’une autre du tout — cette séparation est imposée par la base de données à '
    + 'chaque requête plutôt que par un réglage.',
  'mkt.price.testimonials': 'Des familles qui ont cessé de payer pour trois outils',
  'mkt.price.ctaTitle': 'Le découvrir ne coûte rien',
  'mkt.price.ctaLede':
    'Créez votre famille, partagez le code, et voyez si cela remplace le tableur.',

  // ──── THE FAMILY-SIZE SLIDER — the demonstration that the price does not move ────
  'mkt.slider.relatives': 'proches',
  'mkt.slider.relativesOrMore': 'proches ou plus',
  'mkt.slider.dragLabel': 'Faites-le glisser jusqu’à la taille de votre famille',
  'mkt.slider.valueText': '{n} proches',
  'mkt.slider.yourBill': 'Votre facture, à {n} proches',
  'mkt.slider.each': '{amount} chacun',
  'mkt.slider.nothing': 'rien',
  'mkt.slider.underCent': 'moins de 0,01 $',
  'mkt.slider.cents': '{amount}',
  'mkt.slider.foot':
    'Déplacez-le aussi loin que vous voulez. Les chiffres de gauche ne changent jamais — il '
    + 'n’y a de frais par membre sur aucun forfait, donc le cousin que vous avez presque '
    + 'oublié ne coûte rien à ajouter.',
}
