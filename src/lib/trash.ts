import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Db } from 'mongodb'

export const TRASH_RETENTION_DAYS = 7

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
})

type AnyDoc = Record<string, unknown>

function fileUrls(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(fileUrls)
  const record = value as AnyDoc
  const own = typeof record.file_url === 'string' ? [record.file_url] : []
  return own.concat(Object.values(record).flatMap(fileUrls))
}

export function filesFromSnapshots(snapshots: AnyDoc[]) {
  const seen = new Set<string>()
  const files: { file_url: string; file_name: string }[] = []
  for (const snapshot of snapshots) {
    for (const url of fileUrls(snapshot)) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      const name = url.split('/').pop()?.split('?')[0] ?? url
      files.push({ file_url: url, file_name: decodeURIComponent(name) })
    }
  }
  return files
}

function keyFromPublicUrl(url: string): string | null {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  if (!base || !url.startsWith(`${base}/`)) return null
  return decodeURIComponent(url.slice(base.length + 1))
}

export async function deleteTrashFiles(files: { file_url: string }[]) {
  const keys = [...new Set(files.map((file) => keyFromPublicUrl(file.file_url)).filter((key): key is string => Boolean(key)))]
  await Promise.all(keys.map((Key) => r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key }))))
}

export async function purgeExpiredTrash(db: Db) {
  const expired = await db.collection('deleted_projects').find({ purge_at: { $lte: new Date() } }).toArray()
  if (expired.length === 0) return 0
  await Promise.all(expired.map((item) => deleteTrashFiles((item.files ?? []) as { file_url: string }[]).catch(() => undefined)))
  const result = await db.collection('deleted_projects').deleteMany({ _id: { $in: expired.map((item) => item._id) } })
  return result.deletedCount
}
