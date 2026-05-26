# Agent Frontend

A lightweight chat interface for interacting with AI agents. Features OAuth 2.0 authentication via AWS Cognito and real-time streaming responses.

## Quick Start

```bash
# Deploy Cognito
make deploy-cognito

# Configure environment (use values from deploy output)
cp .env.example .env
# Edit .env with your settings

# Start dev server (checks everything automatically)
make dev
```

Visit http://localhost:3000 and you'll be redirected to Cognito login!

## Features

- OAuth 2.0 authentication with AWS Cognito
- Real-time streaming chat with newline-delimited JSON
- Support for tool usage visualization
- Sub-agent execution tracking
- Interrupt handling for approval workflows
- Markdown rendering with syntax highlighting
- Smart authentication (auto-detects local vs. production endpoints)

## Prerequisites

- Node.js 18+ (will be checked automatically)
- AWS CLI configured with appropriate credentials
- An agent backend running locally or deployed

**For Windows users:** You'll need Git Bash (comes with Git for Windows) or WSL to run `make` commands. Alternatively, see the "Without Make" section below.

## Setup

### 1. Deploy Cognito Infrastructure

From the frontend directory:
```bash
make deploy-cognito
```

Or from the infrastructure directory:
```bash
cd infrastructure
make deploy
```

This will create:
- Cognito User Pool with email-based authentication
- User Pool Domain with Managed Login
- Web client for OAuth authorization code flow
- M2M client for machine-to-machine authentication

**Additional commands:**
- `make outputs` - View stack outputs again
- `make delete` - Delete the Cognito stack

### 2. Configure Environment

Copy the example environment file and fill in the values from the CloudFormation outputs:

```bash
cp .env.example .env
```

Edit `.env` with your Cognito configuration:

```env
VITE_COGNITO_DOMAIN=agent-frontend-123456789012
VITE_CLIENT_ID=your-client-id-from-outputs
VITE_AWS_REGION=us-east-1
VITE_BACKEND_URL=http://localhost:8000
```

**Backend URL Options:**
- Local development: `http://localhost:8000` (no auth headers)
- Production: `https://your-api.com` (includes Bearer token)

### 3. Install Dependencies

```bash
make install
```

### 4. Start Development Server

```bash
make dev
```

This will automatically:
- Check if Node.js and npm are installed (with helpful prompts if not)
- Check if `.env` file exists (with instructions if not)
- Install dependencies if needed
- Start the dev server

The frontend will be available at http://localhost:3000

### Without Make (Windows CMD/PowerShell)

If you can't use `make`, run these commands directly:

```bash
# Check Node.js is installed
node --version

# If not installed, download from https://nodejs.org

# Copy and configure environment
copy .env.example .env
# Edit .env with your Cognito values

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Usage

### Creating a User

Since self-signup is enabled, you can create an account directly through the Cognito hosted UI. Alternatively, create a user via AWS CLI:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com \
  --password YourPassword123 \
  --permanent
```

### Authentication Flow

1. Visit http://localhost:3000
2. Redirected to Cognito Managed Login
3. Sign in or sign up
4. Redirected back to `/callback` with authorization code
5. Code exchanged for tokens automatically
6. Chat interface loads

### Event Types

The frontend handles these streaming event types:

- `text` - Main agent text output
- `tool_start` - Tool invocation begins
- `tool` - Complete tool invocation with input
- `sub_text` - Sub-agent reasoning text
- `sub_tool` - Sub-agent tool usage
- `interrupt` - Approval request for sensitive operations
- `result` - Final result, ends stream

## Project Structure

```
frontend/
├── src/
│   ├── hooks/
│   │   ├── useAuth.js          # OAuth flow & token management
│   │   └── useStreaming.js     # Streaming fetch with event handling
│   ├── components/
│   │   ├── ChatMessage.jsx     # Message display with content blocks
│   │   ├── ChatInput.jsx       # Message input field
│   │   ├── ToolTag.jsx         # Tool display component
│   │   └── InterruptApproval.jsx
│   ├── App.jsx                 # Main chat interface
│   └── main.jsx                # React entry point
├── infrastructure/
│   └── cognito.yaml            # CloudFormation template
└── Makefile
```

## Building for Production

```bash
make build
```

Output will be in the `dist/` directory.

## Cleanup

Remove node_modules and build artifacts:

```bash
make clean
```

Delete the Cognito stack:

```bash
cd infrastructure
make delete
```
