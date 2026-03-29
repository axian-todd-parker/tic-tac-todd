import path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import {
  AllowedMethods,
  CachedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import {
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  UserData,
  Vpc,
} from 'aws-cdk-lib/aws-ec2'
import { Bucket, BucketEncryption, BlockPublicAccess } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { Asset } from 'aws-cdk-lib/aws-s3-assets'
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export class TicTacToeSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const vpc = new Vpc(this, 'AppVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    })

    const gameTable = new Table(this, 'MultiplayerGamesTable', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const serverSecurityGroup = new SecurityGroup(this, 'ServerSecurityGroup', {
      allowAllOutbound: true,
      vpc,
    })
    serverSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80))

    const serverBundle = new Asset(this, 'ServerBundle', {
      path: path.resolve(__dirname, '..', '..', 'server', 'deploy'),
    })

    const userData = UserData.forLinux()
    userData.addCommands(
      'dnf update -y',
      'dnf install -y unzip',
      'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -',
      'dnf install -y nodejs',
      'mkdir -p /opt/tic-tac-toe-server',
      `aws s3 cp s3://${serverBundle.s3BucketName}/${serverBundle.s3ObjectKey} /tmp/server-bundle.zip`,
      'rm -rf /opt/tic-tac-toe-server/*',
      'unzip -o /tmp/server-bundle.zip -d /opt/tic-tac-toe-server',
      'cd /opt/tic-tac-toe-server',
      'npm ci --omit=dev',
      'cat <<\'EOF\' >/etc/systemd/system/tic-tac-toe-server.service',
      '[Unit]',
      'Description=Tic Tac Toe Multiplayer API Server',
      'After=network.target',
      '',
      '[Service]',
      'Environment=PORT=80',
      `Environment=DYNAMODB_TABLE_NAME=${gameTable.tableName}`,
      'Environment=HOST=0.0.0.0',
      `Environment=AWS_REGION=${this.region}`,
      'WorkingDirectory=/opt/tic-tac-toe-server',
      'ExecStart=/usr/bin/env node /opt/tic-tac-toe-server/dist/server/src/index.js',
      'Restart=always',
      'User=root',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      'systemctl daemon-reload',
      'systemctl enable --now tic-tac-toe-server',
      'systemctl status tic-tac-toe-server --no-pager || true',
      'journalctl -u tic-tac-toe-server -n 120 --no-pager || true',
    )

    const serverInstance = new Instance(this, 'ApiServerHost', {
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2023(),
      securityGroup: serverSecurityGroup,
      userData,
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
    })

    serverInstance.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    )
    serverBundle.grantRead(serverInstance.role)
    gameTable.grantReadWriteData(serverInstance.role)

    const siteBucket = new Bucket(this, 'SiteBucket', {
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const distribution = new Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      additionalBehaviors: {
        'api/*': {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          origin: new HttpOrigin(serverInstance.instancePublicDnsName, {
            protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          }),
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        health: {
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          origin: new HttpOrigin(serverInstance.instancePublicDnsName, {
            protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          }),
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        ws: {
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          origin: new HttpOrigin(serverInstance.instancePublicDnsName, {
            protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          }),
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    })

    new BucketDeployment(this, 'SiteDeployment', {
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      sources: [
        Source.asset(path.resolve(__dirname, '..', '..', 'dist'), {
          exclude: ['*.map'],
        }),
      ],
    })

    new CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
    })

    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    })

    new CfnOutput(this, 'ApiBaseUrl', {
      value: `https://${distribution.distributionDomainName}/api`,
    })

    new CfnOutput(this, 'MultiplayerGamesTableName', {
      value: gameTable.tableName,
    })
  }
}
