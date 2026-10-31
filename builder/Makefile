# Summit Standalone Builder Execution System Makefile

BINARY_DIR := bin
BINARY_NAME := worker
WORKER_BIN := $(BINARY_DIR)/$(BINARY_NAME)
CMD_PKG := ./cmd/worker

.PHONY: all build test test-race vet fmt clean

all: build

build:
	@mkdir -p $(BINARY_DIR)
	go build -o $(WORKER_BIN) $(CMD_PKG)

test:
	go test ./...

test-race:
	go test -race ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

clean:
	rm -rf $(BINARY_DIR)
