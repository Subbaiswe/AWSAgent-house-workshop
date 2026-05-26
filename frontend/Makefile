.PHONY: help dev install build deploy-infra clean check

help:
	@echo "Available commands:"
	@echo ""
	@echo "  make dev            Start development server (checks prerequisites)"
	@echo "  make install        Install dependencies"
	@echo "  make build          Build for production"
	@echo "  make deploy-infra   Deploy workshop infrastructure (Cognito, Athena)"
	@echo "  make check          Check prerequisites only"
	@echo "  make clean          Remove node_modules and dist"
	@echo ""

check:
	@echo "Checking prerequisites..."
	@which node > /dev/null 2>&1 || { \
		echo ""; \
		echo "❌ Node.js is not installed."; \
		echo ""; \
		echo "Please install Node.js 18+ from:"; \
		echo "  Mac: brew install node  OR  https://nodejs.org"; \
		echo "  Windows: https://nodejs.org"; \
		echo ""; \
		echo "After installing, run 'make dev' again."; \
		echo ""; \
		exit 1; \
	}
	@which npm > /dev/null 2>&1 || { \
		echo ""; \
		echo "❌ npm is not installed."; \
		echo ""; \
		echo "npm comes with Node.js. Please install Node.js from:"; \
		echo "  https://nodejs.org"; \
		echo ""; \
		exit 1; \
	}
	@echo "✓ Node.js and npm are installed"
	@if [ ! -f .env ]; then \
		echo ""; \
		echo "⚠️  .env file not found."; \
		echo ""; \
		echo "Please copy .env.example to .env and configure it:"; \
		echo "  cp .env.example .env"; \
		echo ""; \
		echo "Then edit .env with your configuration values."; \
		echo "Run 'make deploy-infra' to deploy infrastructure and get the values."; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ .env file exists"
	@if [ ! -d node_modules ]; then \
		echo ""; \
		echo "📦 Dependencies not installed. Installing..."; \
		echo ""; \
		npm install; \
		echo ""; \
		echo "✓ Dependencies installed successfully"; \
		echo ""; \
	else \
		echo "✓ Dependencies are installed"; \
	fi

dev: check
	@echo ""
	@echo "🚀 Starting development server..."
	@echo ""
	npm run dev

install:
	npm install

build: check
	npm run build

deploy-infra:
	@cd infrastructure && $(MAKE) deploy

clean:
	rm -rf node_modules dist
