# Ledgerly r12 — Contrast correction

Build: 20261016-contrast-r12. App 3.1.0 / schema 4 unchanged.

Some secondary text and financial badges had insufficient contrast in r11. This release adjusts muted text, positive/negative amount colors and warning colors, plus badge backgrounds in dark mode and the local-storage pill. Financial logic, encryption and storage modules are byte-identical to r11. The immutable r11 directory is retained.

Validation: 132 Node tests passed against r12. 32 representative accessibility states at 390/1440 pixels, system/light/dark, completed with zero confirmed automated violations after colors were integrated into the actual release CSS. The scan still has incomplete results on gradients/decorative/overlapping elements; this is not a full accessibility certification. A real service-worker upgrade from r11 to r12 preserved a synthetic encrypted ledger and blocked applying the update while a form was open. 33 manifest entries match local file hashes.

Phone acceptance of r11 is recorded separately in validation/az-review/PHONE_ACCEPTANCE_20261016.md; r12 has not yet been physically checked on the user's device. TalkBack remains stopped/incomplete. Other rendering engines, isolated fresh install and full device performance/security audits remain outside executed evidence.

User approved proceeding after review of the color candidate on 16 October 2026. Production publication must only follow successful package tests and remote CI. This document records preparation and does not itself prove publication; deployment status and live hashes are verified separately.
