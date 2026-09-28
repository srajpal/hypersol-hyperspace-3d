# A Linux machine like GitHub's (ubuntu-latest, Ubuntu 24.04) for
# `pnpm test:linux` (owner, prompts 103 and 104): Node 22, pnpm, a virtual
# display, a keyring for the password checks, openssl for the certificate
# check, and the libraries Electron needs. There is no graphics card in
# a container, so Chromium draws in software, as on GitHub's machines.
# tests/linux/run.mjs builds it and runs the checks in it; nothing here
# holds the repository, which comes in fresh for every run.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates curl xz-utils openssl \
    xvfb xauth dbus dbus-x11 gnome-keyring \
    libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libgbm1 \
    libgtk-3-0t64 libasound2t64 libxss1 libxtst6 libxcomposite1 libxdamage1 libxrandr2 \
    libxfixes3 libpango-1.0-0 libcairo2 libx11-xcb1 libxkbcommon0 libsecret-1-0 \
    fonts-dejavu-core fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Node from nodejs.org (GitHub's setup-node gives the newest 22), and pnpm
# at the version package.json pins.
ARG NODE_VERSION=22.16.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C /usr/local --strip-components=1 \
  && npm install -g pnpm@12.4.1

# Not root, as on GitHub's machines (Chromium's sandbox does not run as
# root). The caches are volumes (run.mjs), made here so they belong to
# this user: pnpm's store and Electron's download.
RUN useradd -m tester \
  && mkdir -p /home/tester/.local/share/pnpm /home/tester/.cache \
  && chown -R tester:tester /home/tester
USER tester
WORKDIR /home/tester
