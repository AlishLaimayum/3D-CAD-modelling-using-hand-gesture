import { Viewport } from './components/Viewport';
import { UIOverlay } from './components/UIOverlay';
import { SurfaceSelectionPanel } from './components/SurfaceSelectionPanel';
import './index.css';

function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Viewport />
      <UIOverlay />
      <SurfaceSelectionPanel />
    </div>
  );
}

export default App;
