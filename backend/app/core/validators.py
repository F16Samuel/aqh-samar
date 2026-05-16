def validate_goal_limits(goals: list) -> list[str]:
    """
    Validation for incremental updates. 
    Allows total < 100%, but blocks if total > 100% or individual goal < 10%.
    """
    errors = []
    total = sum(g.weightage for g in goals)
    if round(total, 2) > 100.0:
        errors.append(f"Total weightage is {total}% — cannot exceed 100%")
    for g in goals:
        if g.weightage < 10:
            errors.append(f"Goal '{g.title}' has weightage {g.weightage}% — minimum is 10%")
    if len(goals) > 8:
        errors.append(f"{len(goals)} goals found — maximum is 8")
    return errors

def validate_sheet_submission(goals: list) -> list[str]:
    """
    Strict validation for final submission.
    Total weightage must equal exactly 100%.
    """
    errors = validate_goal_limits(goals)
    total = sum(g.weightage for g in goals)
    if round(total, 2) != 100.0:
        errors.append(f"Total weightage is {total}% — must equal exactly 100% for submission")
    return errors
