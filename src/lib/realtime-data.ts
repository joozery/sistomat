import { getClientPromise } from '@/lib/mongodb'

// worker entry ที่นับว่า "มีการบันทึกเวลาแล้ว" ต้องมีทั้ง worker_id และ start_time (ไม่ว่าง/ไม่ null)
const HAS_LOGGED_TIME = {
  $and: [
    { $ne: ['$$w.worker_id', null] },
    { $ne: ['$$w.worker_id', ''] },
    { $ne: ['$$w.start_time', null] },
    { $ne: ['$$w.start_time', ''] },
  ],
}

const HAS_STOP_TIME = {
  $and: [{ $ne: ['$$w.stop_time', null] }, { $ne: ['$$w.stop_time', ''] }],
}

// สร้าง event 1 อันต่อ worker ที่ล็อกเวลาไว้ในกระบวนการนั้น (running/completed)
const WORKER_ENTRIES_PIPELINE = {
  $reduce: {
    input: { $ifNull: ['$processes', []] },
    initialValue: [],
    in: {
      $concatArrays: [
        '$$value',
        {
          $map: {
            input: {
              $filter: {
                input: { $ifNull: ['$$this.workers', []] },
                as: 'w',
                cond: HAS_LOGGED_TIME,
              },
            },
            as: 'w',
            in: {
              project_id: '$project_id',
              dwg_name: { $ifNull: ['$dwg_name', ''] },
              level1: { $ifNull: ['$level1', ''] },
              level2: { $ifNull: ['$level2', ''] },
              process: { $ifNull: ['$$this.process', ''] },
              worker_id: '$$w.worker_id',
              start_time: '$$w.start_time',
              stop_time: { $ifNull: ['$$w.stop_time', null] },
              target_time: { $ifNull: ['$$this.target_time', ''] },
              skill: { $ifNull: ['$$this.skill', '0'] },
              overtime_grace: { $ifNull: ['$$this.overtime_grace', ''] },
              remark: { $ifNull: ['$$this.remark', ''] },
              job_status: { $ifNull: ['$job_status', { $ifNull: ['$status', ''] }] },
              due_date: { $ifNull: ['$due_date', ''] },
              received_date: { $ifNull: ['$received_date', ''] },
              status: { $cond: [HAS_STOP_TIME, 'completed', 'running'] },
            },
          },
        },
      ],
    },
  },
}

// รวมชื่อกระบวนการทั้งหมดของโปรเจกต์ คั่นด้วย ", " ใช้ตอนยังไม่มี worker คนไหนล็อกเวลาเลย (idle row)
const JOINED_PROCESS_NAMES = {
  $reduce: {
    input: {
      $filter: {
        input: { $map: { input: { $ifNull: ['$processes', []] }, as: 'p', in: '$$p.process' } },
        as: 'name',
        cond: { $and: [{ $ne: ['$$name', null] }, { $ne: ['$$name', ''] }] },
      },
    },
    initialValue: '',
    in: { $cond: [{ $eq: ['$$value', ''] }, '$$this', { $concat: ['$$value', ', ', '$$this'] }] },
  },
}

const IDLE_ENTRY = {
  project_id: '$project_id',
  dwg_name: { $ifNull: ['$dwg_name', ''] },
  level1: { $ifNull: ['$level1', ''] },
  level2: { $ifNull: ['$level2', ''] },
  process: { $cond: [{ $eq: [JOINED_PROCESS_NAMES, ''] }, '—', JOINED_PROCESS_NAMES] },
  status: 'idle',
  worker_id: '',
  start_time: '',
  stop_time: null,
  target_time: '',
  skill: '0',
  remark: '',
  job_status: { $ifNull: ['$job_status', { $ifNull: ['$status', ''] }] },
  due_date: { $ifNull: ['$due_date', ''] },
  received_date: { $ifNull: ['$received_date', ''] },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildRealtimeData(): Promise<any> {
  const client = await getClientPromise()
  const db = client.db('sistomat')

  // ทำงานหนัก (loop project → process → worker + join ชื่อกระบวนการ + sort) ที่ฝั่ง MongoDB
  // แทน Node.js เพื่อไม่ให้ต้องดึงทุกฟิลด์ของทุก project (file_url, attachments, qc ฯลฯ) เข้ามาที่ server
  // แล้วมาวน loop เองซึ่งช้าลงเรื่อยๆ เมื่อจำนวน project/worker เพิ่มขึ้น
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = await db
    .collection('projects')
    .aggregate([
      // pre-sort ก่อน flatten เพื่อให้ idle/tie ที่ status+start_time เหมือนกันทุกประการ
      // เรียงลำดับแบบเดิม (คงที่ตาม stable sort ด้านล่าง) เหมือนตอนยัง find().sort() ก่อน loop
      { $sort: { level1: 1, level2: 1, received_date: -1 } },
      {
        $project: {
          project_id: 1,
          dwg_name: 1,
          level1: 1,
          level2: 1,
          processes: 1,
          job_status: 1,
          status: 1,
          due_date: 1,
          received_date: 1,
        },
      },
      { $addFields: { _entries: WORKER_ENTRIES_PIPELINE } },
      {
        $addFields: {
          _events: {
            $cond: [{ $gt: [{ $size: '$_entries' }, 0] }, '$_entries', [IDLE_ENTRY]],
          },
        },
      },
      { $unwind: '$_events' },
      { $replaceRoot: { newRoot: '$_events' } },
    ])
    .toArray()

  // Sort: running → idle → completed
  // ทำใน Node แทน MongoDB $sort เพราะ start_time มีทั้ง format เก่า ("HH:MM") และใหม่
  // ("YYYY-MM-DD HH:MM:SS") ปนกัน — localeCompare ให้ผลต่างจาก $sort (byte-order) ของ Mongo
  // แต่ array ตรงนี้เป็นแค่ events ที่ flatten แล้ว (เล็กกว่าดึงทุก project ทั้งก้อนมาก) จึงไม่หนัก
  const statusOrder = { running: 0, idle: 1, completed: 2 }
  events.sort((a, b) => {
    const oa = statusOrder[a.status as keyof typeof statusOrder] ?? 3
    const ob = statusOrder[b.status as keyof typeof statusOrder] ?? 3
    if (oa !== ob) return oa - ob
    return (b.start_time ?? '').localeCompare(a.start_time ?? '')
  })

  return {
    events,
    total: events.length,
    running: events.filter((e) => e.status === 'running').length,
    completed: events.filter((e) => e.status === 'completed').length,
    idle: events.filter((e) => e.status === 'idle').length,
    timestamp: new Date().toISOString(),
  }
}
