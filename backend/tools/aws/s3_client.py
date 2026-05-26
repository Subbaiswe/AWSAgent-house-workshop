import os
import logging
from io import BytesIO
import boto3

logger = logging.getLogger(__name__)


class S3Client:
    def __init__(self):
        self.region = os.getenv("AWS_REGION")
        if not self.region:
            raise ValueError("AWS_REGION environment variable is required")
        self.bucket = os.getenv("ATHENA_OUTPUT_BUCKET")
        self.client = boto3.client(
            "s3",
            region_name=self.region,
            endpoint_url=f"https://s3.{self.region}.amazonaws.com",
        )

    def upload_clip(self, video_data: bytes, filename: str) -> str:
        """Upload MP4 to S3 and return a presigned URL (1 hour expiry)"""
        if not self.bucket:
            raise ValueError("ATHENA_OUTPUT_BUCKET not configured")

        s3_key = f"video-clips/{filename}"

        logger.info(f"Uploading clip to s3://{self.bucket}/{s3_key}")

        self.client.upload_fileobj(
            BytesIO(video_data),
            self.bucket,
            s3_key,
            ExtraArgs={"ContentType": "video/mp4"},
        )

        presigned_url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": s3_key},
            ExpiresIn=3600,
        )

        logger.info("Generated presigned URL for clip")
        return presigned_url


s3_client = S3Client()


def upload_clip(video_data: bytes, filename: str) -> str:
    """Upload video clip to S3 and return presigned URL"""
    return s3_client.upload_clip(video_data, filename)
