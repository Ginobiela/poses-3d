export type SessionPlan = { name: string; blocks: { count: number; seconds: number }[] };
export const gesturePlan: SessionPlan = { name: 'Gesture Drawing', blocks: [{ count: 10, seconds: 30 }, { count: 5, seconds: 60 }, { count: 3, seconds: 120 }, { count: 2, seconds: 300 }] };
export function expandPlan(plan: SessionPlan) { return plan.blocks.flatMap(block => Array<number>(block.count).fill(block.seconds * 1000)); }
