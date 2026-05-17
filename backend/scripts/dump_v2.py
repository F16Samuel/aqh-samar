import asyncio
import os
import sys
import json
import uuid
from datetime import date, datetime

# Add the app directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal

from app.models.department import Department
from app.models.user import User
from app.models.cycle import Cycle
from app.models.goal import GoalSheet, Goal, Achievement, CheckIn, AuditLog

async def main():
    dump_dir = os.path.join(os.path.dirname(__file__), "..", "..", "supabase_dump_v2")
    os.makedirs(dump_dir, exist_ok=True)
    print(f"Exporting active Supabase tables to {dump_dir}...")
    
    tables = {
        "users": User,
        "departments": Department,
        "cycles": Cycle,
        "goal_sheets": GoalSheet,
        "goals": Goal,
        "achievements": Achievement,
        "checkins": CheckIn,
        "audit_logs": AuditLog
    }
    
    async with AsyncSessionLocal() as session:
        for name, model in tables.items():
            res = await session.execute(select(model))
            records = res.scalars().all()
            
            # Serialize each record
            serialized = []
            for r in records:
                # Build dict of columns
                d_record = {}
                for col in r.__table__.columns:
                    val = getattr(r, col.name)
                    if isinstance(val, (datetime, date)):
                        d_record[col.name] = val.isoformat()
                    elif isinstance(val, uuid.UUID):
                        d_record[col.name] = str(val)
                    else:
                        d_record[col.name] = val
                serialized.append(d_record)
                
            out_file = os.path.join(dump_dir, f"{name}.json")
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(serialized, f, indent=2, ensure_ascii=False)
            print(f"Successfully dumped {len(serialized)} records into {out_file}")
            
        # Also dump alembic_version if it exists
        try:
            res_av = await session.execute(text("SELECT version_num FROM alembic_version"))
            version_num = res_av.scalar()
            if version_num:
                out_file_av = os.path.join(dump_dir, "alembic_version.json")
                with open(out_file_av, "w", encoding="utf-8") as f:
                    json.dump([{"version_num": version_num}], f, indent=2)
                print(f"Successfully dumped alembic_version into {out_file_av}")
        except Exception as e:
            print(f"Could not dump alembic_version: {e}")

if __name__ == "__main__":
    asyncio.run(main())
