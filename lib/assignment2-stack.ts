import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class Assignment2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'ImagesBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
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
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const logImageFn = new lambda.NodejsFunction(this, 'LogImageFunction', {
      entry: 'lambdas/logImage.ts',
      environment: {
        TABLE_NAME: table.tableName
      }
    });

    bucket.grantRead(logImageFn);
    table.grantWriteData(logImageFn);

    const sqsSource = new events.SqsEventSource(queue, {
      batchSize: 1
    });

    logImageFn.addEventSource(sqsSource);

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue));

    new cdk.CfnOutput(this, 'bucketName', {
      value: bucket.bucketName
    });
  }
}
