#!/usr/bin/env bash
set -euo pipefail

HOST_AUTH="/tmp/host-codex/auth.json"
TARGET_DIR="${HOME}/.codex"
TARGET_AUTH="${TARGET_DIR}/auth.json"

if [ -f "${HOST_AUTH}" ]; then
  mkdir -p "${TARGET_DIR}"
  cp "${HOST_AUTH}" "${TARGET_AUTH}"
  chmod 600 "${TARGET_AUTH}"
  echo "Copied Codex auth.json to ${TARGET_AUTH}"
else
  echo "Codex auth.json not found at ${HOST_AUTH}."
  echo "Copy ~/.codex/auth.json from the host into the container at ${TARGET_AUTH}."
fi
