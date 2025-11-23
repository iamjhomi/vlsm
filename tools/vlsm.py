#!/usr/bin/env python3
"""
VLSM IPv4 Subnet Calculator

Usage:
  python tools/vlsm.py 192.168.0.0/24 50 20 10 --format table
  python tools/vlsm.py 10.0.0.0/16 1000 2000 50 --format json

The script accepts a primary IPv4 network in CIDR notation and a list of
required host counts. It assigns subnets using largest-first allocation and
prints a table or JSON with detailed info for each allocated subnet.
"""
import argparse
import ipaddress
import json
import math
import sys
from typing import List, Dict, Any


def calc_min_prefix_for_hosts(hosts: int) -> int:
    """Return the smallest prefix length that can hold `hosts` usable hosts.

    Usable hosts are typically (2^n - 2) for n host bits, except very small
    networks: /31 has 0 usable (but is used for point-to-point) and /32 has 1
    address (not usable as a subnet for hosts). For our purposes we require
    usable hosts >= requested hosts and pick the smallest network that meets
    that requirement.
    """
    if hosts < 0:
        raise ValueError("host count must be non-negative")
    # handle hosts == 0 -> assign smallest block of /32 (1 address)
    # but usable hosts for /32 is 1 (no network/broadcast concept). We'll
    # treat requested hosts >=1 normally. For simplicity, require hosts>=1.
    if hosts == 0:
        return 32
    for prefix in range(32, -1, -1):
        total = 2 ** (32 - prefix)
        usable = total if prefix == 32 else (0 if prefix == 31 else total - 2)
        if usable >= hosts:
            return prefix
    raise ValueError("cannot find suitable prefix for hosts={}".format(hosts))


def wildcard_mask_from_prefix(prefix: int) -> str:
    mask = (0xFFFFFFFF >> prefix) & 0xFFFFFFFF
    return ipaddress.IPv4Address(mask).compressed


def subnet_info(network: ipaddress.IPv4Network, requested_hosts: int) -> Dict[str, Any]:
    total_addresses = network.num_addresses
    prefix = network.prefixlen
    if prefix == 32:
        usable_hosts = 1
        first_usable = str(network.network_address)
        last_usable = str(network.network_address)
        broadcast = str(network.network_address)
    elif prefix == 31:
        usable_hosts = 0
        # RFC3021 uses /31 for P2P — no usable host addresses in classical sense
        first_usable = str(network.network_address)
        last_usable = str(network.broadcast_address)
        broadcast = str(network.broadcast_address)
    else:
        usable_hosts = total_addresses - 2
        first_usable = str(network.network_address + 1)
        last_usable = str(network.broadcast_address - 1)
        broadcast = str(network.broadcast_address)

    mask = str(network.netmask)
    wildcard = wildcard_mask_from_prefix(prefix)
    wasted = total_addresses - (requested_hosts if requested_hosts is not None else usable_hosts)

    return {
        "network": str(network.network_address),
        "prefix": prefix,
        "cidr": f"{network.network_address}/{prefix}",
        "subnet_mask": mask,
        "wildcard_mask": wildcard,
        "total_addresses": total_addresses,
        "usable_hosts": usable_hosts,
        "requested_hosts": requested_hosts,
        "first_usable": first_usable,
        "last_usable": last_usable,
        "broadcast": broadcast,
        "wasted_addresses": wasted,
    }


