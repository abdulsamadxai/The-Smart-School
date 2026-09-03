import os
import secrets
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

load_dotenv()

security = HTTPBasic()

# Legacy single admin (kept for backward compatibility / other admin features)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")

# Director
DIRECTOR_USERNAME = os.getenv("DIRECTOR_USERNAME", "director")
DIRECTOR_PASSWORD = os.getenv("DIRECTOR_PASSWORD", "director2025")

# Fee admins
CASH_ADMIN_USERNAME = os.getenv("CASH_ADMIN_USERNAME", "cash_admin")
CASH_ADMIN_PASSWORD = os.getenv("CASH_ADMIN_PASSWORD", "cash2025")
BANK_ADMIN_USERNAME = os.getenv("BANK_ADMIN_USERNAME", "bank_admin")
BANK_ADMIN_PASSWORD = os.getenv("BANK_ADMIN_PASSWORD", "bank2025")


def _match(a: str, b: str) -> bool:
    return secrets.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def get_role(credentials: HTTPBasicCredentials) -> str:
    """Return the role string for valid credentials, or raise 401."""
    u, p = credentials.username, credentials.password

    if _match(u, ADMIN_USERNAME) and _match(p, ADMIN_PASSWORD):
        return "admin"
    if _match(u, DIRECTOR_USERNAME) and _match(p, DIRECTOR_PASSWORD):
        return "director"
    if _match(u, CASH_ADMIN_USERNAME) and _match(p, CASH_ADMIN_PASSWORD):
        return "cash_admin"
    if _match(u, BANK_ADMIN_USERNAME) and _match(p, BANK_ADMIN_PASSWORD):
        return "bank_admin"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Basic"},
    )


def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """
    Validates HTTP Basic Auth credentials.
    Accepts admin, director, cash_admin, and bank_admin credentials.
    Returns the role string.
    """
    return get_role(credentials)


def verify_director(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """
    Strictly validates Director credentials only. Used for Director-only endpoints.
    """
    role = get_role(credentials)
    if role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Director credentials required",
            headers={"WWW-Authenticate": "Basic"},
        )
    return role
