/** SQLite: datetime, PostgreSQL: timestamp */
export function dbTimestampType(): 'timestamp' | 'datetime' {
  return process.env.DATABASE_URL ? 'timestamp' : 'datetime';
}
