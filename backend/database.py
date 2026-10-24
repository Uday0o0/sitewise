"""SQLAlchemy async engine and session for SQLite."""

import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sitewise.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


from sqlalchemy import text


async def init_db():
    """Create all tables and execute safe SQLite migrations for existing databases."""
    import models  # noqa: F401 - ensure all tables are registered with Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _migrate(sync_conn):
            # Migrate findings
            res_fnd = sync_conn.execute(text("PRAGMA table_info(findings)")).fetchall()
            cols_fnd = {row[1] for row in res_fnd}
            if "image_id" not in cols_fnd:
                sync_conn.execute(text("ALTER TABLE findings ADD COLUMN image_id VARCHAR"))
            if "analysis_id" not in cols_fnd:
                sync_conn.execute(text("ALTER TABLE findings ADD COLUMN analysis_id VARCHAR"))

            # Migrate graph_nodes
            res_nodes = sync_conn.execute(text("PRAGMA table_info(graph_nodes)")).fetchall()
            cols_nodes = {row[1] for row in res_nodes}
            if "project_id" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN project_id VARCHAR DEFAULT 'PRJ-NH48-PKG3'"))
            if "node_type" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN node_type VARCHAR DEFAULT 'FINDING'"))
            if "document_id" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN document_id VARCHAR"))
            if "passage_id" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN passage_id INTEGER"))
            if "page_number" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN page_number INTEGER"))
            if "citation_text" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN citation_text TEXT"))
            if "finding_id" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN finding_id VARCHAR"))
            if "rationale" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN rationale TEXT"))
            if "confidence" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN confidence FLOAT"))
            if "metadata_json" not in cols_nodes:
                sync_conn.execute(text("ALTER TABLE graph_nodes ADD COLUMN metadata_json JSON DEFAULT '{}'"))

            # Migrate graph_edges
            res_edges = sync_conn.execute(text("PRAGMA table_info(graph_edges)")).fetchall()
            cols_edges = {row[1] for row in res_edges}
            if "project_id" not in cols_edges:
                sync_conn.execute(text("ALTER TABLE graph_edges ADD COLUMN project_id VARCHAR DEFAULT 'PRJ-NH48-PKG3'"))
            if "relationship_type" not in cols_edges:
                sync_conn.execute(text("ALTER TABLE graph_edges ADD COLUMN relationship_type VARCHAR DEFAULT 'TRIGGERS'"))
            if "provenance" not in cols_edges:
                sync_conn.execute(text("ALTER TABLE graph_edges ADD COLUMN provenance VARCHAR DEFAULT 'SYNTHETIC_DEMO'"))
            if "rationale" not in cols_edges:
                sync_conn.execute(text("ALTER TABLE graph_edges ADD COLUMN rationale TEXT"))
            if "confidence" not in cols_edges:
                sync_conn.execute(text("ALTER TABLE graph_edges ADD COLUMN confidence FLOAT"))

        await conn.run_sync(_migrate)

    # Ensure baseline project and data are seeded if missing (idempotent, safe for production)
    from seed import seed_baseline_if_missing
    async with async_session() as session:
        await seed_baseline_if_missing(session, force=False)



async def get_db():
    """Yield an async session for FastAPI dependency injection."""
    async with async_session() as session:
        yield session
