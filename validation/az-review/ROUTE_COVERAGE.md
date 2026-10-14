# Ledgerly r11 route coverage inventory

Actual recorded clicks are distinct from correctness assertions. Refer to the scenario report for assertions and limits.

| Action | Coverage | Evidence / note |
|---|---|---|
| add-adjustment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| add-attachment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| add-debt-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| add-payment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| add-waiver | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| apply-merge-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| apply-restore | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| archive-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| archived-creditors | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| attachments | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| audit | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| backup-menu | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| change-password | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| clean-orphan-attachments | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| close-modal | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| confirm-async-no | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| confirm-async-yes | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| confirm-modal | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| copy-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| copy-recovery | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| creditor-details | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| creditor-menu | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| delete-attachment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| diagnostics | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| download-attachment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| edit-tx | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| emergency-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| enable-security | legacy/not current UI | Legacy optional-security dialog; mandatory setup now protects every active ledger. Mandatory setup tested, legacy dialog not reached in normal UI. |
| export-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| export-csv | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| export-ics | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| export-pdf-full | legacy/not current UI | Legacy report-menu route superseded by the capture-phase Report v2 center; five actual PDF kinds tested. |
| export-pdf-redacted | legacy/not current UI | Legacy PDF route superseded by Report v2; redacted PDF exported and inspected. |
| export-report-full | legacy/not current UI | Legacy HTML export not exposed by the current intercepted report center; source reviewed only. |
| export-report-redacted | legacy/not current UI | No current rendered button; legacy HTML helper, source reviewed only. |
| finish-onboarding | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| generate-template | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| glossary | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| lock-now | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| merge-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| merge-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| move-tx | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| new-empty-ledger | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| plan | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| preview-attachment | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| preview-page | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| print | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| rename-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| report-menu | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| restore-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| restore-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| restore-snapshot | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| reverse-tx | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| save-settings | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| snapshots | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| statement | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| statement-redact | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| templates | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| templates-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| test-backup | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| toggle-creditor | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| tx-more | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |
| void-tx | browser exercised | browser-*-actions.json and corresponding successful scenario assertions |

## Submitted forms observed

- `submit:adjustmentForm`
- `submit:asOfForm`
- `submit:authorizeForm`
- `submit:backupPasswordForm`
- `submit:changePasswordForm`
- `submit:creditorDetailsForm`
- `submit:debtForm`
- `submit:editTxForm`
- `submit:fgAuthForm`
- `submit:mandatorySecurityForm`
- `submit:mergeCreditorForm`
- `submit:moveTxForm`
- `submit:paymentForm`
- `submit:renameCreditorForm`
- `submit:reportAuthForm`
- `submit:reportV2Form`
- `submit:reverseTxForm`
- `submit:templateForm`
- `submit:unlockForm`
- `submit:voidTxForm`
- `submit:waiverForm`
