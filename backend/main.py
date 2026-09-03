from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables
from routers import students, criteria, dashboard, fees, director, certificates

app = FastAPI(
    title="The Smart School — Admission Control Room",
    description="Admission pipeline management system for Bara Kahu Campus",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow all origins so the frontend (any IP on the local network)
# can reach the API without preflight issues.
# Tighten this list before deploying to the internet.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


app.include_router(students.router)
app.include_router(criteria.router)
app.include_router(dashboard.router)
app.include_router(fees.router)
app.include_router(director.router)
app.include_router(certificates.router)


@app.get("/health")
def health():
    return {"status": "ok", "system": "The Smart School Admission Control Room"}
