FROM rust:1.85-bookworm AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./

RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY src/ src/
COPY migrations/ migrations/

RUN touch src/main.rs

ENV SQLX_OFFLINE=true
RUN cargo build --release

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/financepulse /usr/local/bin/financepulse
COPY --from=builder /app/target/release/seed /usr/local/bin/seed

COPY --from=builder /app/migrations /app/migrations

RUN groupadd -r financepulse && useradd -r -g financepulse financepulse
USER financepulse

WORKDIR /app

EXPOSE 8080

ENTRYPOINT ["financepulse"]
