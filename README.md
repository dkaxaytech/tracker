# Personal Attendance Tracker

A modern, responsive, client-side personal attendance and shift tracking web application built with HTML5, CSS3, and Vanilla JavaScript. All records persist locally in the browser using `localStorage` with `YYYY-MM-DD` date keys.

## Features

- **Dashboard Summary Cards**: Live statistics for Today's Hours, Monthly Total, and Days Logged.
- **Interactive Monthly Calendar**:
  - Full month grid with Monday–Sunday alignment.
  - Previous / Next month navigation and quick **Today** jump.
  - Distinct highlights for today, selected date, and days with saved attendance.
- **Weekend & Leave Blocking**:
  - Saturdays and Sundays are automatically configured as weekly leave and blocked from attendance logging.
  - Option to mark any individual date as **Leave** or **Public Holiday** (with reason), blocking the date.
  - One-click **Remove Leave / Unblock Date** option.
- **Smart Shift Calculation**:
  - Live duration computation: `logout - login - break` formatted as `Xh Ym`.
  - Full support for **overnight shifts crossing midnight** (e.g., 22:00 to 06:00).
  - Validation guards against negative break times or breaks exceeding shift duration.
- **One-Click Live Current Time ("Now")**:
  - `⏱️ Now` button to instantly punch in or punch out with the exact current clock time (`HH:MM`).
  - Auto-populates current time when clicking an empty time field.
- **Morning Punch-In & Login Locking**:
  - Ability to save login time immediately upon arrival in the morning without requiring immediate logout.
  - Once saved, login time is **greyed out** and locked (`🔒 Saved`) to prevent accidental overwrites.
  - Locked state **persists across page reloads and browser restarts**.
  - `✏️ Edit` button to unlock and correct login time if needed.
- **Monthly Attendance History**:
  - Detailed table showing Date, Shift, Login, Logout, Break, Total Hours, and Actions.
  - Click any record to load and edit.
- **No External Dependencies**: Vanilla JS, no framework, no backend server or database required.

## Live Deployment (GitHub Pages)

This project can be deployed directly to GitHub Pages:
1. Go to your repository settings on GitHub (`Settings` > `Pages`).
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (or deploy from branch `main` root `/`).
3. Your application will be live at: `https://<your-username>.github.io/tracker/`

## Running Locally

Simply open `index.html` in any web browser, or serve it using Node.js:

```bash
node server.js
```

Then visit [http://localhost:3000](http://localhost:3000) in your browser.
