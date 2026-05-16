export interface WeightageError {
  rule: string;
  message: string;
}

export function validateWeightage(
  goals: { title: string; weightage: number }[]
): WeightageError[] {
  const errors: WeightageError[] = [];
  const total = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (Math.round(total * 100) / 100 !== 100) {
    errors.push({ rule: "TOTAL", message: `Total is ${total}% — must equal 100%` });
  }
  goals.forEach((g) => {
    if (g.weightage < 10) {
      errors.push({ rule: "MIN", message: `"${g.title}" is ${g.weightage}% — minimum 10%` });
    }
  });
  if (goals.length > 8) {
    errors.push({ rule: "MAX_GOALS", message: `${goals.length} goals — maximum is 8` });
  }
  return errors;
}
