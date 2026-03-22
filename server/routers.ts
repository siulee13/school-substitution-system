import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllTeachers,
  getTeacherClassesByDate,
  getSubjectTeachersForClass,
  generateSuggestions,
} from "./substitution";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 代課編排系統 API
  substitution: router({
    // 獲取所有老師列表
    getAllTeachers: publicProcedure.query(async () => {
      return await getAllTeachers();
    }),

    // 根據日期及老師查詢當日課堂
    getTeacherClasses: publicProcedure
      .input(
        z.object({
          teacherFullName: z.string(),
          dateStr: z.string(), // ISO date string e.g. "2026-03-30"
        })
      )
      .query(async ({ input }) => {
        const date = new Date(input.dateStr);
        return await getTeacherClassesByDate(input.teacherFullName, date);
      }),

    // 根據班別查詢科任老師
    getSubjectTeachers: publicProcedure
      .input(z.object({ className: z.string() }))
      .query(async ({ input }) => {
        return await getSubjectTeachersForClass(input.className);
      }),

    // 生成代課建議
    generateSuggestions: publicProcedure
      .input(
        z.object({
          dateStr: z.string(), // ISO date string e.g. "2026-03-30"
          absentTeacherFullName: z.string(),
        })
      )
      .query(async ({ input }) => {
        const date = new Date(input.dateStr);
        return await generateSuggestions(date, input.absentTeacherFullName);
      }),
  }),
});

export type AppRouter = typeof appRouter;
