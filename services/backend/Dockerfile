FROM golang:1.25.7-alpine AS builder
WORKDIR /app
COPY . .
RUN GOFLAGS=-mod=mod go mod tidy \
  && GOFLAGS=-mod=mod go mod download \
  && GOFLAGS=-mod=mod go build -o /backend ./cmd/server

FROM alpine:3.21
WORKDIR /app
RUN adduser -D -u 1001 appuser
COPY --from=builder /backend /usr/local/bin/backend
COPY migrations ./migrations
USER appuser
EXPOSE 8080
CMD ["/usr/local/bin/backend"]
