# Employee Leaderboard

Modern, mobile-first leaderboard web app for internship employee rankings. Data is stored in local JSON files and updated via CSV uploads.

## Features
- Separate leaderboards for Tenured RM, New RM, and BSM
- Hidden hash-based URLs for each role
- CSV upload admin panel with success toast
- Last updated timestamp and empty state
- Premium dark UI with glassmorphism and sticky header

## Tech Stack
- Node.js
- Express.js
- HTML, CSS, Vanilla JavaScript
- Multer for CSV uploads

## Project Routes
- /tenured-rm/a8x92kd7q1
- /new-rm/kd82js9a0x
- /bsm/91ksla8x2q
- /admin-edit

## Local Setup
```bash
npm install
npm start
```
Open http://localhost:3000

## Notes
- Place your logo at public/logo.png
- JSON files are stored in the data/ folder
