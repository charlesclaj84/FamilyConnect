import type { Catalogue } from '@/lib/i18n/t'

/**
 * The words in the mail the app sends. Français — formal address.
 *
 * ── `vous` THROUGHOUT, AND IT MATTERS MORE HERE THAN ON SCREEN ──────────────────────
 * `lib/i18n/fr.ts` carries the decision and the reasoning. Mail is where it is most exposed:
 * three of these messages are about MONEY or about REMOVING something, and two of them are the
 * warning somebody gets when another person is signed in as them. `vous` is what that register
 * wants in French, and `tu` in a security notice reads as a marketing email.
 *
 * Visible below in *Saisissez* (not *Saisis*), *ne faites rien* (not *ne fais rien*), *changez
 * votre mot de passe* (not *change ton mot de passe*) and *Ouvrez* (not *Ouvre*).
 *
 * ── THE VOCABULARY FOLLOWS THE SHELL'S ─────────────────────────────────────────────
 * *rassemblements* for the social occasions, never *réunions*, which in French names the formal
 * proceeding with a secretary and minutes. `lib/i18n/fr.ts` argues it at length and it reaches
 * exactly one string here — `email.approved.p2`, which lists what a new member can now open.
 * One word, and getting it wrong would tell somebody their family runs board meetings for fun.
 *
 * ── THE MARKUP IS PART OF THE SENTENCE AND MOVES WITH IT ───────────────────────────
 * Every `<strong>` here wraps the same thing its English counterpart wraps, but the tag sits
 * wherever French word order puts that phrase — which is the reason emphasis lives inside the
 * string rather than being applied around it in JSX. `i18n:check` cannot verify a tag survived
 * translation, so the tags are kept few and simple.
 *
 * ── TYPOGRAPHY ─────────────────────────────────────────────────────────────────────
 * U+00A0 before `:`, `?` and `!`, as `lib/i18n/fr.ts` explains — and it earns its keep twice
 * over in mail, where a body is reflowed by somebody else's mail client at a width we do not
 * choose. Do not "tidy" these into plain spaces.
 *
 * ── ONE PLURAL SPLIT KEPT, AND IT IS THE TRANSLATOR'S TO WIDEN ─────────────────────
 * `email.disconnect.autopayOne` / `autopayMany` are two strings because English needs two.
 * French also needs exactly two here, so they map across — but the SPLIT is what makes a
 * language with more plural forms able to add them, which a single string carrying `{n}` could
 * never do.
 */
