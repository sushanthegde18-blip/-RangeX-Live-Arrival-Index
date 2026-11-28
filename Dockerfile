FROM debian:bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY CMakeLists.txt ./
COPY core ./core
COPY backend ./backend

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DRANGEX_BUILD_TESTS=OFF && \
    cmake --build build --target rangex_backend -j2

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /src/build/backend/rangex_backend /app/rangex_backend
EXPOSE 8080
CMD ["sh", "-c", "./rangex_backend --port ${PORT:-8080}"]