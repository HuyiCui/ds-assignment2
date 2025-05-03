import { DynamoDBStreamHandler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});
const FROM_EMAIL = process.env.FROM_EMAIL!;

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== 'MODIFY') continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage || !newImage.status || !newImage.id) continue;

    const imageId = newImage.id.S;
    const status = newImage.status.S;
    const reason = newImage.reason?.S || 'No reason given';
    const name = newImage.name?.S || 'Photographer';

    const toAddress = 'email@gmail.com';

    const subject = `Review Result: ${status} - ${imageId}`;
    const bodyText = `Hello ${name},\n\nYour photo "${imageId}" has been reviewed.\n` +
                     `Status: ${status}\nReason: ${reason}\n\nThank you.`;

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [toAddress]
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: bodyText }
        }
      }
    });

    try {
      await ses.send(command);
      console.log(`Email sent to ${toAddress}`);
    } catch (error) {
      console.error(`Failed to send email:`, error);
    }
  }
};
