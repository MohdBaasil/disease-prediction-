import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from backend.database.connection import get_db
from backend.database.models import User

load_dotenv()

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkeyforhospitalqueuesystem123!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    bold_password = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(bold_password, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import hashlib
import traceback
from sqlalchemy import text
from backend.database.connection import DATABASE_URL, engine

def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    auth_header = request.headers.get("authorization", "MISSING")
    
    # If not found in Authorization header, search query parameters
    if not token:
        token = request.query_params.get("token")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    secret_hash = hashlib.sha256(SECRET_KEY.encode()).hexdigest()[:8]
    abs_db_path = str(engine.url)
    
    print("\n----------------------------------------------------", flush=True)
    print("REQUEST START", flush=True)
    print(f"Authorization header: {auth_header}", flush=True)
    print(f"Token exists?: {bool(token)}", flush=True)
    print(f"Token length: {len(token) if token else 0}", flush=True)
    print(f"SECRET_KEY SHA256 hash (ONLY first 8 chars): {secret_hash}", flush=True)
    print(f"DATABASE_URL: {DATABASE_URL}", flush=True)
    print(f"Absolute database file path: {abs_db_path}", flush=True)
    print(f"Current working directory: {os.getcwd()}", flush=True)
    print("----------------------------------------------------", flush=True)

    if not token:
        print("401 caused by missing token", flush=True)
        raise credentials_exception
        
    payload = None
    username = None
    role = None
    exp = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        role = payload.get("role")
        exp = payload.get("exp")
        print(f"Decoded payload: {payload}", flush=True)
        print(f"Username: {username}", flush=True)
        print(f"Role: {role}", flush=True)
        print(f"Expiration: {exp}", flush=True)
        print(f"Current UTC time: {datetime.utcnow().isoformat()}", flush=True)
        if username is None:
            print("401 caused by missing sub in payload", flush=True)
            raise credentials_exception
    except JWTError as e:
        print(f"Exception class: {type(e).__name__}", flush=True)
        print(f"Exception message: {str(e)}", flush=True)
        print("401 caused by jwt.decode()", flush=True)
        raise credentials_exception
    except Exception as e:
        print(f"Exception class: {type(e).__name__}", flush=True)
        print(f"Exception message: {str(e)}", flush=True)
        print("401 caused by jwt.decode()", flush=True)
        raise credentials_exception

    print("\nRunning database lookup...", flush=True)
    print(f"Username being searched: {username}", flush=True)
    print(f"Database path: {abs_db_path}", flush=True)
    try:
        user_count = db.query(User).count()
        print(f"Total users in database: {user_count}", flush=True)
        users_list = db.query(User.username, User.role).all()
        print(f"SELECT username, role FROM users: {users_list}", flush=True)
    except Exception as db_err:
        print(f"Error reading users table: {db_err}", flush=True)

    user = db.query(User).filter(User.username == username).first()
    print(f"Returned user object: {user}", flush=True)
    
    if user is None:
        print("401 caused because user does not exist.", flush=True)
        raise credentials_exception

    print(f"User ID: {user.id}", flush=True)
    print(f"Username: {user.username}", flush=True)
    print(f"Role: {user.role}", flush=True)
    print(f"Active: {getattr(user, 'is_active', None)}", flush=True)
    print("SUCCESS: User authenticated successfully", flush=True)
    return user

def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not token:
        token = request.query_params.get("token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    return db.query(User).filter(User.username == username).first()

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        print(f"\nAllowed roles: {self.allowed_roles}", flush=True)
        print(f"User role: {current_user.role}", flush=True)
        if current_user.role not in self.allowed_roles:
            print("403 caused by RoleChecker", flush=True)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user