def allocate_vlsm(primary: ipaddress.IPv4Network, host_requirements: List[int]) -> List[Dict[str, Any]]:
    # Sort descending: largest-first allocation is best to avoid fragmentation
    requirements = sorted(host_requirements, reverse=True)

    # Precompute needed prefix for each requirement
    allocations = []
    needed_blocks = []  # list of (requested_hosts, prefix, block_size)
    for hosts in requirements:
        prefix = calc_min_prefix_for_hosts(hosts)
        block_size = 2 ** (32 - prefix)
        needed_blocks.append((hosts, prefix, block_size))

    # Quick fit check: ensure sum of block sizes <= primary.num_addresses
    total_needed = sum(b for (_, _, b) in needed_blocks)
    if total_needed > primary.num_addresses:
        raise ValueError(
            f"Requirements do not fit in primary network: need {total_needed} addresses but have {primary.num_addresses}"
        )

    # Allocation pointer: start at primary.network_address
    current = int(primary.network_address)
    primary_end = int(primary.broadcast_address)

    for requested_hosts, prefix, block_size in needed_blocks:
        # Align current to the block boundary for this prefix
        # Block size is power of two; network addresses must be multiples of block_size
        boundary = block_size
        # Compute aligned start: round current up to next multiple of block_size
        aligned_start = ( (current + (boundary - 1)) // boundary ) * boundary

        # Make sure aligned start is within primary
        if aligned_start + block_size - 1 > primary_end:
            raise ValueError(
                "Cannot allocate subnet for {} hosts (/{} -> {} addresses): not enough space in primary after alignment".format(
                    requested_hosts, prefix, block_size
                )
            )

        net = ipaddress.IPv4Network((aligned_start, prefix))
        # Ensure net is contained in primary
        if not net.subnet_of(primary):
            raise ValueError(
                f"Allocated network {net} falls outside the primary network {primary}"
            )

        info = subnet_info(net, requested_hosts)
        allocations.append(info)

        # Move current pointer past this allocated block
        current = aligned_start + block_size

    # After allocation, check overlapping (should not happen as we always move forward and align)
    # But validate uniqueness of allocated networks
    nets = [ipaddress.IPv4Network(f"{a['cidr']}") for a in allocations]
    for i in range(len(nets)):
        for j in range(i + 1, len(nets)):
            if nets[i].overlaps(nets[j]):
                raise RuntimeError(f"Overlap detected between {nets[i]} and {nets[j]}")

    return allocations


def print_table(allocs: List[Dict[str, Any]]):
    headers = [
        "Network",
        "CIDR",
        "Mask",
        "Wildcard",
        "Total",
        "Usable",
        "Req",
        "First",
        "Last",
        "Broadcast",
        "Wasted",
    ]
    rows = []
    for a in allocs:
        rows.append([
            a["network"],
            f"/{a['prefix']}",
            a["subnet_mask"],
            a["wildcard_mask"],
            str(a["total_addresses"]),
            str(a["usable_hosts"]),
            str(a["requested_hosts"]),
            a["first_usable"],
            a["last_usable"],
            a["broadcast"],
            str(a["wasted_addresses"]),
        ])

    # compute column widths
    cols = list(zip(*([headers] + rows)))
    widths = [max(len(x) for x in col) for col in cols]

    def fmt_row(row):
        return "  ".join(item.ljust(w) for item, w in zip(row, widths))

    print(fmt_row(headers))
    print(fmt_row(["-" * w for w in widths]))
    for r in rows:
        print(fmt_row(r))


def parse_args():
    p = argparse.ArgumentParser(description="VLSM IPv4 Subnet Calculator")
    p.add_argument("primary", help="Primary network in CIDR notation, e.g., 192.168.0.0/24")
    p.add_argument("hosts", nargs='+', help="List of required hosts (integers), e.g. 50 20 10")
    p.add_argument("--format", "-f", choices=["table", "json"], default="table", help="Output format")
    return p.parse_args()


def main():
    args = parse_args()

    # Validate primary network
    try:
        primary = ipaddress.IPv4Network(args.primary, strict=True)
    except Exception as e:
        print(f"Invalid primary network '{args.primary}': {e}", file=sys.stderr)
        sys.exit(2)

    # Parse host requirements
    try:
        hosts = [int(x) for x in args.hosts]
    except ValueError:
        print("Host requirements must be integers", file=sys.stderr)
        sys.exit(2)

    if any(h <= 0 for h in hosts):
        print("All requested host counts must be positive integers", file=sys.stderr)
        sys.exit(2)

    try:
        allocations = allocate_vlsm(primary, hosts)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(3)

    if args.format == "json":
        print(json.dumps(allocations, indent=2))
    else:
        print_table(allocations)


if __name__ == "__main__":
    main()
