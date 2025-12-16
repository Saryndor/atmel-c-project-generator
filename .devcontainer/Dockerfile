# Offizielles Devcontainer-Image mit Node + Typescript-Setup
ARG VARIANT="20-bullseye"
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:${VARIANT}

# Optional: zusätzliche Tools für Extension-Entwicklung
# yo + generator-code: VS Code Extension-Scaffolding
# vsce: Packaging/Publishing von Extensions
RUN npm install -g \
    yo \
    generator-code \
    vsce
