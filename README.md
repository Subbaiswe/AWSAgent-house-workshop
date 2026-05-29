# AWS Agentic House Workshop

A smart home AI agent built with the **Strands AI Agent Framework**, **FastAPI**, and **React**. The agent can answer questions about your house — querying temperature/humidity data, analyzing camera feeds, and more — all powered by Amazon Bedrock and deployed on AWS AgentCore.

## What This Project Does

- Chat with an AI agent about your smart home
- Query historical temperature and humidity data (via Amazon Athena)
- Analyze live camera feeds (via Kinesis Video Streams + Bedrock vision models)
- Authenticate users via AWS Cognito (OAuth 2.0)
- Deploy the agent to AWS AgentCore for production use
- Supports both local (Docker) and cloud-deployed backends

## Architecture

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────────┐
│   React UI  │──────▶│  FastAPI Backend  │──────▶│   Amazon Bedrock    │
│ (Vite/React)│       │  (Strands Agent)  │       │  (Claude Haiku 4.5) │
└─────────────┘       └──────────────────┘       └─────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              ┌──────────┐ ┌─────┐ ┌──────────┐
              │  Athena  │ │ KVS │ │ Bedrock  │
              │(Temp DB) │ │(Cam)│ │ (Vision) │
              └──────────┘ └─────┘ └──────────┘
```

## Prerequisites

Install these before starting:

| Software | Version | Download |
|----------|---------|----------|
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Node.js** | 18+ | https://nodejs.org/ |
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop/ |
| **AWS CLI** | v2 | https://aws.amazon.com/cli/ |
| **Git** | Latest | https://git-scm.com/downloads |

### Windows-Specific Notes

- `make` is not available natively on Windows. Use the manual commands shown below, or install make via `choco install make` or `scoop install make`.
- For ARM64 Docker builds (required for AgentCore deployment), you need QEMU emulation. Run: `docker run --privileged --rm tonistiigi/binfmt --install arm64`
- ARM64 builds under emulation are slow (~20-30 min for pip install). This is normal.

## Project Structure

```
agent-house-workshop/
├── backend/
│   ├── app.py                  # FastAPI server & main agent
│   ├── sub_agents/
│   │   └── temperature_agent.py # Temperature/humidity sub-agent
│   ├── tools/
│   │   ├── camera_tools.py     # Camera query & video tools
│   │   ├── temp_tools.py       # Temperature query tool (Athena)
│   │   └── aws/                # AWS service clients
│   ├── streaming/
│   │   └── event_parser.py     # SSE event parsing
│   ├── docker-compose.yml      # Local dev setup
│   ├── Dockerfile              # Container definition
│   ├── template.yaml           # CloudFormation for AgentCore
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main chat interface
│   │   ├── hooks/
│   │   │   ├── useAuth.js      # OAuth flow & token management
│   │   │   └── useStreaming.js # Streaming fetch with event handling
│   │   └── components/         # React UI components
│   ├── package.json            # Node dependencies
│   └── vite.config.js          # Vite configuration
└── Makefile                    # Root-level commands
```

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Subbaiswe/AWSAgent-house-workshop.git
cd AWSAgent-house-workshop
```

### 2. Configure AWS Credentials

Get temporary credentials from your AWS Workshop Studio (or your own AWS account) and set them:

**PowerShell (Windows):**
```powershell
$env:AWS_ACCESS_KEY_ID="your-access-key"
$env:AWS_SECRET_ACCESS_KEY="your-secret-key"
$env:AWS_SESSION_TOKEN="your-session-token"
$env:AWS_DEFAULT_REGION="eu-central-1"
```

