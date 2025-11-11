.PHONY: all install-deps gen run

all: install-deps gen run

# Install Go and Node dependencies
install-deps:
	@echo "--- Installing dependencies ---"
	go mod tidy
	(cd ui && yarn install)

# Generate API stubs for backend and frontend
gen:
	@echo "--- Generating API code ---"
	go tool oapi-codegen --config=codegen.yaml openapi.yaml
	(cd ui && yarn gen-client)

# Run both servers with Overmind
run: install-deps gen
	@echo "--- Starting all services with Overmind ---"
	go tool overmind start -f Procfile
