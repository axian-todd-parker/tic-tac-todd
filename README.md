# ai-tic-tac-toe-lab

## Project Ground Rules

Project operating rules, intent, and the running action log live in [`docs/`](./docs/README.md).

Before making changes:

1. Review [`docs/working-agreement.md`](./docs/working-agreement.md).
2. Confirm the current target state in [`docs/project-intent.md`](./docs/project-intent.md).
3. Plan the work before executing it.
4. Update documentation as changes land.

## Current Status

The repository now contains a Tic Tac Toe React application in TypeScript with:

- a dedicated local game domain module for deterministic CPU play
- a multiplayer HTTP + WebSocket API server
- move history and replayable multiplayer state
- landing, local game, and live multiplayer views
- an active-game spectator lobby with real-time viewing
- win/loss/move sound effects
- confetti on player wins
- command-line unit, server, and Playwright test coverage
- PR validation through GitHub Actions with test coverage and build packaging
- GitHub Actions validation on PRs and `main` pushes with test coverage and build packaging

The application is currently deployed at `https://d3e68a1unw9npz.cloudfront.net`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the client only:

```bash
npm run dev
```

Start the multiplayer API only:

```bash
npm run dev:server
```

Start client and API together:

```bash
npm run dev:multiplayer
```

Create a production build:

```bash
npm run build
```

## Test Commands

Run linting:

```bash
npm run lint
```

Run unit tests:

```bash
npm run test:unit
```

Run multiplayer server tests:

```bash
npm run test:server
```

Generate coverage reports for the client and server test suites:

```bash
npm run coverage
```

Install the Playwright browser dependency:

```bash
npm run test:e2e:install
```

Run the end-to-end browser test:

```bash
npm run test:e2e
```

## AWS Deployment

Deployment documentation lives in [`docs/deployment.md`](./docs/deployment.md).

The current IaC path uses AWS CDK in TypeScript under [`infra/`](./infra), targeting:

- private S3 origin storage
- CloudFront distribution
- DynamoDB for multiplayer game storage
- a low-cost EC2 API host behind CloudFront
- SPA fallback routing back to `index.html`

Current deployed URL:

- `https://d3e68a1unw9npz.cloudfront.net`
- API health: `https://d3e68a1unw9npz.cloudfront.net/health`

## Implemented Game Flow

- The landing page starts a new game against the CPU.
- The landing page can also create, join, or spectate multiplayer games.
- The game detail page shows turn state, winner state, move history, and legal move feedback.
- Illegal moves are blocked in the UI.
- A completed game allows rematch or quit.
- The deterministic CPU always takes the first available cell.
- Multiplayer games are validated by the server before moves are accepted.
- Multiplayer updates are delivered live over WebSockets to players and spectators.
- Active multiplayer games can be listed and opened in spectator mode.
- Multiplayer games can be resigned.
- Abandoned multiplayer games can be ended after 3 minutes via server-side abandonment checks.

## Dev Container Setup Instructions

### Pre-Requisites

This lab takes place inside a Docker-based Dev Container, so the host machine only needs the core local tooling.

- Docker Desktop
- VS Code with the Dev Containers extension
- Local install of OpenAI Codex CLI
- Axian GitHub account access
- Axian AWS L&D access key

Example local Codex install:

```bash
brew install codex
```

or:

```bash
npm install -g @openai/codex
```

### Prep

- Generate or obtain your Axian AWS L&D access key.
- Run `codex` locally and complete the sign-in flow.

### Clone and Create Personal Branch

```bash
git clone https://github.com/Axian-Inc/ai-tic-tac-toe-lab.git
git checkout 00-devcontainer-starter
git checkout -b <firstname-last initial>-<branch-name>
```

### Open in Dev Container

- Open the repository in VS Code.
- Reopen in Dev Container when prompted.
- Wait for the build to complete.
- The build runs `copy-codex-auth.sh` to copy local Codex auth into the container.

### Verify Codex Auth Copied

- Open a terminal in the Dev Container.
- Run `codex` and verify you are already logged in.
- Run `/status` if needed to confirm account information.

### AWS Setup

Run:

```bash
aws configure
```

Use:

- region: `us-west-2`
- output: `json` or blank

Verify with:

```bash
aws s3 ls
```

### GitHub Setup

Verify repository access:

```bash
git ls-remote origin
```

Set Git identity:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```
