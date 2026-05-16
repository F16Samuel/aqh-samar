def validate_weightage(goals: list) -> list[str]:
    errors = []
    total = sum(g.weightage for g in goals)
    if round(total, 2) != 100.0:
        errors.append(f"Total weightage is {total}% — must equal exactly 100%")
    for g in goals:
        if g.weightage < 10:
            errors.append(f"Goal '{g.title}' has weightage {g.weightage}% — minimum is 10%")
    if len(goals) > 8:
        errors.append(f"{len(goals)} goals found — maximum is 8")
    return errors
