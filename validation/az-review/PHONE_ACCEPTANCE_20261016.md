# Ledgerly r11 — Phone acceptance evidence, 15–16 October 2026

This is a record of specific checks, not a claim of exhaustive phone testing. Production was not changed during this continuation.

## Evidence provenance
- Device: user's Android phone; Chrome incognito synthetic ledger, separate from production ledger. Initial screen required a new password and started at zero.
- User confirmed debt 100 then debt 25 to the same creditor. Actual payment was **50**, explicitly confirmed after the PDF review; final total **125 − 50 = 75**. Earlier assistant messages assuming a payment of 25 / remaining 100 are superseded. Short “done” replies were user confirmations, not direct observations by the assistant.
- User confirmed password authorization at debt save, preview, image and multi-page PDF offline navigation, backup export/test and restore with attachments, recovery unlock, rejection of wrong password then successful correct password.
- Detailed PDF supplied by user: D-0001, LR7, build r11, 2 pages, creditor SALAH, debts 100/25 and one payment 50, remaining 75. Independently extracted and rendered; totals agree and no visible clipping was observed.
- Redacted PDF supplied: R-0001, LR8, 2 pages; name replaced by Creditor 01, money replaced by REDACTED, notes omitted. Dates, transaction IDs, counts/status and ledger identifier metadata remain. This is selective redaction, not full anonymization. No embedded files or annotations; searched name and amount literals absent in extracted text and decompressed objects.
- Print preview screenshot showed both pages. Subsequently uploaded saved copy has 2 pages, exact matching extracted text and no visible clipping. Receipt and validity of this copy are verified; file metadata alone does not independently prove which save action produced it. Physical printing remains untested.
- Rotation was initially blocked by phone setting. After enabling auto-rotate, user confirmed landscape keyboard access, scrolling to fields/cancel, and cancellation with unchanged 75.
- Android Back from attachment preview closed preview and returned to home, per user.
- Share screenshot shows Android sheet for exported PDF; user confirmed Cancel returned normally. No message was sent as part of this check. This is OS file sharing, not a native Ledgerly share feature.
- TalkBack was enabled successfully but user found interaction difficult; no Ledgerly accessibility scenario completed. Test STOPPED / INCOMPLETE by agreement; user confirmed disabling TalkBack and normal control restored.
- On 16 October incognito showed new setup; previous temporary session unavailable. This is not evidence that the production ledger was lost.

## Remaining scope
TalkBack screen-reader interaction is incomplete. Fresh install in an isolated ordinary browser profile, other rendering engines, full accessibility state coverage, device-scale performance and comprehensive specialist security audit remain unverified. Desktop automation cannot substitute for these results. Functional correctness tests do not reconcile the user's real debts against external documents.
