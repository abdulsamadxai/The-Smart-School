from typing import Optional, List
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, SQLModel
import json
import io
import csv as csv_module

from database import get_session
from auth import verify_credentials
from models import (
    Student, StudentCreate, StudentRead, StudentDetail,
    HistoryLog, HistoryLogRead, CriteriaSetting,
    ScheduleTestRequest, ScoreEntryRequest, DecisionRequest, JoiningRequest,
    StageEnum, DecisionEnum,
)
from gr_number import generate_gr_number

router = APIRouter(prefix="/students", tags=["students"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_age(dob_str: str, ref_date: date) -> float:
    """Return age in decimal years at ref_date."""
    dob = date.fromisoformat(dob_str)
    delta_days = (ref_date - dob).days
    return round(delta_days / 365.25, 2)


def _auto_criteria_check(student: Student, session: Session) -> None:
    """
    Looks up the age rule for the student's class, computes age, and
    sets stage to criteria_passed or not_eligible. Appends to history log.
    """
    today = date.today()
    age = _compute_age(student.date_of_birth, today)
    student.age_at_registration = age

    rule = session.exec(
        select(CriteriaSetting).where(CriteriaSetting.class_name == student.class_applied_for)
    ).first()

    if rule is None:
        student.stage = StageEnum.criteria_passed
        student.criteria_note = (
            f"No age rule configured for '{student.class_applied_for}'. "
            f"Marked eligible by default. Age: {age:.2f} years."
        )
    elif rule.min_age_years <= age <= rule.max_age_years:
        student.stage = StageEnum.criteria_passed
        student.criteria_note = (
            f"Age {age:.2f} years is within the allowed range "
            f"{rule.min_age_years}–{rule.max_age_years} years for {student.class_applied_for}."
        )
    else:
        student.stage = StageEnum.not_eligible
        student.criteria_note = (
            f"Age {age:.2f} years is outside the allowed range "
            f"{rule.min_age_years}–{rule.max_age_years} years for {student.class_applied_for}. "
            f"Not eligible."
        )


def _log(session: Session, student_id: int, text: str):
    entry = HistoryLog(student_id=student_id, event_text=text)
    session.add(entry)


def _to_read(s: Student) -> StudentRead:
    data = s.dict()
    data["score_subjects"] = s.score_subjects
    data.pop("score_subjects_json", None)
    return StudentRead(**data)


def _to_detail(s: Student) -> StudentDetail:
    data = s.dict()
    data["score_subjects"] = s.score_subjects
    data.pop("score_subjects_json", None)
    # history newest first
    logs = sorted(s.history_logs, key=lambda x: x.timestamp, reverse=True)
    data["history_logs"] = [HistoryLogRead(id=l.id, timestamp=l.timestamp, event_text=l.event_text) for l in logs]
    return StudentDetail(**data)


# ---------------------------------------------------------------------------
# List / search
# ---------------------------------------------------------------------------

@router.get("", response_model=List[StudentRead])
def list_students(
    search: Optional[str] = Query(default=None),
    stage: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    stmt = select(Student)
    students = session.exec(stmt).all()

    if search:
        q = search.lower()
        students = [
            s for s in students
            if q in s.name.lower()
            or q in (s.gr_number or "").lower()
            or q in s.class_applied_for.lower()
        ]
    if stage:
        students = [s for s in students if s.stage.value == stage]

    return [_to_read(s) for s in students]


# ---------------------------------------------------------------------------
# Register (create)
# ---------------------------------------------------------------------------

@router.post("", response_model=StudentRead, status_code=201)
def register_student(
    payload: StudentCreate,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    # Duplicate detection
    duplicates = session.exec(
        select(Student).where(
            Student.name == payload.name,
            Student.date_of_birth == payload.date_of_birth,
        )
    ).all()
    if duplicates:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "A student with the same name and date of birth already exists.",
                "existing_ids": [d.id for d in duplicates],
                "existing_names": [d.name for d in duplicates],
            },
        )

    student = Student.from_orm(payload)
    session.add(student)
    session.flush()  # get ID before logging

    _log(session, student.id, f"Student registered for {student.class_applied_for}.")
    _auto_criteria_check(student, session)
    _log(session, student.id, f"Criteria check: {student.criteria_note}")

    session.commit()
    session.refresh(student)
    return _to_read(student)


# ---------------------------------------------------------------------------
# Get detail
# ---------------------------------------------------------------------------

@router.get("/{student_id}", response_model=StudentDetail)
def get_student(
    student_id: int,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    # eagerly load history
    _ = student.history_logs
    return _to_detail(student)


# ---------------------------------------------------------------------------
# Schedule test
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/schedule-test", response_model=StudentRead)
def schedule_test(
    student_id: int,
    payload: ScheduleTestRequest,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.stage != StageEnum.criteria_passed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot schedule test for student in stage '{student.stage.value}'"
        )
    student.test_date = payload.test_date
    student.test_time = payload.test_time
    student.stage = StageEnum.test_scheduled
    _log(session, student.id, f"Test scheduled for {payload.test_date} at {payload.test_time}.")
    session.commit()
    session.refresh(student)
    return _to_read(student)


# ---------------------------------------------------------------------------
# Enter score
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/enter-score", response_model=StudentRead)
def enter_score(
    student_id: int,
    payload: ScoreEntryRequest,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.stage != StageEnum.test_scheduled:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot enter score for student in stage '{student.stage.value}'"
        )
    if payload.score_total_obtained < 0 or payload.score_total_possible <= 0:
        raise HTTPException(status_code=422, detail="Score values must be non-negative and total_possible > 0")
    if payload.score_total_obtained > payload.score_total_possible:
        raise HTTPException(status_code=422, detail="score_total_obtained cannot exceed score_total_possible")

    student.score_total_obtained = payload.score_total_obtained
    student.score_total_possible = payload.score_total_possible
    if payload.score_subjects:
        student.score_subjects_json = json.dumps([s.dict() for s in payload.score_subjects])
        subject_summary = ", ".join(
            f"{s.subject}: {s.obtained}/{s.total}" for s in payload.score_subjects
        )
        _log(session, student.id, f"Score entered: {payload.score_total_obtained}/{payload.score_total_possible}. Subjects: {subject_summary}.")
    else:
        student.score_subjects_json = None
        _log(session, student.id, f"Score entered: {payload.score_total_obtained}/{payload.score_total_possible} (no subject breakdown).")

    student.stage = StageEnum.awaiting_decision
    session.commit()
    session.refresh(student)
    return _to_read(student)


# ---------------------------------------------------------------------------
# Decision
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/decide", response_model=StudentRead)
def decide(
    student_id: int,
    payload: DecisionRequest,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.stage != StageEnum.awaiting_decision:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot make decision for student in stage '{student.stage.value}'"
        )

    student.decision = payload.decision
    student.decision_at = datetime.utcnow()

    if payload.decision == DecisionEnum.admitted:
        student.stage = StageEnum.admitted
        student.gr_number = generate_gr_number(session)
        student.class_enrolled = student.class_applied_for
        _log(session, student.id, f"Admitted. GR number assigned: {student.gr_number}. Enrolled in {student.class_enrolled}.")
    else:
        student.stage = StageEnum.not_admitted
        _log(session, student.id, "Decision: Not Admitted.")

    session.commit()
    session.refresh(student)
    return _to_read(student)


# ---------------------------------------------------------------------------
# Joining confirmation
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/confirm-joining", response_model=StudentRead)
def confirm_joining(
    student_id: int,
    payload: JoiningRequest,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.stage != StageEnum.admitted:
        raise HTTPException(
            status_code=400,
            detail=f"Only admitted students can have joining confirmed. Current stage: '{student.stage.value}'"
        )
    student.joined = payload.joined
    student.not_joined_reason = payload.not_joined_reason

    if payload.joined:
        _log(session, student.id, "Student confirmed joining.")
    else:
        reason = payload.not_joined_reason or "No reason provided."
        _log(session, student.id, f"Student did not join. Reason: {reason}")

    session.commit()
    session.refresh(student)
    return _to_read(student)


# ---------------------------------------------------------------------------
# Save Admission Challan Data
# ---------------------------------------------------------------------------

class ChallanDataRequest(SQLModel):
    monthly_fee: Optional[float] = None
    scholarship_pct: Optional[float] = None
    sibling_discount_pct: Optional[float] = None
    orphan_discount_pct: Optional[float] = None
    admission_fee: Optional[float] = None
    admission_scholarship_pct: Optional[float] = None
    annual_fee: Optional[float] = None
    security: Optional[float] = None
    security_scholarship_pct: Optional[float] = None
    other_dues: Optional[float] = None
    amount_paid: Optional[float] = None

@router.patch("/{student_id}/save-challan", response_model=StudentRead)
def save_challan_data(
    student_id: int,
    payload: ChallanDataRequest,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.challan_monthly_fee = payload.monthly_fee
    student.challan_scholarship_pct = payload.scholarship_pct
    student.challan_sibling_discount_pct = payload.sibling_discount_pct
    student.challan_orphan_discount_pct = payload.orphan_discount_pct
    student.challan_admission_fee = payload.admission_fee
    student.challan_admission_scholarship_pct = payload.admission_scholarship_pct
    student.challan_annual_fee = payload.annual_fee
    student.challan_security = payload.security
    student.challan_security_scholarship_pct = payload.security_scholarship_pct
    student.challan_other_dues = payload.other_dues
    student.challan_amount_paid = payload.amount_paid

    _log(session, student.id, f"Admission fee challan saved: Monthly=Rs.{payload.monthly_fee}, AdmissionFee=Rs.{payload.admission_fee}, AnnualFee=Rs.{payload.annual_fee}, AmountPaid=Rs.{payload.amount_paid}.")
    session.commit()
    session.refresh(student)
    return _to_read(student)

# ---------------------------------------------------------------------------

@router.get("/export/csv")
def export_csv(
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    students = session.exec(select(Student)).all()

    output = io.StringIO()
    writer = csv_module.writer(output)
    writer.writerow([
        "ID", "Name", "Class Applied For", "Date of Birth",
        "Father Contact", "Mother Contact",
        "Registered At", "Stage", "Age at Registration", "Criteria Note",
        "Test Date", "Test Time",
        "Score Obtained", "Score Possible", "Score Subjects",
        "Decision", "Decision At", "GR Number",
        "Joined", "Not Joined Reason",
    ])

    for s in students:
        writer.writerow([
            s.id, s.name, s.class_applied_for, s.date_of_birth,
            s.father_contact_number or "", s.mother_contact_number or "",
            s.registered_at.strftime("%Y-%m-%d %H:%M:%S"),
            s.stage.value,
            s.age_at_registration or "",
            s.criteria_note or "",
            s.test_date or "", s.test_time or "",
            s.score_total_obtained or "", s.score_total_possible or "",
            s.score_subjects_json or "",
            s.decision.value if s.decision else "", 
            s.decision_at.strftime("%Y-%m-%d %H:%M:%S") if s.decision_at else "",
            s.gr_number or "",
            "" if s.joined is None else ("Yes" if s.joined else "No"),
            s.not_joined_reason or "",
        ])

    output.seek(0)
    filename = f"students_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Delete dependent records manually to satisfy foreign key constraints
    from models import FeeRecord, HistoryLog
    from sqlmodel import delete
    
    session.exec(delete(FeeRecord).where(FeeRecord.student_id == student.id))
    session.exec(delete(HistoryLog).where(HistoryLog.student_id == student.id))
    
    session.delete(student)
    session.commit()
    return {"message": "Student deleted successfully"}


# ---------------------------------------------------------------------------
# Promote All Admitted Students
# ---------------------------------------------------------------------------

CLASS_ORDER = [
    "Playgroup", "Nursery", "Prep", "Grade 1", "Grade 2", 
    "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", 
    "Grade 8", "Grade 9", "Grade 10", "Graduated"
]

@router.post("/promote-all")
def promote_all_students(
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Promotes all admitted students to the next class.
    """
    # Look for both admitted and joined students? Normally if they are in standard stream they are admitted.
    statement = select(Student).where(Student.stage == StageEnum.admitted)
    students = session.exec(statement).all()

    promoted_count = 0
    graduated_count = 0

    for student in students:
        current_class = student.class_applied_for
        
        if current_class == "Graduated":
            continue
            
        try:
            current_index = CLASS_ORDER.index(current_class)
            next_index = current_index + 1
            
            if next_index < len(CLASS_ORDER):
                next_class = CLASS_ORDER[next_index]
                student.class_applied_for = next_class
                
                if next_class == "Graduated":
                    graduated_count += 1
                    _log(session, student.id, "Student graduated.")
                else:
                    promoted_count += 1
                    _log(session, student.id, f"Promoted from {current_class} to {next_class}.")
                    
                session.add(student)
        except ValueError:
            # Class not found in CLASS_ORDER, skip
            pass

    session.commit()
    return {
        "message": "Promotion complete",
        "promoted": promoted_count,
        "graduated": graduated_count
    }

