from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func

from database import get_session
from auth import verify_credentials
from models import Student, StageEnum

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    all_students = session.exec(select(Student)).all()
    total = len(all_students)

    stage_counts = {stage.value: 0 for stage in StageEnum}
    for s in all_students:
        stage_counts[s.stage.value] += 1

    # Admitted but didn't join (subset of admitted)
    admitted_not_joined = sum(
        1 for s in all_students
        if s.stage == StageEnum.admitted and s.joined is False
    )
    # Admitted and joined
    admitted_joined = sum(
        1 for s in all_students
        if s.stage == StageEnum.admitted and s.joined is True
    )
    # Admitted, joining not yet confirmed
    admitted_pending_join = sum(
        1 for s in all_students
        if s.stage == StageEnum.admitted and s.joined is None
    )

    return {
        "total": total,
        "by_stage": stage_counts,
        "admitted_joined": admitted_joined,
        "admitted_not_joined": admitted_not_joined,
        "admitted_pending_join": admitted_pending_join,
    }
