from sqlmodel import Session, text
from database import engine

def fix_seq():
    with Session(engine) as session:
        tables = ['student', 'criteriasetting', 'historylog', 'feerecord']
        for t in tables:
            seq_name = f"{t}_id_seq"
            try:
                sql = f"SELECT setval('{seq_name}', (SELECT COALESCE(MAX(id), 1) FROM {t}), true)"
                print("Executing:", sql)
                session.execute(text(sql))
                session.commit()
                print(f"Success for {t}")
            except Exception as e:
                session.rollback()
                print(f"Failed {t}: {e}")

if __name__ == '__main__':
    fix_seq()
