from sqlmodel import Session, text
from database import engine

def reset_sequences():
    with Session(engine) as session:
        # PostgreSQL syntax to set sequence to max id
        tables = ['student', 'criteriasetting', 'historylog', 'feerecord']
        for t in tables:
            try:
                # Find the maximum ID currently in the table
                max_id = session.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {t}")).scalar()
                # Use setval to adjust the sequence
                session.execute(text(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), {max_id + 1}, false)"))
                session.commit()
                print(f"Sequence for {t} reset successfully past max id {max_id}.")
            except Exception as e:
                print(f"Failed to reset {t}: {e}")
                session.rollback()

if __name__ == '__main__':
    reset_sequences()
