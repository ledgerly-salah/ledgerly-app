# r14 — creditor expansion scroll fix (not published)

The user reported that expanding creditor details scrolls to the top and hides the details below the viewport. Reproduced on r13 at widths 390 and 1440, both first and later creditor cards: all four expansion cases jumped to scrollY=0.

Root cause: ui-accessibility compares `dialogs().at(-1)` (undefined when empty) to activeDialog (null). Every unrelated DOM mutation therefore entered the dialog-close focus restoration branch and focused the stale opener near the top of the page. Normalize the empty top-dialog value to null. The published r13 files remain unchanged; r14 has a separate release directory. Only ui-accessibility and the release build identifier differ within the release package. No accounting/storage changes.

The first hypothesis, replacing only the changed card, did not resolve the jump and was discarded. The final fix is the empty-dialog normalization only.

Validation: the isolated candidate passed all 8 expand/collapse observations across two widths and two card positions. The exact r14 package is tested by scripts/browser-r14-scroll.mjs; Node includes a regression for restoring focus once on real close and preserving focus after unrelated mutations. Firefox/WebKit CI now runs this scroll regression as well as existing acceptance and focus/banner cases.

Production remains r13. User approval was for r13, not this new release. No merge/deployment of r14 without fresh permission. Phone confirmation remains pending until an authorized deployment.
