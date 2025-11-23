import './App.css';
import VlsmCalculator from './components/VlsmCalculator';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="brand">
          <div className="brand-icon" aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <title>Network</title>
              <circle cx="12" cy="4" r="2.2" fill="#fff" opacity="0" />
              <g fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6.5" cy="9.5" r="1.8" fill="#ffffff" />
                <circle cx="17.5" cy="9.5" r="1.8" fill="#ffffff" />
                <circle cx="12" cy="17" r="2.2" fill="#ffffff" />
                <path d="M8.1 10.8C9.1 12 10.4 13 12 13s2.9-1 3.9-2.2" stroke="#fff" />
                <path d="M12 13v3.2" stroke="#fff" />
              </g>
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-title">VLSM Architect</div>
            <div className="brand-sub">IPv4 Subnet Calculator</div>
          </div>
        </div>
      </header>
      <main>
        <VlsmCalculator />
      </main>
      <footer className="App-footer">
        <div className="footer-inner">
          <div>© {new Date().getFullYear()} VLSM Architect. All rights reserved.</div>
          <div className="footer-right">Developed by Homethagan</div>
        </div>
      </footer>
    </div>
  );
}

export default App;
