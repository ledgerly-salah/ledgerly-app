# r15 — Home closes expanded creditor cards (not published)

User accepted the interaction change: selecting Home closes all expanded creditor details and returns to overview; ordinary scrolling preserves expansion. Bind both existing desktop/mobile Home anchors, clear only the transient expanded-card set, and render creditors before native anchor navigation. Repeated Home with no expanded cards is a no-op for rendering. Accounting, storage and persisted ledger data are unchanged. r14 published files are preserved in their immutable folder.

Validation: Node suite and dedicated Chromium browser scenarios; CI also runs the new Home scenarios, previous r14 scroll regression and existing acceptance/focus cases on Firefox/WebKit. Test cases exercise two expanded cards, ordinary scrolling, mobile click, desktop keyboard activation, repeated Home, reopening and unchanged decrypted ledger content.

This is a behavior enhancement requested by the user, not recurrence of the fixed scroll-jump bug. Production remains r14. No publication authorization for r15 has been given.
