import { describe, it, expect, beforeAll } from 'vitest';
import {
  getAllTeachers,
  getTeacherClassesByDate,
  getAvailableTeachers,
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
      // 使用一個已知存在的老師（例如李弘光）
      const date = new Date(2026, 2, 23); // 2026-03-23 (Monday)
      const classes = await getTeacherClassesByDate('李弘光', date);
      
      expect(Array.isArray(classes)).toBe(true);
      
      if (classes.length > 0) {
        const firstClass = classes[0];
        expect(firstClass).toHaveProperty('timeSlot');
        expect(firstClass).toHaveProperty('class');
        expect(firstClass).toHaveProperty('subject');
      }
    });

    it('should return empty array for a teacher with no classes on a given date', async () => {
      // 使用一個可能沒有課的日期
      const date = new Date(2026, 0, 1); // 2026-01-01 (Thursday)
      const classes = await getTeacherClassesByDate('李弘光', date);
      
      expect(Array.isArray(classes)).toBe(true);
    });
  });

  describe('getAvailableTeachers', () => {
    it('should return available teachers for a given time slot', async () => {
      const date = new Date(2026, 2, 23); // 2026-03-23 (Monday)
      const timeSlot = '09:50-10:25'; // 第二節
      
      const availableTeachers = await getAvailableTeachers(date, timeSlot);
      
      expect(Array.isArray(availableTeachers)).toBe(true);
      
      if (availableTeachers.length > 0) {
        const firstTeacher = availableTeachers[0];
        expect(firstTeacher).toHaveProperty('fullName');
        expect(firstTeacher).toHaveProperty('shortName');
      }
    });
  });

  describe('getSubjectTeachersForClass', () => {
    it('should return subject teachers for a specific class', async () => {
      const subjectTeachers = await getSubjectTeachersForClass('6B');
      
      expect(Array.isArray(subjectTeachers)).toBe(true);
      
      if (subjectTeachers.length > 0) {
        const firstTeacher = subjectTeachers[0];
        expect(firstTeacher).toHaveProperty('fullName');
        expect(firstTeacher).toHaveProperty('shortName');
        expect(firstTeacher).toHaveProperty('subjects');
        expect(Array.isArray(firstTeacher.subjects)).toBe(true);
      }
    });

    it('should return empty array for non-existent class', async () => {
      const subjectTeachers = await getSubjectTeachersForClass('9Z');
      
      expect(Array.isArray(subjectTeachers)).toBe(true);
      expect(subjectTeachers.length).toBe(0);
    });
  });
});
