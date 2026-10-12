# Ledgerly integrity-r6 — review candidate

Base production/main: `13bb6fc04e4671a4d39127ef2b4ba7b08a5640c0` (integrity-r5).
Candidate: `20261012-integrity-r6`. Repairs authorized; production merge/deployment is not authorized for this candidate.

## Changes

- R04: Failed commits no longer restore a stale beforeState over a newer successful write. Successful commit installation and reload reject older revisions. CAS still rejects conflicting writes rather than silently retrying a financial mutation.
- R03: New-empty-ledger uses the shared cancellation scope and epoch around asynchronous stages. One atomic save creates the old ledger/evidence snapshot, clears active evidence and obsolete drafts, and installs the empty ledger. Lock aborts pending writes; completed transactions cannot be retroactively revoked. Post-lock callbacks never restore state.
- R01: Moving a transaction authenticates its original evidence, reencrypts it with the new creditor identity, and commits the evidence and transaction together. Plaintext byte buffers are wiped. Changed revision, altered evidence or ended session blocks the move.
- R02: Unlock reads fresh encrypted state/security from storage, including after another tab rotates keys. A revision conflict while unlocking has a specific retry message. Locked-tab refresh can update encrypted metadata without decrypting or restoring state.
- R06: Emergency backup exports record and attachments from one read transaction using exportLedgerBundle. It remains a raw assistance backup, not a normal direct-restore format.
- R07: Automatic allocation accepts the reduction effective date and excludes later debts. Payment, waiver, correction and move pass that date. Current remaining capacity is still respected; the existing unallocated creditor-level policy and financial-date validation remain in force. Explicit invalid allocations remain rejected.
- R05: Backup parsing captures session/epoch and stops after file read, checksum or evidence verification if the session ends. No stale preview/context is installed, including plaintext and emergency formats.
- R08: As-of shows advance credit, cash paid and the reconciliation equation. Amount privacy applies to the entire result.

## Validation

`npm test`: **75 passed, 0 failed, 0 skipped** — 60 existing acceptance tests and 15 new acceptance tests, several covering multiple stages/scenarios. The earlier diagnostic probes were converted to expect corrected behavior, not retained as tests that celebrate defects.

New tests exercise preserved financial writes after a delayed failure, monotonic reload, new-ledger cancellation during encryption and actual IDB writes, successful restorable snapshot/evidence plus draft clearing, debt/payment moves and tamper rejection, fresh unlock after revision/security changes, distinct conflict messages, backup parsing cancellation at multiple stages, coherent emergency/normal export, dated allocation and real waiver/correction functions, and private advance-credit display.

20 top-level release JavaScript modules passed syntax checks. Manifest hashes/imports and explicit service-worker update/offline shell are covered by the suite. Focused implementation diff passed whitespace checks. r5 release files are unchanged.

## Compatibility and limits

- New immutable r6 directory/cache; r5 is retained. No IndexedDB/schema/crypto-format change beyond existing r5. No extra migration is introduced by r6.
- Tests use Node Web Crypto, fake-indexeddb and jsdom/VM with controlled asynchronous barriers; the main render is stubbed. This is not full browser/Android end-to-end validation. No user ledger, password, key, or device was accessed.
- Device quota, eviction, background suspension and PDF visual layout were not newly tested. Existing r5 limits remain.
- Local code/tests only. No remote branch upload, PR, merge or production publication occurred in this repair turn.

Review the focused implementation with:

```sh
git diff --no-index releases/20261011-integrity-r5 releases/20261012-integrity-r6
npm test
```
