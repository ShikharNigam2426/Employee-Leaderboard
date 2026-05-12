# Employee Leaderboard

A clean, modern employee leaderboard with a podium-style top 3, CRUD actions, and a dark glassmorphism UI. Data is stored in a local JSON file through a simple Node server.

## Features
- Podium for top 3 (Champion, 1st Runner-up, 2nd Runner-up)
- Leaderboard table starts from rank 4
- Add, edit, delete employees
- Search by name
- Responsive dark UI with hover effects and rounded cards

## Tech Stack
- HTML, CSS, Vanilla JavaScript
- Node.js (built-in http + fs)

## Run Locally
```bash
cd "C:\Users\Acer\Desktop\POS Image"
node server.js
```
Open http://localhost:3000

## Notes
On free hosting, JSON file storage can be ephemeral. For persistent data, use a database or a persistent disk.
