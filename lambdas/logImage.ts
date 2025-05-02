import { SQSHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: SQSHandler = async (event) => {
  console.log('Received SQS Event:', JSON.stringify(event));

  for (const record of event.Records) {
    if (!record.body) {
      console.warn('Empty record body!');
      continue;
    }

    try {
      const body = JSON.parse(record.body);

      const snsMessage = body?.Message ? JSON.parse(body.Message) : body;

      const s3Record = snsMessage.Records?.[0]?.s3;
      if (!s3Record) {
        console.warn('No S3 record found in message:', JSON.stringify(snsMessage));
        continue;
      }

      const bucket = s3Record.bucket.name;
      const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, " "));
      const fileType = key.split('.').pop()?.toLowerCase();

      if (fileType !== 'jpeg' && fileType !== 'jpg' && fileType !== 'png') {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      const command = new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          id: { S: key }
        }
      });

      await dynamo.send(command);
      console.log(`Image saved to DynamoDB: ${key}`);
    } catch (err: any) {
      console.error('Error processing record:', err);
      throw err; 
    }
  }
};
