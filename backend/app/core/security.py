from functools import wraps
from typing import Callable
from fastapi import Request

from app.core.responses import err

def require_roles(*roles: str) -> Callable:
    """
    Decorator to enforce role-based access control.
    Returns 401 if not authenticated, 403 if role doesn't match.
    Assumes `AuthMiddleware` has populated `request.state.user`.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request object
            request = kwargs.get("request")
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request:
                return err("SERVER_ERROR", "Request object missing from route handler", 500)
                
            user = getattr(request.state, "user", None)
            
            if not user:
                return err("UNAUTHORIZED", "Not authenticated", 401)
                
            if roles and user.role not in roles:
                return err("FORBIDDEN", "You do not have permission to perform this action", 403)
                
            return await func(*args, **kwargs)
        return wrapper
    return decorator
