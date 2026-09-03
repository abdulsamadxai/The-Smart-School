import os
import psycopg2

def fix_sequences():
    url = os.getenv('SUPABASE_DATABASE_URL', 'postgresql://postgres.ghoiaihbjcsjldryzmpy:%23AbdulSamad323893@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres')
    
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cursor = conn.cursor()

    tables = ['student', 'criteriasetting', 'historylog', 'feerecord']
    
    for t in tables:
        try:
            # Get max ID
            cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM {t};")
            max_id = cursor.fetchone()[0]
            if max_id > 0:
                print(f"Max ID for {t} is {max_id}, fixing sequence...")
                # pg_get_serial_sequence doesn't fail on raw psycopg2 if it exists
                cursor.execute(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), %s, true);", (max_id,))
                print(f"✅ fixed {t}")
        except Exception as e:
            print(f"❌ Failed for {t}: {e}")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    fix_sequences()
