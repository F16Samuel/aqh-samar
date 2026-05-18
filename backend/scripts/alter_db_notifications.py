import os
import sys
from sqlalchemy import create_engine, text

# Add parent directory to path to load settings
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

def main():
    print("Connecting to database: ", settings.DATABASE_SYNC_URL)
    engine = create_engine(settings.DATABASE_SYNC_URL)
    
    queries = [
        "ALTER TABLE mock_notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES users(id) ON DELETE SET NULL;",
        "ALTER TABLE mock_notifications ADD COLUMN IF NOT EXISTS folder VARCHAR(50) DEFAULT 'inbox' NOT NULL;"
    ]
    
    with engine.connect() as conn:
        for q in queries:
            print(f"Executing: {q}")
            conn.execute(text(q))
            conn.commit()
    print("Database altered successfully!")

if __name__ == "__main__":
    main()
