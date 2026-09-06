/**
 * Seed workers from hardcoded WORKERS_LIST into MongoDB users collection.
 * Workers without username get username = their code (e.g. "335").
 * Default password = their code string (e.g. "335") — change after seeding.
 *
 * Run: node scripts/seed-workers.js
 */

const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')

const WORKERS_LIST = [
  { code: 0,   name: 'Admin',                         machines: ['ADMIN', 'MAT', 'QC', 'CAM', 'CNC', 'ML', 'LATHE', 'SPAR'], username: 'admin' },
  { code: 335, name: 'นายธณรัฐ การญจนเวทย์',         machines: ['SPAR', 'LATHE 2', 'ML'] },
  { code: 361, name: 'นายอาชวัตร ยิ้มโภชน์',         machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 367, name: 'นายธีระยุทธ บ้านเปี่ยมขวัญ',   machines: ['CNC 1', 'CNC 2'] },
  { code: 395, name: 'น.ส.จิรัชพร ปานอร่ามวงศ์',     machines: ['ADMIN 1', 'MAT'],          username: 'jirachporn' },
  { code: 407, name: 'นายณัฐพงศ์ เปล่งพานิช',        machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 413, name: 'นายอาทิตย์ หุ่นสมบูรณ์',       machines: ['ADMIN 2', 'MAT', 'QC'],    username: 'arthit' },
  { code: 417, name: 'นายกิตติคุณ สุขเกษม',          machines: ['LATHE 1', 'LATHE 2', 'ML'] },
  { code: 419, name: 'นายจารุเดช ปัทมราช',           machines: ['CNC 4'] },
  { code: 421, name: 'นายพีระพัฒน์ ทับสาร',          machines: ['CNC 3', 'CNC 4'] },
  { code: 451, name: 'น.ส.ณปภัช มโนรส',              machines: ['QC', 'ADMIN 3'],           username: 'napapat' },
  { code: 452, name: 'นายจิรพงษ์ พงศ์ภานิช',         machines: ['CAM 2', 'CNC 3', 'CNC 5'] },
  { code: 453, name: 'นายพัฒนชัย ชูใจ',              machines: ['CAM 1', 'CNC 1', 'CNC 2'] },
]

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('❌ ไม่พบ MONGODB_URI — รัน: MONGODB_URI=... node scripts/seed-workers.js')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db('sistomat')
  const col = db.collection('users')

  let created = 0
  let skipped = 0

  for (const w of WORKERS_LIST) {
    const username = w.username || String(w.code)
    const existing = await col.findOne({ $or: [{ username }, { code: w.code }] })

    if (existing) {
      // อัปเดต fields ที่ขาดไป (name, code, machines) โดยไม่แตะ password
      const $set = {}
      if (!existing.name     && w.name)     $set.name = w.name
      if (!existing.code     && w.code)     $set.code = w.code
      if (!existing.machines && w.machines) $set.machines = w.machines

      if (Object.keys($set).length > 0) {
        await col.updateOne({ _id: existing._id }, { $set })
        console.log(`  ↻ อัปเดต: @${existing.username} (${w.name})`)
      } else {
        console.log(`  ✓ มีอยู่แล้ว: @${existing.username} (${w.name})`)
      }
      skipped++
      continue
    }

    // กำหนด role ตาม machines
    let role = 'User'
    if (w.machines.some((m) => m.includes('ADMIN'))) role = 'Admin'
    else if (w.machines.some((m) => m.includes('QC'))) role = 'QC'
    else if (w.machines.some((m) => m.includes('MAT'))) role = 'MAT'

    // default password = username (ให้เปลี่ยนทีหลัง)
    const defaultPassword = username
    const hash = await bcrypt.hash(defaultPassword, 10)

    await col.insertOne({
      username,
      password: hash,
      role,
      name: w.name,
      code: w.code || null,
      email: '',
      phone: '',
      machines: w.machines,
      created_at: new Date(),
    })

    console.log(`  + สร้าง: @${username} (${w.name}) role=${role} pw="${defaultPassword}"`)
    created++
  }

  await client.close()
  console.log(`\nเสร็จแล้ว: สร้างใหม่ ${created} คน, ข้ามที่มีอยู่ ${skipped} คน`)
  console.log('⚠️  รหัสผ่านเริ่มต้น = username — แนะนำให้เปลี่ยนทุก account')
}

main().catch((e) => { console.error(e); process.exit(1) })
