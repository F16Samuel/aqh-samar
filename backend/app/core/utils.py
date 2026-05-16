from datetime import date
from typing import Optional

from app.models.cycle import Cycle

def is_window_open(cycle: Cycle, action_type: Optional[str] = None) -> bool:
    """
    Check if a cycle's window is currently open.
    If action_type is provided, we could optionally match it against cycle.phase.
    For now, simply checking if today falls within window_open and window_close.
    """
    today = date.today()
    
    # Check strict date bounds
    if not (cycle.window_open <= today <= cycle.window_close):
        return False
        
    if action_type == "goal_setting":
        if cycle.phase != "Phase 1 - Goal Setting":
            return False
    elif action_type in ["q1", "q2", "q3", "q4"]:
        # Map q1 to "Q1 Check-in"
        phase_map = {
            "q1": "Q1 Check-in",
            "q2": "Q2 Check-in",
            "q3": "Q3 Check-in",
            "q4": "Q4 / Annual"
        }
        if cycle.phase != phase_map.get(action_type):
            return False
            
    return True

def compute_progress_score(uom_type: str, target: str, actual: str) -> float:
    """
    Computes a progress score based on the Unit of Measurement (UoM) type.
    Returns a percentage (0.0 to 100.0).
    uom_types: min, max, timeline, zero
    """
    if not actual:
        return 0.0

    try:
        if uom_type == "min":
            t = float(target)
            a = float(actual)
            if t == 0: return 100.0 if a >= 0 else 0.0
            return min((a / t) * 100, 100.0)
            
        elif uom_type == "max":
            t = float(target)
            a = float(actual)
            if a == 0: return 100.0
            if t >= a: return 100.0
            return max((t / a) * 100, 0.0)
            
        elif uom_type == "timeline":
            from datetime import datetime
            t_date = datetime.strptime(target, "%Y-%m-%d").date()
            a_date = datetime.strptime(actual, "%Y-%m-%d").date()
            return 100.0 if a_date <= t_date else 0.0
            
        elif uom_type == "zero":
            a = float(actual)
            return 100.0 if a == 0 else 0.0
            
    except (ValueError, TypeError):
        return 0.0
        
    return 0.0
