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
    # Get total count
    total = session.exec(select(func.count(Student.id))).one()

    # Get counts grouped by stage
    stage_counts_db = session.exec(
        select(Student.stage, func.count(Student.id)).group_by(Student.stage)
    ).all()
    
    stage_counts = {stage.value: 0 for stage in StageEnum}
    for stage, count in stage_counts_db:
        # stage might be a string or enum depending on sqlite mapping
        stage_val = stage.value if hasattr(stage, "value") else stage
        if stage_val in stage_counts:
            stage_counts[stage_val] = count

    # Admitted and joined statuses
    admitted_not_joined = session.exec(
        select(func.count(Student.id)).where(Student.stage == StageEnum.admitted, Student.joined == False)
    ).one()
    
    admitted_joined = session.exec(
        select(func.count(Student.id)).where(Student.stage == StageEnum.admitted, Student.joined == True)
    ).one()
    
    admitted_pending_join = session.exec(
        select(func.count(Student.id)).where(Student.stage == StageEnum.admitted, Student.joined == None)
    ).one()

    return {
        "total": total,
        "by_stage": stage_counts,
        "admitted_joined": admitted_joined,
        "admitted_not_joined": admitted_not_joined,
        "admitted_pending_join": admitted_pending_join,
    }
