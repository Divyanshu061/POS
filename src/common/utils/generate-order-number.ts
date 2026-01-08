// src/common/utils/generate-order-number.ts
import { Repository, ObjectLiteral } from 'typeorm';

/**
 * Robust read-based order-number generator using TypeORM metadata.
 * - Finds the real DB column name for the order number (fuzzy matching)
 * - Quotes identifiers correctly (handles mixed-case like "orderNumber")
 * - Returns PREFIX-0001 formatted strings
 *
 * Note: still read-based (not fully concurrency-safe). For production concurrency
 * use the order_counters + FOR UPDATE approach.
 */
export async function generateOrderNumber<T extends ObjectLiteral = ObjectLiteral>(
  prefix: string,
  repo: Repository<T>,
  companyId?: string | null,
  pad = 4,
): Promise<string> {
  if (!repo || !prefix) throw new Error('repo and prefix are required');

  const metadata = repo.metadata;
  const tableName = metadata.tableName; // actual DB table name
  const cols = metadata.columns;

  const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

  // Try to find "order number" column metadata
  let orderColMeta = cols.find(
    (c) =>
      /order[_-]?number/i.test(c.propertyName) ||
      /order[_-]?number/i.test(c.databaseName),
  );

  if (!orderColMeta) {
    orderColMeta = cols.find((c) => {
      const p = normalize(c.propertyName ?? '');
      const d = normalize(c.databaseName ?? '');
      return (p.includes('order') && p.includes('number')) || (d.includes('order') && d.includes('number'));
    });
  }

  if (!orderColMeta) {
    orderColMeta = cols.find((c) => {
      const p = normalize(c.propertyName ?? '');
      const d = normalize(c.databaseName ?? '');
      return p.includes('order') || d.includes('order');
    });
  }

  if (!orderColMeta) {
    throw new Error(
      'Could not locate an "order number" column in purchase_order metadata. ' +
        'Please check your entity mapping or pass a column name to the generator.',
    );
  }

  const orderDbName = orderColMeta.databaseName;

  // createdAt detection (try several likely names)
  const createdAtMeta =
    cols.find((c) => /created[_-]?at/i.test(c.propertyName) || /created[_-]?at/i.test(c.databaseName)) ??
    cols.find((c) => c.propertyName === 'createdAt' || c.databaseName === 'created_at' || c.databaseName === 'createdAt');

  const createdAtDbName = createdAtMeta?.databaseName ?? cols[0].databaseName; // fallback to first col if none found

  // quoting helper for Postgres identifiers
  const needsQuoting = (s: string) => /[^a-z0-9_]/i.test(s) || /[A-Z]/.test(s);
  const quoteIdent = (s: string) => (needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s);

  const quotedOrderCol = quoteIdent(orderDbName);
  const quotedCreatedAtCol = quoteIdent(createdAtDbName);
  const quotedTable = quoteIdent(tableName);

  const likePattern = `${prefix}-%`;

  // Use a safe alias name (lowercase, underscores) so Postgres returns predictable key
  const safeAlias = '__gen_order_col';

  // Build parameterized raw SQL using discovered names
  let sql: string;
  let params: any[];
  if (companyId) {
    sql = `SELECT ${quotedOrderCol} AS ${safeAlias} FROM ${quotedTable} WHERE ${quotedOrderCol} LIKE $1 AND company_id = $2 ORDER BY ${quotedCreatedAtCol} DESC LIMIT 1`;
    params = [likePattern, companyId];
  } else {
    sql = `SELECT ${quotedOrderCol} AS ${safeAlias} FROM ${quotedTable} WHERE ${quotedOrderCol} LIKE $1 ORDER BY ${quotedCreatedAtCol} DESC LIMIT 1`;
    params = [likePattern];
  }

  const rows: any[] = await repo.query(sql, params);

  let next = 1;
  if (rows && rows.length > 0) {
    const r = rows[0] as Record<string, unknown>;
    // read the value using the safe alias
    const val = r[safeAlias];
    if (typeof val === 'string' && val.length > 0) {
      const m = val.match(/(\d+)$/);
      if (m) {
        const n = Number.parseInt(m[1], 10);
        if (!Number.isNaN(n)) next = n + 1;
      }
    }
  }

  const seq = String(next).padStart(pad, '0');
  return `${prefix}-${seq}`;
}
