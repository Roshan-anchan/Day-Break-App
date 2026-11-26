import React, { useState, useEffect, useRef } from 'react';
import {
  Check, Plus, Trash2, ChevronLeft, ChevronRight, Flame, Trophy,
  CalendarDays, LayoutList, BarChart3, Settings2, Pencil, X, ArrowUp, ArrowDown,
  Hash, CheckSquare, Home, Bell, Sun, Star, Award, TrendingUp, Target, LogOut, Mail, User as UserIcon, RefreshCw,
  Settings, Moon, Clock,
} from 'lucide-react';
import {
  auth, db, googleProvider, signInWithPopup, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, getDoc, setDoc,
} from './firebase.js';

const LIGHT_COLORS = {
  ink: '#1E2235',
  dawn: '#F2A365',
  dusk: '#6C7BD9',
  mist: '#F7F7FB',
  mistDeep: '#E9E9F5',
  sage: '#4FAE8E',
  rose: '#E28B8B',
  slate: '#9498B3',
  white: '#FFFFFF',
};
const DARK_COLORS = {
  ink: '#F1F2FA',
  dawn: '#F2A365',
  dusk: '#8B98E8',
  mist: '#14151F',
  mistDeep: '#2A2C3D',
  sage: '#5FC49D',
  rose: '#E8A0A0',
  slate: '#9195B0',
  white: '#1C1E2B',
};
// Mutable on purpose: components read COLORS.xxx at render time via inline
// styles rather than via props/context, so DaybreakApp updates these values
// in place (see the Object.assign near its top) whenever the theme changes,
// before any child component renders. Much smaller change than threading a
// theme prop through every component in the file.
const COLORS = { ...LIGHT_COLORS };

const BUCKET_COLORS = ['#E9E9F5', '#D7D3F0', '#B7ADE6', '#8F7FDB', '#6C7BD9'];

