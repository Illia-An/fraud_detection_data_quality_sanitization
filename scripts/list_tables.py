"""Read-only: list tables/views in the configured database. Do not write."""

from sqlalchemy import text

from db.connection import get_engine


def main() -> None:
    engine = get_engine()
    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT DB_NAME() AS db_name")).scalar()
        print(f"CONNECTED ok | database={db_name}")
        rows = conn.execute(
            text(
                """
                SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE IN (N'BASE TABLE', N'VIEW')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
                """
            )
        ).fetchall()
        print(f"tables_and_views={len(rows)}")
        for schema, name, ttype in rows:
            print(f"{ttype}\t{schema}.{name}")


if __name__ == "__main__":
    main()
