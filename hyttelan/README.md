# HYTTELAN VI · Hovden

GTA / Vice City-inspired invitation for 19 November 2026, with a newly illustrated version of the actual two-gabled cabin in the supplied photograph. This version restores the original hot-pink / purple direction instead of presenting the unedited photograph as the hero.

## Open the site without an Inmoment redirect

[Interactive GitHub preview](https://htmlpreview.github.io/?https://github.com/oleemil/oleemil.github.io/blob/main/hyttelan/index.html)

This uses the third-party HTMLPreview renderer hosted on github.io to display this public file. It is a preview, not a separate GitHub Pages deployment belonging to this account. The existing account-level custom domain has deliberately not been changed.

## Functionality

- Shared participant state refreshes from the existing event API every 12 seconds.
- Registration opens a first-party RSVP window. It records the response in the existing database, then updates the invitation.
- Names and real portraits must be entered by the host. The participant roster is currently empty; anonymous dossier artwork is labeled as an empty layout, not an actual participant.
- No host keys, API secrets, participant data, or fabricated confirmations are included in this repository.
- The answer deadline is 25 September 2026 at 18:00 Europe/Oslo. Unanswered invitations expire; registered reserves can claim available seats after the deadline.
- All code and CSS for this page are in index.html. The existing style.css and app.js are retained as historical files but are not loaded.
- Backend hosting remains separate from GitHub; GitHub Pages alone does not persist form submissions.

The original photograph appears only in the clearly labeled behind-the-scenes postcard. The hero uses the new illustrated cabin asset.

## Verified availability (24 September 2026)

The styled page and artwork load through the GitHub preview without an Inmoment redirect. The existing external RSVP host currently returns HTTP 401 to anonymous visitors, so public registration is NOT working. The site explicitly prevents false confirmations when the API is unavailable. The roster also has no supplied participant names. Do not distribute this as a functioning RSVP system until the backend and roster are completed.
