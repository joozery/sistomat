import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI!

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables')
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

const mongoOptions = {
  directConnection: true,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
}

function createClientPromise(): Promise<MongoClient> {
  const c = new MongoClient(uri, mongoOptions)
  return c.connect().catch((err) => {
    global._mongoClientPromise = undefined
    throw err
  })
}

export function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = createClientPromise()
    }
    return global._mongoClientPromise
  }
  return createClientPromise()
}

// backward-compat default export
export default getClientPromise