export const emailFr: Catalogue = {
  // ── MEMBERSHIP APPROVED ──────────────────────────────────────────────────────────
  'email.approved.subject': 'Votre demande d’adhésion à {family} a été approuvée',
  'email.approved.preheader': 'C’est fait. {family} vous attend.',
  'email.approved.heading': 'Bienvenue',
  'email.approved.headingNamed': 'Bienvenue, {name}',
  'email.approved.p1':
    'Votre demande d’adhésion à <strong style="font-weight:600;">{family}</strong> sur {app} a '
    + 'été approuvée.',
  // *rassemblements*, never *réunions*. See the header.
  'email.approved.p2':
    'Tout vous est désormais ouvert : l’arbre généalogique, les photographies, les '
    + 'rassemblements, les annonces et le reste. Un bon premier pas est de compléter vos '
    + 'informations, pour que ceux qui vous connaissent puissent vous retrouver.',
  'email.approved.button': 'Ouvrir GENORRA',
  'email.approved.footnote':
    'Vous recevez ce message parce que quelqu’un utilisant cette adresse a demandé à rejoindre '
    + 'une famille sur {app}.',

  // ── FAMILY INVITATION ────────────────────────────────────────────────────────────
  // SENT IN THE INVITER'S LANGUAGE. The reader may not have chosen French — they have no
  // account and therefore no preference — so this copy leans a little more explicit than the
  // English about what the product IS, on the chance the language is a surprise.
  'email.invitation.subject': '{inviter} vous invite à rejoindre {family}',
  'email.invitation.subjectNoInviter': 'Vous êtes invité à rejoindre {family}',
  'email.invitation.preheader':
    '{family} vous a gardé une place. L’invitation est valable {days} jours.',
  'email.invitation.heading': 'Votre famille vous a gardé une place',
  'email.invitation.greeting': 'Bonjour {name},',
  'email.invitation.opening':
    '<strong style="font-weight:600;">{inviter}</strong> vous invite à rejoindre '
    + '<strong style="font-weight:600;">{family}</strong> sur {app}, où une famille conserve ses '
    + 'histoires, ses photographies, ses projets et le registre de qui est qui.',
  'email.invitation.openingNoInviter':
    'Vous êtes invité à rejoindre <strong style="font-weight:600;">{family}</strong> sur {app}, '
    + 'où une famille conserve ses histoires, ses photographies, ses projets et le registre de '
    + 'qui est qui.',
  'email.invitation.preApproved':
    'Acceptez ci-dessous et vous entrez aussitôt. Il n’y a aucun code familial à trouver et rien '
    + 'à remplir au préalable.',
  'email.invitation.needsReview':
    'Acceptez ci-dessous pour créer votre compte. Un administrateur vous admettra ensuite, il '
    + 'peut donc y avoir une courte attente après cette étape.',
  'email.invitation.button': 'Accepter l’invitation',
  'email.invitation.fine':
    'Cette invitation ne vaut que pour cette adresse et expire dans {days} jours.',
  'email.invitation.footnote':
    'Si vous n’attendiez pas ce message, vous pouvez l’ignorer sans risque. Aucun compte n’est '
    + 'créé avant que vous n’acceptiez, et personne n’en est informé dans un cas comme dans '
    + 'l’autre.',

  // ── FAMILY REMOVAL CODE ──────────────────────────────────────────────────────────
  'email.removal.subject': 'Votre code pour supprimer {family}',
  'email.removal.preheader':
    'Le code est valable {minutes} minutes et ne peut servir qu’une fois.',
  'email.removal.heading': 'Confirmez la suppression de cette famille',
  'email.removal.p1':
    'Quelqu’un connecté sous votre compte a demandé à supprimer '
    + '<strong style="font-weight:600;">{family}</strong> de {app}. Saisissez ce code dans la '
    + 'confirmation pour terminer :',
  'email.removal.p2':
    'Supprimer une famille la ferme pour tous ses membres : personne ne peut l’ouvrir, la '
    + 'rejoindre ni accepter une invitation. <strong style="font-weight:600;">Rien n’est '
    + 'effacé.</strong> Chaque paiement, photographie, événement et personne reste exactement à '
    + 'sa place, et l’assistance GENORRA peut rétablir la famille.',
  'email.removal.fine': 'Ce code est valable {minutes} minutes et ne peut servir qu’une fois.',
  'email.removal.footnote':
    'Si vous n’avez rien demandé, ne faites rien : le code expire de lui-même et la famille '
    + 'reste exactement telle qu’elle est. Changez ensuite votre mot de passe, car quelqu’un '
    + 'd’autre est connecté sous votre compte.',

  // ── STRIPE DISCONNECT CODE ───────────────────────────────────────────────────────
  'email.disconnect.subject': 'Votre code pour déconnecter Stripe de {family}',
  'email.disconnect.preheader':
    'Le code est valable {minutes} minutes et ne peut servir qu’une fois.',
  'email.disconnect.heading': 'Confirmez la déconnexion de Stripe',
  'email.disconnect.p1':
    'Quelqu’un connecté sous votre compte a demandé à déconnecter le compte Stripe par lequel '
    + '<strong style="font-weight:600;">{family}</strong> encaisse ses cotisations. Saisissez ce '
    + 'code dans la confirmation pour terminer :',
  'email.disconnect.p2':
    'Les membres ne pourront plus payer en ligne, et chaque paiement déjà enregistré est '
    + 'conservé. <strong style="font-weight:600;">Le compte Stripe de la famille lui-même reste '
    + 'intact</strong> : l’argent, les coordonnées bancaires et le tableau de bord Stripe '
    + 'demeurent exactement tels qu’ils sont.',
  'email.disconnect.autopayOne':
    '<strong style="font-weight:600;">1 proche</strong> paie ses cotisations automatiquement, et '
    + 'ce prélèvement sera annulé chez Stripe. Un prélèvement annulé ne peut pas être relancé : '
    + 'la reconnexion rétablit le compte, mais ce proche devrait reconfigurer son paiement.',
  'email.disconnect.autopayMany':
    '<strong style="font-weight:600;">{n} proches</strong> paient leurs cotisations '
    + 'automatiquement, et ces prélèvements seront annulés chez Stripe. Un prélèvement annulé ne '
    + 'peut pas être relancé : la reconnexion rétablit le compte, mais chacun d’eux devrait '
    + 'reconfigurer son paiement.',
  'email.disconnect.fine': 'Ce code est valable {minutes} minutes et ne peut servir qu’une fois.',
  'email.disconnect.footnote':
    'Si vous n’avez rien demandé, ne faites rien : le code expire de lui-même et rien ne change. '
    + 'Changez ensuite votre mot de passe, car quelqu’un d’autre est connecté sous votre compte.',

  // ── DISTRIBUTION ─────────────────────────────────────────────────────────────────
  // Sent in the SENDER's language, so this copy wraps a message that is also in French. The
  // subject and the heading are the member's own words and are not keys at all.
  'email.distribution.preheaderFrom': 'De {sender}, à toute la famille {family}.',
  'email.distribution.preheaderAnon': 'Un message à toute la famille {family}.',
  'email.distribution.empty': '(Aucun message n’a été joint.)',
  'email.distribution.footnoteFrom':
    '{sender} a envoyé ceci à toute la famille {family} sur {app}. Répondez à ce courriel pour '
    + 'lui répondre directement.',
  'email.distribution.footnoteAnon':
    'Ceci a été envoyé à toute la famille {family} sur {app}.',

  // ── SAFETY CHECK-IN ──────────────────────────────────────────────────────────────
  // The one message somebody may read in an emergency, so it is the shortest and the plainest —
  // and the one sent in the READER's language while the raiser's own words come through
  // untranslated. Never *alerte*: this is somebody ASKING, not the product claiming that
  // anything is happening near the reader.
  'email.checkIn.subject': 'Êtes-vous en sécurité ? — {family}',
  'email.checkIn.preheader': '{title} : votre famille vous demande de répondre.',
  'email.checkIn.heading': 'Êtes-vous en sécurité ?',
  'email.checkIn.askRaiser':
    '{raiser} demande à tous les membres de la famille {family} qui pourraient être touchés par '
    + '<strong>{title}</strong> de dire s’ils sont en sécurité.',
  'email.checkIn.askAnon':
    'La famille {family} demande à tous ceux qui pourraient être touchés par '
    + '<strong>{title}</strong> de dire s’ils sont en sécurité.',
  'email.checkIn.answer':
    'Ouvrez la demande et choisissez <strong style="font-weight:600;">Je suis en '
    + 'sécurité</strong> ou <strong style="font-weight:600;">J’ai besoin d’aide</strong>. Cela '
    + 'prend une seule touche, et la personne qui a demandé verra votre réponse aussitôt.',
  'email.checkIn.button': 'Répondre à la demande',
  'email.checkIn.footnoteRaiser':
    '{raiser} a lancé cette demande dans la famille {family} sur {app}. Si vous ne pouvez pas '
    + 'ouvrir le lien, répondez à ce courriel et cette personne le verra.',
  'email.checkIn.footnoteAnon':
    'Cette demande a été lancée dans la famille {family} sur {app}. Si vous ne pouvez pas ouvrir '
    + 'le lien, répondez à ce courriel.',
  'email.chrome.values': 'Relier | Organiser | Célébrer',
  'email.chrome.lead': 'Où chaque génération a sa place.',
  'email.chrome.fallback': 'Si le bouton ne fonctionne pas, collez ceci dans votre navigateur :',

  'email.auth.confirm.subject': 'Vous y êtes presque',
  'email.auth.confirm.preheader': 'Un geste et c’est fait. Le lien est valable une heure.',
  'email.auth.confirm.heading': 'Vous y êtes presque',
  'email.auth.confirm.p1':
    'Bienvenue. Confirmez cette adresse et votre compte {app} sera prêt — les histoires, les '
    + 'photographies et les projets de votre famille, réunis en un seul endroit.',
  'email.auth.confirm.p2':
    'Une chose à prévoir ensuite : votre famille examine les nouveaux membres avant de les '
    + 'admettre, il peut donc y avoir une courte attente après cette étape.',
  'email.auth.confirm.button': 'Confirmer mon adresse électronique',
  'email.auth.confirm.fine': 'Ce lien fonctionne une fois et expire au bout d’une heure.',
  'email.auth.confirm.footnote':
    'Si vous n’avez pas créé de compte {app}, vous pouvez ignorer ce message : rien ne se passe '
    + 'avant l’ouverture du lien, et il expire de lui-même.',

  'email.auth.recovery.subject': 'Réinitialisez votre mot de passe',
  'email.auth.recovery.preheader':
    'Choisissez un nouveau mot de passe. Le lien est valable une heure.',
  'email.auth.recovery.heading': 'Choisissez un nouveau mot de passe',
  'email.auth.recovery.p1':
    'Quelqu’un a demandé la réinitialisation du mot de passe du compte {app} associé à cette '
    + 'adresse. Ouvrez le lien ci-dessous et choisissez-en un nouveau.',
  'email.auth.recovery.button': 'Choisir un nouveau mot de passe',
  'email.auth.recovery.fine': 'Ce lien fonctionne une fois et expire au bout d’une heure.',
  'email.auth.recovery.footnote':
    'Si vous ne l’avez pas demandé, vous pouvez l’ignorer sans crainte. Votre mot de passe ne '
    + 'changera pas, et le lien expire de lui-même.',

  'email.auth.invite.subject': 'Votre famille vous a gardé une place',
  'email.auth.invite.preheader': 'Acceptez l’invitation à les rejoindre sur {app}.',
  'email.auth.invite.heading': 'Votre famille vous a gardé une place',
  'email.auth.invite.p1':
    'Quelqu’un de votre famille a invité <strong style="font-weight:600;">{email}</strong> à '
    + 'les rejoindre sur {app} — où une famille garde ses histoires, ses photographies, ses '
    + 'projets et la trace de qui appartient à qui.',
  'email.auth.invite.p2':
    'Acceptez ci-dessous et votre compte est créé pour vous. Il n’y a aucun code de famille à '
    + 'trouver ni rien à remplir au préalable.',
  'email.auth.invite.button': 'Accepter l’invitation',
  'email.auth.invite.fine': 'Ce lien fonctionne une fois et expire au bout d’une heure.',
  'email.auth.invite.footnote':
    'Si vous ne vous y attendiez pas, vous pouvez l’ignorer. Aucun compte n’est créé avant '
    + 'l’ouverture du lien.',

  'email.auth.reauth.subject': 'Nous vérifions juste que c’est vous',
  'email.auth.reauth.preheader':
    'Votre code de confirmation est ci-dessous. Il fonctionne une fois et expire au bout d’une '
    + 'heure.',
  'email.auth.reauth.heading': 'Nous vérifions juste que c’est vous',
  'email.auth.reauth.p1':
    'Vous effectuez un changement qui demande une seconde vérification. Saisissez ce code dans '
    + 'l’écran qui vous l’a demandé :',
  'email.auth.reauth.fine': 'Ce code fonctionne une fois et expire au bout d’une heure.',
  'email.auth.reauth.footnote':
    'Nous ne vous demanderons jamais ce code par téléphone, SMS ou courriel. Si vous ne vous y '
    + 'attendiez pas, ne le communiquez pas : quelqu’un connaît peut-être votre mot de passe, '
    + 'et c’est celui-ci qu’il faut changer.',

  'email.auth.changeOld.subject': 'Confirmez votre nouvelle adresse',
  'email.auth.changeOld.preheader':
    'Confirmez le changement depuis l’adresse que vous avez actuellement.',
  'email.auth.changeOld.heading': 'Confirmez ce changement',
  'email.auth.changeOld.p1':
    'Une demande a été faite pour déplacer le compte {app} de '
    + '<strong style="font-weight:600;">{email}</strong> vers '
    + '<strong style="font-weight:600;">{newEmail}</strong>.',
  'email.auth.changeOld.p2':
    'Les deux adresses doivent confirmer. Voici la moitié qui vient de l’adresse actuelle.',
  'email.auth.changeOld.button': 'Confirmer ce changement',
  'email.auth.changeOld.fine': 'Ce lien fonctionne une fois et expire au bout d’une heure.',
  'email.auth.changeOld.footnote':
    'Si vous ne l’avez pas demandé, ne faites rien et l’adresse de votre compte reste telle '
    + 'quelle. Il vaut la peine de changer aussi votre mot de passe — une telle demande ne peut '
    + 'être faite que depuis une session ouverte.',

  'email.auth.changeNew.subject': 'Confirmez votre nouvelle adresse',
  'email.auth.changeNew.preheader': 'Confirmez la nouvelle adresse du compte.',
  'email.auth.changeNew.heading': 'Confirmez cette adresse',
  'email.auth.changeNew.p1':
    'Une demande a été faite pour déplacer le compte {app} de '
    + '<strong style="font-weight:600;">{email}</strong> vers cette adresse.',
  'email.auth.changeNew.p2':
    'Les deux adresses doivent confirmer. Voici la moitié qui vient de la nouvelle.',
  'email.auth.changeNew.button': 'Confirmer cette adresse',
  'email.auth.changeNew.fine': 'Ce lien fonctionne une fois et expire au bout d’une heure.',
  'email.auth.changeNew.footnote':
    'Si vous ne vous y attendiez pas, vous pouvez l’ignorer : le compte conserve son adresse '
    + 'actuelle jusqu’à ce que les deux moitiés soient confirmées.',
  // ── THE STAFF FAMILY-DELETION CODE, 2026-08-31 ───────────────────────────
  // The one challenge email whose reader is a GENORRA owner rather than a family's
  // administrator, and the one where nothing is sent to the family at all.
  'email.staffDelete.subject': 'Votre code pour supprimer définitivement {code}',
  'email.staffDelete.preheader': 'Six chiffres, valables {minutes} minutes.',
  'email.staffDelete.heading': 'Confirmez une suppression définitive',
  'email.staffDelete.p1': 'Une personne connectée à la console du personnel GENORRA a demandé la suppression définitive de <strong>{family}</strong> (<strong>{code}</strong>). Tapez ce code dans la confirmation encore ouverte dans cette fenêtre.',
  'email.staffDelete.p2': 'Cela détruit chaque enregistrement de cette famille, et il n’y a pas de restauration. Si vous n’avez pas demandé cela, n’utilisez pas le code — et considérez votre session de console comme compromise.',
  'email.staffDelete.fine': 'Le code dure {minutes} minutes, fonctionne une fois et autorise cinq tentatives.',
  'email.staffDelete.footnote': 'Envoyé parce qu’une session de la console du personnel l’a demandé. Personne dans la famille ne reçoit ce message.',
}
