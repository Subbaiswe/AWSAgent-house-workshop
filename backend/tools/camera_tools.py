import os
import logging
from datetime import datetime
from typing import Dict, Any
from strands import tool
from tools.services import camera_service, url_shortener
from tools.aws import kvs_client, s3_client

logger = logging.getLogger(__name__)


@tool
def query_camera(question: str) -> Dict[str, Any]:
    """Ask a question about what the camera currently sees"""
    logger.info(f"query_camera invoked with question: {question}")
    return camera_service.query_camera(question)


@tool
def get_video(start: str, end: str) -> Dict[str, Any]:
    """Get a video clip from the camera between two timestamps.

    Args:
        start: Start time in ISO8601 format (e.g., '2024-01-15T10:00:00Z')
        end: End time in ISO8601 format (max 3 minutes after start)

    Returns:
        Dict with URL to show the video clip
    """
    logger.info(f"get_video called: start={start}, end={end}")

    # Parse timestamps
    start_time = datetime.fromisoformat(start.replace("Z", "+00:00"))
    end_time = datetime.fromisoformat(end.replace("Z", "+00:00"))

    # Validate duration (max 3 minutes, min 5 seconds)
    duration = (end_time - start_time).total_seconds()
    if duration > 180:
        raise ValueError(
            f"Duration {duration:.0f}s exceeds maximum of 180 seconds (3 minutes)"
        )
    if duration < 5:
        raise ValueError(f"Duration {duration:.0f}s is too short (minimum 5 seconds)")

    stream_name = os.getenv("KVS_STREAM_NAME")
    if not stream_name:
        raise ValueError("KVS_STREAM_NAME not configured")

    # Get clip from KVS
    video_data = kvs_client.get_clip(stream_name, start_time, end_time)

    # Upload to S3
    filename = f"clip_{start_time.strftime('%Y%m%d_%H%M%S')}.mp4"
    presigned_url = s3_client.upload_clip(video_data, filename)

    # Shorten URL
    short_url = url_shortener.shorten_url(presigned_url)

    return {"url": short_url}