**Bash (Mac/Linux):**
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_SESSION_TOKEN="your-session-token"
export AWS_DEFAULT_REGION="eu-central-1"
```

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in:
- AWS credentials (ACCESS_KEY_ID, SECRET_ACCESS_KEY, SESSION_TOKEN)
- Cognito values (USER_POOL_ID, WEB_CLIENT_ID, M2M_CLIENT_ID, COGNITO_DOMAIN)
- Other service values from CloudFormation outputs

### 4. Start the Backend (Local Docker)

**With make (Mac/Linux/Git Bash):**
```bash
cd backend
make dev
```

**Without make (Windows PowerShell):**
```powershell
cd backend
docker compose up --build
```

The backend runs at http://localhost:8081

### 5. Configure Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_COGNITO_DOMAIN=your-cognito-domain
VITE_CLIENT_ID=your-web-client-id
VITE_AWS_REGION=eu-central-1
VITE_LOCAL_BACKEND_URL=http://localhost:8081/invocations
VITE_DEPLOYED_BACKEND_URL=  # Fill after deploying to AgentCore
```

### 6. Start the Frontend

**With make:**
```bash
cd frontend
make dev
```

**Without make (Windows PowerShell):**
```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at http://localhost:3000

### 7. Use the App

1. Open http://localhost:3000
2. You'll be redirected to Cognito login — sign up or sign in
3. Start chatting with the agent!

Try questions like:
- "What's the current temperature in the kitchen?"
- "What was the average temperature this week?"
- "What do you see in the camera?"

## Deploying to AWS AgentCore

### Build and Push ARM64 Image

**With make (Mac/Linux):**
```bash
cd backend
make build-and-push
```

**Without make (Windows PowerShell):**
```powershell
cd backend

# Login to ECR
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin "YOUR_ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com"

# Create ECR repo (first time only)
aws ecr create-repository --region eu-central-1 --repository-name agentic-house-orchestrator

# Build ARM64 image and push (takes ~20-30 min on Windows due to emulation)
docker buildx create --name mybuilder --use
docker buildx build --platform linux/arm64 -t YOUR_ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/agentic-house-orchestrator:v1 --push .
```

### Deploy CloudFormation Stack

**With make:**
```bash
cd backend
make deploy
```

**Without make (Windows PowerShell):**
```powershell
aws cloudformation deploy --region eu-central-1 --template-file template.yaml --stack-name agentic-house-agent --capabilities CAPABILITY_IAM --parameter-overrides ContainerImageUri=YOUR_ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/agentic-house-orchestrator:v1 UserPoolId=YOUR_USER_POOL_ID WebClientId=YOUR_WEB_CLIENT_ID M2MClientId=YOUR_M2M_CLIENT_ID KvsStreamName=backyard AthenaDatabase=house_db AthenaOutputBucket=YOUR_ATHENA_BUCKET AgentModelId=global.anthropic.claude-haiku-4-5-20251001-v1:0 ImageModelId=global.amazon.nova-2-lite-v1:0 --no-fail-on-empty-changeset
```

### Get Deployed Endpoint

**With make:**
```bash
make outputs
```

**Without make:**
```powershell
aws cloudformation describe-stacks --region eu-central-1 --stack-name agentic-house-agent --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" --output table
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `make` not recognized (Windows) | Use the PowerShell commands shown above, or install via `choco install make` |
| "Unable to locate credentials" in chat | Set AWS credentials in `backend/.env` and restart Docker |
| "ExpiredToken" error | Get fresh credentials from Workshop Studio and update `.env` |
| Cognito login page unreachable | Check `VITE_COGNITO_DOMAIN` and `VITE_CLIENT_ID` in `frontend/.env` |
| ARM64 build `exec format error` | Run `docker run --privileged --rm tonistiigi/binfmt --install arm64` first |
| ARM64 build very slow | Normal — QEMU emulation on x86 is slow. Wait ~20-30 min |
| Stack in ROLLBACK_COMPLETE | Delete it first: `aws cloudformation delete-stack --stack-name agentic-house-agent` |

## Tech Stack

- **Agent Framework:** [Strands Agents](https://github.com/strands-agents/strands-agents) v1.15.0
- **LLM:** Amazon Bedrock (Claude Haiku 4.5)
- **Backend:** FastAPI + Uvicorn
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Auth:** AWS Cognito (OAuth 2.0 Authorization Code flow)
- **Data:** Amazon Athena (temperature), Kinesis Video Streams (camera)
- **Deployment:** AWS AgentCore, ECR, CloudFormation
- **Containerization:** Docker (ARM64)

## License

This project was created as part of an AWS workshop.
