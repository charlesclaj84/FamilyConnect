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
  'mkt.also./accounting/transactions.title': 'Le registre complet',
  'mkt.also./accounting/transactions.blurb':
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
  'mkt.also./reporting/payment-history.title': 'Votre propre historique de paiement',
  'mkt.also./reporting/payment-history.blurb':
    'Chaque paiement enregistré à votre nom, avec sa date, son montant, son mode et son '
    + 'état — pour que personne n’ait à croire le trésorier sur parole.',
  'mkt.also./reporting/dues-projections.title': 'Projection des cotisations',
  'mkt.also./reporting/dues-projections.blurb':
    'Ce que la famille devrait encaisser cette année, ce qui est entré, et qui doit encore '
    + '— en comptant les proches qui n’ont jamais terminé leur inscription.',
  'mkt.also./accounting/transactions/fund-transfers.title': 'Virements entre fonds',
  'mkt.also./accounting/transactions/fund-transfers.blurb':
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
}
