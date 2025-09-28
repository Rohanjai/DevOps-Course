FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build the application
RUN go build -o storage main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/storage .

# Create the storage directory
RUN mkdir -p /storage

# Expose port
EXPOSE 5000

# Run the application
CMD ["./storage"]