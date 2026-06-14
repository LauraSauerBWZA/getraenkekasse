FROM node:22-slim

# Systempakete
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# pnpm bleibt global (root) – pnpm braucht keinen Self-Update-Schreibzugriff
RUN npm install -g pnpm

# Normaler Benutzer ZUERST anlegen, dann auf ihn wechseln
RUN useradd -m -s /bin/bash claude
USER claude

# Claude Code in einen USER-eigenen Prefix → Auto-Updater darf schreiben
ENV NPM_CONFIG_PREFIX=/home/claude/.npm-global
ENV PATH=/home/claude/.npm-global/bin:$PATH
RUN npm install -g @anthropic-ai/claude-code

# Auth-Verzeichnis anlegen (gehört claude) → Named Volume erbt diesen Owner beim ersten Mount
RUN mkdir -p /home/claude/.claude

WORKDIR /home/claude/workspace

# Git-Identität (lokal im Container, hat mit echtem Git-Account nichts zu tun)
RUN git config --global user.email "claude@sandbox" && \
    git config --global user.name "Claude Sandbox"

CMD ["bash"]
