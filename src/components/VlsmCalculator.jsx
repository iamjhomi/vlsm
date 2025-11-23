import React, { useState } from 'react';
import { allocateVlsm } from '../utils/vlsm';

function parseHostsInput(input) {
  // accept space, comma, newline separated ints
  return input
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => parseInt(s, 10));
}

export default function VlsmCalculator() {
  const [primary, setPrimary] = useState('192.168.0.0/24');
  const [hostsText, setHostsText] = useState('50 20 10');
  const [error, setError] = useState(null);
  const [allocs, setAllocs] = useState(null);
  const [format, setFormat] = useState('table');

  function onCalculate(e) {
    e && e.preventDefault();
    setError(null);
    setAllocs(null);
    let hosts;
    try {
      hosts = parseHostsInput(hostsText);
      if (hosts.length === 0) throw new Error('Provide at least one host requirement');
      const res = allocateVlsm(primary, hosts);
      setAllocs(res);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 980 }}>
      <h2>VLSM IPv4 Subnet Calculator</h2>
      <form onSubmit={onCalculate} style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Primary network (CIDR): </label>
          <input value={primary} onChange={e => setPrimary(e.target.value)} style={{ width: 220 }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Host requirements (space/comma separated): </label>
          <input value={hostsText} onChange={e => setHostsText(e.target.value)} style={{ width: 420 }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Output: </label>
          <select value={format} onChange={e => setFormat(e.target.value)}>
            <option value="table">Table</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <button type="submit">Calculate</button>
      </form>

      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}

      {allocs && format === 'json' && (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 12 }}>{JSON.stringify(allocs, null, 2)}</pre>
      )}

      {allocs && format === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Network</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>CIDR</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Mask</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Wildcard</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Total</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Usable</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Req</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>First</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Last</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Broadcast</th>
                <th style={{ border: '1px solid #ddd', padding: 6 }}>Wasted</th>
              </tr>
            </thead>
            <tbody>
              {allocs.map((a, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.network}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{`/${a.prefix}`}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.subnet_mask}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.wildcard_mask}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.total_addresses}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.usable_hosts}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.requested_hosts}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.first_usable}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.last_usable}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.broadcast}</td>
                  <td style={{ border: '1px solid #ddd', padding: 6 }}>{a.wasted_addresses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
