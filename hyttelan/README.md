# Hyttelan VI · Hovden

Static invitation hosted by the existing GitHub Pages site, isolated under `/hyttelan/`. Existing site files, the CNAME and homepage are unchanged.

- Event: 19 November 2026.
- Default response deadline: 25 September 2026, 18:00 Europe/Oslo. The shared backend is authoritative after synchronization.
- The hero is the original user-supplied cabin photograph, not generated replacement architecture.
- No invented participants or confirmations are seeded.
- Page title/metadata request no search indexing; this is not access control.

## Shared RSVP

The existing server and database remain responsible for RSVP validation, shared state, deadline enforcement, host administration and reserve places. The GitHub page does not store answers locally or pretend browser-only changes are shared.

A user-clicked registration window opens `/lan-share.html` on the existing backend. It runs same-origin, retains secure cookies, shows the name picker and consent, and writes through the existing API. It posts public attendee state back to this page using an exact target-origin allowlist and per-window nonce. The parent validates the sender origin, window reference, nonce and payload. No GitHub login, personal access token, service-role key, or cross-origin host credentials are required.

The invitation displays the last state received while the RSVP window is open. On a new visit, use **Jeg er med** or **Hent siste svar** to synchronize. It does not claim unattended real-time synchronization when the window is closed. Some in-app browsers may require allowing the new window.

## Personalization still needed

The participant-name attachment was not available in the conversation. Enter the actual names and approved portraits using the existing private host panel. Never commit the private host link or host key to this public repository.
