# rename_to_dots.py
# Renames files by replacing all '-' in the filename (stem) with '.'
# Example: "radtown-underwater-labs-tech-parts-2.webp" -> "radtown.underwater.labs.tech.parts.2.webp"

from pathlib import Path
import re

# ----------------- Config -----------------
SUFFIXES = {".webp"}     # rename only these file types; add others if needed
RECURSIVE = True         # True: include subfolders; False: current folder only
DRY_RUN = False           # True: only print what would happen; False: actually rename
# ------------------------------------------

def transform_name(p: Path) -> str:
    stem = p.stem.replace("-", ".")
    # collapse multiple dots and strip accidental leading/trailing dots
    stem = re.sub(r"\.{2,}", ".", stem).strip(".")
    return f"{stem}{p.suffix}"

def iter_files(root: Path):
    if RECURSIVE:
        yield from (f for f in root.rglob("*") if f.is_file() and (not SUFFIXES or f.suffix.lower() in SUFFIXES))
    else:
        yield from (f for f in root.iterdir() if f.is_file() and (not SUFFIXES or f.suffix.lower() in SUFFIXES))

def main():
    root = Path.cwd()
    renamed = skipped = collisions = errors = 0

    for src in iter_files(root):
        new_name = transform_name(src)
        if new_name == src.name:
            skipped += 1
            continue

        dst = src.with_name(new_name)
        if dst.exists():
            print(f"SKIP (exists): {src.name} -> {dst.name}")
            collisions += 1
            continue

        print(f"RENAME: {src.name} -> {dst.name}")
        if not DRY_RUN:
            try:
                src.rename(dst)
                renamed += 1
            except Exception as e:
                print(f"ERROR: {src.name} -> {dst.name} ({e})")
                errors += 1

    print(f"\nDone. Renamed: {renamed}, Skipped: {skipped}, Collisions: {collisions}, Errors: {errors}")

if __name__ == "__main__":
    main()
