# Stage 1: Build dependencies and application
FROM rust:1.85-bookworm AS builder

WORKDIR /app

# Copy manifests for dependency caching
COPY Cargo.toml Cargo.lock ./

# Create dummy main.rs to cache dependency compilation
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy actual source code and migrations
COPY src/ src/
COPY migrations/ migrations/

# Touch main.rs to invalidate the dummy build cache for src
RUN touch src/main.rs

# Build release binary with offline SQLx checking
ENV SQLX_OFFLINE=true
RUN cargo build --release

# Stage 2: Minimal runtime image
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled binaries
COPY --from=builder /app/target/release/financepulse /usr/local/bin/financepulse
COPY --from=builder /app/target/release/seed /usr/local/bin/seed

# Copy migrations for runtime migration execution
COPY --from=builder /app/migrations /app/migrations

# Create non-root user
RUN groupadd -r financepulse && useradd -r -g financepulse financepulse
USER financepulse

WORKDIR /app

EXPOSE 8080

ENTRYPOINT ["financepulse"]
