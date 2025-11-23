# VLSM IPv4 Subnet Calculator

This tool computes Variable Length Subnet Mask (VLSM) allocations inside a
primary IPv4 network. It assigns subnets using largest-first allocation and
outputs the results as a readable table or JSON.

Usage (PowerShell / Windows):

```powershell
# Table output (default)
python .\tools\vlsm.py 192.168.0.0/24 50 20 10

# JSON output
python .\tools\vlsm.py 10.0.0.0/16 1000 2000 50 -f json
```

What it validates and returns:
- Validates the primary network in CIDR notation.
- Validates host counts (positive integers).
- Uses largest-first allocation to minimize fragmentation.
- Ensures allocations are aligned to subnet boundaries and contained inside
  the primary network.
- Returns for each allocated subnet: network address, CIDR prefix, subnet
  mask, wildcard mask, total addresses, usable hosts, first/last usable IP,
  broadcast address, and wasted addresses.

Notes and limitations:
- The script uses standard IPv4 rules for usable hosts: usable = total - 2
  for prefixes smaller than /31. /31 is treated specially (0 usable hosts in
  the classical sense); /32 is treated as a single address.
- The script does not attempt advanced packing beyond largest-first.

If you want, I can:
- Add unit tests for common cases.
- Add an npm script or PowerShell wrapper for convenience.
- Add CSV export.
