const DAY_MS = 24 * 60 * 60 * 1000;

export function photoStreak(times: string[], now = Date.now()): number {
  const stamps = times.map((time) => Date.parse(time)).filter((time) => !Number.isNaN(time)).sort((a, b) => b - a);
  if (stamps.length === 0 || now - stamps[0] > DAY_MS) return 0;

  const chain = [stamps[0]];
  for (let index = 1; index < stamps.length; index += 1) {
    if (stamps[index - 1] - stamps[index] > DAY_MS) break;
    chain.push(stamps[index]);
  }

  const days = new Set(chain.map(localDayKey));
  return days.size;
}

function localDayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
