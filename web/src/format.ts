export function fmt(value: number): string {
  return Math.floor(value).toLocaleString("ru-RU");
}

export function left(until: number, now: number): string {
  const seconds = Math.max(0, Math.floor((until - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}ч ${String(minutes).padStart(2, "0")}м`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function daysLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 86_400_000));
}
