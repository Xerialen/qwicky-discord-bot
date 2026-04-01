// Focused date/time parser for QuakeWorld scheduling messages.
// Handles: ISO dates, European dates, relative days, weekday names, times, CET/CEST.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// CET = UTC+1, CEST = UTC+2 (most QW players are European)
const TZ_OFFSETS = {
  utc: 0,
  gmt: 0,
  cet: 1,
  cest: 2,
  eet: 2,
  eest: 3,
  est: -5,
  edt: -4,
  cst: -6,
  cdt: -5,
  pst: -8,
  pdt: -7,
};

function parseDate(text) {
  const lower = text.toLowerCase().trim();
  const now = new Date();

  let date = null;
  let time = null;
  let tzOffset = null; // hours from UTC, null = assume CET

  // --- Extract timezone ---
  const tzMatch = lower.match(/\b(utc|gmt|cet|cest|eet|eest|est|edt|cst|cdt|pst|pdt)\b/);
  if (tzMatch) {
    tzOffset = TZ_OFFSETS[tzMatch[1]];
  }

  // --- Extract time ---
  // 20:00, 20.00, 8pm, 8:30pm, @21, bare "21" (only if 15-23 range)
  const time24 = lower.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const time12 = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const timeAt = lower.match(/@\s*(\d{1,2})/);

  if (time24) {
    const h = parseInt(time24[1]);
    const m = parseInt(time24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  } else if (time12) {
    let h = parseInt(time12[1]);
    const m = parseInt(time12[2] || '0');
    if (time12[3] === 'pm' && h < 12) h += 12;
    if (time12[3] === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  } else if (timeAt) {
    const h = parseInt(timeAt[1]);
    if (h >= 0 && h <= 23) {
      time = `${String(h).padStart(2, '0')}:00`;
    }
  }

  // --- Extract date ---

  // ISO: 2026-04-15
  const iso = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // European numeric: 15/04, 15/04/2026, 15.04.2026
  if (!date) {
    const euro = lower.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
    if (euro && !time24) {
      // avoid confusing 20:00 with a date
      const d = parseInt(euro[1]);
      const m = parseInt(euro[2]);
      let y = euro[3] ? parseInt(euro[3]) : now.getFullYear();
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // Named month: "15 april", "april 15", "15th april", "apr 15"
  if (!date) {
    for (let mi = 0; mi < 12; mi++) {
      const full = MONTHS[mi];
      const short = MONTH_SHORT[mi];
      const pattern = new RegExp(
        `\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${full}|${short})|(?:${full}|${short})\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?:\\s+(\\d{4}))?\\b`
      );
      const m = lower.match(pattern);
      if (m) {
        const d = parseInt(m[1] || m[2]);
        const y = m[3] ? parseInt(m[3]) : now.getFullYear();
        if (d >= 1 && d <= 31) {
          date = `${y}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
        break;
      }
    }
  }

  // Relative: today, tonight, tomorrow
  if (!date) {
    if (/\btoday\b|\btonight\b/.test(lower)) {
      date = formatDate(now);
      if (/\btonight\b/.test(lower) && !time) time = '21:00';
    } else if (/\btomorrow\b/.test(lower)) {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      date = formatDate(tom);
    }
  }

  // Weekday: "monday", "next wednesday", "this friday"
  if (!date) {
    const hasNext = /\bnext\b/.test(lower);
    for (let wi = 0; wi < 7; wi++) {
      const full = WEEKDAYS[wi];
      const short = WEEKDAY_SHORT[wi];
      if (new RegExp(`\\b(?:${full}|${short})\\b`).test(lower)) {
        const currentDay = now.getDay();
        let diff = wi - currentDay;
        if (diff <= 0) diff += 7;
        if (hasNext) diff += 7;
        const target = new Date(now);
        target.setDate(target.getDate() + diff);
        date = formatDate(target);
        break;
      }
    }
  }

  if (!date && !time) return null;

  // Default timezone to CET if not specified
  if (tzOffset === null) tzOffset = 1;

  return { date, time, tzOffset, tzName: tzMatch?.[1]?.toUpperCase() || 'CET' };
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Convert local time to UTC for storage
function toUtcTime(time, tzOffset) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  let utcH = h - tzOffset;
  if (utcH < 0) utcH += 24;
  if (utcH >= 24) utcH -= 24;
  return `${String(utcH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = { parseDate, toUtcTime };
