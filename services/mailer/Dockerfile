FROM golang:1.25.7-alpine AS builder
WORKDIR /app
COPY . .
RUN GOFLAGS=-mod=mod go mod tidy \
  && GOFLAGS=-mod=mod go mod download \
  && GOFLAGS=-mod=mod go build -o /mailer ./cmd/worker

FROM alpine:3.21
WORKDIR /app
RUN adduser -D -u 1001 appuser
COPY --from=builder /mailer /usr/local/bin/mailer
USER appuser
CMD ["/usr/local/bin/mailer"]