// ---------- date helpers ----------
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr() { return toDateStr(new Date()); }
function parseDateStr(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDateStr(s); d.setDate(d.getDate() + n); return toDateStr(d); }
function addMonths(s, n) { const d = parseDateStr(s); d.setMonth(d.getMonth() + n); d.setDate(1); return toDateStr(d); }
function formatDisplay(s) { const d = parseDateStr(s); return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
function formatMonthLabel(s) { const d = parseDateStr(s); return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function formatMonthShort(s) { const d = parseDateStr(s); return d.toLocaleDateString(undefined, { month: 'short' }); }
function daysInMonth(s) { const d = parseDateStr(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function monthStart(s) { const d = parseDateStr(s); return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)); }
function generateRange(startStr, endStr) {
  let cur = parseDateStr(startStr);
  const end = parseDateStr(endStr);
  const out = [];
  while (cur <= end) { out.push(toDateStr(cur)); cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1); }
  return out;
}
function formatClockTime(t, timeFormat) {
  if (!t || timeFormat !== '12h') return t;
  const [hh, mm] = t.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm)} ${period}`;
}
function formatTimeRange(str, timeFormat) {
  if (!str || timeFormat !== '12h') return str;
  if (str.includes('–')) {
    const [a, b] = str.split('–');
    return `${formatClockTime(a, timeFormat)}–${formatClockTime(b, timeFormat)}`;
  }
  return formatClockTime(str, timeFormat);
}
function formatHabitTime(h, timeFormat) {
  if (h.noTime) return 'Anytime';
  if (h.endTime) return `${formatClockTime(h.time, timeFormat)}–${formatClockTime(h.endTime, timeFormat)}`;
  return formatClockTime(h.time, timeFormat);
}
function weekMondayStr(dateStr) {
  const d = parseDateStr(dateStr);
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? 6 : dow - 1;
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday));
}
function hexToRgb(hex) { const v = hex.replace('#', ''); return [parseInt(v.substring(0, 2), 16), parseInt(v.substring(2, 4), 16), parseInt(v.substring(4, 6), 16)]; }
function lerpColor(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a); const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => pad(i));

// ---------- custom 24-hour time picker (native <input type="time"> renders 12h AM/PM on many systems) ----------
function TimeSelect({ value, onChange }) {
  const [hh, mm] = (value || '09:00').split(':');
  return (
    <div className="flex items-center gap-1">
      <select value={hh} onChange={e => onChange(`${e.target.value}:${mm}`)}
        className="px-2 py-2 rounded-xl text-sm outline-none font-mono" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }}>
        {HOURS_24.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: COLORS.slate }}>:</span>
      <select value={mm} onChange={e => onChange(`${hh}:${e.target.value}`)}
        className="px-2 py-2 rounded-xl text-sm outline-none font-mono" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }}>
        {MINUTES_60.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}

// ---------- time mode control: single time / time range / anytime (no time) ----------
function TimeModeControl({ mode, setMode, time, setTime, endTime, setEndTime }) {
  const btn = (m, label) => (
    <button type="button" onClick={() => setMode(m)}
      className="px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{ background: mode === m ? COLORS.dusk : COLORS.mistDeep, color: mode === m ? '#fff' : COLORS.slate }}>
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5 flex-wrap">
        {btn('single', 'Single time')}
        {btn('range', 'Time range')}
        {btn('none', 'Anytime')}
      </div>
      {mode === 'single' && <TimeSelect value={time} onChange={setTime} />}
      {mode === 'range' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <TimeSelect value={time} onChange={setTime} />
          <span style={{ color: COLORS.slate }} className="text-xs">to</span>
          <TimeSelect value={endTime} onChange={setEndTime} />
        </div>
      )}
      {mode === 'none' && <p className="text-[11px]" style={{ color: COLORS.slate }}>No fixed time — do it anytime today.</p>}
    </div>
  );
}

// ---------- small illustration for the streak widget ----------
function PeakBadge({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="46" fill="none" stroke={COLORS.mistDeep} strokeWidth="3" />
      <path d="M18 66 L38 34 L50 52 L58 42 L78 66 Z" fill={COLORS.dusk} opacity="0.85" />
      <path d="M38 34 L46 46 L50 52" fill="none" stroke={COLORS.white} strokeWidth="2" opacity="0.5" />
      <circle cx="38" cy="34" r="3" fill={COLORS.dawn} />
      <line x1="38" y1="31" x2="38" y2="20" stroke={COLORS.ink} strokeWidth="1.5" />
      <path d="M38 20 L48 24 L38 28 Z" fill={COLORS.dawn} />
    </svg>
  );
}

// ---------- signature visual: 24-hour Day Ring ----------
function DayRing({ habits, date, isDone, size = 180 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 26;
  const done = habits.filter(h => isDone(date, h.id)).length;
  const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.mistDeep} strokeWidth={9} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.sage} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference - (pct / 100) * circumference}
        transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      {habits.filter(h => !h.noTime).map(h => {
        const [hh, mm] = (h.time || '09:00').split(':').map(Number);
        const frac = (hh * 60 + mm) / 1440;
        const angle = frac * 2 * Math.PI - Math.PI / 2;
        const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
        const d = isDone(date, h.id);
        return <circle key={h.id} cx={x} cy={y} r={6} fill={d ? COLORS.sage : COLORS.white} stroke={d ? COLORS.sage : COLORS.slate} strokeWidth={2} />;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={26} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} fill={COLORS.ink}>{pct}%</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fontFamily="Inter, sans-serif" fill={COLORS.slate}>{done}/{habits.length}</text>
    </svg>
  );
}

function Sparkline({ points, width = 220, height = 60 }) {
  if (points.length === 0) return null;
  const max = 100, min = 0;
  const stepX = width / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / (max - min)) * height;
    return [x, y];
  });
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={COLORS.dusk} opacity="0.12" />
      <path d={path} fill="none" stroke={COLORS.dusk} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r="2.5" fill={COLORS.dusk} />)}
    </svg>
  );
}

// ---------- Dashboard (the main "Today" page, matches the reference layout) ----------
function Dashboard({
  habits, entries, isDone, getValue, setNumericValue, toggleHabit, setTab,
  dashMonth, setDashMonth, profileName, setProfileName,
  monthStats, overallStreak, last7DaysPulse, monthlyFlow, achievements, focusHabit, milestonesToday,
  weeklyGoals, todayProductivity, onSetProductivity, setWeeklyDone, timeFormat,
}) {
  const [editingCell, setEditingCell] = useState(null);
  const [weeklyTimeCell, setWeeklyTimeCell] = useState(null);
  const [pickedStart, setPickedStart] = useState('10:00');
  const [pickedEnd, setPickedEnd] = useState('11:00');
  const [expandedWeeklyId, setExpandedWeeklyId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profileName);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000); // refresh every 30s — plenty for a date/time line
    return () => clearInterval(t);
  }, []);
  const numDays = daysInMonth(dashMonth);
  const first = parseDateStr(dashMonth);
  const dateList = Array.from({ length: numDays }, (_, i) => toDateStr(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  const stats = monthStats(dashMonth);
  const elapsedDays = stats.days.length;
  const dailyHabitsCount = habits.filter(h => h.type !== 'weekly').length;
  const totalPossible = dailyHabitsCount * elapsedDays;
  const missedCount = Math.max(totalPossible - stats.totalDone, 0);
  const streak = overallStreak();
  const pulse = last7DaysPulse();
  const flow = monthlyFlow();
  const wins = achievements();
  const milestones = milestonesToday();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateTimeLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12h' });

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setProfileName(nameDraft.trim() || 'there'); setEditingName(false); } }}
                onBlur={() => { setProfileName(nameDraft.trim() || 'there'); setEditingName(false); }}
                className="px-2 py-1 rounded-lg text-xl font-semibold outline-none" style={{ border: `1px solid ${COLORS.dusk}`, fontFamily: "'Space Grotesk', sans-serif" }} />
            </div>
          ) : (
            <h1 onClick={() => { setNameDraft(profileName); setEditingName(true); }}
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink, cursor: 'pointer' }} className="text-2xl font-semibold tracking-tight">
              {greeting}, {profileName} 👋
            </h1>
          )}
          <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>Small mornings build big momentum.</p>
          <p className="text-xs mt-1 font-mono" style={{ color: COLORS.dusk }}>{dateTimeLabel}</p>
        </div>
        <button type="button" onClick={() => setTab('habits')} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium shrink-0" style={{ background: COLORS.dusk, color: '#fff' }}>
          <Plus size={16} /> Add Habit
        </button>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
          <MiniRing pct={stats.avg} />
          <div><div className="text-lg font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.avg}%</div><div className="text-[11px]" style={{ color: COLORS.slate }}>Monthly progress</div></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: '#FDF0E4' }}><Flame size={18} color={COLORS.dawn} /></div>
          <div><div className="text-lg font-semibold font-mono" style={{ color: COLORS.ink }}>{streak}</div><div className="text-[11px]" style={{ color: COLORS.slate }}>Day streak</div></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: '#EAF6F1' }}><Check size={18} color={COLORS.sage} /></div>
          <div><div className="text-lg font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.totalDone}</div><div className="text-[11px]" style={{ color: COLORS.slate }}>Completed</div></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: '#FBEAEA' }}><X size={18} color={COLORS.rose} /></div>
          <div><div className="text-lg font-semibold font-mono" style={{ color: COLORS.ink }}>{missedCount}</div><div className="text-[11px]" style={{ color: COLORS.slate }}>Missed</div></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* main column */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* month grid */}
          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">{formatMonthLabel(dashMonth)}</div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setDashMonth(addMonths(dashMonth, -1))} className="p-1.5 rounded-full hover:bg-black/5"><ChevronLeft size={16} color={COLORS.ink} /></button>
                <button type="button" onClick={() => setDashMonth(addMonths(dashMonth, 1))} className="p-1.5 rounded-full hover:bg-black/5"><ChevronRight size={16} color={COLORS.ink} /></button>
              </div>
            </div>

            {habits.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: COLORS.slate }}>No habits yet — add one to see your grid here.</p>
            ) : (
              <div className="overflow-x-auto">
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 px-2 py-1 text-left" style={{ background: COLORS.white, minWidth: 140 }} />
                      {dateList.map(d => {
                        const dd = parseDateStr(d);
                        const isToday = d === todayStr();
                        return (
                          <th key={d} className="px-1 pb-1 text-center" style={{ minWidth: 30 }}>
                            <div className="text-[9px]" style={{ color: COLORS.slate }}>{WEEKDAY_SHORT[dd.getDay()][0]}</div>
                            <div className="text-[11px] font-mono font-medium" style={{ color: isToday ? COLORS.dusk : COLORS.ink }}>{dd.getDate()}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {habits.map(h => (
                      <tr key={h.id}>
                        <td className="sticky left-0 z-10 pr-3 py-1.5" style={{ background: COLORS.white }}>
                          <div className="flex flex-col whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: COLORS.ink }}>
                              {h.type === 'weekly' ? <Bell size={11} color={COLORS.slate} /> : h.type === 'numeric' ? (h.goal ? <Target size={11} color={COLORS.slate} /> : <Hash size={11} color={COLORS.slate} />) : <CheckSquare size={11} color={COLORS.slate} />}
                              {h.name}
                            </span>
                            <span className="text-[10px] font-mono pl-4" style={{ color: COLORS.slate }}>{h.type === 'weekly' ? `${h.weeklyGoal}x/week` : formatHabitTime(h, timeFormat)}</span>
                          </div>
                        </td>
                        {dateList.map(d => {
                          const done = isDone(d, h.id);
                          const missed = !done && d < todayStr() && (!h.createdAt || d >= h.createdAt);
                          if (h.type === 'numeric') {
                            const editing = editingCell && editingCell.date === d && editingCell.habitId === h.id;
                            const val = getValue(d, h.id);
                            return (
                              <td key={d} className="px-1 py-1 text-center">
                                {editing ? (
                                  <input autoFocus type="number" defaultValue={val}
                                    onBlur={e => { setNumericValue(d, h.id, e.target.value); setEditingCell(null); }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                    className="w-9 text-center text-[10px] font-mono rounded outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
                                ) : (
                                  <button type="button" onClick={() => setEditingCell({ date: d, habitId: h.id })}
                                    className="flex items-center justify-center mx-auto rounded-full" style={{ width: 22, height: 22, background: done ? COLORS.dusk : missed ? '#FBEAEA' : COLORS.mistDeep }}>
                                    {missed && val === '' ? <X size={11} color={COLORS.rose} strokeWidth={3} /> : <span className="text-[9px] font-mono" style={{ color: done ? '#fff' : COLORS.slate }}>{val !== '' ? val : ''}</span>}
                                  </button>
                                )}
                              </td>
                            );
                          }
                          if (h.type === 'weekly') {
                            const val = getValue(d, h.id);
                            return (
                              <td key={d} className="px-1 py-1 text-center">
                                <button type="button"
                                  onClick={() => done ? toggleHabit(d, h.id) : (setPickedStart('10:00'), setPickedEnd('11:00'), setWeeklyTimeCell({ date: d, habitId: h.id }))}
                                  className="flex items-center justify-center mx-auto rounded-full" style={{ width: 22, height: 22, background: done ? COLORS.dusk : missed ? '#FBEAEA' : COLORS.mistDeep }}
                                  title={done && typeof val === 'string' ? `Done at ${formatTimeRange(val, timeFormat)}` : undefined}>
                                  {done && <Check size={12} color="#fff" strokeWidth={3} />}
                                  {missed && <X size={11} color={COLORS.rose} strokeWidth={3} />}
                                </button>
                              </td>
                            );
                          }
                          return (
                            <td key={d} className="px-1 py-1 text-center">
                              <button type="button" onClick={() => toggleHabit(d, h.id)}
                                className="flex items-center justify-center mx-auto rounded-full" style={{ width: 22, height: 22, background: done ? COLORS.dusk : missed ? '#FBEAEA' : COLORS.mistDeep }}>
                                {done && <Check size={12} color="#fff" strokeWidth={3} />}
                                {missed && <X size={11} color={COLORS.rose} strokeWidth={3} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-center text-xs mt-3" style={{ color: COLORS.slate }}>Click on any day to toggle completion</p>
          </div>

          {/* monthly flow */}
          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-0.5">Monthly Flow</div>
            <p className="text-xs mb-3" style={{ color: COLORS.slate }}>Your consistency over the last few months</p>
            <div className="flex items-end gap-4 overflow-x-auto">
              {flow.months.map((m, mi) => (
                <div key={mi} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="flex flex-col gap-1">
                    {m.weeks.map((w, wi) => (
                      <div key={wi} className="rounded-full" style={{ width: 10, height: 10, background: BUCKET_COLORS[w] }} />
                    ))}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: m.label === formatMonthShort(dashMonth) ? COLORS.dusk : COLORS.slate, fontWeight: m.label === formatMonthShort(dashMonth) ? 700 : 400 }}>{m.label}</div>
                </div>
              ))}
              <div className="flex flex-col gap-1 ml-2 pl-3 shrink-0" style={{ borderLeft: `1px solid ${COLORS.mistDeep}` }}>
                {['Perfect', 'Great', 'Good', 'Low', 'None'].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="rounded-full" style={{ width: 8, height: 8, background: BUCKET_COLORS[4 - i] }} />
                    <span className="text-[10px]" style={{ color: COLORS.slate }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* wins */}
          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-3">Wins this month</div>
            {wins.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.slate }}>Keep going — your first win will show up here.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {wins.map((w, i) => (
                  <div key={i} className="flex flex-col items-center text-center gap-1.5 rounded-xl py-4 px-2" style={{ background: COLORS.mist }}>
                    <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: COLORS.white }}>{w.icon}</div>
                    <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{w.title}</div>
                    <div className="text-[11px]" style={{ color: COLORS.slate }}>{w.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right widgets */}
        <div className="w-full lg:w-72 flex flex-col gap-5 shrink-0">
          <DayCheckIn productivity={todayProductivity} onSetProductivity={onSetProductivity} />

          <div className="rounded-2xl p-4 flex flex-col items-center gap-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold self-start">Current Streak</div>
            <PeakBadge />
            <div className="text-center">
              <div className="text-2xl font-semibold font-mono" style={{ color: COLORS.ink }}>{streak} <span className="text-sm font-sans font-normal" style={{ color: COLORS.slate }}>Days</span></div>
              <div className="text-xs" style={{ color: COLORS.dawn }}>Keep it up! 🔥</div>
            </div>
            <div className="flex gap-1.5">
              {pulse.slice(-7).map((p, i) => (
                <div key={i} className="rounded-full" style={{ width: 8, height: 8, background: p.pct > 0 ? COLORS.dusk : COLORS.mistDeep }} title={p.date} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-2">Weekly Pulse</div>
            <Sparkline points={pulse.map(p => p.pct)} />
          </div>

          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Target size={15} color={COLORS.dusk} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">Milestones</div>
            </div>
            {milestones.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.slate }}>Add a number habit with a daily goal (like "30 push-ups" or "3 litres water") to see today's targets here.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {milestones.map(m => (
                  <div key={m.habit.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: COLORS.ink }} className="font-medium">{m.habit.name}</span>
                      <span className="font-mono" style={{ color: COLORS.slate }}>{m.val}/{m.habit.goal} {m.habit.unit}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.mistDeep }}>
                      <div style={{ width: `${m.pct}%`, background: m.pct >= 100 ? COLORS.sage : COLORS.dusk, height: '100%', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Bell size={15} color={COLORS.dusk} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">Weekly Goals</div>
            </div>
            {weeklyGoals.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.slate }}>Add a weekly task (like "Meditation, 3x/week") to track it here.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {weeklyGoals.map(w => {
                  const expanded = expandedWeeklyId === w.habit.id;
                  return (
                  <div key={w.habit.id}>
                    <button type="button" onClick={() => setExpandedWeeklyId(expanded ? null : w.habit.id)} className="w-full text-left">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: COLORS.ink }} className="font-medium">{w.habit.name}</span>
                        <span className="font-mono" style={{ color: COLORS.slate }}>{w.done}/{w.goal} this week</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.mistDeep }}>
                        <div style={{ width: `${w.pct}%`, background: w.pct >= 100 ? COLORS.sage : COLORS.dusk, height: '100%', transition: 'width 0.4s ease' }} />
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-2 pt-2 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${COLORS.mistDeep}` }}>
                        {w.habit.description && <p className="text-[11px] mb-0.5" style={{ color: COLORS.slate }}>{w.habit.description}</p>}
                        {w.history.length === 0 ? (
                          <p className="text-[11px]" style={{ color: COLORS.slate }}>Not marked done yet — tap a day in the month grid to log it.</p>
                        ) : (
                          w.history.map(entry => {
                            const dd = parseDateStr(entry.date);
                            return (
                              <div key={entry.date} className="flex items-center justify-between text-[11px]">
                                <span style={{ color: entry.date === todayStr() ? COLORS.dusk : COLORS.ink }}>{WEEKDAY_SHORT[dd.getDay()]}, {formatMonthShort(entry.date)} {dd.getDate()}</span>
                                <span className="flex items-center gap-1 font-mono" style={{ color: COLORS.sage }}><Check size={11} strokeWidth={3} /> {typeof entry.value === 'string' ? formatTimeRange(entry.value, timeFormat) : 'Done'}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-2">Focus Habit</div>
            {focusHabit ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: '#EAF6F1' }}>
                  {focusHabit.habit.type === 'numeric' ? (focusHabit.habit.goal ? <Target size={18} color={COLORS.sage} /> : <Hash size={18} color={COLORS.sage} />) : <CheckSquare size={18} color={COLORS.sage} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{focusHabit.habit.name}</div>
                  <div className="text-xs" style={{ color: COLORS.slate }}>{focusHabit.pct}% this month</div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: COLORS.mistDeep }}>
                    <div style={{ width: `${focusHabit.pct}%`, background: COLORS.sage, height: '100%' }} />
                  </div>
                </div>
              </div>
            ) : <p className="text-sm" style={{ color: COLORS.slate }}>Add a habit to see your focus area.</p>}
          </div>
        </div>
      </div>

      {weeklyTimeCell && (() => {
        const h = habits.find(x => x.id === weeklyTimeCell.habitId);
        if (!h) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(30,34,53,0.35)' }}
            onClick={() => setWeeklyTimeCell(null)}>
            <div onClick={e => e.stopPropagation()} className="rounded-2xl p-5 w-full max-w-xs flex flex-col gap-3" style={{ background: COLORS.white }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">{h.name}</div>
                <div className="text-xs" style={{ color: COLORS.slate }}>{formatDisplay(weeklyTimeCell.date)}</div>
              </div>
              <div className="text-xs" style={{ color: COLORS.slate }}>What time did you do it?</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <TimeSelect value={pickedStart} onChange={setPickedStart} />
                <span style={{ color: COLORS.slate }} className="text-xs">to</span>
                <TimeSelect value={pickedEnd} onChange={setPickedEnd} />
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setWeeklyTimeCell(null)} className="flex-1 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: COLORS.mistDeep, color: COLORS.slate }}>Cancel</button>
                <button type="button" onClick={() => { setWeeklyDone(weeklyTimeCell.date, weeklyTimeCell.habitId, `${pickedStart}–${pickedEnd}`); setWeeklyTimeCell(null); }}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: COLORS.dusk, color: '#fff' }}>Mark Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function DayCheckIn({ productivity, onSetProductivity }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-3">Today's Check-in</div>
      <div>
        <div className="text-xs mb-1.5" style={{ color: COLORS.slate }}>Productivity</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button type="button" key={n} onClick={() => onSetProductivity(n === productivity ? undefined : n)}>
              <Star size={22} color={n <= (productivity || 0) ? COLORS.dawn : COLORS.mistDeep} fill={n <= (productivity || 0) ? COLORS.dawn : 'none'} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniRing({ pct, size = 40 }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.mistDeep} strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.dusk} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function CalendarView({ habits, isDone, completionPct, calMonth, setCalMonth, calHabit, setCalHabit }) {
  const numDays = daysInMonth(calMonth);
  const first = parseDateStr(calMonth);
  const firstWeekdayMon = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWeekdayMon; i++) cells.push(null);
  for (let d = 1; d <= numDays; d++) cells.push(toDateStr(new Date(first.getFullYear(), first.getMonth(), d)));
  while (cells.length % 7 !== 0) cells.push(null);
  function valueFor(date) { return calHabit === 'all' ? completionPct(date) : (isDone(date, calHabit) ? 100 : 0); }
  function cellColor(date) {
    if (!date) return 'transparent';
    const v = valueFor(date);
    if (v === 0) return COLORS.mistDeep;
    return lerpColor(COLORS.mistDeep, COLORS.sage, v / 100);
  }
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => setCalMonth(addMonths(calMonth, -1))} className="p-2 rounded-full hover:bg-black/5"><ChevronLeft size={18} color={COLORS.ink} /></button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold text-sm">{formatMonthLabel(calMonth)}</div>
        <button type="button" onClick={() => setCalMonth(addMonths(calMonth, 1))} className="p-2 rounded-full hover:bg-black/5"><ChevronRight size={18} color={COLORS.ink} /></button>
      </div>
      <select value={calHabit} onChange={e => setCalHabit(e.target.value)} className="text-sm px-3 py-1.5 rounded-full" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink, background: COLORS.white }}>
        <option value="all">All habits (avg)</option>
        {habits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
      <div className="grid grid-cols-7 gap-1.5 w-full">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="text-center text-[11px]" style={{ color: COLORS.slate }}>{d}</div>)}
        {cells.map((date, i) => (
          <div key={i} title={date ? `${date}: ${valueFor(date)}%` : ''} className="aspect-square rounded-md"
            style={{ background: cellColor(date), border: date === todayStr() ? `2px solid ${COLORS.dusk}` : 'none' }} />
        ))}
      </div>
    </div>
  );
}

