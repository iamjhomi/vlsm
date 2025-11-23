import './App.css';
import VlsmCalculator from './components/VlsmCalculator';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{ margin: 8 }}>VLSM Calculator</h1>
      </header>
      <main>
        <VlsmCalculator />
      </main>
    </div>
  );
}

export default App;
