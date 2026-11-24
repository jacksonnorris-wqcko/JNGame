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
  "https://grab3d.com/dl/mountain-hut/mountain-hut.glb" \
  "$BUILDINGS/pinecrest-mountain-hut.glb" \
  "Mountain Hut architectural lodge model (CC0)"

fetch_asset \
  "https://tevy.dev/models/timber-frame-house/v1/lod0.glb" \
  "$BUILDINGS/pinecrest-timber-frame-house.glb" \
  "Timber-Framed House with furnished interior (CC0)"

# Cedarwatch is a complete forest lodge scene: the standard GLB includes
# the furnished interior and open doorway; keep its navigation/report data beside it.
CEDAR_TMP="$(mktemp -d)"
trap 'rm -rf "$CEDAR_TMP"' EXIT
fetch_asset \
  "https://scenecrate.com/worlds/buildings/forest-cabin/delivery.zip" \
  "$CEDAR_TMP/cedarwatch-delivery.zip" \
  "Cedarwatch Cabin scene pack (CC0)"
unzip -q "$CEDAR_TMP/cedarwatch-delivery.zip" -d "$CEDAR_TMP/cedarwatch"
test -s "$CEDAR_TMP/cedarwatch/models/standard.glb"
test -s "$CEDAR_TMP/cedarwatch/scene.json"
test -s "$CEDAR_TMP/cedarwatch/report.json"
cp "$CEDAR_TMP/cedarwatch/models/standard.glb" "$BUILDINGS/pinecrest-cedarwatch-cabin.glb"
cp "$CEDAR_TMP/cedarwatch/scene.json" "$BUILDINGS/pinecrest-cedarwatch-scene.json"
cp "$CEDAR_TMP/cedarwatch/report.json" "$BUILDINGS/pinecrest-cedarwatch-report.json"
echo "Fetched Cedarwatch Cabin: standard GLB plus scene navigation and measured report"

# Replace the stylised fern clusters with real woodland photogrammetry scans.
fetch_asset \
  "https://scenecrate.com/worlds/free/sunburst-fern/delivery.zip" \
  "$CEDAR_TMP/woodland-fern.zip" \
  "Photoreal Woodland Bracken Fern (CC0)"
unzip -q "$CEDAR_TMP/woodland-fern.zip" -d "$CEDAR_TMP/woodland-fern"
cp "$CEDAR_TMP/woodland-fern/models/standard.glb" "$VEGETATION/woodland-bracken-fern.glb"
cp "$CEDAR_TMP/woodland-fern/report.json" "$VEGETATION/woodland-bracken-fern-report.json"

fetch_asset \
  "https://scenecrate.com/worlds/free/glowcap-cluster/delivery.zip" \
  "$CEDAR_TMP/mossy-boulders.zip" \
  "Photoreal Mossy Forest Boulders (CC0)"
unzip -q "$CEDAR_TMP/mossy-boulders.zip" -d "$CEDAR_TMP/mossy-boulders"
cp "$CEDAR_TMP/mossy-boulders/models/standard.glb" "$VEGETATION/mossy-forest-boulders.glb"
cp "$CEDAR_TMP/mossy-boulders/report.json" "$VEGETATION/mossy-forest-boulders-report.json"
echo "Fetched photogrammetry fern and mossy boulder scans"

fetch_asset \
  "https://www.innerscene.com/api/library/conifer-detailed-needles-ca8e7cef/download" \
  "$VEGETATION/conifer-detailed.glb" \
  "Conifer, detailed needles (CC0)"

fetch_asset \
  "https://www.innerscene.com/api/library/linden-street-tree-detailed-leaves-6300c26e/download" \
  "$VEGETATION/linden-detailed.glb" \
  "Linden street tree, detailed leaves (CC0)"

fetch_asset \
  "https://www.innerscene.com/api/library/mature-norway-spruce-tree-48c2566f/download" \
  "$VEGETATION/norway-spruce.glb" \
  "Mature Norway spruce (CC0)"

fetch_asset \
  "https://www.innerscene.com/api/library/oak-street-tree-detailed-leaves-a273fef9/download" \
  "$VEGETATION/oak-detailed.glb" \
  "Oak street tree, detailed leaves (CC0)"

