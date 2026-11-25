FROM node:22.23.4-bookworm
RUN npm install -g @openai/codex@0.148.0-alpha.9 \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv git procps \
 && rm -rf /var/lib/apt/lists/* \
 && python3 -c 'import sys; sys.exit("ACE benchmark runtime requires Python 3.11+") if sys.version_info < (3, 11) else None'
WORKDIR /workspace
COPY fixture/ /workspace/
