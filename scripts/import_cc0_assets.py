#!/usr/bin/env python3
"""Fetch small CC0 PBR texture sets and one forest HDRI for Wildrange.

All textures are stored locally in public/assets/pbr so the browser game does
not need to contact an asset CDN at runtime.
"""
from __future__ import annotations

import json
import os
import shutil
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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    results = [import_material(asset_id, slug) for asset_id, slug in ASSETS.items()]
    results.append(import_hdri())
    manifest = {
        "version": 1,
        "license": "CC0 1.0 Universal",
        "sources": {
            "ambientCG": "https://ambientcg.com/",
            "Poly Haven": "https://polyhaven.com/a/nature_reserve_forest"
        },
        "assets": results
    }
    (ROOT / "public" / "assets" / "asset-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
