# Project Intent

## Objective

Build a Tic Tac Toe system with both local single-player and server-backed multiplayer play, including tested game logic, deterministic CPU behavior, multiplayer state brokering over HTTP and WebSockets, deployment infrastructure, and clear project documentation.

## Requested Product Shape

- Landing page that greets the user and starts a game against the CPU.
- In-game detail view that reflects current state, turn, and game-over results.
- Game module responsible for state, move history, turn tracking, and win detection.
- Unit tests covering the core game behaviors.
- UI rules that prevent illegal moves and visually distinguish valid and invalid interactions.
- Audio feedback for move placement, wins, and losses.
- Confetti for winning outcomes.
- Quit and rematch flows for CPU games.
- Deterministic CPU move selection.
- Infrastructure as code and deployment path for Axian's AWS LnD account.
- Playwright coverage for a full game flow including winning conditions.
- Command-line runnable test workflows suitable for CI automation.
- Multiplayer HTTP API that validates commands, stores state, and broadcasts updates.
- Spectator support for live multiplayer games.
- Persistence of multiplayer game state and move history so games can be replayed or caught up.
- Multiplayer abandonment and resign flows.
- Concurrent multiplayer game cap at 25 games with HTTP 429 handling.

## Exit Criteria

- The game is deployed to Axian's AWS LnD account.
- Unit tests and Playwright tests run from the command line.
- Multiplayer server behavior is covered by automated tests.
- The repository remains well documented, including `README.md`.

## Current Status

- Repository-level working rules have been established in `docs/working-agreement.md`.
- The React + TypeScript client supports both local CPU games and live multiplayer games.
- The local game domain module tracks board state, move history, current turn, winner, and winning line.
- A deterministic CPU opponent is implemented and preserved.
- The multiplayer server accepts game creation, joining, move, resign, spectate, and abandonment-check commands.
- Multiplayer game state and move history are stored in DynamoDB and exposed through HTTP plus WebSocket updates.
- Spectators can watch multiplayer games live.
- The server enforces the 25 concurrent multiplayer game limit.
- Win, loss, and move sounds are implemented with the Web Audio API.
- Confetti feedback is implemented for player wins.
- Unit, server, and Playwright coverage are in place and runnable from the command line.
- AWS CDK deployment infrastructure is in place for S3, CloudFront, DynamoDB, and the multiplayer API host.
- The application is deployed in Axian's AWS LnD account at `https://d3e68a1unw9npz.cloudfront.net`.
