import os
import json
import datetime
from decimal import Decimal
from uuid import UUID
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Resolve paths
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(backend_dir, ".env"))

DATABASE_SYNC_URL = os.getenv("DATABASE_SYNC_URL")
if not DATABASE_SYNC_URL:
    print("Error: DATABASE_SYNC_URL not found in .env")
    exit(1)

# Target directories
docs_dir = os.path.join(os.path.dirname(backend_dir), "docs")
dump_dir = os.path.join(docs_dir, "supabase_dump")
os.makedirs(dump_dir, exist_ok=True)

class CustomEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle UUIDs, datetimes, decimals, and dates."""
    def default(self, obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def run_dump():
    print(f"Connecting to database using: {DATABASE_SYNC_URL.split('@')[-1]}")
    conn = psycopg2.connect(DATABASE_SYNC_URL)
    
    # 1. Get List of Tables
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
    
    print(f"Found {len(tables)} tables: {', '.join(tables)}")
    
    schema_info = {}
    relationship_lines = []
    mermaid_relationships = []
    
    # 2. Extract Schema, Primary Keys, Foreign Keys, and Table Data
    for table in tables:
        # Ignore alembic versions unless they are explicitly requested, but keep them for full dumping
        print(f"\nProcessing table: {table}...")
        
        # A. Columns Info
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position;
            """, (table,))
            columns = cur.fetchall()
            
        # B. Primary Keys
        with conn.cursor() as cur:
            cur.execute("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = %s;
            """, (table,))
            pkeys = [row[0] for row in cur.fetchall()]

        # C. Foreign Keys
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    kcu.column_name AS foreign_column,
                    ccu.table_name AS referenced_table,
                    ccu.column_name AS referenced_column,
                    tc.constraint_name
                FROM
                    information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = %s;
            """, (table,))
            fkeys = cur.fetchall()

        # D. Get All Rows
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SELECT * FROM "{table}";')
            rows = cur.fetchall()
            
        # E. Save Table Data to JSON
        json_path = os.path.join(dump_dir, f"{table}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, cls=CustomEncoder, indent=2)
        print(f"Saved {len(rows)} records to {json_path}")
        
        # Save structural details
        schema_info[table] = {
            "columns": columns,
            "pkeys": pkeys,
            "fkeys": fkeys,
            "record_count": len(rows)
        }
        
        # Build relationships for Markdown
        for fk in fkeys:
            relationship_lines.append(
                f"- **`{table}.{fk['foreign_column']}`** references **`{fk['referenced_table']}.{fk['referenced_column']}`** (Constraint: `{fk['constraint_name']}`)"
            )
            mermaid_relationships.append(
                f'    "{table}" }}|--|| "{fk["referenced_table"]}" : "{fk["foreign_column"]} -> {fk["referenced_column"]}"'
            )

    # 3. Generate Schema Markdown Document
    md_path = os.path.join(docs_dir, "supabase_schema.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# Supabase Database Schema & Relations Documentation\n\n")
        f.write(f"*Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n")
        
        f.write("This document provides a highly detailed schematic of the AQH-SAMAR portal tables, columns, constraints, and relational mappings, along with the physical records exported to JSON files.\n\n")
        
        # Mermaid Diagram
        f.write("## Entity Relationship Diagram (ERD)\n\n")
        f.write("```mermaid\nerDiagram\n")
        
        # Define tables and columns in ERD
        for table, info in schema_info.items():
            f.write(f'    "{table}" {{\n')
            for col in info["columns"]:
                pk_label = " PK" if col["column_name"] in info["pkeys"] else ""
                fk_label = " FK" if any(fk["foreign_column"] == col["column_name"] for fk in info["fkeys"]) else ""
                f.write(f'        {col["data_type"]} {col["column_name"]}{pk_label}{fk_label}\n')
            f.write("    }\n")
            
        f.write("\n")
        # Add relational lines
        for rel in mermaid_relationships:
            f.write(f"{rel}\n")
        f.write("```\n\n")
        
        # Relationship Summary
        f.write("## Relational Rules & Foreign Key Constraints\n\n")
        if relationship_lines:
            for rel in relationship_lines:
                f.write(f"{rel}\n")
        else:
            f.write("*No explicit foreign key relationships found.*\n")
        f.write("\n")
        
        # Detailed Table Schematics
        f.write("## Table Schematics & Column Definitions\n\n")
        for table, info in schema_info.items():
            f.write(f"### Table: `{table}`\n\n")
            f.write(f"- **Total Exported Records**: `{info['record_count']}`\n")
            f.write(f"- **JSON Data Dump**: [`{table}.json`](./supabase_dump/{table}.json)\n\n")
            
            f.write("| Column Name | Data Type | Nullable | Primary Key? | Default Value |\n")
            f.write("|---|---|---|---|---|\n")
            for col in info["columns"]:
                pk = "🔑 YES" if col["column_name"] in info["pkeys"] else "NO"
                nullable = "YES" if col["is_nullable"] == "YES" else "NO"
                default_val = col["column_default"] if col["column_default"] is not None else "*None*"
                f.write(f"| `{col['column_name']}` | `{col['data_type']}` | {nullable} | {pk} | `{default_val}` |\n")
            f.write("\n---\n\n")
            
    print(f"\nCompleted! Generated database schema documentation at {md_path}")
    conn.close()

if __name__ == "__main__":
    run_dump()
