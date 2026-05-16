from fastapi import Request
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None
        auth_header = request.headers.get("Authorization")
        
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                # We do not verify audience because Supabase defaults to "authenticated"
                payload = jwt.decode(
                    token, 
                    settings.SUPABASE_JWT_SECRET, 
                    algorithms=["HS256"], 
                    options={"verify_aud": False}
                )
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
