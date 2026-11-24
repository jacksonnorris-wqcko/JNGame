#!/usr/bin/env python3
"""Fetch environment textures and licensed GLB models for Wildrange.

Game assets are stored locally in public/assets so play sessions fetch models
from the same static GitHub Pages site rather than a third-party model CDN.
"""
from __future__ import annotations

import json
import os
import shutil
import struct
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "pbr"
HDR_OUT = ROOT / "public" / "assets" / "nature_reserve_forest_1k.hdr"

ASSETS = {
    "Grass001": "grass",
    "Ground053": "forest_floor",
    "WoodSiding001": "wood_siding",
    "Wood001": "wood_planks",
    "Bark016": "bark",
    "Rock053": "rock",
    "LeafSet005": "leaf_set",
}

MAPS = {
    "Color": "albedo",
    "NormalGL": "normal",
    "Roughness": "roughness",
    "AmbientOcclusion": "ao",
}

# Game-ready model assets. Each record carries its own licence and source metadata.
GAME_MODELS = [
    {
        "asset": "Polyfork deer-base",
        "path": "animals/deer-base.glb",
        "url": "https://polyfork.dev/cdn/deer-base.glb",
        "minimum_bytes": 100_000,
        "license": "CC BY 4.0",
        "source": "https://polyfork.dev/asset/deer-base",
    },
    {
        "asset": "Polyfork pig-base, adapted as wild boar",
        "path": "animals/pig-base.glb",
        "url": "https://polyfork.dev/cdn/pig-base.glb",
        "minimum_bytes": 100_000,
        "license": "CC BY 4.0",
        "source": "https://polyfork.dev/asset/pig-base",
    },
    {
        "asset": "White-Tailed Deer, high-detail static source (Grab3D)",
        "path": "animals/deer-high-detail-source.glb",
        "url": "https://grab3d.com/dl/deer/deer-light.glb",
        "minimum_bytes": 1_000_000,
        "license": "CC0 1.0 Universal",
        "source": "https://grab3d.com/models/animals/deer/",
    },
    {
        "asset": "Forest Boar, Jointed (FPS Survival Forest Outpost)",
        "path": "animals/forest-boar.glb",
        "url": "https://cdn.3dassets.dev/assets/32710/v1/model.glb",
        "minimum_bytes": 100_000,
        "license": "CC0 1.0 Universal",
        "source": "https://3dassets.dev/assets/fps-survival-forest-outpost-creature-boar-2eae041a",
    },
    {
        "asset": "Polyfork Bolt-Action Rifle (legacy fallback)",
        "path": "weapons/bolt-action-rifle.glb",
        "url": "https://polyfork.dev/cdn/bolt-action-rifle-2f1793.glb",
        "minimum_bytes": 50_000,
        "license": "CC BY 4.0",
        "source": "https://polyfork.dev/asset/bolt-action-rifle-2f1793",
    },
    {
        "asset": "Marksman Rifle and Bipod (FPS Survival Forest Outpost)",
        "path": "weapons/marksman-rifle.glb",
        "url": "https://cdn.3dassets.dev/assets/32655/v1/model.glb",
        "minimum_bytes": 100_000,
        "license": "CC0 1.0 Universal",
        "source": "https://3dassets.dev/assets/fps-survival-forest-outpost-weapon-marksman-rifle-e20c7bc2",
    },
]
# These models are downloaded by scripts/download_licensed_3d_assets.sh
# in the browser/Pages build, but are listed here so later asset imports never
# erase their provenance from the canonical asset manifest.
BUILD_TIME_ASSETS = [
    {
        "asset": "Log cabin 3 x 3 m, apex roof",
        "status": "downloaded-at-build",
        "path": "buildings/pinecrest-lodge.glb",
        "approximate_bytes": 4423912,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/log-cabin-3-x-3-m-apex-roof-ed7532ac",
        "integration": "Pinecrest Lodge authored exterior shell; Wildrange interior, interactive door, porch and compound systems retained"
    },
    {
        "asset": "Mountain Hut",
        "status": "downloaded-at-build",
        "path": "buildings/pinecrest-mountain-hut.glb",
        "approximate_bytes": 2700000,
        "license": "CC0 1.0 Universal",
        "source": "https://grab3d.com/models/buildings/mountain-hut/",
        "integration": "Primary Pinecrest Lodge architecture: stone lower level, dark timber upper level, weighted shingle roof, chimney and terrace"
    },
    {
        "asset": "Timber-Framed House",
        "status": "downloaded-at-build",
        "path": "buildings/pinecrest-timber-frame-house.glb",
        "approximate_bytes": 2000000,
        "license": "CC0 1.0 Universal",
        "source": "https://tevy.dev/models/timber-frame-house/",
        "integration": "Candidate primary Pinecrest hunting lodge: two-storey dark oak framing, stone chimney, thatched roof, lean-to woodshed and walkable furnished ground-floor room"
    },
    {
        "asset": "Cedarwatch Cabin",
        "status": "downloaded-at-build",
        "path": "buildings/pinecrest-cedarwatch-cabin.glb",
        "approximate_bytes": 956496,
        "license": "CC0 1.0 Universal",
        "source": "https://scenecrate.com/scenes/forest-cabin",
        "integration": "Primary Pinecrest hunting lodge: cedar cladding, layered green shingles, amber windows, dressed-stone chimney, furnished interior and open 1.64 m front doorway"
    },
    {
        "asset": "Conifer, detailed needles",
        "status": "downloaded-at-build",
        "path": "vegetation/conifer-detailed.glb",
        "approximate_bytes": 7998880,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/conifer-detailed-needles-ca8e7cef",
        "integration": "Two high-detail hero conifers around Pinecrest compound"
    },
    {
        "asset": "Linden street tree, detailed leaves",
        "status": "downloaded-at-build",
        "path": "vegetation/linden-detailed.glb",
        "approximate_bytes": 3840824,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/linden-street-tree-detailed-leaves-6300c26e",
        "integration": "Two high-detail hero broadleaf trees around Pinecrest compound"
    },
    {
        "asset": "Mature Norway spruce tree",
        "status": "downloaded-at-build",
        "path": "vegetation/norway-spruce.glb",
        "approximate_bytes": 2000000,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/mature-norway-spruce-tree-48c2566f",
        "integration": "Two tall spruce silhouettes frame the Pinecrest approach"
    },
    {
        "asset": "Oak street tree, detailed leaves",
        "status": "downloaded-at-build",
        "path": "vegetation/oak-detailed.glb",
        "approximate_bytes": 5900000,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/oak-street-tree-detailed-leaves-a273fef9",
        "integration": "Two broadleaf hero trees add a different canopy silhouette around Pinecrest"
    },
    {
        "asset": "Fern clumps",
        "status": "downloaded-at-build",
        "path": "vegetation/fern-clump.glb",
        "approximate_bytes": 3200000,
        "license": "CC0 1.0 Universal",
        "source": "https://www.innerscene.com/tools/library/3d-parts/fern-clumps-82a87bea",
        "integration": "Four PBR fern clumps soften the Pinecrest fence and garden edges"
    }
]

