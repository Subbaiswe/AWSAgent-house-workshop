.PHONY: help dev stop build-and-push deploy outputs test-m2m logs

# Configuration
ECR_REPO_NAME := agentic-house-orchestrator
STACK_NAME ?= agentic-house-agent

# Derived values (evaluated at runtime)
AWS_ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)
# AWS_REGION is read from .env file - must be set there
AWS_REGION = $(shell grep '^AWS_REGION=' .env 2>/dev/null | cut -d'=' -f2)

help:
	@echo "Available commands:"
	@echo ""
	@echo "  make dev             Start the agent in Docker (port 8081)"
	@echo "  make stop            Stop the Docker container"
	@echo "  make build-and-push  Build and push image to ECR"
	@echo "  make deploy          Deploy to AgentCore Runtime"
	@echo "  make outputs         Show CloudFormation stack outputs"
	@echo "  make test-m2m        Test M2M authentication with deployed agent"
	@echo "  make logs            Show logs from the last 15 minutes"
	@echo ""

dev:
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found"; \
		echo ""; \
		echo "Please copy .env.example to .env and configure it:"; \
		echo "  cp .env.example .env"; \
		echo ""; \
		exit 1; \
	fi
	@echo "🚀 Starting workshop agent..."
	@echo ""
	docker compose up --build

stop:
	@echo "🛑 Stopping workshop agent..."
	docker compose down