python3 - "$BUILDINGS/pinecrest-lodge.glb" "$BUILDINGS/pinecrest-mountain-hut.glb" "$BUILDINGS/pinecrest-timber-frame-house.glb" "$BUILDINGS/pinecrest-cedarwatch-cabin.glb" "$VEGETATION/conifer-detailed.glb" "$VEGETATION/linden-detailed.glb" "$VEGETATION/norway-spruce.glb" "$VEGETATION/oak-detailed.glb" "$VEGETATION/woodland-bracken-fern.glb" "$VEGETATION/mossy-forest-boulders.glb" <<'PY'
import os
import struct
import sys

minimum_bytes = {
    "pinecrest-lodge.glb": 1_000_000,
    "pinecrest-mountain-hut.glb": 2_000_000,
    "pinecrest-timber-frame-house.glb": 1_800_000,
    "pinecrest-cedarwatch-cabin.glb": 900_000,
    "conifer-detailed.glb": 1_000_000,
    "linden-detailed.glb": 1_000_000,
    "norway-spruce.glb": 1_000_000,
    "oak-detailed.glb": 4_000_000,
    "woodland-bracken-fern.glb": 350_000,
    "mossy-forest-boulders.glb": 1_000_000,
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
    if os.path.basename(path) == "pinecrest-cedarwatch-cabin.glb":
        import json
        report_path = os.path.join(os.path.dirname(path), "pinecrest-cedarwatch-report.json")
        scene_path = os.path.join(os.path.dirname(path), "pinecrest-cedarwatch-scene.json")
        report = json.load(open(report_path, encoding="utf-8"))
        scene_data = json.load(open(scene_path, encoding="utf-8"))
        print("Cedarwatch measured bounds:", report.get("bounds"))
        print("Cedarwatch standard metrics:", report.get("variants", {}).get("standard"))
        print("Cedarwatch scene top-level keys:", list(scene_data.keys()))
        print("Cedarwatch navigation data:", json.dumps(scene_data, separators=(",", ":"))[:12000])
    with open(path, "rb") as stream:
        stream.seek(12)
        json_length, json_type = struct.unpack("<II", stream.read(8))
        json_bytes = stream.read(json_length) if json_type == 0x4E4F534A else b""
    if os.path.basename(path) in {"woodland-bracken-fern.glb", "mossy-forest-boulders.glb"}:
        report_name = os.path.basename(path).replace(".glb", "-report.json")
        report_path = os.path.join(os.path.dirname(path), report_name)
        report = __import__("json").load(open(report_path, encoding="utf-8"))
        print("Photogrammetry asset report:", os.path.basename(path), report.get("bounds"), report.get("variants", {}).get("standard"))
    if json_bytes and os.path.basename(path) == "pinecrest-timber-frame-house.glb":
        document = __import__("json").loads(json_bytes.decode("utf-8").rstrip("\\x00 \\t\\r\\n"))
        print("Timber lodge GLB nodes:", ", ".join(node.get("name", "") for node in document.get("nodes", []) if node.get("name")))
        print("Timber lodge GLB animations:", ", ".join(animation.get("name", "") for animation in document.get("animations", [])))
        print("Timber lodge GLB mesh/material counts:", len(document.get("meshes", [])), len(document.get("materials", [])))
        position_bounds = [
            accessor for accessor in document.get("accessors", [])
            if accessor.get("type") == "VEC3" and accessor.get("min") and accessor.get("max")
        ]
        if position_bounds:
            mins = [min(accessor["min"][axis] for accessor in position_bounds) for axis in range(3)]
            maxs = [max(accessor["max"][axis] for accessor in position_bounds) for axis in range(3)]
            print("Timber lodge raw position accessor bounds:", mins, maxs)
            print("Timber lodge raw position accessor size:", [round(maxs[axis] - mins[axis], 3) for axis in range(3)])
        for node in document.get("nodes", []):
            if node.get("name") in {"timber-frame-house", "door", "door_iron", "door_wood", "shutter_1", "shutter_2"}:
                print("Timber lodge node transform:", node.get("name"), "translation=", node.get("translation"), "rotation=", node.get("rotation"), "scale=", node.get("scale"), "children=", node.get("children"))
PY