ATTRIBUTION_PATH = ROOT / "public" / "assets" / "models" / "ATTRIBUTION.md"


def fetch(url: str, timeout: int = 90) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Wildrange-Game-Asset-Importer/1.0"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def import_material(asset_id: str, slug: str) -> dict:
    folder = OUT / slug
    folder.mkdir(parents=True, exist_ok=True)
    expected = [folder / f"{slug}_{kind}.jpg" for kind in MAPS.values()]
    if (folder / f"{slug}_albedo.jpg").exists() and (
        slug == "leaf_set" or (folder / f"{slug}_normal.jpg").exists()
    ):
        return {"asset": asset_id, "status": "already-present"}

    url = f"https://ambientcg.com/get?file={asset_id}_1K-JPG.zip"
    last_error = None
    for attempt in range(3):
        try:
            archive_bytes = fetch(url)
            with tempfile.TemporaryDirectory() as temp_dir:
                archive_path = Path(temp_dir) / "asset.zip"
                archive_path.write_bytes(archive_bytes)
                with zipfile.ZipFile(archive_path) as archive:
                    names = archive.namelist()
                    for member in names:
                        base = Path(member).name
                        if not base.lower().endswith(".jpg"):
                            continue
                        for source_map, output_kind in MAPS.items():
                            # AmbientCG includes the format in map filenames:
                            # e.g. Grass001_1K-JPG_Color.jpg.
                            suffix = f"_{source_map}.jpg"
                            if (
                                base.lower().startswith(asset_id.lower() + "_1k")
                                and base.lower().endswith(suffix.lower())
                            ):
                                destination = folder / f"{slug}_{output_kind}.jpg"
                                with archive.open(member) as source, destination.open("wb") as target:
                                    shutil.copyfileobj(source, target)
                if not (folder / f"{slug}_albedo.jpg").exists():
                    found = [Path(name).name for name in names if name.lower().endswith(".jpg")]
                    raise RuntimeError(f"{asset_id}: Color.jpg map not found. Archive files: {found[:20]}")
            return {
                "asset": asset_id,
                "status": "downloaded",
                "maps": [p.name for p in folder.glob("*.jpg")]
            }
        except Exception as exc:  # retry transient CDN/API failures
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Could not import {asset_id}: {last_error}")


