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
        
    # If a specific action type is required, ensure the cycle phase permits it
    if action_type:
        # e.g., action_type "goal_setting" requires phase "Phase 1 - Goal Setting"
        # Since we're tracking a single active phase, date bounds usually suffice.
        pass
        
    return True
