import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import path = require("path");


export interface RDSStackProps extends cdk.StackProps {
    // This parameters are set from <project-repo>/bin/rds-ddl-automation.ts
    vpc: ec2.Vpc;
  }

export class RDSStack extends cdk.Stack {
  readonly rdsCluster: rds.ServerlessCluster;
  readonly rdsDBName: string;

  constructor(scope: Construct, id: string, props: RDSStackProps) {
    super(scope, id, props);
    
    // passed in as property
    const vpc = props.vpc;

    // extract the ID from the default security group object
    const vpcDefaultSecGroupId = ec2.SecurityGroup.fromSecurityGroupId(this, 'defaultSG', vpc.vpcDefaultSecurityGroup);

    // create RDS bits (security group and serverless instance)
    const dbName = "postgres";
    const rdsSecGroupName = "rds-security-group";
    const rdsEngine = rds.DatabaseClusterEngine.auroraPostgres(      
      {
        version: rds.AuroraPostgresEngineVersion.VER_13_9
      }
    );
    const rdsSecurityGroup = new ec2.SecurityGroup(this, rdsSecGroupName, {
      securityGroupName: rdsSecGroupName,
      vpc: vpc,
      allowAllOutbound: true,
    });
    rdsSecurityGroup.connections.allowFrom(vpcDefaultSecGroupId, ec2.Port.tcp(5432));

    const rdsSource = new rds.ServerlessCluster(this, 'rdsSource', {
      engine: rdsEngine,
      vpc: vpc,
      defaultDatabaseName: dbName,
      enableDataApi: true,
      securityGroups: [rdsSecurityGroup]
    });
    this.rdsCluster = rdsSource;
    this.rdsDBName = dbName;
  }
}
