# My Meetings

A simple page for keeping daily meeting links in one place, with an alarm before each meeting. Plain HTML, CSS and JavaScript. No build step, no installs.

## Files

- `index.html` is the page structure
- `style.css` is the look. The colours and fonts are at the top of the file
- `app.js` is the logic. Set `USER_NAME` and `DEFAULT_LEAD_MINUTES` at the top

## Put it on GitHub and get a link

1. Create a new repository on github.com (for example `meeting-links`).
2. Upload all four files (`index.html`, `style.css`, `app.js`, `README.md`) to the repository root.
3. Go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, then save.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/meeting-links/`.

Open that link on your mother's phone and use "Add to Home Screen" so it opens like an app.

## Good to know

- Meetings are saved in the browser of the device they were added on. Use "Backup and restore" at the bottom of the page to move them to another device.
- Alarms only ring while the page is open, so keep it open on her phone with the screen on. Tap "Turn on alarms" once each time the page is opened.
- To change the look, edit the colour values under `THEME` in `style.css`.
