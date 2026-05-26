.PHONY: help check-env

# Detect OS for conditional behavior
UNAME_S := $(shell uname -s 2>/dev/null || echo Windows)

help:
	@echo "Workshop Environment Commands:"
	@echo ""
	@echo "  make check-env    Verify all required dependencies are installed"
	@echo ""
	@echo "NOTE: Windows users must run this from Git Bash, WSL, or Cygwin."
	@echo "      For native PowerShell, use: ./check-env.ps1"
	@echo ""

check-env:
	@echo "🔍 Checking workshop prerequisites..."
	@echo "   Detected OS: $(UNAME_S)"
	@echo ""
	@MISSING=0; \
	WARNINGS=0; \
	\
	echo "Checking Python..."; \
	if command -v python3 >/dev/null 2>&1; then \
		PYTHON_CMD="python3"; \
	elif command -v python >/dev/null 2>&1; then \
		PYTHON_CMD="python"; \
	else \
		PYTHON_CMD=""; \
	fi; \
	if [ -n "$$PYTHON_CMD" ]; then \
		PYTHON_VERSION=$$($$PYTHON_CMD --version 2>&1 | sed 's/Python //'); \
		PYTHON_MAJOR=$$(echo $$PYTHON_VERSION | cut -d. -f1); \
		PYTHON_MINOR=$$(echo $$PYTHON_VERSION | cut -d. -f2); \
		if [ "$$PYTHON_MAJOR" -ge 3 ] && [ "$$PYTHON_MINOR" -ge 11 ]; then \
			echo "  ✅ Python $$PYTHON_VERSION (via $$PYTHON_CMD)"; \
		else \
			echo "  ❌ Python $$PYTHON_VERSION (requires 3.11+)"; \
			echo ""; \
			echo "     Install Python 3.11+:"; \
			echo "       macOS:    brew install python@3.11"; \
			echo "       Windows:  https://www.python.org/downloads/"; \
			echo "       Linux:    sudo apt install python3.11 (Ubuntu/Debian)"; \
			echo ""; \
			MISSING=1; \
		fi; \
	else \
		echo "  ❌ Python not found"; \
		echo ""; \
		echo "     Install Python 3.11+:"; \
		echo "       macOS:    brew install python@3.11"; \
		echo "       Windows:  https://www.python.org/downloads/"; \
		echo "       Linux:    sudo apt install python3.11 (Ubuntu/Debian)"; \
		echo ""; \
		MISSING=1; \
	fi; \
	\
	echo "Checking Docker or Finch..."; \
	if command -v docker >/dev/null 2>&1; then \
		DOCKER_VERSION=$$(docker --version 2>&1 | sed 's/Docker version //; s/,.*//' || echo "unknown"); \
		echo "  ✅ Docker $$DOCKER_VERSION"; \
	elif command -v finch >/dev/null 2>&1; then \
		FINCH_VERSION=$$(finch version 2>&1 | head -1 || echo "unknown"); \
		echo "  ✅ Finch $$FINCH_VERSION"; \
	else \
		echo "  ❌ Neither Docker nor Finch found"; \
		echo ""; \
		echo "     Install Docker:"; \
		echo "       macOS:    https://docs.docker.com/desktop/install/mac-install/"; \
		echo "       Windows:  https://docs.docker.com/desktop/install/windows-install/"; \
		echo "       Linux:    https://docs.docker.com/engine/install/"; \
		echo ""; \
		echo "     Or install Finch (AWS alternative):"; \
		echo "       macOS:    brew install finch"; \
		echo "       Windows:  https://github.com/runfinch/finch/releases"; \
		echo ""; \
		MISSING=1; \
	fi; \
	\
	echo "Checking Node.js..."; \
	if command -v node >/dev/null 2>&1; then \
		NODE_VERSION=$$(node --version 2>&1 | sed 's/v//'); \
		NODE_MAJOR=$$(echo $$NODE_VERSION | cut -d. -f1); \
		if [ "$$NODE_MAJOR" -ge 18 ]; then \
			echo "  ✅ Node.js $$NODE_VERSION"; \
		else \
			echo "  ❌ Node.js $$NODE_VERSION (requires 18+)"; \
			echo ""; \
			echo "     Install Node.js 18+:"; \
			echo "       macOS:    brew install node"; \
			echo "       Windows:  https://nodejs.org/en/download/"; \
			echo "       Linux:    https://nodejs.org/en/download/package-manager/"; \
			echo ""; \
			MISSING=1; \
		fi; \
	else \
		echo "  ❌ Node.js not found"; \
		echo ""; \
		echo "     Install Node.js 18+:"; \
		echo "       macOS:    brew install node"; \
		echo "       Windows:  https://nodejs.org/en/download/"; \
		echo "       Linux:    https://nodejs.org/en/download/package-manager/"; \
		echo ""; \
		MISSING=1; \
	fi; \
	\
	echo "Checking AWS CLI..."; \
	if command -v aws >/dev/null 2>&1; then \
		AWS_VERSION=$$(aws --version 2>&1 | cut -d' ' -f1 | sed 's/aws-cli\///'); \
		echo "  ✅ AWS CLI $$AWS_VERSION"; \
		if aws sts get-caller-identity >/dev/null 2>&1; then \
			AWS_ACCOUNT=$$(aws sts get-caller-identity --query Account --output text 2>/dev/null); \
			AWS_USER=$$(aws sts get-caller-identity --query Arn --output text 2>/dev/null | sed 's/.*\///'); \
			echo "  ✅ AWS credentials configured ($$AWS_USER)"; \
		else \
			echo "  ⚠️  No AWS credentials found in current environment"; \
			WARNINGS=1; \
		fi; \
	else \
		echo "  ❌ AWS CLI not found"; \
		echo ""; \
		echo "     Install AWS CLI:"; \
		echo "       macOS:    brew install awscli"; \
		echo "       Windows:  https://aws.amazon.com/cli/"; \
		echo "       Linux:    https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"; \
		echo ""; \
		MISSING=1; \
	fi; \
	\
	echo ""; \
	if [ $$MISSING -eq 0 ] && [ $$WARNINGS -eq 0 ]; then \
		echo "✨ All prerequisites installed! You're ready to start the workshop."; \
		echo ""; \
	elif [ $$MISSING -eq 0 ] && [ $$WARNINGS -eq 1 ]; then \
		echo "✨ All prerequisites installed!"; \
		echo ""; \
		echo "📝 Note: No AWS credentials found in your current environment."; \
		echo "   You'll need to retrieve temporary credentials from the AWS Workshop Studio"; \
		echo "   interface before deploying infrastructure or running the agent."; \
		echo ""; \
	else \
		echo "❌ Some prerequisites are missing. Please install them and run 'make check-env' again."; \
		echo ""; \
		exit 1; \
	fi