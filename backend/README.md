# Workshop Agent - Setup

A lightweight camera surveillance agent built with Strands AI Agent Framework and FastAPI.

## Features

- FastAPI server with streaming responses
- Strands agent with Claude Haiku 4.5
- Built-in calculator tool
- Custom camera query tool (fetches from KVS + analyzes with Bedrock)
- Docker-based local development

## Quick Start

1. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your AWS credentials and configuration
```

2. **Start the agent**
```bash
make dev
```

The agent will be available at http://localhost:8081

**Hot reloading is enabled** - any changes to the code will automatically restart the server.

3. **Test it**
```bash
make test
```

## Project Structure

```
backend/
├── app.py                      # FastAPI server & agent
├── requirements.txt            # Dependencies
├── Dockerfile                  # Container definition
├── docker-compose.yml          # Local dev setup
├── Makefile                    # Dev commands
├── .env.example                # Config template
├── streaming/
│   ├── __init__.py
│   └── event_parser.py         # Event parsing logic
└── tools/
    ├── __init__.py             # Tool exports
    ├── camera_tools.py         # Camera tool definition
    ├── aws/
    │   ├── kvs_client.py       # KVS image fetching
    │   └── bedrock_client.py   # AI image analysis
    └── services/
        └── camera_service.py   # Business logic
```

## Tools

### Calculator
Built-in tool from `strands_tools` for basic math operations.

### Query Camera
Custom tool that:
1. Fetches the latest image from a Kinesis Video Stream
2. Analyzes it using Bedrock vision model (Nova Lite)
3. Returns analysis results

## API Endpoints

- `GET /ping` - Health check
- `POST /invocations` - Agent invocation (streaming)

### Example Request
```bash
curl -X POST http://localhost:8081/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What do you see in the camera?"}'
```

## Configuration

All configuration is in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region for all services (required) | Set to your workshop region |
| `KVS_STREAM_NAME` | KVS stream name | backyard |
| `AGENT_MODEL_ID` | Agent text model | anthropic.claude-haiku-4-5-20251001-v1:0 |
| `IMAGE_MODEL_ID` | Vision model | amazon.nova-lite-v1:0 |

Note: Bedrock calls are automatically configured to use `us-east-1`.

## Commands

```bash
make help   # Show available commands
make dev    # Start agent in Docker
make stop   # Stop the agent
make clean  # Clean up Docker resources
make test   # Test the agent
```
