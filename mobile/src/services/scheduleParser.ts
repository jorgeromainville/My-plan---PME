// Parser de horarios en español: texto OCR → candidatos (materia, día, inicio, fin).
// Puro TypeScript sin dependencias (se puede probar con tsx). Nada se crea solo:
// la pantalla muestra los candidatos para corregir antes de confirmar.
export interface ScheduleCandidate {
  title: string;
  weekday: number; // 0=Dom … 6=Sáb (como Date.getDay)
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };
function norm(s: string): string {
  return s.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] ?? c);
}

const DAY_TOKS: { wd: number; toks: string[] }[] = [
  { wd: 1, toks: ['lunes', 'lun', 'lu'] },
  { wd: 2, toks: ['martes', 'mar', 'ma'] },
  { wd: 3, toks: ['miercoles', 'mie', 'mi'] },
  { wd: 4, toks: ['jueves', 'jue', 'ju'] },
  { wd: 5, toks: ['viernes', 'vie', 'vi'] },
  { wd: 6, toks: ['sabado', 'sab', 'sa'] },
  { wd: 0, toks: ['domingo', 'dom', 'do'] },
];

const SINGLE: Record<string, number> = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };

function findDays(line: string, nline: string): number[] {
  const found = new Set<number>();
  for (const d of DAY_TOKS) {
    for (const t of d.toks) {
      if (new RegExp(`\\b${t}\\b`).test(nline)) found.add(d.wd);
    }
  }
  // Rango "lunes a viernes" / "lun-vie".
  const tokAlt = DAY_TOKS.flatMap((d) => d.toks).join('|');
  const range = new RegExp(`\\b(${tokAlt})\\b\\s*(?:a|al|-)\\s*\\b(${tokAlt})\\b`);
  const rm = nline.match(range);
  if (rm) {
    const toWd = (t: string) => DAY_TOKS.find((d) => d.toks.includes(t))!.wd;
    let a = toWd(rm[1]);
    const b = toWd(rm[2]);
    while (true) {
      found.add(a);
      if (a === b) break;
      a = (a + 1) % 7;
      if (found.size > 7) break;
    }
  }
  // Letras sueltas "L M X J V" y "MWF".
  if (/\bmwf\b/i.test(line)) [1, 3, 5].forEach((w) => found.add(w));
  const singles = line.match(/\b[LMXJVSD]\b/g);
  if (singles) singles.forEach((s) => found.add(SINGLE[s]));
  return [...found];
}

const TIME_RE =
  /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|—|a|al|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;

function to24(h: number, ampm?: string): number {
  const p = (ampm ?? '').toLowerCase().startsWith('p');
  const a = (ampm ?? '').toLowerCase().startsWith('a');
  if (p && h < 12) return h + 12;
  if (a && h === 12) return 0;
  return h;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseScheduleText(text: string): ScheduleCandidate[] {
  const out: ScheduleCandidate[] = [];
  const tokAlt = DAY_TOKS.flatMap((d) => d.toks).join('|');
  const dayReCI = new RegExp(`\\b(?:${tokAlt}|mwf)\\b`, 'gi');
  const dayReSingle = /\b[LMXJVSD]\b/g; // solo mayúsculas: la "s" de "Inglés" no es sábado

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length < 3) continue;
    const nline = norm(line);
    const days = findDays(line, nline);
    if (days.length === 0) continue;

    const tm = line.match(TIME_RE);
    if (!tm) continue;
    const endAmp = tm[6] ?? tm[3]; // "8-10 pm" vale para ambos
    const sh = to24(Number(tm[1]), tm[3] ?? endAmp);
    const sm = Number(tm[2] ?? '0');
    const eh = to24(Number(tm[4]), endAmp ?? tm[3]);
    const em = Number(tm[5] ?? '0');
    if (sh > 23 || eh > 23 || sm > 59 || em > 59) continue;
    if (eh * 60 + em <= sh * 60 + sm) continue;
    const start = `${pad(sh)}:${pad(sm)}`;
    const end = `${pad(eh)}:${pad(em)}`;

    let title = line.replace(tm[0], ' ').replace(dayReCI, ' ').replace(dayReSingle, ' ');
    title = title.replace(/[-–—:;•|/()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    // Conectores sueltos al inicio/fin ("y Física", "a Tutoría"); los interiores se respetan.
    // Ojo: \b no sirve con tildes (\w es solo ASCII y parte "Tutoría" en dos).
    title = title.replace(/^(y|e|de|del|a|al)(?=[\s\-–—:;•|/()])/i, '').trim();
    title = title.replace(/[\s\-–—:;•|/()](y|e|de|del|a|al)$/i, '').trim();
    title = title.replace(/^[^a-zA-Z0-9áéíóúüñ]+|[^a-zA-Z0-9áéíóúüñ]+$/g, '');
    if (!title) title = 'Clase';
    if (/^(horario|hora|horas|aula|curso|materia|asignatura|hora inicio|hora fin)s?$/i.test(title)) continue;

    for (const weekday of days) out.push({ title, weekday, start, end });
  }
  return out;
}

// Próxima ocurrencia del día de semana, mediodía local (evita corrimientos por zona).
export function nextWeekdayISO(weekday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

// Fin de semestre por defecto: +4 meses.
export function defaultSemesterEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 4);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export const WEEKDAY_SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
