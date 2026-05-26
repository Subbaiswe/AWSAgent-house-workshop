import os
import logging
from typing import AsyncIterator
from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from strands_tools import current_time
from tools.temp_tools import query_temperature
from tools.types import SubAgentResult
from pydantic import BaseModel, Field

logger = logging.getLogger("temp-history-agent")


TEMP_HISTORY_AGENT_PROMPT = """# Instructions
You are a house temperature and humidity analyst that answers questions about a home owner's house temperature and humidity, both current and over time.

# Database Schema
- Database: house_db
- Table: temperature_readings
- Columns:
  - room (string): Room name (kitchen, livingroom, or bedroom)
  - temperature (double): Temperature in Celsius
  - humidity (double): Humidity percentage
  - time_recorded (string): ISO format timestamp when reading was recorded
  - ingest_date (string): Partition key in format YYYY-MM-DD

# SQL Query Requirements
You MUST generate SQL queries that include partition pruning for performance:
- ALWAYS include: WHERE ingest_date >= 'YYYY-MM-DD' AND ingest_date <= 'YYYY-MM-DD'
- Use Presto SQL syntax (Athena uses Presto)
- Keep queries simple and efficient

# Example Queries

## Example 1: Find coldest room today
```sql
SELECT
    room,
    MIN(temperature) as min_temp
FROM "house_db"."temperature_readings"
WHERE ingest_date = date_format(current_date, '%Y-%m-%d')
GROUP BY room
ORDER BY min_temp ASC
LIMIT 1
```

## Example 2: Average temperature per room in past 7 days
```sql
SELECT
    room,
    ROUND(AVG(temperature), 1) as avg_temp,
    ROUND(AVG(humidity), 1) as avg_humidity,
    COUNT(*) as readings
FROM "house_db"."temperature_readings"
WHERE ingest_date >= date_format(current_date - interval '7' day, '%Y-%m-%d')
    AND ingest_date <= date_format(current_date, '%Y-%m-%d')
GROUP BY room
ORDER BY room
```

## Example 3: Find highest temperature in specific date range
```sql
SELECT
    room,
    MAX(temperature) as max_temp
FROM "house_db"."temperature_readings"
WHERE ingest_date >= '2025-11-01'
    AND ingest_date <= '2025-11-30'
GROUP BY room
ORDER BY max_temp DESC
```

## Example 4: Recent readings (when you need specific timestamps)
```sql
SELECT
    room,
    temperature,
    humidity,
    time_recorded
FROM "house_db"."temperature_readings"
WHERE ingest_date = date_format(current_date, '%Y-%m-%d')
ORDER BY time_recorded DESC
LIMIT 10
```

## Example 5: Filter by specific time range within a day
```sql
SELECT
    room,
    temperature,
    humidity,
    time_recorded
FROM "house_db"."temperature_readings"
WHERE ingest_date = '2025-11-28'
    AND from_iso8601_timestamp(time_recorded) BETWEEN
        timestamp '2025-11-28 09:00:00' AND timestamp '2025-11-28 17:00:00'
ORDER BY time_recorded DESC
```

# Rules
- Generate SQL queries based on the user's question
- ALWAYS include partition filters (ingest_date) in your queries
- Keep queries simple - use MIN, MAX, AVG, COUNT as needed
- The time_recorded column is ISO 8601 format - use `from_iso8601_timestamp()` for timestamp operations
- Analyze results and provide a clear, conversational answer
- If results are empty, explain that no data exists for that time period
- Temperature is in Celsius, humidity is in percentage
"""


@tool
async def temperature_agent(question: str) -> AsyncIterator:
    """Ask questions about current and historical temperature and humidity data

    This is a specialized agent that autonomously handles complex historical queries
    about temperature and humidity. It generates SQL queries, executes them, and
    analyzes results to answer questions like:
    - "What was the coldest temperature in the past 5 days?"
    - "What's the average temperature this month?"
    - "When was it warmest in the house?"

    Args:
        question: The question to ask about historical temperature/humidity data

    Yields:
        SubAgentResult events containing sub-agent's streaming activity,
        final yield is the answer message
    """
    logger.info(f"temperature_agent invoked with question: {question}")

    try:
        # Bedrock models are only available in specific regions - us-east-1 is used for this workshop
        model = BedrockModel(
            model_id=os.getenv(
                "AGENT_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0"
            ),
            max_tokens=2000,
            region_name="us-east-1",
        )

        temp_history_agent = Agent(
            name="Temperature History Agent",
            model=model,
            system_prompt=TEMP_HISTORY_AGENT_PROMPT,
            callback_handler=None,
            tools=[query_temperature, current_time],
        )

        result = None

        async for event in temp_history_agent.stream_async(question):
            yield SubAgentResult(agent=temp_history_agent, event=event)

            if "result" in event:
                result = event["result"]

        # Return structured output if available, otherwise string result
        if result:
            if hasattr(result, 'structured_output') and result.structured_output:
                yield result.structured_output.model_dump()
            else:
                yield str(result)
        else:
            yield "Analysis complete"

    except Exception as e:
        logger.error(f"Temperature history agent failed: {str(e)}", exc_info=True)
        yield f"Unable to query temperature history: {str(e)}"
