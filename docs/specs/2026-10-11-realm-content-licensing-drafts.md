# Realm content licensing: drafts for review

**Date:** 2026-10-11 · **Status:** A and B are live on `rose-garden` (2026-10-11: claim consent, `terms.md` §2.5 to §2.8, the inactivity job). C is a draft. All of it still needs a lawyer's review.

Three pieces, using the same defined terms throughout:

| Term                   | Means                                                                            | Owner                |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------- |
| **Imported Content**   | Material that originates outside IxStates (wiki pages, flags, maps, nation data) | Its author           |
| **Nation Material**    | The Imported Content tied to one nation (its wiki pages, flag, arms, maps, art)  | Its author           |
| **User Content**       | What users make on IxStates (ToS §2.1)                                           | The user             |
| **Platform Materials** | Software, engines, generated output, presets, adapters, features                 | Alpaia Holdings      |
| **Shared Record**      | What stays when a nation leaves so others' stories still hold                    | n/a (factual record) |

---

## A. Claim flow consent

Goes in `ClaimNationButton.tsx` (and the `claimNationPage` path) as a second checkbox under the rules checkbox. The
claim button stays disabled until it is ticked. The server stores the consent version and time with the claim.

**Checkbox label**

> {countryName}'s wiki pages, flag and other material are my own work, or I have their creator's permission to
> bring them here.

**Line under it** (footnote style, link on "Realm content terms" to ToS §2.6)

> You keep ownership. IxStates and {realmName} may show and use this material in the realm while you hold
> {countryName}. If you leave or stop playing, it comes down and only the shared history stays. Realm content terms

**When the claimant is not the page's verified creator** (moderator review path), replace the label with:

> I have permission from the creator of {countryName}'s wiki pages and flag to bring them here.

and add an optional text field: "Who gave permission, and where? (a link or a name helps the moderators)". The
answer goes to the moderators with the claim and is kept as the permission record.

**Stored with the claim:** `consentVersion` (e.g. `"realm-content-1"`), `consentAt`, `consentBasis`
(`"author"` | `"permission"`), `permissionNote`.

---

## B. Terms of Service additions

Insert after §2.4. Update §2's summary line to: "Content brought in from other wikis stays its author's. Claiming a
nation lets us use its material in the realm while you hold it, and we remove it when you leave or stop playing."

Also change §3.1 "independent hobbyist project" to "independent project" once realms are sold.

### 2.5 Imported Content

"**Imported Content**" means material that originates outside the Services and is brought into them, by us or at
a user's direction, including through realm source syncs, wiki imports, map pipelines, file imports, and embedded
third-party media. Examples include wiki articles, flags, coats of arms, maps and map overlays, and nation data
hosted on other wikis or repositories.

(a) **Ownership stays with the author.** Bringing material into the Services does not transfer ownership of it to
Alpaia Holdings, to any realm, or to the person who imported it.

(b) **Upstream terms apply.** Imported Content remains subject to the licence or permission under which it was
obtained ("**Upstream Terms**"). Where available, we record each item's source, author, and Upstream Terms, and we
display the attribution the Upstream Terms require.

(c) **Restricted licences.** Where Upstream Terms prohibit commercial use or adaptation, we will not display that
content in a paid realm, or adapt it, without the author's written permission.

(d) **Factual data.** To the extent permitted by applicable law, names, figures (such as population, economic
output, and land area), dates, and links are treated as factual data and may be imported and displayed without a
grant from the author.

(e) **Responsibility for imports.** Anyone who configures or runs an import, including a realm operator,
represents that they hold or have obtained the rights the import requires. Section 5.4 applies to Imported
Content they bring in as it does to User Content.

(f) **Removal on request.** The author of Imported Content may ask us to remove it by writing to
[admin@ixwiki.com](mailto:admin@ixwiki.com) or using the report option on the content. We will remove it, or
explain why we believe we hold the rights to keep it, within fourteen (14) days. No formal notice is required.
Section 6.2 remains available for copyright complaints.

### 2.6 Nation Claims and the Realm Content Licence

