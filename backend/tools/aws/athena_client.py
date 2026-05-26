import os
import time
import boto3
from typing import List, Dict, Any


class AthenaClient:
    def __init__(self):
        self.database = os.getenv("ATHENA_DATABASE", "house_db")
        self.output_bucket = os.getenv("ATHENA_OUTPUT_BUCKET")
        self.region = os.getenv("AWS_REGION")

        if not self.region:
            raise ValueError("AWS_REGION environment variable is required")
        if not self.output_bucket:
            raise ValueError("ATHENA_OUTPUT_BUCKET not configured in environment")

        self.output_location = f"s3://{self.output_bucket}/athena-output/"
        self.client = boto3.client("athena", region_name=self.region)
        self.max_attempts = 30
        self.poll_interval = 1

    def execute_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute Athena query and return results"""
        if not query.strip().upper().startswith("SELECT"):
            raise ValueError("Only SELECT queries are allowed")

        if "ingest_date" not in query.lower():
            raise ValueError(
                "Query must include partition filter on ingest_date for performance. "
                "Example: WHERE ingest_date >= '2025-01-01'"
            )

        execution = self.client.start_query_execution(
            QueryString=query,
            QueryExecutionContext={"Database": self.database},
            ResultConfiguration={"OutputLocation": self.output_location},
        )
        execution_id = execution["QueryExecutionId"]

        for attempt in range(self.max_attempts):
            if attempt > 0:
                time.sleep(self.poll_interval)

            status = self.client.get_query_execution(QueryExecutionId=execution_id)
            state = status["QueryExecution"]["Status"]["State"]

            if state == "SUCCEEDED":
                all_rows = []
                next_token = None

                while True:
                    if next_token:
                        results = self.client.get_query_results(
                            QueryExecutionId=execution_id,
                            NextToken=next_token
                        )
                    else:
                        results = self.client.get_query_results(
                            QueryExecutionId=execution_id
                        )

                    all_rows.extend(results["ResultSet"]["Rows"])
                    next_token = results.get("NextToken")

                    if not next_token:
                        break

                return all_rows

            if state in ("FAILED", "CANCELLED"):
                error_reason = status["QueryExecution"]["Status"].get(
                    "StateChangeReason", "Unknown error"
                )
                raise Exception(f"Query execution {state}: {error_reason}")

        raise Exception(f"Query execution timed out after {self.max_attempts} attempts")


athena_client = AthenaClient()


def execute_query(query: str) -> List[Dict[str, Any]]:
    return athena_client.execute_query(query)