def import_hdri() -> dict:
    HDR_OUT.parent.mkdir(parents=True, exist_ok=True)
    if HDR_OUT.exists() and HDR_OUT.stat().st_size > 100_000:
        return {"asset": "nature_reserve_forest", "status": "already-present"}
    metadata = json.loads(fetch("https://api.polyhaven.com/files/nature_reserve_forest"))
    hdri = metadata.get("hdri") or metadata.get("HDRI") or {}
    entry = (hdri.get("1k") or {}).get("hdr") or {}
    url = entry.get("url")
    if not url:
        raise RuntimeError("Poly Haven API did not return the 1K HDR panorama URL")
    data = fetch(url, timeout=180)
    if len(data) < 100_000 or data[:2] != b"#?":
        raise RuntimeError("Downloaded forest HDRI did not look like a Radiance HDR file")
    HDR_OUT.write_bytes(data)
    return {
        "asset": "nature_reserve_forest",
        "status": "downloaded",
        "bytes": len(data)
    }




def inspect_glb(data: bytes) -> dict:
    """Read the JSON chunk of a GLB to expose model node and animation names."""
    if len(data) < 20 or data[:4] != b"glTF":
        return {}
    chunk_length = struct.unpack_from("<I", data, 12)[0]
    chunk_type = struct.unpack_from("<I", data, 16)[0]
    if chunk_type != 0x4E4F534A or 20 + chunk_length > len(data):
        return {}
    document = json.loads(data[20:20 + chunk_length].decode("utf-8").rstrip("\\x00 \\t\\r\\n"))
    return {
        "node_names": [node.get("name", "") for node in document.get("nodes", []) if node.get("name")],
        "animation_names": [animation.get("name", "") for animation in document.get("animations", []) if animation.get("name")],
        "mesh_count": len(document.get("meshes", [])),
        "material_count": len(document.get("materials", [])),
        "skin_count": len(document.get("skins", [])),
    }


def import_game_model(model: dict) -> dict:
    """Download one validated glTF binary into the static game assets."""
    destination = ROOT / "public" / "assets" / model["path"]
    destination.parent.mkdir(parents=True, exist_ok=True)
    minimum_bytes = int(model.get("minimum_bytes", 100_000))
    if destination.exists() and destination.stat().st_size >= minimum_bytes:
        return {
            "asset": model["asset"],
            "status": "already-present",
            "path": model["path"],
            "bytes": destination.stat().st_size,
            "license": model["license"],
            "source": model["source"],
            **inspect_glb(destination.read_bytes()),
        }

    last_error = None
    for attempt in range(3):
        try:
            data = fetch(model["url"], timeout=180)
            if len(data) < minimum_bytes:
                raise RuntimeError(f"GLB is unexpectedly small ({len(data)} bytes)")
            if data[:4] != b"glTF":
                raise RuntimeError("Downloaded file does not have a glTF binary header")
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(data)
            temporary.replace(destination)
            return {
                "asset": model["asset"],
                "status": "downloaded",
                "path": model["path"],
                "bytes": len(data),
                "license": model["license"],
                "source": model["source"],
                **inspect_glb(data),
            }
        except Exception as exc:
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Could not import {model['asset']}: {last_error}")


