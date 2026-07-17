export interface MealPlanShare {
  userId: string;
  share: number;
}

const EPSILON = 0.000001;

export function validateShares(shares: MealPlanShare[]): MealPlanShare[] {
  const memberIds = new Set(shares.map(({ userId }) => userId));
  if (memberIds.size !== shares.length) {
    throw new Error("Każdy domownik może wystąpić tylko raz");
  }
  if (shares.some(({ share }) => !Number.isFinite(share) || share <= 0 || share > 1)) {
    throw new Error("Udział musi być większy od 0% i nie większy niż 100%");
  }
  const total = shares.reduce((sum, allocation) => sum + allocation.share, 0);
  if (Math.abs(total - 1) > EPSILON) {
    throw new Error("Suma udziałów musi wynosić 100%");
  }
  return shares;
}

export function equalShares(userIds: string[]): MealPlanShare[] {
  if (userIds.length === 0) throw new Error("Wybierz co najmniej jednego domownika");
  const share = 1 / userIds.length;
  return validateShares(userIds.map((userId) => ({ userId, share })));
}

export function percentageAllocationsToShares(
  allocations: Array<{ userId: string; percentage: number }>,
): MealPlanShare[] {
  return validateShares(
    allocations.map(({ userId, percentage }) => ({ userId, share: percentage / 100 })),
  );
}

export function personalAmount(total: number, share: number): number {
  return total * share;
}
