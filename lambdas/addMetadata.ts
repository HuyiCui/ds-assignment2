import { SNSHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: SNSHandler = async (event) => {
  console.log('Received SNS metadata event:', JSON.stringify(event));

  for (const record of event.Records) {
    const messageAttributes = record.Sns.MessageAttributes;
    const metadataType = messageAttributes?.metadata_type?.Value;

    if (!['Caption', 'Date', 'Name'].includes(metadataType)) {
      console.warn('Unsupported metadata type:', metadataType);
      continue;
    }

    const message = JSON.parse(record.Sns.Message);
    const { id, value } = message;

    const command = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
      UpdateExpression: `SET #attr = :val`,
      ExpressionAttributeNames: {
        '#attr': metadataType
      },
      ExpressionAttributeValues: {
        ':val': { S: value }
      }
    });

    await client.send(command);
    console.log(`Updated ${id} with ${metadataType}: ${value}`);
  }
};