def write_model_attributions() -> None:
    """Keep CC BY credits and CC0 provenance beside the redistributed models."""
    ATTRIBUTION_PATH.parent.mkdir(parents=True, exist_ok=True)
    ATTRIBUTION_PATH.write_text(
        """# Wildrange model asset credits

The following 3D meshes are bundled and modified in Wildrange.

- Deer by Polyfork (https://polyfork.dev/asset/deer-base), CC BY 4.0.
- Pig by Polyfork (https://polyfork.dev/asset/pig-base), CC BY 4.0. Recoloured and adapted with additional boar details for Wildrange.
- Bolt-Action Rifle by Polyfork (https://polyfork.dev/asset/bolt-action-rifle-2f1793), CC BY 4.0.
- Marksman Rifle and Bipod by 3DAssets.dev (https://3dassets.dev/assets/fps-survival-forest-outpost-weapon-marksman-rifle-e20c7bc2), CC0 1.0 Universal.
- Forest Boar, Jointed by 3DAssets.dev (https://3dassets.dev/assets/fps-survival-forest-outpost-creature-boar-2eae041a), CC0 1.0 Universal.
- White-Tailed Deer high-detail static source by Grab3D (https://grab3d.com/models/animals/deer/), CC0 1.0 Universal. Imported for future retopology and rigging; not used as a live game model.

## Build-time CC0 architecture and vegetation assets

The following models are downloaded by scripts/download_licensed_3d_assets.sh for the browser/Pages build.

- Log cabin 3 x 3 m, apex roof (https://www.innerscene.com/tools/library/3d-parts/log-cabin-3-x-3-m-apex-roof-ed7532ac), CC0 1.0 Universal. Used as the authored Pinecrest Lodge exterior.
- Mountain Hut by Grab3D (https://grab3d.com/models/buildings/mountain-hut/), CC0 1.0 Universal. Used as the primary Pinecrest Lodge architecture.
- Timber-Framed House by tevy (https://tevy.dev/models/timber-frame-house/), CC0 1.0 Universal. Candidate replacement hunting lodge with furnished walkable interior, moving door/shutters, timber framing, stone chimney and thatched roof.
- Conifer, detailed needles (https://www.innerscene.com/tools/library/3d-parts/conifer-detailed-needles-ca8e7cef), CC0 1.0 Universal. Used for high-detail hero conifers.
- Linden street tree, detailed leaves (https://www.innerscene.com/tools/library/3d-parts/linden-street-tree-detailed-leaves-6300c26e), CC0 1.0 Universal. Used for high-detail hero broadleaf trees.
- Mature Norway spruce tree (https://www.innerscene.com/tools/library/3d-parts/mature-norway-spruce-tree-48c2566f), CC0 1.0 Universal. Used to introduce a distinct tall conifer silhouette.
- Oak street tree, detailed leaves (https://www.innerscene.com/tools/library/3d-parts/oak-street-tree-detailed-leaves-a273fef9), CC0 1.0 Universal. Used for high-detail broadleaf hero trees.
- Fern clumps (https://www.innerscene.com/tools/library/3d-parts/fern-clumps-82a87bea), CC0 1.0 Universal. Used for PBR understorey planting around the compound.
""",
        encoding="utf-8",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    results = [import_material(asset_id, slug) for asset_id, slug in ASSETS.items()]
    results.append(import_hdri())
    results.extend(import_game_model(model) for model in GAME_MODELS)
    write_model_attributions()
    manifest = {
        "version": 3,
        "license": "Mixed: CC0 1.0 Universal and CC BY 4.0; see per-asset records and models/ATTRIBUTION.md",
        "sources": {
            "ambientCG": "https://ambientcg.com/",
            "Poly Haven": "https://polyhaven.com/a/nature_reserve_forest",
            "Polyfork": "https://polyfork.dev/licensing",
            "3D Assets": "https://3dassets.dev/",
            "Innerscene 3D Parts Library": "https://www.innerscene.com/tools/library/3d-parts/"
        },
        "assets": results + BUILD_TIME_ASSETS
    }
    (ROOT / "public" / "assets" / "asset-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
