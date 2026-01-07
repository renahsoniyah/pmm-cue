require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
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

async function purgeOldReports({ prefix = 'report', keep = 60 } = {}) {
  try {
    let allObjects = [];
    let ContinuationToken = undefined;

    do {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: process.env.FILEBASE_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken,
      }));

      const contents = resp.Contents || [];
      allObjects.push(
        ...contents
          .filter((o) => o.Key && o.Key.endsWith('.pdf'))
          .map((o) => ({ Key: o.Key, LastModified: o.LastModified }))
      );

      ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (ContinuationToken);

    if (allObjects.length <= keep) {
      return { deleted: 0, total: allObjects.length };
    }

    allObjects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
    const toDelete = allObjects.slice(keep);

    const deleteParams = {
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Delete: { Objects: toDelete.map((o) => ({ Key: o.Key })) },
    };

    const delResp = await s3Client.send(new DeleteObjectsCommand(deleteParams));
    const deletedCount = (delResp.Deleted || []).length;
    console.log(`🧹 Purged ${deletedCount} old report file(s) to free space.`);
    return { deleted: deletedCount, total: allObjects.length };
  } catch (e) {
    console.warn(`⚠️ Failed to purge old reports: ${e.message}`);
    return { deleted: 0, total: 0, error: e.message };
  }
}

async function uploadToFilebase(fileBuffer, fileName) {
  // Ambil MIME type berdasarkan ekstensi file
  const contentType = mime.lookup(fileName) || 'application/octet-stream';

  console.log(`🟢 Uploading: ${fileName} as ${contentType}`);

  try {
    // Upload langsung dari buffer ke Filebase
  await s3Client.send(new PutObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
    }));

    console.log(`✅ File diunggah: ${fileName}`);

    // Ambil signed URL setelah upload berhasil
    const signedUrl = await signedUrlTools(fileName);
    return signedUrl;
  } catch (error) {
    const msg = (error && error.message ? error.message : '').toLowerCase();
    const isQuota = msg.includes('quota') || msg.includes('exceeded') || msg.includes('storage limit');

    if (isQuota) {
      console.warn('🚨 Storage quota reached. Attempting purge of old reports...');
      await purgeOldReports({ prefix: 'report', keep: 60 });

      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: fileName,
          Body: fileBuffer,
          ContentType: contentType,
        }));
        console.log(`✅ File diunggah setelah purge: ${fileName}`);
        const signedUrl = await signedUrlTools(fileName);
        return signedUrl;
      } catch (retryErr) {
        console.error(`❌ Upload retry failed after purge: ${retryErr.message}`);
        throw retryErr;
      }
    }

    console.error(`❌ Gagal mengunggah ke Filebase: ${error.message}`);
    throw error;
  }
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
