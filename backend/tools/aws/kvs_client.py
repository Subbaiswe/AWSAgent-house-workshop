import os
import base64
import logging
from datetime import datetime, timedelta
from typing import Optional
import boto3

logger = logging.getLogger(__name__)


class KVSClient:
    def __init__(self):
        self.region = os.getenv("AWS_REGION")
        if not self.region:
            raise ValueError("AWS_REGION environment variable is required")
        self.kvs_client = boto3.client("kinesisvideo", region_name=self.region)

    def get_latest_image(self, stream_name: str) -> Optional[bytes]:
        """Fetch the latest image from a Kinesis Video Stream"""
        try:
            endpoint_response = self.kvs_client.get_data_endpoint(
                StreamName=stream_name,
                APIName="GET_IMAGES"
            )
            endpoint = endpoint_response["DataEndpoint"]

            media_client = boto3.client(
                "kinesis-video-archived-media",
                endpoint_url=endpoint,
                region_name=self.region
            )

            end_time = datetime.utcnow()
            start_time = end_time - timedelta(seconds=10)

            response = media_client.get_images(
                StreamName=stream_name,
                ImageSelectorType="SERVER_TIMESTAMP",
                StartTimestamp=start_time,
                EndTimestamp=end_time,
                MaxResults=1,
                Format="JPEG"
            )

            if response.get("Images"):
                image_entry = response["Images"][0]
                image_data = image_entry["ImageContent"]

                if isinstance(image_data, str):
                    image_data = base64.b64decode(image_data)

                return image_data

            return None

        except Exception as e:
            print(f"Error fetching image from KVS: {e}")
            raise


kvs_client = KVSClient()


def get_latest_image(stream_name: str) -> Optional[bytes]:
    """Get the latest image from a KVS stream"""
    return kvs_client.get_latest_image(stream_name)


def get_clip(stream_name: str, start_time: datetime, end_time: datetime) -> bytes:
    """Get a video clip from a KVS stream as MP4 bytes"""
    try:
        endpoint_response = kvs_client.kvs_client.get_data_endpoint(
            StreamName=stream_name, APIName="GET_CLIP"
        )
        media_client = boto3.client(
            "kinesis-video-archived-media",
            endpoint_url=endpoint_response["DataEndpoint"],
            region_name=kvs_client.region,
        )

        logger.info(f"Getting clip: {start_time.isoformat()} to {end_time.isoformat()}")

        response = media_client.get_clip(
            StreamName=stream_name,
            ClipFragmentSelector={
                "FragmentSelectorType": "SERVER_TIMESTAMP",
                "TimestampRange": {
                    "StartTimestamp": start_time,
                    "EndTimestamp": end_time,
                },
            },
        )
        return response["Payload"].read()

    except Exception as e:
        logger.error(f"Error getting clip from KVS: {e}")
        raise
