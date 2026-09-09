import { Db } from 'mongodb'

export type NotificationType = 'success' | 'warning' | 'error' | 'info'
export type NotificationCategory = 'machine' | 'system' | 'qc' | 'inventory'

interface CreateNotificationInput {
  type: NotificationType
  category: NotificationCategory
  title: string
  description?: string
  link?: string
}

export async function createNotification(db: Db, input: CreateNotificationInput) {
  await db.collection('notifications').insertOne({
    type: input.type,
    category: input.category,
    title: input.title,
    description: input.description ?? '',
    read: false,
    link: input.link ?? null,
    created_at: new Date(),
  })
}
