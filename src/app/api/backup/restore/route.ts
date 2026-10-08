import { NextRequest, NextResponse } from 'next/server'
import { EJSON } from 'bson'
import { getClientPromise } from '@/lib/mongodb'
import { gunzipSync } from 'node:zlib'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { verifyIT } from '@/lib/it-auth'

export const dynamic = 'force-dynamic'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

type Backup = {
  format?: string
  version?: number
  collections?: { name: string; data: string }[]
  files?: { url: string; contentType: string; data: string }[]
}

export async function POST(req: NextRequest) {
  const auth = verifyIT(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const raw = Buffer.from(await req.arrayBuffer())
    const json = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString('utf8') : raw.toString('utf8')
    const backup = JSON.parse(json) as Backup
    if (backup.format !== 'sistomat-full-backup' || backup.version !== 1 || !Array.isArray(backup.collections)) {
      return NextResponse.json({ error: 'ไฟล์ Backup ไม่ถูกต้องหรือไม่ใช่ของระบบนี้' }, { status: 400 })
    }

    const client = await getClientPromise()
    const db = client.db('sistomat')
    let restoredFiles = 0
    let failedFiles = 0
    const publicPrefix = `${process.env.R2_PUBLIC_URL ?? ''}/`

    for (const file of backup.files ?? []) {
      if (!file.url.startsWith(publicPrefix) || !file.data) {
        failedFiles++
        continue
      }
      const key = file.url.slice(publicPrefix.length)
      try {
        const buffer = Buffer.from(file.data, 'base64')
        await r2.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          Body: buffer,
          ContentType: file.contentType || 'application/octet-stream',
          ContentLength: buffer.length,
        }))
        restoredFiles++
      } catch {
        failedFiles++
      }
    }

    let restoredCollections = 0
    let restoredDocuments = 0
    for (const item of backup.collections) {
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(item.name) || typeof item.data !== 'string') continue
      const docs = EJSON.parse(item.data, { relaxed: false })
      if (!Array.isArray(docs)) continue
      const collection = db.collection(item.name)
      await collection.deleteMany({})
      if (docs.length > 0) await collection.insertMany(docs)
      restoredCollections++
      restoredDocuments += docs.length
    }

    return NextResponse.json({ restoredCollections, restoredDocuments, restoredFiles, failedFiles })
  } catch (error) {
    console.error('[backup/restore]', error)
    return NextResponse.json({ error: 'Restore Backup ไม่สำเร็จ' }, { status: 400 })
  }
}
