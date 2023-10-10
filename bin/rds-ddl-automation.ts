#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RdsDdlAutomationStack } from '../lib/rds-ddl-automation-stack';
import { BaseInfraStack } from '../lib/base-infra-stack';
import { RDSStack } from '../lib/rds-stack';
import { DDLSourceRDSStack } from '../lib/ddl-source-rds-stack';

const app = new cdk.App();

const infra = new BaseInfraStack(app, 'BaseInfraStack', {});

const rdsStack = new RDSStack(app, 'RDSStack', {
  vpc: infra.vpc
});

const ddlSourceStack = new DDLSourceRDSStack(app, 'DDLSourceRDSStack', {
  rdsCluster: rdsStack.rdsCluster
});

const rdsAutomation = new RdsDdlAutomationStack(app, 'RdsDdlAutomationStack', {
  ddlTriggerQueue: infra.rdsDdlTriggerQueue,
  rdsCluster: rdsStack.rdsCluster,
  dbName: rdsStack.rdsDBName,
  ddlSourceS3Bucket: ddlSourceStack.sourceS3Bucket,
  ddlSourceStackName: ddlSourceStack.stackName
});
