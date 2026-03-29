# Deployment

## Approach

The application is deployed as a low-cost web stack using:

- Amazon S3 for asset storage
- Amazon CloudFront for delivery
- Amazon DynamoDB for multiplayer game persistence
- Amazon EC2 for the multiplayer API host
- CloudFront custom error responses to route SPA requests back to `index.html`
- AWS CDK in TypeScript under `infra/`

## Commands

Build the app:

```bash
npm run build
```

Install server dependencies:

```bash
npm --prefix server install
```

Install infra dependencies:

```bash
npm --prefix infra install
```

Synthesize the stack:

```bash
npm --prefix infra run synth
```

Bootstrap the target AWS environment:

```bash
AWS_REGION=us-west-2 npm --prefix infra run bootstrap aws://<account-id>/us-west-2
```

Deploy the stack:

```bash
AWS_REGION=us-west-2 npm --prefix infra run deploy
```

## GitHub Actions Validation

The repository automation validates changes in GitHub Actions without deploying infrastructure.

- Trigger: pull requests, pushes to `main`, and manual `workflow_dispatch`
- Workflow: `.github/workflows/ci.yml`
- Checks: dependency install, coverage, and application build

Verify the API health endpoint:

```bash
curl https://d3e68a1unw9npz.cloudfront.net/health
```

## Notes

- The CDK stack expects the client build output in the repository root `dist/` directory.
- The multiplayer server deploy uses `server/deploy/`, which is produced by `npm run build`.
- The stack uses private S3 storage with CloudFront origin access control for static assets.
- CloudFront routes `/api/*`, `/health`, and `/ws` to the multiplayer API host.
- Multiplayer game state is stored in DynamoDB.
- SPA routing is handled with CloudFront responses that map `403` and `404` requests to `/index.html`.
- The stack outputs the S3 bucket name, CloudFront distribution domain name, and DynamoDB table name after deployment.

## Current Deployment

- AWS account: `590316689173`
- Region: `us-west-2`
- CloudFront URL: `https://d3e68a1unw9npz.cloudfront.net`
- API base URL: `https://d3e68a1unw9npz.cloudfront.net/api`
- Health URL: `https://d3e68a1unw9npz.cloudfront.net/health`
- S3 bucket: `tictactoesitestack-sitebucket397a1860-km3fwmv42ump`
- DynamoDB table: `TicTacToeSiteStack-MultiplayerGamesTableFAFF4FCA-1KAVY2GB6G5VW`

## Live Verification

Run the Playwright flow against the deployed site:

```bash
PLAYWRIGHT_BASE_URL=https://d3e68a1unw9npz.cloudfront.net npm run test:e2e
```
