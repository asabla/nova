import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const bucket = process.env.S3_BUCKET ?? "nova-files";

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("  Bucket already exists:", bucket);
} catch {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log("  Created bucket:", bucket);
}
