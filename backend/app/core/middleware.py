from fastapi import Request
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.cycle import Cycle
from app.core.utils import is_window_open
from sqlalchemy import select
import json
from fastapi.responses import JSONResponse

import httpx
import time
from app.models.user import User
from sqlalchemy import select

_JWKS_CACHE = None
_JWKS_LAST_FETCH = 0

async def get_jwks():
    global _JWKS_CACHE, _JWKS_LAST_FETCH
    now = time.time()
    if _JWKS_CACHE and (now - _JWKS_LAST_FETCH < 3600):
        return _JWKS_CACHE
    
    try:
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=5)
            if r.status_code == 200:
                _JWKS_CACHE = r.json()
                _JWKS_LAST_FETCH = now
                return _JWKS_CACHE
    except Exception:
        pass
    return None

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None
        auth_header = request.headers.get("Authorization")
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                # 1. Peek at the algorithm
                header = jwt.get_unverified_header(token)
                algo = header.get("alg")
                
                payload = None
                if algo == "HS256":
                    # Legacy HS256 using the secret
                    payload = jwt.decode(
                        token, 
                        settings.SUPABASE_JWT_SECRET, 
                        algorithms=["HS256"],
                        options={"verify_aud": False}
                    )
                elif algo == "ES256":
                    # Modern ECC using Public Keys (JWKS)
                    jwks = await get_jwks()
                    if jwks:
                        kid = header.get("kid")
                        key_to_use = None
                        for k in jwks.get("keys", []):
                            if k.get("kid") == kid:
                                key_to_use = k
                                break
                        
                        if key_to_use:
                            payload = jwt.decode(
                                token,
                                key_to_use,
                                algorithms=["ES256"],
                                options={"verify_aud": False}
                            )
                
                if payload:
                    user_id = payload.get("sub")
                    if user_id:
                        # Open a quick session to fetch user
                        async with AsyncSessionLocal() as session:
                            result = await session.execute(select(User).where(User.id == user_id))
                            user = result.scalar_one_or_none()
                            request.state.user = user
            except JWTError:
                # Invalid token, ignore and leave state.user as None
                pass
        
        return await call_next(request)

class WindowGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method in ("POST", "PATCH") and ("/api/v1/achievements" in path or "/api/v1/checkins" in path):
            body = await request.body()
            
            async def receive():
                return {"type": "http.request", "body": body}
            request._receive = receive
            
            action_type = None
            try:
                if body:
                    data = json.loads(body)
                    q = data.get("quarter", "")
                    if q:
                        action_type = q.lower().replace(" ", "_")
            except Exception:
                pass
                
            async with AsyncSessionLocal() as session:
                cycle_res = await session.execute(select(Cycle).where(Cycle.is_active == True))
                active_cycle = cycle_res.scalar_one_or_none()
                if not active_cycle:
                    return JSONResponse(status_code=422, content={"data": None, "error": {"code": "NO_ACTIVE_CYCLE", "message": "No active cycle found"}})
                    
                if not is_window_open(active_cycle, action_type=action_type):
                    return JSONResponse(status_code=422, content={"data": None, "error": {"code": "WINDOW_CLOSED", "message": "Check-in window is not currently open"}})
                    
        return await call_next(request)
