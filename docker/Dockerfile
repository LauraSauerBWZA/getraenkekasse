FROM node:20-slim

# Systempakete
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI + pnpm global
RUN npm install -g @anthropic-ai/claude-code pnpm

# Normaler Benutzer
RUN useradd -m -s /bin/bash claude
USER claude
WORKDIR /home/claude/workspace

# Git-Identität (lokal im Container, hat mit echtem Git-Account nichts zu tun)
RUN git config --global user.email "claude@sandbox" && \
    git config --global user.name "Claude Sandbox"

CMD ["bash"]
