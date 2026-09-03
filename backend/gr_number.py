from datetime import datetime
from sqlmodel import Session, select
from models import Student


def generate_gr_number(session: Session) -> str:
    """
    Generates the next GR number in format TSS-<year>-<4-digit-sequential>.
    Queries the max existing number for the current year so it's always unique,
    even if the DB is manually edited or records are deleted.
    """
    year = datetime.utcnow().year
    prefix = f"TSS-{year}-"

    statement = select(Student.gr_number).where(
        Student.gr_number.startswith(prefix)  # type: ignore[union-attr]
    )
    existing = session.exec(statement).all()

    max_seq = 0
    for gr in existing:
        if gr:
            try:
                seq = int(gr.split("-")[-1])
                if seq > max_seq:
                    max_seq = seq
            except ValueError:
                pass

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:04d}"
