import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertSubstitutionRecord, InsertSubstitutionRecordItem, substitutionRecordItems, substitutionRecords, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ====== 代課記錄 CRUD ======

/** 查詢指定日期的代課記錄（包含明細） */
export async function getSubstitutionRecordByDate(dateStr: string) {
  const db = await getDb();
  if (!db) return null;
  const records = await db.select().from(substitutionRecords).where(eq(substitutionRecords.dateStr, dateStr)).limit(1);
  if (records.length === 0) return null;
  const record = records[0];
  const items = await db.select().from(substitutionRecordItems)
    .where(eq(substitutionRecordItems.recordId, record.id))
    .orderBy(substitutionRecordItems.sortOrder);
  return { ...record, items };
}

/** 儲存或更新代課記錄（先刪除舊明細，再寫入新明細） */
export async function upsertSubstitutionRecord(
  record: InsertSubstitutionRecord,
  items: InsertSubstitutionRecordItem[]
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // 查詢是否已有記錄
  const existing = await db.select().from(substitutionRecords)
    .where(eq(substitutionRecords.dateStr, record.dateStr)).limit(1);

  let recordId: number;
  if (existing.length > 0) {
    recordId = existing[0].id;
    // 更新記錄
    await db.update(substitutionRecords)
      .set({ note: record.note, updatedAt: new Date() })
      .where(eq(substitutionRecords.id, recordId));
    // 刪除舊明細
    await db.delete(substitutionRecordItems).where(eq(substitutionRecordItems.recordId, recordId));
  } else {
    // 創建新記錄
    const result = await db.insert(substitutionRecords).values(record);
    recordId = (result as unknown as { insertId: number }).insertId;
  }

  // 寫入新明細
  if (items.length > 0) {
    await db.insert(substitutionRecordItems).values(
      items.map((item, idx) => ({ ...item, recordId, sortOrder: idx }))
    );
  }

  return recordId;
}

/** 列出最近的代課記錄（不含明細） */
export async function listSubstitutionRecords(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(substitutionRecords)
    .orderBy(substitutionRecords.dateStr)
    .limit(limit);
}
