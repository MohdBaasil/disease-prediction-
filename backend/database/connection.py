import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

raw_db_url = os.getenv("DATABASE_URL", "sqlite:///./hospital_v2.db")

# Resolve relative SQLite database paths relative to project root
if raw_db_url.startswith("sqlite:///./"):
    db_filename = raw_db_url[12:]
    abs_db_path = os.path.normpath(os.path.join(BASE_DIR, db_filename))
    DATABASE_URL = f"sqlite:///{abs_db_path}"
elif raw_db_url.startswith("sqlite:///") and not os.path.isabs(raw_db_url[10:]):
    abs_db_path = os.path.normpath(os.path.join(BASE_DIR, raw_db_url[10:]))
    DATABASE_URL = f"sqlite:///{abs_db_path}"
else:
    DATABASE_URL = raw_db_url

# For SQLite, check_same_thread must be False to allow multi-threaded access
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Enable foreign keys enforcement in SQLite
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
