"""Trim the OWID energy dataset down to what the site needs.

Run from the repo root:
    python prep_data.py
Reads  energy-data/owid-energy-data.csv
Writes data/energy_trimmed.csv
"""
import csv
import os
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "energy-data/owid-energy-data.csv"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/energy_trimmed.csv"

COLS = [
    "country",
    "iso_code",
    "year",
    "renewables_share_elec",
    "low_carbon_share_elec",
    "fossil_share_elec",
    "coal_share_elec",
]
YEAR_MIN, YEAR_MAX = 2000, 2024

os.makedirs(os.path.dirname(OUT), exist_ok=True)
kept = 0
with open(SRC, newline="", encoding="utf-8") as f_in, open(OUT, "w", newline="", encoding="utf-8") as f_out:
    reader = csv.DictReader(f_in)
    writer = csv.DictWriter(f_out, fieldnames=COLS)
    writer.writeheader()
    for row in reader:
        iso = row["iso_code"]
        # Real countries only: 3-letter ISO codes (drops regions like "World", "Europe", "OWID_*")
        if len(iso) != 3 or iso.startswith("OWID"):
            continue
        year = int(row["year"])
        if not (YEAR_MIN <= year <= YEAR_MAX):
            continue
        if row["renewables_share_elec"] == "":
            continue
        writer.writerow({c: row[c] for c in COLS})
        kept += 1

print(f"Wrote {kept} rows to {OUT}")
