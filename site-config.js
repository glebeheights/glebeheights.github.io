/* Glebe Heights — site configuration
 * -----------------------------------------------------------------------------
 * Loaded before the other scripts. Holds the one setting that connects the static
 * website to the Google Apps Script backend (see apps-script/README.md).
 *
 * HOW TO CONNECT THE BACKEND:
 *   1. Deploy the Apps Script web app (Execute as: Me, Who has access: Anyone).
 *   2. Copy the deployment URL (it ends in "/exec").
 *   3. Paste it between the quotes for `webAppUrl` below, commit, and push.
 *
 * Until this is set, the site still works:
 *   - the calendar + Upcoming Events fall back to the bundled events.json, and
 *   - the reservation form falls back to opening the visitor's email client.
 * No secrets or API keys belong in this file — it is public.
 */
window.GHCA_CONFIG = {
  // Apps Script web app URL, e.g. "https://script.google.com/macros/s/AKfyc.../exec"
  webAppUrl: "",

  // Fallback email used if the backend isn't connected yet (matches the site).
  reservationEmail: "glebeheights.secretary@gmail.com",

  // How many upcoming items to show in the "Upcoming Events" list on the homepage.
  upcomingLimit: 6
};
