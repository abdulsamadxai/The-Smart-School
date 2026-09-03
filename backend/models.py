from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
import json


class StageEnum(str, Enum):
    inquiry = "inquiry"
    not_eligible = "not_eligible"
    criteria_passed = "criteria_passed"
    test_scheduled = "test_scheduled"
    awaiting_decision = "awaiting_decision"
    admitted = "admitted"
    not_admitted = "not_admitted"


class DecisionEnum(str, Enum):
    admitted = "admitted"
    rejected = "rejected"


# ---------------------------------------------------------------------------
# CriteriaSetting
# ---------------------------------------------------------------------------

class CriteriaSettingBase(SQLModel):
    class_name: str = Field(index=True)
    min_age_years: float
    max_age_years: float


class CriteriaSetting(CriteriaSettingBase, table=True):
    __tablename__ = "criteria_settings"
    id: Optional[int] = Field(default=None, primary_key=True)


class CriteriaSettingCreate(CriteriaSettingBase):
    pass


class CriteriaSettingRead(CriteriaSettingBase):
    id: int


# ---------------------------------------------------------------------------
# HistoryLog
# ---------------------------------------------------------------------------

class HistoryLog(SQLModel, table=True):
    __tablename__ = "history_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="students.id", index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_text: str

    student: Optional["Student"] = Relationship(back_populates="history_logs")


class HistoryLogRead(SQLModel):
    id: int
    timestamp: datetime
    event_text: str


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------

class StudentBase(SQLModel):
    name: str
    class_applied_for: str
    class_enrolled: Optional[str] = None
    date_of_birth: str   # ISO 8601 date string YYYY-MM-DD
    father_contact_number: Optional[str] = ""
    mother_contact_number: Optional[str] = ""
    parent_relation: Optional[str] = None
    parent_name: Optional[str] = None



class Student(StudentBase, table=True):
    __tablename__ = "students"
    id: Optional[int] = Field(default=None, primary_key=True)

    registered_at: datetime = Field(default_factory=datetime.utcnow)
    stage: StageEnum = Field(default=StageEnum.inquiry)
    age_at_registration: Optional[float] = None
    criteria_note: Optional[str] = None

    # Test
    test_date: Optional[str] = None   # YYYY-MM-DD
    test_time: Optional[str] = None   # HH:MM

    # Score — stored as JSON strings (SQLite has no native array)
    score_total_obtained: Optional[float] = None
    score_total_possible: Optional[float] = None
    score_subjects_json: Optional[str] = Field(default=None)  # JSON list of {subject,obtained,total}

    # Decision
    decision: Optional[DecisionEnum] = None
    decision_at: Optional[datetime] = None
    gr_number: Optional[str] = None

    # Joining
    joined: Optional[bool] = None
    not_joined_reason: Optional[str] = None

    # Admission Fee Challan Data (saved from ChallansPage)
    challan_monthly_fee: Optional[float] = None
    challan_scholarship_pct: Optional[float] = None
    challan_sibling_discount_pct: Optional[float] = None
    challan_orphan_discount_pct: Optional[float] = None
    challan_admission_fee: Optional[float] = None
    challan_admission_scholarship_pct: Optional[float] = None
    challan_annual_fee: Optional[float] = None
    challan_security: Optional[float] = None
    challan_security_scholarship_pct: Optional[float] = None
    challan_other_dues: Optional[float] = None
    challan_amount_paid: Optional[float] = None

    # Certificates
    certificate_issued: Optional[str] = None          # "leaving" | "character" | "both"
    certificate_issued_at: Optional[datetime] = None
    leaving_date: Optional[str] = None                # YYYY-MM-DD
    leaving_reason: Optional[str] = None
    conduct_remarks: Optional[str] = None

    history_logs: List[HistoryLog] = Relationship(back_populates="student")
    fee_records: List["FeeRecord"] = Relationship(back_populates="student")
    @property
    def score_subjects(self):
        if self.score_subjects_json:
            return json.loads(self.score_subjects_json)
        return []


class StudentCreate(StudentBase):
    pass


class ScoreSubject(SQLModel):
    subject: str
    obtained: float
    total: float


class StudentRead(SQLModel):
    id: int
    name: str
    class_applied_for: str
    class_enrolled: Optional[str] = None
    date_of_birth: str
    father_contact_number: Optional[str] = ""
    mother_contact_number: Optional[str] = ""
    parent_relation: Optional[str]
    parent_name: Optional[str]
    registered_at: datetime
    stage: StageEnum
    age_at_registration: Optional[float]
    criteria_note: Optional[str]
    test_date: Optional[str]
    test_time: Optional[str]
    score_total_obtained: Optional[float]
    score_total_possible: Optional[float]
    score_subjects: Optional[List[dict]] = None
    decision: Optional[DecisionEnum]
    decision_at: Optional[datetime]
    gr_number: Optional[str]
    joined: Optional[bool]
    not_joined_reason: Optional[str]
    # Challan fields
    challan_monthly_fee: Optional[float] = None
    challan_scholarship_pct: Optional[float] = None
    challan_sibling_discount_pct: Optional[float] = None
    challan_orphan_discount_pct: Optional[float] = None
    challan_admission_fee: Optional[float] = None
    challan_admission_scholarship_pct: Optional[float] = None
    challan_annual_fee: Optional[float] = None
    challan_security: Optional[float] = None
    challan_security_scholarship_pct: Optional[float] = None
    challan_other_dues: Optional[float] = None
    challan_amount_paid: Optional[float] = None
    # Certificate fields
    certificate_issued: Optional[str] = None
    certificate_issued_at: Optional[datetime] = None
    leaving_date: Optional[str] = None
    leaving_reason: Optional[str] = None
    conduct_remarks: Optional[str] = None


class StudentDetail(StudentRead):
    history_logs: List[HistoryLogRead] = []

# ---------------------------------------------------------------------------
# Fee Records
# ---------------------------------------------------------------------------

class FeeRecordBase(SQLModel):
    fee_month: str
    amount_due: float
    status: str = "unpaid"  # "paid" or "unpaid"
    payment_method: Optional[str] = None  # "Cash" or "Bank" (set when paid)

class FeeRecord(FeeRecordBase, table=True):
    __tablename__ = "fee_records"
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="students.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    cleared_at: Optional[datetime] = None

    student: Optional["Student"] = Relationship(back_populates="fee_records")

class FeeRecordRead(FeeRecordBase):
    id: int
    student_id: int
    created_at: datetime
    cleared_at: Optional[datetime]
    payment_method: Optional[str] = None

class FeeRecordCreate(FeeRecordBase):
    student_id: int
    
class FeeRecordUpdate(SQLModel):
    status: str
    payment_method: Optional[str] = None

# ---------------------------------------------------------------------------
# Request bodies for stage transitions
# ---------------------------------------------------------------------------

class ScheduleTestRequest(SQLModel):
    test_date: str
    test_time: str


class ScoreEntryRequest(SQLModel):
    score_total_obtained: float
    score_total_possible: float
    score_subjects: Optional[List[ScoreSubject]] = None


class DecisionRequest(SQLModel):
    decision: DecisionEnum


class JoiningRequest(SQLModel):
    joined: bool
    not_joined_reason: Optional[str] = None
