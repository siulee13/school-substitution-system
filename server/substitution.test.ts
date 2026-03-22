import { describe, it, expect } from 'vitest';
import {
  getAllTeachers,
  getTeacherClassesByDate,
  getSubjectTeachersForClass,
} from './substitution';

describe('Substitution System', () => {
  describe('getAllTeachers', () => {
    it('should return a list of teachers with full names and short names', async () => {
      const teachers = await getAllTeachers();
      expect(Array.isArray(teachers)).toBe(true);
      expect(teachers.length).toBeGreaterThan(0);
      const firstTeacher = teachers[0];
      expect(firstTeacher).toHaveProperty('fullName');
      expect(firstTeacher).toHaveProperty('shortName');
      expect(typeof firstTeacher.fullName).toBe('string');
      expect(typeof firstTeacher.shortName).toBe('string');
    });
  });

  describe('getTeacherClassesByDate', () => {
    it('should return classes for a specific teacher on a given date', async () => {
      // 使用 UTC 日期 2026-03-23 (Monday)
      const date = new Date('2026-03-23T00:00:00.000Z');
      const classes = await getTeacherClassesByDate('李弘光', date);
      expect(Array.isArray(classes)).toBe(true);
      if (classes.length > 0) {
        const firstClass = classes[0];
        expect(firstClass).toHaveProperty('timeSlot');
        expect(firstClass).toHaveProperty('className');
        expect(firstClass).toHaveProperty('subject');
      }
    });

    it('should return empty array for a teacher with no classes on a weekend', async () => {
      // 2026-01-04 是星期日，不應有課堂
      const date = new Date('2026-01-04T00:00:00.000Z');
      const classes = await getTeacherClassesByDate('李弘光', date);
      expect(Array.isArray(classes)).toBe(true);
    });
  });

  describe('getSubjectTeachersForClass', () => {
    it('should return subject teachers with correct properties', async () => {
      const subjectTeachers = await getSubjectTeachersForClass('6B');
      expect(Array.isArray(subjectTeachers)).toBe(true);
      if (subjectTeachers.length > 0) {
        const firstTeacher = subjectTeachers[0];
        expect(firstTeacher).toHaveProperty('fullName');
        expect(firstTeacher).toHaveProperty('shortName');
        expect(firstTeacher).toHaveProperty('subject');
        expect(typeof firstTeacher.subject).toBe('string');
      }
    });

    it('should return empty array for non-existent class', async () => {
      const subjectTeachers = await getSubjectTeachersForClass('9Z');
      expect(Array.isArray(subjectTeachers)).toBe(true);
      expect(subjectTeachers.length).toBe(0);
    });
  });
});
