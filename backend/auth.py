import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

# Security configurations
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
# Offline shop default: allow header role/tenant (local LAN). Set ALLOW_DEMO_AUTH=0 for internet deploy.
ALLOW_DEMO_AUTH = os.environ.get("ALLOW_DEMO_AUTH", "1").strip() not in ("0", "false", "False", "no")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Dependency injection for tenant isolation and authentication
def get_tenant_context(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    x_test_role: Optional[str] = Header(None, alias="X-Test-Role"),
    x_forwarded_host: Optional[str] = Header(None, alias="X-Forwarded-Host"),
    host: Optional[str] = Header(None)
) -> Dict:
    """
    Extracts tenant identity and role.
    Prefer JWT. Demo header fallbacks only when ALLOW_DEMO_AUTH=1 (offline default).
    """
    # 1. Check JWT first
    if credentials:
        token = credentials.credentials
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            tenant_id = payload.get("tenant_id")
            role = payload.get("role", "desk_staff")
            if not tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: tenant_id missing"
                )
            return {"tenant_id": tenant_id, "role": role}
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if not ALLOW_DEMO_AUTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    resolved_role = x_test_role or "desk_staff"

    # 2. Check subdomain wildcard header (host verification)
    effective_host = x_forwarded_host or host
    if effective_host:
        host_clean = effective_host.split(":")[0]
        parts = host_clean.split(".")
        if len(parts) >= 2:
            subdomain = parts[0]
            if subdomain not in ("www", "localhost", "127", "127.0.0.1", "racms", "demo", "app", "rental"):
                try:
                    from backend.database import SessionLocal
                    from backend import models
                    with SessionLocal() as db:
                        t = db.query(models.Tenant).filter(models.Tenant.id == subdomain).first()
                        if t:
                            return {"tenant_id": subdomain, "role": resolved_role}
                except Exception:
                    pass

    # 3. Fallback to X-Tenant-ID header
    if x_tenant_id:
        return {"tenant_id": x_tenant_id, "role": resolved_role}

    # For local/testing development fallback
    return {"tenant_id": "default", "role": resolved_role}

def require_roles(allowed_roles: list[str]):
    def dependency(tenant_context: dict = Depends(get_tenant_context)):
        role = tenant_context.get("role")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: insufficient role permissions"
            )
        return tenant_context
    return dependency

def require_super_admin(tenant_context: dict = Depends(get_tenant_context)):
    role = tenant_context.get("role")
    if role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Super Admin rights required"
        )
    return tenant_context
