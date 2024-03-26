import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import path = require("path");
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail"

export class BaseInfraStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly rdsDdlTriggerQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create VPC to deploy the infrastructure in
    const vpc = new ec2.Vpc(this, "infraNetwork", {
        ipAddresses: ec2.IpAddresses.cidr('10.80.0.0/20'),
        availabilityZones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'],
        subnetConfiguration: [
            {
              name: "public",
              subnetType: ec2.SubnetType.PUBLIC,
            },
            {
              name: "private",
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            }
        ],
      });
      this.vpc = vpc;

    // Trail for logging AWS API events
    const trail = new cloudtrail.Trail(this, 'myCloudTrail', {
      managementEvents: cloudtrail.ReadWriteType.ALL
    });
    
    // Queue for triggering initialization (DDL deployment) of RDS 
    const rdsDdlDetectionQueue = new sqs.Queue(this, 'rdsDdlDetectionQueue', {
        queueName: "RDS_DDL_Detection_Queue",
        visibilityTimeout: cdk.Duration.minutes(30)
    });
    this.rdsDdlTriggerQueue = rdsDdlDetectionQueue;

    // Function that gets triggered on the creation of an RDS cluster
    const rdsDdlTriggerFn = new lambda.Function(this, "rdsDdlTriggerFn", {
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/rds-ddl-trigger")),
        runtime: lambda.Runtime.PYTHON_3_9,
        timeout: cdk.Duration.minutes(15),
        handler: "app.lambda_handler",
        environment:{
          "RDS_DDL_QUEUE_URL": rdsDdlDetectionQueue.queueUrl,
      },
    });
    // give permission to the function to be able to send messages to the queues
    rdsDdlDetectionQueue.grantSendMessages(rdsDdlTriggerFn);

    // Trigger an event when there is a RDS CreateDB API call recorded in CloudTrail
    const eventBridgeCreateDBRule = new events.Rule(this, 'eventBridgeCreateDBRule', {
        eventPattern: {
            source: ["aws.rds"],
            detail: {
            eventSource: ["rds.amazonaws.com"],
            eventName: ["CreateDBCluster"]
            }
        },
    });
    eventBridgeCreateDBRule.node.addDependency(trail);
    // Invoke the rdsDdlTriggerFn upon a matching event
    eventBridgeCreateDBRule.addTarget(new targets.LambdaFunction(rdsDdlTriggerFn));

  }
}
