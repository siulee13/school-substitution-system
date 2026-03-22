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
        // 使用 YYYY-MM-DD 格式解析，避免 UTC 時區偏差
        const [year, month, day] = input.dateStr.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);
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
          startTime: z.string().optional(), // e.g. "9:05" for time range filter
          endTime: z.string().optional(),   // e.g. "13:05" for time range filter
          allowSwap: z.boolean().optional(), // 容許調課
        })
      )
      .query(async ({ input }) => {
        // 使用 YYYY-MM-DD 格式解析，避免 UTC 時區偏差
        const [year, month, day] = input.dateStr.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return await generateSuggestions(date, input.absentTeacherFullName, input.startTime, input.endTime, input.allowSwap);
      }),

    // 生成多位老師同日請假的代課建議
    generateSuggestionsMulti: publicProcedure
      .input(
        z.object({
          dateStr: z.string(),
          absentTeachers: z.array(z.object({
            fullName: z.string(),
            startTime: z.string().optional(),
            endTime: z.string().optional(),
          })),
          allowSwap: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        const [year, month, day] = input.dateStr.split('T')[0].split('-').map(Number);
        const date = new Date(year, month - 1, day);

        // 順序生成每位老師的代課建議（不能並行，需確保調課資源不重複分配）
        // excludedSwapResources 記錄已被前面老師佔用的調課資源，格式：`${swapTeacherFullName}|||${swapTeacherTimeSlot}`
        const excludedSwapResources = new Set<string>();
        const results: Array<{ teacherFullName: string; suggestions: Awaited<ReturnType<typeof generateSuggestions>> }> = [];

        for (const teacher of input.absentTeachers) {
          const suggestions = await generateSuggestions(
            date,
            teacher.fullName,
            teacher.startTime,
            teacher.endTime,
            input.allowSwap,
            excludedSwapResources
          );

          // 將此老師的調課建議加入已佔用集合，避免後續老師重複使用
          if (input.allowSwap) {
            for (const suggestion of suggestions) {
              for (const swap of suggestion.swapCandidates) {
                excludedSwapResources.add(`${swap.swapTeacherFullName}|||${swap.swapTeacherTimeSlot}`);
              }
            }
          }

          results.push({ teacherFullName: teacher.fullName, suggestions });
        }

        return results;
      }),
  }),
});

export type AppRouter = typeof appRouter;
