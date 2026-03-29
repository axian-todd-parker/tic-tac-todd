#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { TicTacToeSiteStack } from '../lib/tic-tac-toe-site-stack'

const app = new cdk.App()

const account =
  process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? process.env.AWS_ACCOUNT
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-west-2'

new TicTacToeSiteStack(app, 'TicTacToeSiteStack', {
  env: account ? { account, region } : { region },
})
