import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt

# Security configurations
# Demo auth (header-role fallback + shared demo passwords) is for the LOCAL offline
# install only (run.py enables it). Internet deployments must run with it OFF:
# it defaults to OFF so a server that forgets the env var fails closed, not open.
ALLOW_DEMO_AUTH = os.environ.get("ALLOW_DEMO_AUTH", "0").strip() not in ("0", "false", "False", "no")

_env_secret = os.environ.get("JWT_SECRET_KEY")
if _env_secret:
    SECRET_KEY = _env_secret
elif ALLOW_DEMO_AUTH:
    SECRET_KEY = "local-demo-secret-do-not-use-on-a-server"
else:
    # No secret configured on an internet deploy: use a random per-boot secret.
    # Tokens simply stop working across restarts (users log in again) instead of
    # every deployment sharing one publicly-known signing key.
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    print("[SECURITY] JWT_SECRET_KEY is not set - using a random per-boot secret. "
          "Set JWT_SECRET_KEY in the server environment for stable sessions.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days session

# Super Admin password comes from the environment ONLY. The old hardcoded
# fallbacks were removed: they were visible in the source code, so anyone with
# the code knew the master password for every deployment.
SUPER_ADMIN_PASSWORD = os.environ.get("SUPER_ADMIN_PASSWORD")
# Shared demo passwords - honoured ONLY in local demo mode (ALLOW_DEMO_AUTH=1).
DEMO_SUPER_ADMIN_PASSWORD = "OmnysyncSuper2026!"
DEMO_TENANT_PASSWORD = "OmnysyncPassword123"

security = HTTPBearer(auto_error=False)

def get_password_hash(password: str) -> str:
    pwd_bytes = (password or "").encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

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

# Helper to identify requested tenant from Subdomain or Header
def resolve_tenant_id_from_request(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    x_forwarded_host: Optional[str] = Header(None, alias="X-Forwarded-Host"),
    host: Optional[str] = Header(None)
) -> str:
    effective_host = x_forwarded_host or host
    if effective_host:
        host_clean = effective_host.split(":")[0]
        parts = host_clean.split(".")
        if len(parts) >= 2:
            subdomain = parts[0].lower()
            if subdomain not in ("www", "localhost", "127", "127.0.0.1", "racms", "demo", "app", "rental"):
                return subdomain
    return (x_tenant_id or "default").strip().lower()

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
    Prefer JWT. Dedicated tenant subdomains ALWAYS require authentication.
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
            if role == "super_admin":
                target_tenant = resolve_tenant_id_from_request(x_tenant_id, x_forwarded_host, host)
                return {
                    "tenant_id": target_tenant if target_tenant != "system" else "default",
                    "role": "super_admin"
                }
            return {"tenant_id": tenant_id, "role": role}
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials or expired session",
                headers={"WWW-Authenticate": "Bearer"},
            )

    target_tenant = resolve_tenant_id_from_request(x_tenant_id, x_forwarded_host, host)

    # Dedicated agency tenant workspaces ALWAYS require password login
    if target_tenant != "default":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access this agency workspace.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # For default demo / local development fallback
    if not ALLOW_DEMO_AUTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    resolved_role = x_test_role or "desk_staff"
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

def require_super_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    # A valid super-admin JWT is the ONLY way in. The previous X-Test-Role header
    # bypass let anyone on the internet list/delete tenants and reset tenant
    # passwords with no credentials at all, so it has been removed entirely.
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("role") == "super_admin":
                return payload
        except JWTError:
            pass
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Super Admin access denied. Super Admin authentication required."
    )
