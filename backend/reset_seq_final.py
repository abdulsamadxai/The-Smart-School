import os
import sqlalchemy as sa
from database import engine

def sync():
    insp = sa.inspect(engine)
    tables = insp.get_table_names()
    print("Tables:", tables)

    with engine.connect() as conn:
        for t in tables:
            try:
                # get max ID
                m = conn.execute(sa.text(f"SELECT COALESCE(MAX(id), 0) FROM {t}")).scalar()
                
                # set the sequence
                if m > 0:
                    conn.execute(sa.text(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), {m+1}, false)"))
                    print(f"✅ Reset sequence for {t}, new max is {m}")
            except Exception as e:
                print(f"❌ Failed to reset sequence for {t}: {e}")
        
        conn.commit()

if __name__ == "__main__":
    sync()
