# HYTTELAN VI · Hovden

The invitation now contains the 19 participants supplied by the organizer, their approved GTA-style illustrated portraits, and the personalized fictional LAN biographies. The original neon cabin design is preserved.

## Open the working invitation

[Open the GitHub-hosted file through HTMLPreview](https://htmlpreview.github.io/?https://github.com/oleemil/oleemil.github.io/blob/7056ae2294257eb60b1f15407dea7ef164662c8b/hyttelan/index.html)

[Latest source](https://github.com/oleemil/oleemil.github.io/tree/main/hyttelan)

HTMLPreview is an independent renderer hosted on github.io; it is not a new account-owned GitHub Pages deployment. This link does not redirect to the account's existing custom domain. The RSVP works inside this view using the live Supabase backend. No Higgsfield page, popup, GitHub login, or extra guest account is required.

## Current behavior

All 19 profiles are intentionally OPEN until the organizer asks for locking. Open profiles are NOT confirmations. No real guest was confirmed during development or testing.

The guest presses “Jeg er med!”, chooses their own name, checks the self-confirmation box, and submits. “MISSION PASSED” appears only after the database has saved a confirmed answer. “Jeg kan ikke komme” saves a decline. Other browsers refresh the shared status automatically every seven seconds while visible.

The trip date is 19 November 2026. The answer deadline is 25 September 2026 at 18:00 Europe/Oslo (16:00 UTC). Unanswered invitations become WASTED after the server-side deadline; confirmed guests keep their places. Registered reserves can claim available capacity after the deadline. The organizer must add reserve names; the page does not invent replacements.

Name selection is trust-based, not identity verification. The server prevents overwriting a answered name, duplicate requests, and oversubscription. The organizer can correct mistakes through the authorized database connection. There is no publicly accessible admin mutation.

## Implementation

- `design-reference.html`: retained visual source.
- `visning-data.json`: organizer-approved names and fictional biographies.
- `assets/portraits/player-01.webp` through `player-19.webp`: cropped from the explicitly labeled, approved illustration sheet. The JO card remains a silhouette, as supplied.
- `live-client.js`: shared reads, on-page registration, validated server responses, idempotent retries, filters, search, share and calendar export.
- `live-style.css`: portrait and registration styles.
- `backend-config.json`: public anon key, event ID, and public guest IDs; no service-role or admin credential.
- `build-live.py`: compiles only already-approved local content. It does not query or mutate the database.
- `.github/workflows/hyttelan-live.yml`: crops the approved artwork, validates and compiles the invitation, and commits only the event output.

Supabase storage is isolated in `hyttelan_private`. Only the narrowly scoped `hyttelan_state` and `hyttelan_respond` RPCs are public. Raw participant tables are inaccessible to anonymous visitors. The API is authoritative for attendance, capacity, deadline and current visibility. Browser storage contains only retry IDs, never the shared RSVP database.

## Verification completed on 25 September 2026, Norwegian time

61 automated checks passed: 45 browser checks and 16 live API checks. Browser testing used headless Chromium at 320, 390 and 1440 pixels. It was not a physical iPhone/Safari test.

The actual published GitHub preview loaded anonymously with all 19 portraits and profiles, no broken images, no horizontal overflow, a working name search and modal, and no unhandled JavaScript errors.

Writes were tested against a SEPARATE temporary event through the same deployed functions and client. A confirmation in one browser appeared in a second independent browser and survived a full reload. Declines, duplicate retries, conflicting claims, missing consent, network errors, server-side expiry, hiding unconfirmed profile fields, and two simultaneous reserves competing for the final seat were checked. Only one reserve obtained that seat.

The temporary event, its five test profiles, and its request records were removed after testing. The actual invitation was verified with 19 pending responses and zero confirmations. Unrelated legacy tables were checked with zero-row requests only; anonymous access was denied.

## Future locking

Only act when the organizer requests it. Change the event visibility to `on_confirmation` without resetting attendance. Also update the static HTML/bootstrap so pending profiles are not briefly shown before the first API response. The current artwork and fictional text are intentionally public in Git history; visual locking is a reveal mechanic, not a promise that previously published material can be made secret.
