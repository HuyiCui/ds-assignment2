import { SNSHandler } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: SNSHandler = async (event) => {
  console.log('Received SNS status update event:', JSON.stringify(event));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const { id, date, update } = message;

    if (!['Pass', 'Reject'].includes(update?.status)) {
      console.warn('Invalid status:', update?.status);
      continue;
    }

    const command = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: id } },
      UpdateExpression: 'SET #status = :status, #reason = :reason, #date = :date',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#reason': 'reason',
        '#date': 'reviewDate'
      },
      ExpressionAttributeValues: {
        ':status': { S: update.status },
        ':reason': { S: update.reason },
        ':date': { S: date }
      }
    });

    await client.send(command);
    console.log(`Updated status for ${id}: ${update.status}`);
  }
};