build-and-push:
	@TAG=$$(date +%Y%m%d-%H%M%S) && \
		IMAGE=$(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(ECR_REPO_NAME):$$TAG && \
		echo "🔧 Building and pushing to ECR..." && \
		echo "   Account: $(AWS_ACCOUNT_ID)" && \
		echo "   Region:  $(AWS_REGION)" && \
		echo "   Image:   $$IMAGE" && \
		echo "" && \
		aws ecr describe-repositories --region $(AWS_REGION) --repository-names $(ECR_REPO_NAME) > /dev/null 2>&1 || \
			aws ecr create-repository --region $(AWS_REGION) --repository-name $(ECR_REPO_NAME) > /dev/null && \
		aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin \
			$(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com && \
		docker build --platform linux/arm64 -t $$IMAGE . && \
		docker push $$IMAGE && \
		echo "$$IMAGE" > .orchestrator-image && \
		echo "" && \
		echo "✅ Image pushed: $$IMAGE" && \
		echo "   Saved to .orchestrator-image"

deploy:
	@if [ ! -f .orchestrator-image ]; then \
		echo "❌ No image found. Run 'make build-and-push' first."; \
		exit 1; \
	fi
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found. Copy .env.example and configure it."; \
		exit 1; \
	fi
	@echo "🚀 Deploying to AgentCore Runtime..."
	@set -a && . ./.env && set +a && \
		IMAGE=$$(cat .orchestrator-image) && \
		echo "   Stack:    $(STACK_NAME)" && \
		echo "   Image:    $$IMAGE" && \
		echo "   UserPool: $$USER_POOL_ID" && \
		echo "" && \
		aws cloudformation deploy \
			--region $(AWS_REGION) \
			--template-file template.yaml \
			--stack-name $(STACK_NAME) \
			--capabilities CAPABILITY_IAM \
			--parameter-overrides \
				ContainerImageUri=$$IMAGE \
				UserPoolId=$$USER_POOL_ID \
				WebClientId=$$WEB_CLIENT_ID \
				M2MClientId=$$M2M_CLIENT_ID \
				KvsStreamName=$$KVS_STREAM_NAME \
				AthenaDatabase=$$ATHENA_DATABASE \
				AthenaOutputBucket=$$ATHENA_OUTPUT_BUCKET \
				AgentModelId=$$AGENT_MODEL_ID \
				ImageModelId=$$IMAGE_MODEL_ID \
			--no-fail-on-empty-changeset && \
		echo "" && \
		echo "✅ Deployed successfully!"

outputs:
	@echo "Stack outputs:"
	@aws cloudformation describe-stacks --region $(AWS_REGION) --stack-name $(STACK_NAME) \
		--query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output table
	@echo ""
	@RUNTIME_ARN=$$(aws cloudformation describe-stacks --region $(AWS_REGION) --stack-name $(STACK_NAME) \
		--query 'Stacks[0].Outputs[?OutputKey==`RuntimeArn`].OutputValue' --output text) && \
		ENCODED_ARN=$$(echo "$$RUNTIME_ARN" | sed 's/:/%3A/g' | sed 's/\//%2F/g') && \
		echo "Endpoint: https://bedrock-agentcore.$(AWS_REGION).amazonaws.com/runtimes/$$ENCODED_ARN/invocations?qualifier=DEFAULT"

test-m2m:
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found"; \
		exit 1; \
	fi
	@set -a && . ./.env && set +a && \
		if [ -z "$$M2M_CLIENT_SECRET" ] || [ -z "$$AGENT_ENDPOINT" ]; then \
			echo "❌ M2M_CLIENT_SECRET and AGENT_ENDPOINT must be set in .env"; \
			exit 1; \
		fi && \
		if [ -z "$$COGNITO_DOMAIN" ] || [ -z "$$M2M_CLIENT_ID" ]; then \
			echo "❌ COGNITO_DOMAIN and M2M_CLIENT_ID must be set in .env"; \
			exit 1; \
		fi && \
		echo "🔐 Getting access token..." && \
		TOKEN_URL="https://$$COGNITO_DOMAIN.auth.$(AWS_REGION).amazoncognito.com/oauth2/token" && \
		echo "   URL: $$TOKEN_URL" && \
		echo "   Client ID: $$M2M_CLIENT_ID" && \
		BASIC_AUTH=$$(printf '%s' "$$M2M_CLIENT_ID:$$M2M_CLIENT_SECRET" | base64 | tr -d '\n') && \
		RESPONSE=$$(curl -s -X POST "$$TOKEN_URL" \
			-H "Authorization: Basic $$BASIC_AUTH" \
			-H "Content-Type: application/x-www-form-urlencoded" \
			-d "grant_type=client_credentials&scope=agent-platform-id/service") && \
		TOKEN=$$(echo "$$RESPONSE" | jq -r '.access_token') && \
		if [ "$$TOKEN" = "null" ] || [ -z "$$TOKEN" ]; then \
			echo "❌ Failed to get access token"; \
			echo "   Response: $$RESPONSE"; \
			exit 1; \
		fi && \
		echo "✅ Token received" && \
		echo "" && \
		echo "📤 Sending request to agent..." && \
		curl -s -X POST "$$AGENT_ENDPOINT" \
			-H "Content-Type: application/json" \
			-H "Authorization: Bearer $$TOKEN" \
			-H "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: test-m2m-session-$$$$$$(date +%Y%m%d%H%M%S)-$$$$$$RANDOM" \
			-d '{"prompt": "Hello! What can you help me with?"}' && \
		echo "" && \
		echo "" && \
		echo "✅ M2M test complete"

logs:
	@echo "📋 Fetching logs from the last 15 minutes..."
	@LOG_GROUP=$$(aws logs describe-log-groups \
		--region $(AWS_REGION) \
		--log-group-name-prefix "/aws/bedrock-agentcore/runtimes/house_agent" \
		--query 'logGroups[0].logGroupName' \
		--output text) && \
	if [ "$$LOG_GROUP" = "None" ] || [ -z "$$LOG_GROUP" ]; then \
		echo "❌ No log group found. Is the agent deployed?"; \
		exit 1; \
	fi && \
	echo "   Log group: $$LOG_GROUP" && \
	echo "" && \
	START_TIME=$$(date +%s | awk '{print ($$1 - 900) * 1000}') && \
	aws logs filter-log-events \
		--region $(AWS_REGION) \
		--log-group-name "$$LOG_GROUP" \
		--start-time "$$START_TIME" \
		--query 'events[*].[timestamp,message]' \
		--output text | sort -n
