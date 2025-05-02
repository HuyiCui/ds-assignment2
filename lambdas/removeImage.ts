import { SQSHandler } from 'aws-lambda';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export const handler: SQSHandler = async (event) => {
  console.log('DLQ Event:', JSON.stringify(event));

  for (const record of event.Records) {
    try {
      if (!record.body) {
        console.warn('Empty DLQ message body.');
        continue;
      }

      const body = JSON.parse(record.body);
      const snsMessage = body?.Message ? JSON.parse(body.Message) : body;
      const s3Record = snsMessage.Records?.[0]?.s3;

      if (!s3Record) {
        console.warn('No S3 record found in DLQ message.');
        continue;
      }

      const bucket = s3Record.bucket.name;
      const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, " "));

      console.log(`Deleting invalid image from S3: ${bucket}/${key}`);

      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      });

      await s3.send(deleteCommand);
      console.log(`Deleted ${key} from ${bucket}`);
    } catch (err) {
      console.error('Failed to process DLQ message:', err);
    }
  }
};
