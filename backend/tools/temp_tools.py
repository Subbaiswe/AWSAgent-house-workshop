import logging
from typing import List, Dict, Any
from strands import tool
from tools.aws import athena_client

logger = logging.getLogger("temp-tool")


@tool
def query_temperature(sql: str) -> List[Dict[str, Any]]:
    """Get information about current and historical inside temperature and humidity information.

    This tool executes custom SQL queries against the house_db.temperature_readings table.
    Use this for historical temperature and humidity analysis.

    IMPORTANT SQL Requirements:
    - ALWAYS use partition pruning with ingest_date in WHERE clause
    - Format: ingest_date >= 'YYYY-MM-DD' AND ingest_date <= 'YYYY-MM-DD'
    - Only SELECT queries are allowed

    Table schema:
    - Database: house_db
    - Table: temperature_readings
    - Columns: room (string), temperature (double), humidity (double), time_recorded (string), ingest_date (string, partition key)
    - Rooms: kitchen, livingroom, bedroom

    Args:
        sql: SELECT query to execute (must include partition filter on ingest_date)

    Returns:
        List of result rows from the query

    Raises:
        ValueError: If query is not a SELECT or lacks partition filter
        Exception: If query execution fails
    """
    logger.info(f"query_temperature invoked with SQL: {sql[:100]}...")

    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    dangerous_keywords = [
        "DROP",
        "DELETE",
        "INSERT",
        "UPDATE",
        "ALTER",
        "CREATE",
        "TRUNCATE",
    ]
    for keyword in dangerous_keywords:
        if keyword in sql_upper:
            raise ValueError(f"Dangerous SQL keyword '{keyword}' is not allowed")

    if "INGEST_DATE" not in sql_upper:
        raise ValueError(
            "Query must include ingest_date partition filter for performance. "
            "Example: WHERE ingest_date >= '2025-01-01' AND ingest_date <= '2025-01-31'"
        )

    results = athena_client.execute_query(sql)
    return results
