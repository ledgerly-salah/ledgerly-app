# Ledgerly integrity repair: 20261009-integrity-r2

This package addresses the unified diagnosis F01–F23. It preserves schema 4, the existing password, the approved infographic page structure, and all recorded financial amounts. It does not rewrite existing valid records as a migration.

## Changes

| Findings | Implemented behavior |
|---|---|
| F01 | Chunked Base64 conversion handles the advertised 10 MiB attachment limit. |
| F02 | Invalid allocations/reversals/dates are rejected; category exposure and debt reductions share one calculation. Creditor-level increases remain separate exposure buckets. |
| F03–F04 | State, evidence mutations and rollback snapshots share an IndexedDB transaction. Snapshots preserve file bytes. Conflicts throw and stop success callbacks. |
| F05–F06 | Backup merges compare financial relationships; imported evidence and template creditor identities are mapped. Unsupported schemas are rejected before normalization. |
| F07–F08 | Lock clears active overlays, secrets and title; session guards stop stale operations. Privacy covers extra context, trends, plans and copied statements. |
| F09–F11 | Report reference writes advance revision with a lease. Cash payments and waivers are separate. Charts respect the report cutoff; historical balances explicitly mean the currently corrected ledger. Infographic Net Change equals adjustments minus waivers. |
| F12–F14 | Backup tests decrypt every included file and check links/size. Download requests no longer claim a verified download. Archived balances remain in totals. Corrections retain full before/after fields and voided entries stay in history. |
| F15–F17 | Forecasts honor frequency and ignore paid debts. PDFs embed Arabic fonts with bidi/shaping, wrap long notes and fix column widths. Closing confirmation resolves it; draft timers stop on close/lock and file selection must be repeated. |
| F18–F20 | New shell uses immutable release paths and waits for explicit activation. Legacy migration preserves original names and values. CSV prefixes formula-like text. |
| F21–F23 | Active dark chips have readable contrast; labels/dialog focus are enhanced. Build identity is centralized and release hashes and regression CI are included. |

## Verification

Run `npm ci --ignore-scripts` and `npm test` on Node 24+. The suite uses synthetic data, jsdom and fake-indexeddb; it does not read the owner's phone ledger.

32 tests passed locally, including 500 generated valid ledgers, 10 MiB Base64, large encrypted payloads, failed attachment-write rollback, revision conflict, reference sequencing and safe-mode restore under a different backup key. Arabic detailed and one-page infographic PDFs were rendered and inspected with Poppler. The screenshot example 13,482.16 minus 1,010.00 equals 12,472.16 remains unchanged in the synthetic arithmetic test.

## Acceptance still required before merge/publication

- Actual Android Chrome/PWA: existing install update, first install, offline cold start, multi-tab conflict, close/back/Tab behavior, autolock/background timing and large real-file quota behavior. No full browser runtime was available for these checks.
- On a disposable ledger: create debt/payment with evidence, correction, reversal, archive/unarchive, template and creditor/backup merges; export/test/restore and snapshot restore; verify PDF download and printing. Do not exercise destructive acceptance steps on the live ledger.
- Privacy is presentation masking, not access control; editing inputs and explicit full exports can still reveal information. Attachment names/metadata remain outside encryption, as the backup screen discloses.
- Historical reports recompute from today's corrected/voided records; these are not immutable historical books. Imported audit provenance is retained separately rather than spliced into the current audit chain.
- Embedded PDF font supports Arabic and the supplied Latin/punctuation subset. Unsupported characters fail explicitly; complex vowel mark placement and other scripts require further typography work.
- Snapshots keep up to 40 full evidence copies and therefore use more storage. Quota failure must abort the entire transaction; retention pruning is best effort. Old snapshots without file copies cannot recover missing evidence.
- Backup testing checks content integrity and decryption, not cryptographic sender authenticity or that Android finished the download. Emergency raw backups remain a separate recovery-assistance format.

## Packaging and publication

All new code lives in `releases/20261009-integrity-r2/`; existing root scripts remain available so older controlled tabs cannot fetch changed script bodies at their original URLs. The root index and service worker select the complete new module set. No automatic skipWaiting occurs. The older release's own already-installed update behavior cannot be changed retroactively.

This is a review package, not a production deployment. Merge only after the Android acceptance list above passes. Keep the existing downloaded backup and export a fresh backup before applying an approved release.

## Android acceptance and password requirement

Owner confirmed SAR 100 debt / SAR 25 paid / SAR 75 remaining, Lock now and backup test on Android. Build integrity-r2 requires a fresh master password for every debt and payment submission, including template-generated debts. Cancel or wrong password preserves the live input form and selected evidence. Tests cover rejection, one-shot authorization and a lock during password verification. Device acceptance of this new gate is pending.
