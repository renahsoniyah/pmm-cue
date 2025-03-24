require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mime = require('mime-types');

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.com',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
});

async function uploadToFilebase(filePath, fileName) {
  const fileContent = require('fs').readFileSync(filePath);

  // Ambil MIME type berdasarkan ekstensi file
  const contentType = mime.lookup(filePath) || 'application/octet-stream';

  console.log(`🟢 Uploading: ${fileName} as ${contentType}`);
  
  // Upload file ke Filebase
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: contentType,
  }));
  
  console.log(`✅ File diunggah: ${fileName}`);

  let signedUrl = await signedUrlTools(fileName);

  return signedUrl;
}

async function signedUrlTools(fileName) {
  // Generate pre-signed URL (berlaku selama 7 hari)
  const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
  }), { expiresIn: 604800 }); // 7 hari

  console.log(`🔗 URL Akses: ${signedUrl}`);
  return signedUrl
}

module.exports = { uploadToFilebase, signedUrlTools };
