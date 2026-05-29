import os
import logging
from typing import Optional
from dotenv import load_dotenv

# Load environment variables BEFORE importing tools (they read env vars at import time)
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from strands import Agent
from strands.models.bedrock import BedrockModel
from strands_tools import current_time
from tools.camera_tools import query_camera, get_video
from tools.temp_tools import query_temperature
from sub_agents.temperature_agent import temperature_agent
from streaming import parse_agent_events
from utils import get_user_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("workshop-agent")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """# Instructions
You are a helpful smart home agent.
You have access to several tools that help you answer a home owner's questions regarding their house.
The house is located in North-Pole, Northern Sweden.

# Rules
- Always respond concisely and use your tools when appropriate.
- All responses should be markdown formatted, with images and urls properly formatted.
- Always use timestamps in UTC


"""

# Bedrock models are only available in specific regions - us-east-1 is used for this workshop
model = BedrockModel(
    model_id=os.getenv(
        "AGENT_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0"
    ),
    max_tokens=4000,
    region_name="us-east-1",
)

# Global agent instance (lazy initialization)
agent: Agent | None = None


def get_or_create_agent(session_id: str, user_id: str) -> Agent:
    """Get or create the agent instance."""
    global agent
    if agent is None:
        logger.info("Creating agent")
        agent = Agent(
            name="Workshop Smart Home Agent",
            model=model,
            system_prompt=SYSTEM_PROMPT,
            tools=[
                current_time,
                query_camera,
                query_temperature,
                get_video,
                temperature_agent,
            ],
            callback_handler=None,
            trace_attributes={
                "session.id": session_id,
                "user.id": user_id,
            },
        )
    return agent


class InvocationRequest(BaseModel):
    prompt: Optional[str] = None


@app.get("/ping")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/invocations")
async def invocations(payload: InvocationRequest, request: Request):
    """Main agent invocation endpoint with streaming"""
    # Get session and user from headers
    session_id = request.headers.get(
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id", "unknown"
    )
    user_id = get_user_id(request.headers.get("Authorization", ""))

    logger.info(f"Session: {session_id}, User: {user_id}, Prompt: {payload.prompt}")

    if not payload.prompt:
        return {"error": "No prompt provided"}

    agent = get_or_create_agent(session_id, user_id)
    agent_stream = agent.stream_async(payload.prompt)
    parsed_stream = parse_agent_events(agent_stream)

    return StreamingResponse(parsed_stream, media_type="application/x-ndjson")
