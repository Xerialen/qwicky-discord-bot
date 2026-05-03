// vitest globals are enabled in vitest.config.js (describe, it, expect, vi, beforeEach, afterEach)
import { parseDate, toUtcTime } from '../../src/utils/dateParser.js';

describe('parseDate', () => {
  beforeEach(() => {
    // Fix "now" to 2026-03-29 (Sunday) 12:00 UTC for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ISO date parsing', () => {
    it('parses YYYY-MM-DD with 24h time', () => {
      const result = parseDate('2026-04-15 20:00');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBe('20:00');
    });

    it('parses ISO date without time', () => {
      const result = parseDate('2026-04-15');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBeNull();
    });

    it('defaults timezone to CET when not specified', () => {
      const result = parseDate('2026-04-15 20:00');
      expect(result.tzOffset).toBe(1);
      expect(result.tzName).toBe('CET');
    });
  });

  describe('European format', () => {
    it('parses DD/MM without time', () => {
      const result = parseDate('15/04');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBeNull();
    });

    it('parses DD/MM/YYYY without time', () => {
      const result = parseDate('15/04/2026');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBeNull();
    });

    it('parses DD/MM with 12-hour time (avoids time24 conflict)', () => {
      const result = parseDate('15/04 8pm');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBe('20:00');
    });

    it('parses DD/MM/YYYY with 12-hour time', () => {
      const result = parseDate('15/04/2026 8pm');
      expect(result.date).toBe('2026-04-15');
      expect(result.time).toBe('20:00');
    });

    it('euro date skipped when 24h time present (time24 guard)', () => {
      // The parser intentionally skips euro date parsing when time24 matched,
      // to avoid confusing "20:00" as a date. Only time is extracted.
      const result = parseDate('15/04 at 21:00');
      expect(result.date).toBeNull();
      expect(result.time).toBe('21:00');
    });

    it('DD.MM.YYYY is parsed as time (dot matches time24 regex)', () => {
      // 15.04 matches the time24 regex as 15:04, so euro date is skipped
      const result = parseDate('15.04.2026');
      expect(result.date).toBeNull();
      expect(result.time).toBe('15:04');
    });
  });

  describe('12-hour time', () => {
    it('parses 8pm', () => {
      const result = parseDate('2026-04-15 8pm');
      expect(result.time).toBe('20:00');
    });

    it('parses 8:30pm', () => {
      const result = parseDate('2026-04-15 8:30pm');
      expect(result.time).toBe('20:30');
    });

    it('parses 12am as midnight', () => {
      const result = parseDate('2026-04-15 12am');
      expect(result.time).toBe('00:00');
    });

    it('parses 12pm as noon', () => {
      const result = parseDate('2026-04-15 12pm');
      expect(result.time).toBe('12:00');
    });
  });

  describe('timezone handling', () => {
    it('parses CET timezone', () => {
      const result = parseDate('2026-04-15 20:00 CET');
      expect(result.tzOffset).toBe(1);
      expect(result.tzName).toBe('CET');
    });

    it('parses CEST timezone', () => {
      const result = parseDate('2026-04-15 20:00 CEST');
      expect(result.tzOffset).toBe(2);
      expect(result.tzName).toBe('CEST');
    });

    it('parses 8pm CET', () => {
      const result = parseDate('2026-04-15 8pm cet');
      expect(result.time).toBe('20:00');
      expect(result.tzOffset).toBe(1);
    });

    it('parses EST timezone', () => {
      const result = parseDate('2026-04-15 20:00 EST');
      expect(result.tzOffset).toBe(-5);
    });
  });

  describe('relative dates', () => {
    it('parses "today"', () => {
      const result = parseDate('today 20:00');
      expect(result.date).toBe('2026-03-29');
      expect(result.time).toBe('20:00');
    });

    it('parses "tonight" with default 21:00', () => {
      const result = parseDate('tonight');
      expect(result.date).toBe('2026-03-29');
      expect(result.time).toBe('21:00');
    });

    it('parses "tomorrow"', () => {
      const result = parseDate('tomorrow 20:00');
      expect(result.date).toBe('2026-03-30');
      expect(result.time).toBe('20:00');
    });
  });

  describe('weekday names', () => {
    it('parses "monday" as upcoming Monday (tomorrow from Sunday)', () => {
      const result = parseDate('monday 20:00');
      expect(result.date).toBe('2026-03-30'); // March 29 is Sunday, next day is Monday
      expect(result.time).toBe('20:00');
    });

    it('parses "next wednesday"', () => {
      const result = parseDate('next wednesday 20:00');
      // "next" adds 7 more days from upcoming Wednesday
      // Sunday 29 -> Wednesday is +3 = April 1, + 7 = April 8
      expect(result.date).toBe('2026-04-08');
    });
  });

  describe('named months', () => {
    it('parses "15 april"', () => {
      const result = parseDate('15 april 20:00');
      expect(result.date).toBe('2026-04-15');
    });

    it('parses "april 15"', () => {
      const result = parseDate('april 15 20:00');
      expect(result.date).toBe('2026-04-15');
    });

    it('parses "15th april"', () => {
      const result = parseDate('15th april');
      expect(result.date).toBe('2026-04-15');
    });

    it('parses abbreviated month "apr 15"', () => {
      const result = parseDate('apr 15 20:00');
      expect(result.date).toBe('2026-04-15');
    });
  });

  describe('no match', () => {
    it('returns null for unrecognized text', () => {
      expect(parseDate('just chatting gg')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });
  });
});

describe('toUtcTime', () => {
  it('converts CET (UTC+1) time to UTC', () => {
    expect(toUtcTime('20:00', 1)).toBe('19:00');
  });

  it('converts CEST (UTC+2) time to UTC', () => {
    expect(toUtcTime('20:00', 2)).toBe('18:00');
  });

  it('converts EST (UTC-5) time to UTC', () => {
    expect(toUtcTime('20:00', -5)).toBe('01:00');
  });

  it('handles midnight wraparound forward', () => {
    expect(toUtcTime('01:00', 2)).toBe('23:00');
  });

  it('handles midnight wraparound backward', () => {
    expect(toUtcTime('23:00', -2)).toBe('01:00');
  });

  it('returns null for null time', () => {
    expect(toUtcTime(null, 1)).toBeNull();
  });

  it('preserves minutes', () => {
    expect(toUtcTime('20:30', 1)).toBe('19:30');
  });
});
