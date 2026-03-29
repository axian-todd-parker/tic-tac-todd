# Action Log

## 2026-03-29

### Intent

Create a project-level documentation area in the repository root so future work has explicit operating rules, project goals, and a running history of outcomes.

### Result

- Added `docs/README.md` to define the purpose of the documentation folder.
- Added `docs/working-agreement.md` to capture the team's required operating rules.
- Added `docs/project-intent.md` to record the desired end-state and exit criteria.
- Established this `docs/action-log.md` file to track future actions and outcomes.

## 2026-03-29

### Intent

Establish the application baseline, implement the core Tic Tac Toe experience, and ensure the core game flow is covered by automated tests.

### Result

- Scaffolded a Vite React + TypeScript application in the repository root.
- Implemented a dedicated game module with state, move history, turn tracking, win detection, and deterministic CPU behavior.
- Built a landing page and in-game detail page with quit and rematch flows.
- Added UI feedback for legal and illegal moves.
- Added move, win, and loss audio using the Web Audio API.
- Added confetti celebration for player wins.
- Added unit tests with Vitest and end-to-end coverage with Playwright.
- Verified the app with `npm run build`, `npm run lint`, `npm run test:unit`, and `npm run test:e2e`.

## 2026-03-29

### Intent

Add deployment infrastructure so the application has a reproducible AWS deployment path.

### Result

- Added an AWS CDK app in `infra/`.
- Defined a static-site stack using private S3 storage and a CloudFront distribution.
- Added SPA fallback behavior for client-side routing through CloudFront custom error responses.
- Verified the infrastructure definition with `npm --prefix infra run build` and `npm --prefix infra run synth`.

## 2026-03-29

### Intent

Deploy the application into Axian's AWS LnD account and verify the live environment.

### Result

- Deployed the `TicTacToeSiteStack` CloudFormation stack into account `590316689173` in `us-west-2`.
- Published the app to CloudFront at `https://d3e68a1unw9npz.cloudfront.net`.
- Verified the live deployment with Playwright using `PLAYWRIGHT_BASE_URL=https://d3e68a1unw9npz.cloudfront.net npm run test:e2e`.

## 2026-03-29

### Intent

Extend the project to support server-backed multiplayer play, preserve the existing single-player mode, and update the AWS deployment footprint accordingly.

### Result

- Added a Fastify-based multiplayer API server with HTTP endpoints and WebSocket broadcasting.
- Implemented multiplayer game creation, joining, move validation, resign, spectate, and abandonment-check behavior.
- Added DynamoDB-backed multiplayer persistence with enough stored state to replay games and catch up spectators.
- Enforced the 25 concurrent multiplayer game cap with HTTP 429 responses.
- Added server tests covering creation limits, move broadcasting, resignation, and abandonment behavior.
- Updated the React client to create and join multiplayer games, receive live updates, and preserve the original CPU game flow.
- Added deployed and local Playwright coverage for a full multiplayer game alongside the original CPU game test.
- Extended the CDK stack to include DynamoDB, an EC2 API host, and CloudFront routing for `/api`, `/health`, and `/ws`.
- Fixed an API deployment packaging bug by introducing an explicit `server/deploy/` bundle consumed by the CDK asset.
- Verified the completed system with `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:server`, `npm run test:e2e`, `npm --prefix infra run build`, `npm --prefix infra run synth`, and deployed-site Playwright against `https://d3e68a1unw9npz.cloudfront.net`.
