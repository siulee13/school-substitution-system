import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 代課記錄表（每日一筆記錄）
export const substitutionRecords = mysqlTable("substitution_records", {
  id: int("id").autoincrement().primaryKey(),
  /** 請假日期，格式 YYYY-MM-DD */
  dateStr: varchar("dateStr", { length: 10 }).notNull(),
  /** 創建時間 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 最後更新時間 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** 備註（可選） */
  note: text("note"),
});

export type SubstitutionRecord = typeof substitutionRecords.$inferSelect;
export type InsertSubstitutionRecord = typeof substitutionRecords.$inferInsert;

// 代課記錄明細表（每堂課一筆）
export const substitutionRecordItems = mysqlTable("substitution_record_items", {
  id: int("id").autoincrement().primaryKey(),
  /** 關聯的代課記錄 ID */
  recordId: int("recordId").notNull(),
  /** 請假老師全名 */
  absentTeacher: varchar("absentTeacher", { length: 64 }).notNull(),
  /** 課堂時段 e.g. "8:30 - 9:05" */
  timeSlot: varchar("timeSlot", { length: 32 }).notNull(),
  /** 班別 e.g. "3A" */
  className: varchar("className", { length: 16 }).notNull(),
  /** 科目 */
  subject: varchar("subject", { length: 64 }).notNull(),
  /** 代課/調課老師名稱 */
  substitutionTeacher: varchar("substitutionTeacher", { length: 64 }).notNull(),
  /** 是否為調課 */
  isSwap: int("isSwap").default(0).notNull(), // 0=代課, 1=調課
  /** 調課備註 */
  swapNote: text("swapNote"),
  /** 排列順序 */
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type SubstitutionRecordItem = typeof substitutionRecordItems.$inferSelect;
export type InsertSubstitutionRecordItem = typeof substitutionRecordItems.$inferInsert;