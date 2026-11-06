// 受保護（src/lib/**）：日期與片長的顯示格式，逐項比照 mysite DisplayTime（app/app/Domain/Content/Support/DisplayTime.php）。
// 資料一律是 UTC；顯示時轉臺北時間。伺服器與瀏覽器用同一套規則，避免 hydration 前後不一致。

const TAIPEI_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function taipeiParts(iso: string): { year: string; month: string; day: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = TAIPEI_DATE.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

/** 「2026年11月6日」（臺北時間）。日期一律用這個函式顯示。 */
export function formatTaipeiDate(iso: string): string {
  const p = taipeiParts(iso);
  return p === null ? '' : `${p.year}年${p.month}月${p.day}日`;
}

function epochMs(iso: string): number {
  return new Date(iso).getTime();
}

/** 修改時間比發布時間晚超過一天時，顯示「更新於」（比照 entry.blade.php）。 */
export function isMeaningfullyUpdated(publishedAt: string, modifiedAt: string): boolean {
  const published = epochMs(publishedAt);
  const modified = epochMs(modifiedAt);
  if (Number.isNaN(published) || Number.isNaN(modified)) return false;
  return modified > published + 24 * 60 * 60 * 1000;
}

/** 片長：1:02:03 或 4:05；沒有或不大於 0 時為 null。 */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 片長的口語說明（螢幕閱讀器）：「1 小時 2 分」「4 分 5 秒」。 */
export function formatDurationSpoken(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} 小時`);
  if (m > 0) parts.push(`${m} 分`);
  if (s > 0 && h === 0) parts.push(`${s} 秒`);
  return parts.join(' ');
}

/** ISO 8601 期間（PT1H2M3S），給 <time datetime>。 */
export function isoDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}${s > 0 ? `${s}S` : ''}`;
}
