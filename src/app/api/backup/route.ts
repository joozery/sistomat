import { NextRequest, NextResponse } from 'next/server'
import { EJSON } from 'bson'
import { getClientPromise } from '@/lib/mongodb'
import { gzipSync } from 'node:zlib'
import { verifyIT } from '@/lib/it-auth'

export const dynamic = 'force-dynamic'

type BackupFile = { url: string; contentType: string; data: string }

function collectFileUrls(value: unknown, urls: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectFileUrls(item, urls)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && key.endsWith('_url') && /^https?:\/\//i.test(child)) urls.add(child)
    else collectFileUrls(child, urls)
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyIT(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const client = await getClientPromise()
    const db = client.db('sistomat')
    const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray()
    const collections: { name: string; data: string }[] = []
    const urls = new Set<string>()

    for (const info of collectionInfos) {
      const docs = await db.collection(info.name).find({}).toArray()
      collections.push({ name: info.name, data: EJSON.stringify(docs, { relaxed: false }) })
      collectFileUrls(docs, urls)
    }

    const files: BackupFile[] = []
    for (const url of urls) {
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        files.push({ url, contentType: response.headers.get('content-type') || 'application/octet-stream', data: buffer.toString('base64') })
      } catch {
        // Keep the database URL in the backup; a missing remote file is reported by the manifest.
      }
    }

    const backup = {
      format: 'sistomat-full-backup',
      version: 1,
      created_at: new Date().toISOString(),
      database: 'sistomat',
      collections,
      files,
      missing_file_urls: [...urls].filter((url) => !files.some((file) => file.url === url)),
    }
    const compressed = gzipSync(Buffer.from(JSON.stringify(backup)))
    return new NextResponse(new Uint8Array(compressed), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="sistomat-full-backup-${new Date().toISOString().slice(0, 10)}.json.gz"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[backup]', error)
    return NextResponse.json({ error: 'สร้าง Backup ไม่สำเร็จ' }, { status: 500 })
  }
}
