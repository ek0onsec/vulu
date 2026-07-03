/** Convertit des minutes en durée lisible : heures, puis jours, puis mois (30 j). */
export function formatWatchDuration(minutes: number): string {
  const totalHours = Math.floor(minutes / 60);
  if (totalHours < 24) {
    const mins = minutes % 60;
    return mins > 0 ? `${totalHours} h ${mins}` : `${totalHours} h`;
  }
  const totalDays = Math.floor(totalHours / 24);
  if (totalDays < 30) {
    const hours = totalHours % 24;
    return hours > 0 ? `${totalDays} j ${hours} h` : `${totalDays} j`;
  }
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  return days > 0 ? `${months} mois ${days} j` : `${months} mois`;
}
