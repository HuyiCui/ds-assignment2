import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';

export class Assignment2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'ImagesBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const dlq = new sqs.Queue(this, 'DLQ');

    const queue = new sqs.Queue(this, 'ImageQueue', {
      deadLetterQueue: {
        maxReceiveCount: 1,
        queue: dlq
      }
    });

    const table = new dynamodb.Table(this, 'ImagesTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const topic = new sns.Topic(this, 'ImageTopic');

    const logImageFn = new lambda.NodejsFunction(this, 'LogImageFunction', {
      entry: 'lambdas/logImage.ts',
      environment: {
        TABLE_NAME: table.tableName
      }
    });
    bucket.grantRead(logImageFn);
    table.grantWriteData(logImageFn);
    logImageFn.addEventSource(new events.SqsEventSource(queue, { batchSize: 1 }));
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue));

    const removeImageFn = new lambda.NodejsFunction(this, 'RemoveImageFunction', {
      entry: 'lambdas/removeImage.ts',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5)
    });
    bucket.grantDelete(removeImageFn);
    removeImageFn.addEventSource(new events.SqsEventSource(dlq, { batchSize: 1 }));

    const addMetadataFn = new lambda.NodejsFunction(this, 'AddMetadataFunction', {
      entry: 'lambdas/addMetadata.ts',
      environment: {
        TABLE_NAME: table.tableName
      }
    });
    table.grantWriteData(addMetadataFn);
    topic.addSubscription(new subscriptions.LambdaSubscription(addMetadataFn, {
      filterPolicy: {
        metadata_type: sns.SubscriptionFilter.stringFilter({
          allowlist: ['Caption', 'Date', 'Name']
        })
      }
    }));

    const updateStatusFn = new lambda.NodejsFunction(this, 'UpdateStatusFunction', {
      entry: 'lambdas/updateStatus.ts',
      environment: {
        TABLE_NAME: table.tableName
      }
    });
    table.grantWriteData(updateStatusFn);
    topic.addSubscription(new subscriptions.LambdaSubscription(updateStatusFn));

    const mailerFn = new lambda.NodejsFunction(this, 'StatusMailerFunction', {
      entry: 'lambdas/mailer.ts',
      environment: {
        FROM_EMAIL: 'email@gmail.com'
      }
    });
    mailerFn.addEventSource(new events.DynamoEventSource(table, {
      startingPosition: StartingPosition.LATEST
    }));
    mailerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*']
    }));

    new cdk.CfnOutput(this, 'bucketName', {
      value: bucket.bucketName
    });

    new cdk.CfnOutput(this, 'topicArn', {
      value: topic.topicArn
    });
  }
}
