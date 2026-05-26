import os
import boto3


class BedrockClient:
    def __init__(self):
        # Bedrock models are only available in specific regions - us-east-1 is used for this workshop
        self.region = "us-east-1"
        self.image_model_id = os.getenv("IMAGE_MODEL_ID", "amazon.nova-lite-v1:0")
        self.client = boto3.client("bedrock-runtime", region_name=self.region)

    def analyze_image(self, image_bytes: bytes, question: str) -> str:
        """Analyze an image using Bedrock vision model"""
        messages = [
            {
                "role": "user",
                "content": [
                    {"image": {"format": "jpeg", "source": {"bytes": image_bytes}}},
                    {"text": question}
                ]
            }
        ]

        try:
            response = self.client.converse(
                modelId=self.image_model_id,
                messages=messages,
                inferenceConfig={
                    "maxTokens": 1000,
                    "temperature": 0.2
                }
            )

            answer = response["output"]["message"]["content"][0]["text"]
            return answer

        except Exception as e:
            print(f"Error analyzing image with Bedrock: {e}")
            raise


bedrock_client = BedrockClient()


def analyze_image(image_bytes: bytes, question: str) -> str:
    """Analyze an image using Bedrock"""
    return bedrock_client.analyze_image(image_bytes, question)
