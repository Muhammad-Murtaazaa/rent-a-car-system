import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Default to PostgreSQL from environment, fallback to local SQLite for local testing
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///app_data/car_rental.db")

is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

if is_sqlite:
    os.makedirs("app_data/documents", exist_ok=True)
    os.makedirs("app_data/backups", exist_ok=True)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 15},
        pool_pre_ping=True,
    )

    # High-speed, low-RAM SQLite PRAGMAs (WAL mode allows concurrent reads without locks)
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA cache_size=-8000")  # ~8MB page cache for fast queries with minimal RAM
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()
else:
    # Fix potential postgres:// vs postgresql:// scheme issue from services like Heroku/Render
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
