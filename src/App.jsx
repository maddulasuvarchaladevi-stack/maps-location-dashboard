 import MapView from "./components/MapView";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">📍</div>

          <div>
            <h1>Location Dashboard</h1>
            <p>Search, explore and navigate places</p>
          </div>
        </div>

        <div className="topbar-status">
          <span className="status-dot"></span>
          Map Online
        </div>
      </header>

      <main className="dashboard">
        <MapView />
      </main>
    </div>
  );
}

export default App;