function StatsView({ habits, computeStreaks, monthStats, weeklySummaries, perHabitMonthProgress, statsMonth, setStatsMonth, dayMeta }) {
  const stats = monthStats(statsMonth);
  const weeks = weeklySummaries(stats.days, habits);
  const last7 = generateRange(addDays(todayStr(), -6), todayStr());
  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={() => setStatsMonth(addMonths(statsMonth, -1))} className="p-2 rounded-full hover:bg-black/5"><ChevronLeft size={18} color={COLORS.ink} /></button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold text-sm">{formatMonthLabel(statsMonth)}</div>
        <button type="button" onClick={() => setStatsMonth(addMonths(statsMonth, 1))} className="p-2 rounded-full hover:bg-black/5"><ChevronRight size={18} color={COLORS.ink} /></button>
      </div>
      <div className="rounded-2xl p-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold mb-3">Productivity — Last 7 Days</div>
        <div className="flex justify-between gap-1">
          {last7.map(d => {
            const meta = dayMeta[d] || {};
            const dd = parseDateStr(d);
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className="text-[10px]" style={{ color: d === todayStr() ? COLORS.dusk : COLORS.slate }}>{WEEKDAY_SHORT[dd.getDay()][0]}</span>
                <span className="text-[10px] font-mono" style={{ color: COLORS.slate }}>{meta.productivity ? `★${meta.productivity}` : '—'}</span>
              </div>
            );
          })}
        </div>
      </div>
      {habits.length === 0 ? (
        <p className="text-sm text-center" style={{ color: COLORS.slate }}>Add habits to see stats here.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {habits.map(h => {
              const s = computeStreaks(h);
              const prog = perHabitMonthProgress(h, statsMonth);
              return (
                <div key={h.id} className="flex flex-col gap-2 px-4 py-3 rounded-2xl" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: COLORS.ink }} className="text-sm font-medium">{h.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-sm font-mono" style={{ color: s.current > 0 ? COLORS.dawn : COLORS.slate }}><Flame size={15} />{s.current}</span>
                      <span className="flex items-center gap-1 text-sm font-mono" style={{ color: COLORS.dusk }}><Trophy size={15} />{s.longest}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.mistDeep }}>
                      <div style={{ width: `${prog.pct}%`, background: COLORS.sage, height: '100%', transition: 'width 0.4s ease' }} />
                    </div>
                    <span className="text-[11px] font-mono shrink-0" style={{ color: COLORS.slate }}>{prog.done}/{prog.total} days</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.avg}%</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Avg completion</div>
            </div>
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.totalDone}</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Total done</div>
            </div>
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.bestDay ? stats.bestDay.pct + '%' : '—'}</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Best day</div>
            </div>
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.sage }}>{stats.activeDays}</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Active days</div>
            </div>
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.rose }}>{stats.missedDays}</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Missed days</div>
            </div>
            <div className="rounded-2xl py-3" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
              <div className="text-xl font-semibold font-mono" style={{ color: COLORS.ink }}>{stats.worstDay ? stats.worstDay.pct + '%' : '—'}</div>
              <div className="text-[11px]" style={{ color: COLORS.slate }}>Worst day</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {weeks.map((w, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
                <span className="text-sm" style={{ color: COLORS.ink }}>{w.label}</span>
                <span className="text-sm font-mono" style={{ color: COLORS.slate }}>{w.avg}% · {w.totalDone} done</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HabitsView({
  habits, addHabit, removeHabit, renameHabit, updateHabitMeta, moveHabit,
  newName, setNewName, newTimeMode, setNewTimeMode, newTime, setNewTime, newEndTime, setNewEndTime,
  newType, setNewType, newUnit, setNewUnit, newGoal, setNewGoal, newWeeklyGoal, setNewWeeklyGoal,
  newDescription, setNewDescription,
  editingId, setEditingId, editName, setEditName,
  editTimeMode, setEditTimeMode, editTime, setEditTime, editEndTime, setEditEndTime,
  editUnit, setEditUnit, editGoal, setEditGoal, editWeeklyGoal, setEditWeeklyGoal,
  editDescription, setEditDescription, timeFormat,
}) {
  function handleAdd() {
    if (!newName.trim()) return;
    if (newType === 'milestone' && !String(newGoal).trim()) return; // milestones require a goal
    addHabit({
      name: newName, timeMode: newTimeMode, time: newTime, endTime: newEndTime,
      type: newType === 'milestone' ? 'numeric' : newType, unit: newUnit, goal: newGoal, weeklyGoal: newWeeklyGoal,
      description: newDescription,
    });
    setNewName(''); setNewTimeMode('single'); setNewTime('09:00'); setNewEndTime('10:00');
    setNewType('boolean'); setNewUnit(''); setNewGoal(''); setNewWeeklyGoal(3); setNewDescription('');
  }
  const needsGoalWarning = newType === 'milestone' && !String(newGoal).trim();
  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2 p-3 rounded-2xl" style={{ border: `1px solid ${COLORS.mistDeep}`, background: COLORS.white }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="New habit name" className="px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setNewType('boolean')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: newType === 'boolean' ? COLORS.dusk : COLORS.mistDeep, color: newType === 'boolean' ? '#fff' : COLORS.slate }}><CheckSquare size={13} /> Habit</button>
          <button type="button" onClick={() => setNewType('numeric')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: newType === 'numeric' ? COLORS.dusk : COLORS.mistDeep, color: newType === 'numeric' ? '#fff' : COLORS.slate }}><Hash size={13} /> Number</button>
          <button type="button" onClick={() => setNewType('milestone')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: newType === 'milestone' ? COLORS.dusk : COLORS.mistDeep, color: newType === 'milestone' ? '#fff' : COLORS.slate }}><Target size={13} /> Milestone</button>
          <button type="button" onClick={() => setNewType('weekly')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: newType === 'weekly' ? COLORS.dusk : COLORS.mistDeep, color: newType === 'weekly' ? '#fff' : COLORS.slate }}><Bell size={13} /> Weekly</button>
        </div>
        {newType === 'weekly' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: COLORS.slate }}>Times per week</span>
              <input type="number" min="1" max="7" value={newWeeklyGoal} onChange={e => setNewWeeklyGoal(e.target.value)}
                className="w-20 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
            </div>
            <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Short description (optional)"
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
          </div>
        ) : (
          <TimeModeControl mode={newTimeMode} setMode={setNewTimeMode} time={newTime} setTime={setNewTime} endTime={newEndTime} setEndTime={setNewEndTime} />
        )}
        {(newType === 'numeric' || newType === 'milestone') && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="Unit (e.g. glasses, hours)" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
              <input type="number" value={newGoal} onChange={e => setNewGoal(e.target.value)}
                placeholder={newType === 'milestone' ? 'Daily goal (required)' : 'Daily goal (optional)'}
                className="w-36 px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${needsGoalWarning ? COLORS.rose : COLORS.mistDeep}`, color: COLORS.ink }} />
            </div>
            {newType === 'milestone' && <p className="text-[11px]" style={{ color: COLORS.slate }}>Milestones need a daily goal, e.g. "30 push-ups" or "3 litres water" — they'll show up in the Milestones widget on your dashboard. Pick "Anytime" above if it has no fixed time.</p>}
          </div>
        )}
        {newType === 'weekly' && <p className="text-[11px]" style={{ color: COLORS.slate }}>Weekly tasks (like meditation trips) can be checked off on any day — progress shows in the Weekly Goals widget.</p>}
        <button type="button" onClick={handleAdd} disabled={needsGoalWarning} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40" style={{ background: COLORS.dusk, color: '#fff' }}><Plus size={16} /> Add</button>
      </div>
      {habits.length === 0 && <p className="text-sm text-center py-2" style={{ color: COLORS.slate }}>Nothing here yet — add your first habit or milestone above.</p>}
      <div className="flex flex-col gap-2">
        {habits.map((h, i) => {
          const Icon = h.type === 'weekly' ? Bell : h.type !== 'numeric' ? CheckSquare : (h.goal ? Target : Hash);
          return (
          <div key={h.id} className="flex flex-col gap-2 px-3 py-2.5 rounded-xl" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
            <div className="flex items-center gap-2">
              <div className="flex flex-col shrink-0">
                <button type="button" disabled={i === 0} onClick={() => moveHabit(h.id, -1)} className="disabled:opacity-20"><ArrowUp size={13} color={COLORS.slate} /></button>
                <button type="button" disabled={i === habits.length - 1} onClick={() => moveHabit(h.id, 1)} className="disabled:opacity-20"><ArrowDown size={13} color={COLORS.slate} /></button>
              </div>
              {editingId === h.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
                  <button type="button" onClick={() => {
                    renameHabit(h.id, editName);
                    updateHabitMeta(h.id, { timeMode: editTimeMode, time: editTime, endTime: editEndTime, unit: editUnit, goal: editGoal, weeklyGoal: editWeeklyGoal, description: editDescription });
                    setEditingId(null);
                  }} className="p-1.5 rounded-lg shrink-0" style={{ background: COLORS.sage }}><Check size={14} color="#fff" /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-1.5 shrink-0"><X size={14} color={COLORS.slate} /></button>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 flex-1 text-sm" style={{ color: COLORS.ink }}>
                    <Icon size={12} color={COLORS.slate} />{h.name}
                  </span>
                  <span className="text-xs font-mono" style={{ color: COLORS.slate }}>{h.type === 'weekly' ? `${h.weeklyGoal}x/week` : formatHabitTime(h, timeFormat)}</span>
                  <button type="button" onClick={() => {
                    setEditingId(h.id); setEditName(h.name);
                    setEditTimeMode(h.noTime ? 'none' : h.endTime ? 'range' : 'single');
                    setEditTime(h.time || '09:00'); setEditEndTime(h.endTime || '10:00');
                    setEditUnit(h.unit || ''); setEditGoal(h.goal || ''); setEditWeeklyGoal(h.weeklyGoal || 3); setEditDescription(h.description || '');
                  }} className="p-1.5 shrink-0"><Pencil size={14} color={COLORS.slate} /></button>
                  <button type="button" onClick={() => removeHabit(h.id)} className="p-1.5 shrink-0"><Trash2 size={14} color={COLORS.slate} /></button>
                </>
              )}
            </div>
            {editingId === h.id && h.type !== 'weekly' && (
              <div className="pl-6">
                <TimeModeControl mode={editTimeMode} setMode={setEditTimeMode} time={editTime} setTime={setEditTime} endTime={editEndTime} setEndTime={setEditEndTime} />
              </div>
            )}
            {editingId === h.id && h.type === 'numeric' && (
              <div className="flex gap-2 pl-6">
                <input value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="Unit" className="flex-1 px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
                <input type="number" value={editGoal} onChange={e => setEditGoal(e.target.value)} placeholder="Daily goal" className="w-28 px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
              </div>
            )}
            {editingId === h.id && h.type === 'weekly' && (
              <div className="flex flex-col gap-2 pl-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: COLORS.slate }}>Times per week</span>
                  <input type="number" min="1" max="7" value={editWeeklyGoal} onChange={e => setEditWeeklyGoal(e.target.value)} className="w-20 px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
                </div>
                <input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Short description (optional)" className="px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.dusk}` }} />
              </div>
            )}
            {editingId !== h.id && h.type === 'numeric' && (
              <div className="pl-6 text-[11px]" style={{ color: COLORS.slate }}>{h.goal ? 'Milestone · ' : ''}{h.unit || 'units'}{h.goal ? ` · goal: ${h.goal}` : ''}</div>
            )}
            {editingId !== h.id && h.type === 'weekly' && (
              <div className="pl-6 text-[11px]" style={{ color: COLORS.slate }}>Weekly · {h.weeklyGoal}x per week{h.description ? ` — ${h.description}` : ''}</div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- settings: theme + time format ----------
function SettingsView({ theme, setTheme, timeFormat, setTimeFormat }) {
  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Sun size={15} color={COLORS.dusk} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">Appearance</div>
        </div>
        <p className="text-xs mb-1" style={{ color: COLORS.slate }}>Choose how Daybreak looks on this and every device you log into.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTheme('light')}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: theme === 'light' ? COLORS.dusk : COLORS.mistDeep, color: theme === 'light' ? '#fff' : COLORS.slate }}>
            <Sun size={15} /> Light
          </button>
          <button type="button" onClick={() => setTheme('dark')}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: theme === 'dark' ? COLORS.dusk : COLORS.mistDeep, color: theme === 'dark' ? '#fff' : COLORS.slate }}>
            <Moon size={15} /> Dark
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Clock size={15} color={COLORS.dusk} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="font-semibold">Time Format</div>
        </div>
        <p className="text-xs mb-1" style={{ color: COLORS.slate }}>Controls how times are shown around the app (the picker when adding or editing a habit's time always uses 24-hour).</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTimeFormat('24h')}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: timeFormat === '24h' ? COLORS.dusk : COLORS.mistDeep, color: timeFormat === '24h' ? '#fff' : COLORS.slate }}>
            24-hour <span className="font-mono opacity-80">(14:30)</span>
          </button>
          <button type="button" onClick={() => setTimeFormat('12h')}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: timeFormat === '12h' ? COLORS.dusk : COLORS.mistDeep, color: timeFormat === '12h' ? '#fff' : COLORS.slate }}>
            12-hour <span className="font-mono opacity-80">(2:30 PM)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- login screen: guest / Google / email+password ----------
function AuthGate() {
  const [mode, setMode] = useState('start'); // 'start' | 'email-signin' | 'email-signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleGoogle() {
    setError(''); setBusy(true);
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setError(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  }
  async function handleGuest() {
    setError(''); setBusy(true);
    try { await signInAnonymously(auth); }
    catch (e) { setError(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  }
  async function handleEmail(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (mode === 'email-signup') await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) { setError(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-4" style={{ background: COLORS.mist, fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: COLORS.white, border: `1px solid ${COLORS.mistDeep}` }}>
        <div className="flex items-center gap-2 justify-center mb-1">
          <Sun size={22} color={COLORS.dusk} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="text-xl font-semibold">Daybreak</span>
        </div>
        <p className="text-sm text-center" style={{ color: COLORS.slate }}>Sign in to sync your habits everywhere, or continue as a guest.</p>

        {mode === 'start' && (
          <div className="flex flex-col gap-2">
            <button type="button" disabled={busy} onClick={handleGoogle} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }}>
              <Mail size={16} /> Continue with Google
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('email-signin')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }}>
              <Mail size={16} /> Continue with Email
            </button>
            <button type="button" disabled={busy} onClick={handleGuest} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: COLORS.dusk, color: '#fff' }}>
              <UserIcon size={16} /> Continue as Guest
            </button>
            <p className="text-[10px] text-center mt-1" style={{ color: COLORS.slate }}>Guest data stays on this device only. Sign in with Google or Email to sync across devices.</p>
          </div>
        )}

        {(mode === 'email-signin' || mode === 'email-signup') && (
          <form onSubmit={handleEmail} className="flex flex-col gap-2">
            <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 6 characters)"
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ border: `1px solid ${COLORS.mistDeep}`, color: COLORS.ink }} />
            <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: COLORS.dusk, color: '#fff' }}>
              {mode === 'email-signup' ? 'Create account' : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setMode(mode === 'email-signup' ? 'email-signin' : 'email-signup'); setError(''); }} className="text-xs" style={{ color: COLORS.dusk }}>
              {mode === 'email-signup' ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
            <button type="button" onClick={() => { setMode('start'); setError(''); }} className="text-xs" style={{ color: COLORS.slate }}>← Back</button>
          </form>
        )}

        {error && <p className="text-xs text-center" style={{ color: COLORS.rose }}>{error}</p>}
      </div>
    </div>
  );
}

export default function DaybreakApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [habits, setHabits] = useState([]);
  const [entries, setEntries] = useState({});
  const [dayMeta, setDayMeta] = useState({});
  const [theme, setTheme] = useState('light');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [profileName, setProfileName] = useState('there');
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [dashMonth, setDashMonth] = useState(monthStart(todayStr()));
  const [calMonth, setCalMonth] = useState(monthStart(todayStr()));
  const [calHabit, setCalHabit] = useState('all');
  const [statsMonth, setStatsMonth] = useState(monthStart(todayStr()));

  const [newName, setNewName] = useState('');
  const [newTimeMode, setNewTimeMode] = useState('single');
  const [newTime, setNewTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newType, setNewType] = useState('boolean');
  const [newUnit, setNewUnit] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newWeeklyGoal, setNewWeeklyGoal] = useState(3);
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTimeMode, setEditTimeMode] = useState('single');
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('10:00');
  const [editUnit, setEditUnit] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editWeeklyGoal, setEditWeeklyGoal] = useState(3);
  const [editDescription, setEditDescription] = useState('');

  const saveTimer = useRef(null);
  const pendingWrite = useRef(false); // true while a local edit is queued or being saved
  const [syncError, setSyncError] = useState('');

  const [syncingNow, setSyncingNow] = useState(false);

  function applySnapshot(snap, u) {
    if (snap.exists()) {
      const parsed = snap.data();
      setHabits(parsed.habits || []);
      setEntries(parsed.entries || {});
      setDayMeta(parsed.dayMeta || {});
      setProfileName(parsed.profileName || (u.displayName ? u.displayName.split(' ')[0] : 'there'));
      setTheme(parsed.theme || 'light');
      setTimeFormat(parsed.timeFormat || '24h');
    } else {
      setProfileName(u.displayName ? u.displayName.split(' ')[0] : 'there');
    }
  }

  // watch auth state (guest / Google / email)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
      if (!u) { setHabits([]); setEntries({}); setDayMeta({}); setProfileName('there'); setTheme('light'); setTimeFormat('24h'); setLoaded(false); setSyncError(''); }
    });
    return unsub;
  }, []);

  // load this user's data from Firestore once on login. (We deliberately don't
  // keep a live listener running — with this app's "overwrite the whole doc"
  // save style, a live listener can race a save that's still in flight and
  // snap a click back to its old value, or bleed into a neighboring day. A
  // plain load-then-save is far more predictable.)
  useEffect(() => {
    if (!user) return;
    setLoaded(false);
    setSyncError('');
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        applySnapshot(snap, user);
      } catch (err) {
        console.error('sync failed', err);
        setSyncError(
          err.code === 'permission-denied'
            ? "Can't sync: Firestore security rules are blocking this account. Check the rules in your Firebase console."
            : `Sync error: ${err.message}`
        );
      }
      setLoaded(true);
    })();
  }, [user]);

  // Manual "Sync now" — the safe, on-demand way to pull in changes made on
  // another device, without the auto-refetch-on-focus race we removed above.
  async function syncNow() {
    if (!user || pendingWrite.current) return;
    setSyncingNow(true);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      applySnapshot(snap, user);
      setSyncError('');
    } catch (err) {
      console.error('manual sync failed', err);
      setSyncError(`Sync error: ${err.message}`);
    }
    setSyncingNow(false);
  }

  // Note: we deliberately do NOT auto-refetch on tab focus/visibility anymore.
  // That created a recurring race: a stray focus/visibility event (even from
  // something as simple as switching windows to take a screenshot) could
  // re-pull the still-old data from Firestore before a very recent local
  // click had finished saving, and silently revert it. A full page refresh
  // already re-loads fresh data safely (see the effect above, keyed on
  // `user`), so that's the supported way to pull in changes made elsewhere.

  // push local changes up to Firestore (debounced ~250ms). The pending save is
  // also flushed immediately if you switch tabs, minimize, or close the page —
  // otherwise a change made right before closing the tab could be lost, since
  // the debounce timer never gets a chance to fire.
  useEffect(() => {
    if (!loaded || !user) return;
    pendingWrite.current = true; // hold off the focus-refresh above until this saves

    async function flush() {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      try {
        // Firestore rejects `undefined` field values (habits have several optional
        // fields like endTime/goal/unit/weeklyGoal/description that are undefined
        // when unused) — this strips them out before saving.
        const payload = JSON.parse(JSON.stringify({ habits, entries, profileName, dayMeta, theme, timeFormat, updatedAt: Date.now() }));
        await setDoc(doc(db, 'users', user.uid), payload);
        setSyncError('');
      } catch (e) {
        console.error('save failed', e);
        setSyncError(
          e.code === 'permission-denied'
            ? "Can't save: Firestore security rules are blocking this account. Check the rules in your Firebase console."
            : `Save error: ${e.message}`
        );
      } finally {
        pendingWrite.current = false;
      }
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 250);

    const onHide = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current) flush();
    };
    const onPageHide = () => { if (saveTimer.current) flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      clearTimeout(saveTimer.current);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [habits, entries, profileName, dayMeta, theme, timeFormat, loaded, user]);

  function setProductivity(date, val) {
    setDayMeta(prev => {
      const next = { ...prev, [date]: { ...(prev[date] || {}), productivity: val } };
      if (val === undefined) delete next[date];
      return next;
    });
  }

  function getHabit(habitId) { return habits.find(h => h.id === habitId); }

  function isDone(date, habitId) {
    const habit = getHabit(habitId);
    if (!habit) return false;
    const val = entries[date] && entries[date][habitId];
    if (habit.type === 'numeric') {
      if (val === undefined || val === null || val === '') return false;
      if (habit.goal) return Number(val) >= Number(habit.goal);
      return Number(val) > 0;
    }
    return !!val;
  }

  function getValue(date, habitId) {
    const v = entries[date] && entries[date][habitId];
    return v === undefined || v === null ? '' : v;
  }

  function toggleHabit(date, habitId) {
    setEntries(prev => {
      const day = { ...(prev[date] || {}) };
      if (day[habitId]) delete day[habitId]; else day[habitId] = true;
      const next = { ...prev };
      if (Object.keys(day).length === 0) delete next[date]; else next[date] = day;
      return next;
    });
  }

  function setNumericValue(date, habitId, rawValue) {
    setEntries(prev => {
      const day = { ...(prev[date] || {}) };
      if (rawValue === '' || rawValue === null || isNaN(Number(rawValue))) delete day[habitId];
      else day[habitId] = Number(rawValue);
      const next = { ...prev };
      if (Object.keys(day).length === 0) delete next[date]; else next[date] = day;
      return next;
    });
  }

  function setWeeklyDone(date, habitId, time) {
    setEntries(prev => {
      const day = { ...(prev[date] || {}) };
      day[habitId] = time || '09:00';
      const next = { ...prev, [date]: day };
      return next;
    });
  }

  function addHabit({ name, timeMode, time, endTime, type, unit, goal, weeklyGoal, description }) {
    const isWeekly = type === 'weekly';
    const noTime = !isWeekly && timeMode === 'none';
    const isRange = !isWeekly && timeMode === 'range';
    const h = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(), type: type || 'boolean',
      time: isWeekly || noTime ? undefined : (time || '09:00'),
      endTime: isRange ? (endTime || '10:00') : undefined,
      noTime: !isWeekly && noTime,
      unit: type === 'numeric' ? ((unit || '').trim() || 'units') : undefined,
      goal: type === 'numeric' && goal !== '' ? Number(goal) : undefined,
      weeklyGoal: isWeekly ? Math.max(1, Number(weeklyGoal) || 1) : undefined,
      description: isWeekly ? (description || '').trim() || undefined : undefined,
      createdAt: todayStr(),
    };
    setHabits(prev => [...prev, h]);
  }
  function removeHabit(id) {
    setHabits(prev => prev.filter(h => h.id !== id));
    setEntries(prev => {
      const next = {};
      Object.keys(prev).forEach(date => {
        const day = { ...prev[date] };
        delete day[id];
        if (Object.keys(day).length) next[date] = day;
      });
      return next;
    });
  }
  function renameHabit(id, name) { setHabits(prev => prev.map(h => h.id === id ? { ...h, name } : h)); }
  function updateHabitMeta(id, meta) {
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const next = { ...h };
      if (h.type === 'weekly') {
        next.weeklyGoal = Math.max(1, Number(meta.weeklyGoal) || 1);
        next.description = (meta.description || '').trim() || undefined;
        next.time = undefined; next.endTime = undefined; next.noTime = false;
      } else if (meta.timeMode === 'none') {
        next.time = undefined; next.endTime = undefined; next.noTime = true;
      } else if (meta.timeMode === 'range') {
        next.time = meta.time || '09:00'; next.endTime = meta.endTime || '10:00'; next.noTime = false;
      } else {
        next.time = meta.time || '09:00'; next.endTime = undefined; next.noTime = false;
      }
      if (h.type === 'numeric') {
        next.unit = (meta.unit || '').trim() || 'units';
        next.goal = meta.goal !== '' && meta.goal !== undefined ? Number(meta.goal) : undefined;
      }
      return next;
    }));
  }
  function moveHabit(id, dir) {
    setHabits(prev => {
      const idx = prev.findIndex(h => h.id === id);
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function computeStreaks(habit) {
    const start = habit.createdAt && habit.createdAt <= todayStr() ? habit.createdAt : todayStr();
    const dates = generateRange(start, todayStr());
    let longest = 0, run = 0;
    dates.forEach(d => { if (isDone(d, habit.id)) { run++; if (run > longest) longest = run; } else run = 0; });
    return { current: run, longest };
  }

  function completionPct(date) {
    const dh = habits.filter(h => h.type !== 'weekly');
    if (dh.length === 0) return 0;
    const done = dh.filter(h => isDone(date, h.id)).length;
    return Math.round((done / dh.length) * 100);
  }

  function weeklyProgress() {
    const start = weekMondayStr(todayStr());
    const end = addDays(start, 6);
    const weekDates = generateRange(start, end);
    return habits.filter(h => h.type === 'weekly').map(h => {
      const done = weekDates.filter(d => isDone(d, h.id)).length;
      const goal = h.weeklyGoal || 1;
      const history = Object.keys(entries)
        .filter(d => entries[d] && entries[d][h.id])
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 12)
        .map(d => ({ date: d, value: entries[d][h.id] }));
      return { habit: h, done, goal, pct: Math.min(100, Math.round((done / goal) * 100)), history };
    });
  }

  function overallStreak() {
    if (habits.length === 0) return 0;
    const earliest = habits.reduce((min, h) => (h.createdAt < min ? h.createdAt : min), todayStr());
    const dates = generateRange(earliest, todayStr());
    let run = 0;
    dates.forEach(d => { if (completionPct(d) > 0) run++; else run = 0; });
    return run;
  }

  function last7DaysPulse() {
    const dates = generateRange(addDays(todayStr(), -6), todayStr());
    return dates.map(d => ({ date: d, pct: completionPct(d) }));
  }

  function perHabitMonthProgress(habit, monthStr) {
    const total = daysInMonth(monthStr);
    const first = parseDateStr(monthStr);
    let done = 0;
    for (let d = 1; d <= total; d++) {
      const dateStr = toDateStr(new Date(first.getFullYear(), first.getMonth(), d));
      if (isDone(dateStr, habit.id)) done++;
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function monthStats(monthStr) {
    const numDays = daysInMonth(monthStr);
    const first = parseDateStr(monthStr);
    const last = new Date(first.getFullYear(), first.getMonth(), numDays);
    const todayD = parseDateStr(todayStr());
    const endDate = last < todayD ? last : todayD;
    const dh = habits.filter(h => h.type !== 'weekly');
    if (endDate < first || dh.length === 0) return { avg: 0, totalDone: 0, bestDay: null, worstDay: null, days: [], activeDays: 0, missedDays: 0 };
    const dates = generateRange(toDateStr(first), toDateStr(endDate));
    let totalDone = 0; let best = null, worst = null;
    const days = dates.map(d => {
      const done = dh.filter(h => isDone(d, h.id)).length;
      const pct = Math.round((done / dh.length) * 100);
      totalDone += done;
      if (!best || pct > best.pct) best = { date: d, pct };
      if (!worst || pct < worst.pct) worst = { date: d, pct };
      return { date: d, pct, done };
    });
    const avg = Math.round(days.reduce((s, x) => s + x.pct, 0) / days.length);
    const activeDays = days.filter(d => d.pct > 0).length;
    const missedDays = days.filter(d => d.pct === 0).length;
    return { avg, totalDone, bestDay: best, worstDay: worst, days, activeDays, missedDays };
  }

  function weeklySummaries(days, habitsList) {
    const blocks = []; let cur = [];
    days.forEach(day => {
      cur.push(day);
      const wd = parseDateStr(day.date).getDay();
      if (wd === 0) { blocks.push(cur); cur = []; }
    });
    if (cur.length) blocks.push(cur);
    const dh = habitsList.filter(h => h.type !== 'weekly');
    return blocks.map((block, i) => {
      const totalPossible = dh.length * block.length;
      const totalDone = block.reduce((s, d) => s + d.done, 0);
      const avg = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;
      return { label: 'Week ' + (i + 1), avg, totalDone };
    });
  }

  function bucketFor(pct) {
    if (pct >= 100) return 4;
    if (pct >= 75) return 3;
    if (pct >= 50) return 2;
    if (pct > 0) return 1;
    return 0;
  }

  function monthlyFlow() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(monthStart(todayStr()), -i);
      const s = monthStats(m);
      const weekBuckets = weeklySummaries(s.days, habits).map(w => bucketFor(w.avg));
      while (weekBuckets.length < 5) weekBuckets.push(0);
      months.push({ label: formatMonthShort(m), weeks: weekBuckets.slice(0, 5) });
    }
    return { months };
  }

  function achievements() {
    if (habits.length === 0) return [];
    const wins = [];
    const streaks = habits.map(h => ({ habit: h, s: computeStreaks(h) })).sort((a, b) => b.s.current - a.s.current);
    if (streaks[0] && streaks[0].s.current >= 3) {
      wins.push({ icon: <Flame size={18} color={COLORS.dawn} />, title: `${streaks[0].s.current} Days`, subtitle: `${streaks[0].habit.name} streak` });
    }
    const stats = monthStats(monthStart(todayStr()));
    const perfectDays = stats.days.filter(d => d.pct === 100).length;
    if (perfectDays > 0) {
      wins.push({ icon: <Star size={18} color={COLORS.dusk} />, title: `${perfectDays} Perfect Day${perfectDays > 1 ? 's' : ''}`, subtitle: 'All habits done' });
    }
    const progresses = habits.map(h => ({ habit: h, p: perHabitMonthProgress(h, monthStart(todayStr())) })).sort((a, b) => b.p.pct - a.p.pct);
    if (progresses[0] && progresses[0].p.pct > 0) {
      wins.push({ icon: <Award size={18} color={COLORS.sage} />, title: progresses[0].habit.name, subtitle: `${progresses[0].p.pct}% this month` });
    }
    return wins.slice(0, 3);
  }

  function focusHabit() {
    if (habits.length === 0) return null;
    const progresses = habits.map(h => ({ habit: h, ...perHabitMonthProgress(h, monthStart(todayStr())) })).sort((a, b) => b.pct - a.pct);
    return progresses[0] || null;
  }

  function milestonesToday() {
    return habits
      .filter(h => h.type === 'numeric' && h.goal)
      .map(h => {
        const raw = getValue(todayStr(), h.id);
        const val = raw === '' ? 0 : Number(raw);
        const pct = Math.min(100, Math.round((val / h.goal) * 100));
        return { habit: h, val, pct };
      });
  }

  // Sync the shared, mutable COLORS object to the current theme before
  // anything renders — see the comment above its declaration for why.
  Object.assign(COLORS, theme === 'dark' ? DARK_COLORS : LIGHT_COLORS);

  if (authLoading) return <div className="w-full min-h-screen flex items-center justify-center text-sm" style={{ background: COLORS.mist, color: COLORS.slate }}>Loading…</div>;
  if (!user) return <AuthGate />;
  if (!loaded) return <div className="p-8 text-center text-sm" style={{ background: COLORS.mist, color: COLORS.slate }}>Loading your habits…</div>;

  const NAV = [
    { id: 'dashboard', label: 'Today', icon: Home },
    { id: 'habits', label: 'Habits', icon: Settings2 },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'stats', label: 'Insights', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ background: COLORS.mist, minHeight: '100%', fontFamily: "'Inter', sans-serif" }} className="w-full flex flex-col lg:flex-row">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${COLORS.dusk}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
        input, select, textarea { background: ${COLORS.white}; color: ${COLORS.ink}; }
        ::placeholder { color: ${COLORS.slate}; opacity: 1; }
        select option { background: ${COLORS.white}; color: ${COLORS.ink}; }
      `}</style>

      {/* left nav */}
      <div className="w-full lg:w-56 shrink-0 flex lg:flex-col items-center lg:items-stretch gap-1 lg:gap-1 px-4 py-3 lg:py-6"
        style={{ background: COLORS.white, borderBottom: `1px solid ${COLORS.mistDeep}` }}>
        <div className="hidden lg:flex items-center gap-2 px-2 mb-6">
          <Sun size={20} color={COLORS.dusk} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", color: COLORS.ink }} className="text-lg font-semibold">Daybreak</span>
        </div>
        <div className="flex lg:flex-col gap-1 flex-1 lg:flex-none justify-center lg:justify-start">
          {NAV.map(n => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button type="button" key={n.id} onClick={() => setTab(n.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium"
                style={{ background: active ? COLORS.mist : 'transparent', color: active ? COLORS.dusk : COLORS.slate }}>
                <Icon size={16} /> <span className="hidden sm:inline">{n.label}</span>
              </button>
            );
          })}
        </div>
        <div className="hidden lg:flex flex-col gap-2 px-2 mt-6 pt-4" style={{ borderTop: `1px solid ${COLORS.mistDeep}` }}>
          <div className="text-xs truncate" style={{ color: COLORS.slate }}>
            {user.isAnonymous ? 'Guest (this device only)' : (user.email || 'Signed in')}
          </div>
          {!user.isAnonymous && (
            <button type="button" onClick={syncNow} disabled={syncingNow} className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50" style={{ color: COLORS.dusk }}>
              <RefreshCw size={13} className={syncingNow ? 'animate-spin' : ''} /> {syncingNow ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          <button type="button" onClick={() => signOut(auth)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: COLORS.rose }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      {/* main content */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 py-6 flex justify-center">
        <div className="w-full" style={{ maxWidth: tab === 'dashboard' ? 1100 : 480 }}>
          {syncError && (
            <div className="mb-4 px-4 py-2.5 rounded-xl text-sm" style={{ background: '#FBEAEA', color: COLORS.rose, border: `1px solid ${COLORS.rose}` }}>
              {syncError}
            </div>
          )}
          {tab === 'dashboard' && (
            <Dashboard
              habits={habits} entries={entries} isDone={isDone} getValue={getValue} setNumericValue={setNumericValue}
              toggleHabit={toggleHabit} setTab={setTab} dashMonth={dashMonth} setDashMonth={setDashMonth}
              profileName={profileName} setProfileName={setProfileName} monthStats={monthStats}
              overallStreak={overallStreak} last7DaysPulse={last7DaysPulse} monthlyFlow={monthlyFlow}
              achievements={achievements} focusHabit={focusHabit()} milestonesToday={milestonesToday}
              weeklyGoals={weeklyProgress()} todayProductivity={(dayMeta[todayStr()] || {}).productivity}
              onSetProductivity={v => setProductivity(todayStr(), v)} setWeeklyDone={setWeeklyDone} timeFormat={timeFormat}
            />
          )}
          {tab === 'calendar' && (
            <CalendarView habits={habits} isDone={isDone} completionPct={completionPct} calMonth={calMonth} setCalMonth={setCalMonth} calHabit={calHabit} setCalHabit={setCalHabit} />
          )}
          {tab === 'stats' && (
            <StatsView habits={habits} computeStreaks={computeStreaks} monthStats={monthStats} weeklySummaries={weeklySummaries} perHabitMonthProgress={perHabitMonthProgress} statsMonth={statsMonth} setStatsMonth={setStatsMonth} dayMeta={dayMeta} />
          )}
          {tab === 'habits' && (
            <HabitsView
              habits={habits} addHabit={addHabit} removeHabit={removeHabit} renameHabit={renameHabit} updateHabitMeta={updateHabitMeta} moveHabit={moveHabit}
              newName={newName} setNewName={setNewName}
              newTimeMode={newTimeMode} setNewTimeMode={setNewTimeMode} newTime={newTime} setNewTime={setNewTime} newEndTime={newEndTime} setNewEndTime={setNewEndTime}
              newType={newType} setNewType={setNewType} newUnit={newUnit} setNewUnit={setNewUnit} newGoal={newGoal} setNewGoal={setNewGoal}
              newWeeklyGoal={newWeeklyGoal} setNewWeeklyGoal={setNewWeeklyGoal}
              newDescription={newDescription} setNewDescription={setNewDescription}
              editingId={editingId} setEditingId={setEditingId} editName={editName} setEditName={setEditName}
              editTimeMode={editTimeMode} setEditTimeMode={setEditTimeMode} editTime={editTime} setEditTime={setEditTime} editEndTime={editEndTime} setEditEndTime={setEditEndTime}
              editUnit={editUnit} setEditUnit={setEditUnit} editGoal={editGoal} setEditGoal={setEditGoal}
              editWeeklyGoal={editWeeklyGoal} setEditWeeklyGoal={setEditWeeklyGoal}
              editDescription={editDescription} setEditDescription={setEditDescription} timeFormat={timeFormat}
            />
          )}
          {tab === 'settings' && (
            <SettingsView theme={theme} setTheme={setTheme} timeFormat={timeFormat} setTimeFormat={setTimeFormat} />
          )}
        </div>
      </div>
    </div>
  );
}
