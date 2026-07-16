interface PortionAssignment {
  userId: string;
  servings: number;
}

export function totalAssignedServings(assignments: PortionAssignment[]) {
  return assignments.reduce((sum, assignment) => sum + assignment.servings, 0);
}

export function canSetAssignment(
  entryServings: number,
  assignments: PortionAssignment[],
  userId: string,
  servings: number,
) {
  const otherTotal = assignments
    .filter((assignment) => assignment.userId !== userId)
    .reduce((sum, assignment) => sum + assignment.servings, 0);
  return otherTotal + servings <= entryServings;
}
