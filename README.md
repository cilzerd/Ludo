# Online Ludo — worldwide multiplayer MVP

This project converts the supplied `LUDO.HTML` board concept into a single Node.js web service with a browser client and Socket.IO multiplayer.

## Included
- Guest display names; no player account is required.
- Private rooms with six-character invite codes and shareable invite links.
- Public matchmaking (the public game starts at four players).
- 2–4 seats in private rooms; host can start with 2, 3, or 4 players.
- Two tokens per player, server-generated dice, server-side move validation, captures, safe squares, extra turns for six/capture, and win detection.
- `/health` endpoint for deployment checks.

## Windows local test
1. Install Node.js LTS (version 20 or newer) from https://nodejs.org/en/download/.
2. Extract the ZIP file.
3. Open the extracted `online-ludo-worldwide` folder.
4. Click the File Explorer address bar, type `cmd`, and press Enter.
5. In the Command Prompt window, run `npm install` and wait for it to finish.
6. Run `npm start`.
7. Open `http://localhost:3000` in Chrome or Edge. Open a second browser or an incognito window to test another player.

## Deploy on Render
1. Upload the **contents** of this folder to a GitHub repository (the `package.json` and `server.js` must be at the repository root).
2. In Render, create a **Web Service** and connect that GitHub repository.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Deploy. Render supplies the `PORT` environment variable automatically.

Do not deploy this as a GitHub Pages site or as a Render Static Site. Socket.IO needs a running Node web service.

## Rules and current limitations
- The original supplied game allowed a token to move directly from its base without requiring a six. This version preserves that convention: a token leaving base lands on the start square and uses the remaining roll distance.
- A player needs an exact roll to finish. A six or a capture grants another roll. Captures are blocked on the eight safe-star squares.
- The server keeps rooms in memory. Restarting/redeploying the service clears active games. A persistent database/Redis layer is not included.
- Public matchmaking starts at four players; an underfilled public room waits. There is no bot fill or automatic timeout yet.
- A player who disconnects during a game keeps their seat, but reconnect-to-seat is not implemented yet. Refreshing/leaving the page during a match can therefore strand that seat until the service restarts.
- This is an MVP, not a hardened high-traffic production service. Add persistent storage, reconnect support, abuse/rate limiting, automated tests, and load testing before advertising it as a large-scale public game.
