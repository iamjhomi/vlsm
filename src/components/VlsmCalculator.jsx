import React, { useState } from 'react';
import { allocateVlsm, parseCidr } from '../utils/vlsm';
import '../App.css';

function downloadJSON(obj, filename = 'vlsm.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function toCSV(allocs) {
  const headers = ['Name','Network','CIDR','Mask','Wildcard','Total','Usable','First','Last','Broadcast','Wasted'];
  const rows = allocs.map(a => [
    a.name,
    a.network,
    `/${a.prefix}`,
    a.subnet_mask,
    a.wildcard_mask,
    a.total_addresses,
    a.usable_hosts,
    a.first_usable,
    a.last_usable,
    a.broadcast,
    a.wasted_addresses
  ]);
  return [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
}

export default function VlsmCalculator() {
  const [primary, setPrimary] = useState('192.168.0.0/24');
  const [hosts, setHosts] = useState([{ name: 'Subnet 1', hosts: 0 }]);
  const [allocs, setAllocs] = useState(null);
  const [error, setError] = useState('');

  function addHost() {
    setHosts(hs => [...hs, { name: `Subnet ${hs.length + 1}`, hosts: 0 }]);
  }

  function updateHost(idx, field, value) {
    setHosts(hs => hs.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }

  function removeHost(idx) {
    setHosts(hs => hs.filter((_, i) => i !== idx));
  }

  async function onCalculate() {
    setError('');
    setAllocs(null);
    try {
      parseCidr(primary); // will throw if invalid

      if (!hosts || hosts.length === 0) throw new Error('Add at least one subnet requirement');

      const hostNums = hosts.map(h => {
        if (!h.name || h.name.trim().length === 0) throw new Error('Each subnet must have a name');
        if (h.hosts == null || h.hosts === '' ) throw new Error('Empty host entries are not allowed');
        if (!Number.isInteger(h.hosts) || h.hosts <= 0) throw new Error('Host values must be positive integers');
        return h.hosts;
      });

      const res = allocateVlsm(primary, hostNums);
      // attach names back in order of allocation (largest-first allocation changed order)
      const remaining = hosts.slice();
      const named = res.map(r => {
        const idx = remaining.findIndex(h => h.hosts === r.requested_hosts);
        let name = '';
        if (idx !== -1) {
          name = remaining[idx].name;
          remaining.splice(idx, 1);
        }
        return { ...r, name };
      });

      setAllocs(named);
    } catch (err) {
      setError(err.message || String(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <>
    <div className="vlsm-root">
      <section className="vlsm-left">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Primary Network (CIDR)</div>
          </div>
          <div className="card-body small">
            <div className="cidr-input-wrapper">
              <div className="cidr-icon" aria-hidden>🌐</div>
              <input
                className="primary-cidr"
                value={primary}
                placeholder="e.g. 192.168.0.0/24"
                onChange={e => setPrimary(e.target.value)}
                aria-label="Primary network CIDR"
              />
            </div>
            <div className="muted">The base block from which subnets will be carved.</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div className="card-title">Subnet Requirements</div>
            <div>
              <button className="btn" onClick={addHost}>+ Add Subnet</button>
            </div>
          </div>
          <div className="card-body">
            {hosts.map((h, i) => (
              <div key={i} className="subnet-row">
                <input className="subnet-name" value={h.name} onChange={e => updateHost(i, 'name', e.target.value)} />
                <input className="subnet-hosts" type="number" min="0" value={h.hosts} onChange={e => updateHost(i, 'hosts', e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
                <button className="btn small" onClick={() => removeHost(i)}>🗑</button>
              </div>
            ))}

            <div style={{ height: 8 }} />
            <button className="btn primary full" onClick={onCalculate}>Calculate Allocation</button>
          </div>
        </div>

        {error && <div className="error" style={{ marginTop: 12 }}>Error: {error}</div>}

        {/* results-card removed from left column; will render full-width below */}
      </section>
      
    </div>

    {/* Full-width results below the main grid */}
    {allocs && (
      <div className="results-card fullwidth" style={{ marginTop: 18 }}>
        <div className="result-actions">
          <button className="btn" onClick={() => copyToClipboard(JSON.stringify(allocs))}>Copy JSON</button>
          <button className="btn" onClick={() => downloadJSON(allocs)}>Download JSON</button>
          <button className="btn" onClick={() => {
            const csv = toCSV(allocs);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'vlsm.csv'; a.click(); URL.revokeObjectURL(url);
          }}>Download CSV</button>
        </div>

        <div className="table-wrap">
          <table className="vlsm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Network</th>
                <th>CIDR</th>
                <th>Mask</th>
                <th>Wildcard</th>
                <th>Total</th>
                <th>Usable</th>
                <th>First</th>
                <th>Last</th>
                <th>Broadcast</th>
                <th>Wasted</th>
              </tr>
            </thead>
            <tbody>
              {allocs.map((a, i) => (
                <tr key={i}>
                  <td>{a.name}</td>
                  <td>{a.network}</td>
                  <td>{`/${a.prefix}`}</td>
                  <td>{a.subnet_mask}</td>
                  <td>{a.wildcard_mask}</td>
                  <td>{a.total_addresses}</td>
                  <td>{a.usable_hosts}</td>
                  <td>{a.first_usable}</td>
                  <td>{a.last_usable}</td>
                  <td>{a.broadcast}</td>
                  <td>{a.wasted_addresses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  );
}
