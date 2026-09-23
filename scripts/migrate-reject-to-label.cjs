// Dry run: node scripts/migrate-reject-to-label.cjs
// Apply:   node scripts/migrate-reject-to-label.cjs --apply
require('@next/env').loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const { MongoClient } = require('mongodb')
const { isDeepStrictEqual } = require('node:util')

const migration = 'reject-to-label-v1'
const apply = process.argv.includes('--apply')
const legacyStatuses = ['REJECT', 'CMD_REJECT', 'ยกเลิก']

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    directConnection: true, serverSelectionTimeoutMS: 10000,
  })
  try {
    await client.connect()
    const db = client.db('sistomat')
    const results = []
    for (const collection of ['projects', 'jobs']) {
      const docs = await db.collection(collection).find({ status: { $in: legacyStatuses } }).toArray()
      for (const doc of docs) {
        const code = doc.project_id || doc.job_code
        if (!apply) {
          results.push({ collection, code, status: doc.status, action: 'set Reject label; preserve all processes' })
          continue
        }
        // Keep a database snapshot before changing any record, including its process data.
        await db.collection('migration_backups').updateOne(
          { _id: `${migration}:${collection}:${doc._id}` },
          { $setOnInsert: { migration, collection, original: doc, backed_up_at: new Date() } },
          { upsert: true },
        )
        const result = await db.collection(collection).updateOne(
          { _id: doc._id, status: doc.status, updated_at: doc.updated_at ?? { $exists: false } },
          { $set: {
            status: 'กำลังดำเนินการ',
            'flags.has_reject': true,
            'flags.awaiting_finish_decision': false,
            updated_at: new Date(),
          } },
        )
        if (result.matchedCount !== 1) throw new Error(`Concurrent update: ${collection}/${code}`)
        const after = await db.collection(collection).findOne({ _id: doc._id })
        if (after.status !== 'กำลังดำเนินการ' || !after.flags?.has_reject || !isDeepStrictEqual(after.processes, doc.processes)) {
          throw new Error(`Verification failed: ${collection}/${code}`)
        }
        results.push({ collection, code, migrated: true, processesPreserved: true })
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', migration, results }, null, 2))
  } finally { await client.close() }
}

main().catch(error => { console.error(error.name); process.exitCode = 1 })