When you claim a nation in a realm, you confirm that you are the author of that nation's existing material,
including its wiki pages, flag, coat of arms, maps, and other creative works associated with it ("**Nation
Material**"), or that its author has permitted you to bring it into the Services.

You keep all ownership of Nation Material. For as long as you hold the nation, you grant Alpaia Holdings and the
realm a non-exclusive, worldwide, royalty-free licence to:

1. host, copy, and display Nation Material within the Services;
2. adapt it as needed to run the Services, such as reformatting text, resizing or converting images, placing it on
   maps, and reading figures from it into the simulation;
3. store it, without displaying it, during a reclaim window under Section 2.8; and
4. show it in screenshots of the realm used to present IxStates, only if you opt in to this in your settings.

Alpaia Holdings does not acquire ownership of anything adapted from Nation Material. Adaptations are used only
within the realm and are removed with the Nation Material. We do not sell Nation Material, license it to anyone
else, or use it to train machine learning or artificial intelligence models.

### 2.7 Leaving a Realm

When you release a nation, when it is reassigned under the realm's rules, when you close your account, when a
reclaim window under Section 2.8 ends, or when the author of Nation Material asks under Section 2.5(f), we remove the Nation Material from the Services within
thirty (30) days, apart from routine backups, which expire on their normal schedule.

We keep the "**Shared Record**": the nation's name, its simulation figures and history, and the events, treaties,
and posts by other users that involve it, so that other users' stories remain coherent. The Shared Record does
not include Nation Material other than the nation's name. This is the continuity described in Section 2.3.

### 2.8 Inactive Nations

A nation is **inactive** when its holder has not signed in to the Services or acted for the nation for ninety (90)
days, or for the period set in the realm's rules, which may be no shorter than thirty (30) days and no longer than
three hundred sixty-five (365) days. A realm's rules may also turn inactivity release off.

(a) **Notice.** At least fourteen (14) days before an inactive nation is released, we notify its holder in the
Services and by the email address on their account. Signing in or acting for the nation before the release date
cancels it.

(b) **Release.** On release, the nation becomes unclaimed. Its Nation Material is hidden from display at once, and
the Shared Record stays as described in Section 2.7.

(c) **Reclaim window.** For one hundred eighty (180) days after release, the former holder may reclaim the nation
and its Nation Material is restored. The realm's rules decide whether others may claim the nation during this
window. A new holder never receives the former holder's Nation Material, and the former holder's right to restore
it ends when someone else's claim is approved.

(d) **End of the window.** When the window ends, or when another claim is approved, the Nation Material is removed
under Section 2.7. A removal request under Section 2.5(f) ends the window at any time.

(e) **Inactivity is not consent.** We do not treat inactivity as permission to keep, reuse, or reassign Nation
Material.

---

## C. Realm Agreement: key terms

A term sheet for the contract with whoever buys a realm package ("**Operator**"). It sits on top of the ToS, which
still governs every member of the realm, including the Operator's own account.

1. **Parties and scope.** Alpaia Holdings and the Operator. The Operator, or the individual signing for it, is at
   least eighteen (18) years old. The Operator contracts for itself only and does not grant rights on behalf of the
   realm's members or of authors outside it.

2. **Operator content.** Material the Operator itself owns (the realm's name, branding, setting documents, and
   any map it owns) is licensed to Alpaia Holdings on the same terms as Nation Material (ToS §2.6) for the term of
   the agreement, plus the wind-down period.

3. **Imports.** The Operator configures and runs its realm's imports. For each import it warrants that it holds
   or has obtained the rights required, keeps the permission records, and provides them on request. It will not
   import content under Upstream Terms that prohibit commercial use or adaptation without the author's written
   permission. The Operator acknowledges that paid hosting may count as commercial use under such terms.

4. **Inactivity period.** The Operator may set its realm's inactivity period within the limits of ToS §2.8 and
   decide in its rules whether others may claim a nation during a reclaim window. The notice, reclaim window, and
   removal terms of ToS §2.8 cannot be changed.

5. **Indemnities.** The Operator indemnifies Alpaia Holdings against third-party claims arising from imports it
   configured or ran. Alpaia Holdings indemnifies the Operator against third-party claims that Platform Materials
   infringe their rights.

6. **Platform Materials.** Alpaia Holdings owns the Platform Materials, including presets, adapters, and pipeline
   configuration built for the realm. The Operator receives a licence to use them for its realm during the term.

7. **Custom features.** Alpaia Holdings owns the code of any feature the Operator commissions. The feature is
   exclusive to the Operator's realm for **six (6) months** from launch. After that, Alpaia Holdings
   may make it available across the platform.

8. **No claim on derivatives.** Alpaia Holdings acquires no rights in anything adapted from Imported Content or
   Operator content. Such adaptations are used only in the Operator's realm and are deleted on termination or on
   the author's request.

9. **Exit.** On termination the realm becomes read-only for **ninety (90) days**. Within the first thirty (30) of
   them, Alpaia Holdings provides an export of the Operator's content, the realm's simulation records, and the
   User Content of members who consent, in open formats. At the end of the period the Operator chooses to keep the
   realm as a read-only archive or to have it deleted. Imported Content is removed either way.

10. **Takedowns.** Both parties cooperate on removal requests. Alpaia Holdings may disable content on receipt of a
    credible notice without being in breach.

11. **Liability.** Each party's total liability is capped at the fees paid in the twelve (12) months before the
    claim. The cap does not apply to the indemnities in item 5 or to wilful misconduct.

12. **Members' data.** Alpaia Holdings controls member account data under its Privacy Policy. The Operator's
    moderators access it only through the Services' moderation tools; data the Operator exports is its own
    responsibility.

13. **Law and venue.** New York, as in ToS §6.5.

---

## Open questions for the lawyer

- **Minors.** The minimum age stays 16. In many US states a minor can void a licence they granted. The §2.6 grant
  already ends when the player leaves, so voiding it should change little in practice. Confirm that, and whether
  §5.4's promise that a 16 or 17 year old holds the rights is enforceable. The Realm Agreement requires an adult
  signer (item 1).
- **Entity.** These drafts name Alpaia Holdings, a general partnership. If IxStates moves into an LLC, every draft
  and the ToS need the new party name.
- **Database rights.** §2.5(d) treats facts as free to use. EU database rights can restrict extracting a
  substantial part of a database even when its contents are facts. Does a nation roster pulled from a wiki fall
  under that?
- **Informal permissions.** Do emails or Discord messages such as API access from IIWiki's administrator, recorded
  in a register, count as enough "written permission" for §2.5(c)?
- **Removal times.** Are 14 days (§2.5(f)) and 30 days (§2.7) workable and sufficient?
