import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured.')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function createPresignedPutUrl(params: {
  key: string
  contentType: string
  sizeBytes: number
}): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error('R2_BUCKET_NAME is not configured.')

  const client = getR2Client()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.sizeBytes,
  })

  return getSignedUrl(client, command, { expiresIn: 300 })
}
