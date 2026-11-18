#!/usr/bin/env bash
set -euo pipefail

# CC0 3D assets are fetched at build time so the binary models stay out of
# the source tree while every local build and Pages release gets the same files.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILDINGS="$ROOT/public/assets/buildings"
VEGETATION="$ROOT/public/assets/vegetation"
mkdir -p "$BUILDINGS" "$VEGETATION"

fetch_asset() {
  local url="$1"
  local destination="$2"
  local label="$3"
  echo "Fetching CC0 model: $label"
  curl --fail --location --silent --show-error \
    --retry 4 --retry-delay 2 --retry-all-errors \
    --user-agent "Wildrange-3D-Asset-Build/1.0" \
    "$url" --output "$destination"
}

fetch_asset \
  "https://www.innerscene.com/api/library/log-cabin-3-x-3-m-apex-roof-ed7532ac/download" \
  "$BUILDINGS/pinecrest-lodge.glb" \
  "Log cabin 3 x 3 m, apex roof (CC0)"

fetch_asset \
  "https://www.innerscene.com/api/library/conifer-detailed-needles-ca8e7cef/download" \
  "$VEGETATION/conifer-detailed.glb" \
  "Conifer, detailed needles (CC0)"

fetch_asset \
  "https://www.innerscene.com/api/library/linden-street-tree-detailed-leaves-6300c26e/download" \
  "$VEGETATION/linden-detailed.glb" \
  "Linden street tree, detailed leaves (CC0)"

python3 - "$BUILDINGS/pinecrest-lodge.glb" "$VEGETATION/conifer-detailed.glb" "$VEGETATION/linden-detailed.glb" <<'PY'
import os
import struct
import sys

minimum_bytes = {
    "pinecrest-lodge.glb": 1_000_000,
    "conifer-detailed.glb": 1_000_000,
    "linden-detailed.glb": 1_000_000,
}
for path in sys.argv[1:]:
    size = os.path.getsize(path)
    if size < minimum_bytes[os.path.basename(path)]:
        raise SystemExit(f"Downloaded GLB is unexpectedly small: {path} ({size} bytes)")
    with open(path, "rb") as stream:
        header = stream.read(12)
    if header[:4] != b"glTF":
        raise SystemExit(f"Invalid GLB magic header: {path}")
    version, declared_length = struct.unpack("<II", header[4:12])
    if version != 2 or declared_length != size:
        raise SystemExit(
            f"Invalid GLB header: {path} (version={version}, declared={declared_length}, actual={size})"
        )
    print(f"Validated {os.path.basename(path)}: {size:,} bytes, glTF {version}")
PY
