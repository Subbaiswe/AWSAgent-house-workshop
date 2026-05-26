import os
from typing import Dict, Any
from tools.aws import kvs_client, bedrock_client


def query_camera(question: str) -> Dict[str, Any]:
    """Query the camera by fetching latest image and analyzing it"""
    stream_name = os.getenv("KVS_STREAM_NAME")

    if not stream_name:
        raise ValueError("KVS_STREAM_NAME not configured in environment")

    image_data = kvs_client.get_latest_image(stream_name)

    if not image_data:
        return {"message": "No recent images available from the camera"}

    analysis = bedrock_client.analyze_image(image_data, question)
    return {"message": analysis}
