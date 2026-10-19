// Fórmula de productividad aislada para poder ajustarla sin tocar frontend.
// v1 simple y explicable (0-100). Pesos modificables.
export interface ProductivityInput {
  tasksDone: number;
  tasksTotal: number;
  goalsDone: number;
  goalsTotal: number;
  workHours: number;
  studyHours: number;
  eventsDone: number;
}

export function calcProductivity(i: ProductivityInput): number {
  const taskRate = i.tasksTotal > 0 ? i.tasksDone / i.tasksTotal : 0;
  const goalRate = i.goalsTotal > 0 ? i.goalsDone / i.goalsTotal : 0;
  const hoursScore = Math.min(1, (i.workHours + i.studyHours) / 8);
  const eventsScore = Math.min(1, i.eventsDone / 5);
  const score = taskRate * 0.4 + goalRate * 0.3 + hoursScore * 0.2 + eventsScore * 0.1;
  return Math.round(score * 100);
}
