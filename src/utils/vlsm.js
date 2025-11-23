// VLSM utility functions (IPv4)
function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int) {
  return [24, 16, 8, 0].map(shift => ((int >>> shift) & 0xFF)).join('.');
}

function maskFromPrefix(prefix) {
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  return intToIp(mask);
}

function wildcardFromPrefix(prefix) {
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const wild = (~mask) >>> 0;
  return intToIp(wild);
}

function parseCidr(cidr) {
  const parts = cidr.split('/');
  if (parts.length !== 2) throw new Error('Invalid CIDR');
  const ip = parts[0];
  const prefix = parseInt(parts[1], 10);
  if (prefix < 0 || prefix > 32) throw new Error('Invalid prefix');
  const networkInt = ipToInt(ip) & ((prefix === 0) ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0));
  const total = 2 ** (32 - prefix);
  const broadcastInt = (networkInt + total - 1) >>> 0;
  return { networkInt, prefix, total, broadcastInt };
}

function calcMinPrefixForHosts(hosts) {
  if (!Number.isInteger(hosts) || hosts < 0) throw new Error('hosts must be non-negative integer');
  if (hosts === 0) return 32;
  for (let prefix = 32; prefix >= 0; prefix--) {
    const total = 2 ** (32 - prefix);
    const usable = (prefix === 32) ? 1 : (prefix === 31 ? 0 : total - 2);
    if (usable >= hosts) return prefix;
  }
  throw new Error('cannot satisfy host count');
}

function subnetInfo(networkInt, prefix, requestedHosts) {
  const total = 2 ** (32 - prefix);
  let usable, first, last, broadcast;
  broadcast = (networkInt + total - 1) >>> 0;
  if (prefix === 32) {
    usable = 1;
    first = intToIp(networkInt);
    last = intToIp(networkInt);
    broadcast = intToIp(networkInt);
  } else if (prefix === 31) {
    usable = 0;
    first = intToIp(networkInt);
    last = intToIp(broadcast);
    broadcast = intToIp(broadcast);
  } else {
    usable = total - 2;
    first = intToIp((networkInt + 1) >>> 0);
    last = intToIp((broadcast - 1) >>> 0);
    broadcast = intToIp(broadcast);
  }

  const mask = maskFromPrefix(prefix);
  const wildcard = wildcardFromPrefix(prefix);
  const wasted = total - requestedHosts;

  return {
    network: intToIp(networkInt),
    prefix,
    cidr: `${intToIp(networkInt)}/${prefix}`,
    subnet_mask: mask,
    wildcard_mask: wildcard,
    total_addresses: total,
    usable_hosts: usable,
    requested_hosts: requestedHosts,
    first_usable: first,
    last_usable: last,
    broadcast,
    wasted_addresses: wasted,
  };
}

function allocateVlsm(primaryCidr, hostRequirements) {
  const primary = parseCidr(primaryCidr);
  const primaryStart = primary.networkInt;
  const primaryEnd = primary.broadcastInt;
  const totalNeeded = 0; // placeholder

  const reqs = hostRequirements.slice().map(h => {
    if (!Number.isInteger(h) || h <= 0) throw new Error('host requirements must be positive integers');
    const prefix = calcMinPrefixForHosts(h);
    const block = 2 ** (32 - prefix);
    return { requested: h, prefix, block };
  }).sort((a, b) => b.requested - a.requested || a.prefix - b.prefix);

  const sumBlocks = reqs.reduce((s, r) => s + r.block, 0);
  if (sumBlocks > primary.total) throw new Error(`Requirements need ${sumBlocks} addresses but primary has ${primary.total}`);

  let current = primaryStart;
  const allocations = [];

  for (const r of reqs) {
    const boundary = r.block;
    const alignedStart = Math.ceil(current / boundary) * boundary >>> 0;
    if ((alignedStart + r.block - 1) >>> 0 > primaryEnd) {
      throw new Error(`Cannot allocate subnet for ${r.requested} hosts (/ ${r.prefix} -> ${r.block} addresses): not enough space after alignment`);
    }
    // ensure alignedStart is within primary
    if (alignedStart < primaryStart || (alignedStart + r.block - 1) >>> 0 > primaryEnd) {
      throw new Error('Allocated network falls outside primary');
    }

    allocations.push(subnetInfo(alignedStart, r.prefix, r.requested));
    current = (alignedStart + r.block) >>> 0;
  }

  // verify no overlaps
  for (let i = 0; i < allocations.length; i++) {
    const aStart = ipToInt(allocations[i].network);
    const aEnd = aStart + allocations[i].total_addresses - 1;
    for (let j = i + 1; j < allocations.length; j++) {
      const bStart = ipToInt(allocations[j].network);
      const bEnd = bStart + allocations[j].total_addresses - 1;
      if (!(aEnd < bStart || bEnd < aStart)) throw new Error(`Overlap between ${allocations[i].cidr} and ${allocations[j].cidr}`);
    }
  }

  return allocations;
}

export { allocateVlsm, calcMinPrefixForHosts, parseCidr };
