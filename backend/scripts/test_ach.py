import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import AsyncSessionLocal
from app.models.goal import Goal
from sqlalchemy import select

client = TestClient(app, raise_server_exceptions=True)

async def main():
    # Find a goal in DB
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Goal).limit(1))
        goal = result.scalar_one_or_none()
        
    if goal:
        print(f"Testing achievement for goal: {goal.id}")
        # Test the endpoint
        # The AuthMiddleware looks for token. 
        # But we don't have a valid token easily. We can mock it by mutating request.state.user?
        # Let's bypass auth by calling /api/v1/auth/login to get token
        pass

if __name__ == "__main__":
    asyncio.run(main())
