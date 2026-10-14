import { Viewport } from './components/Viewport';
import { UIOverlay } from './components/UIOverlay';
import { SurfaceSelectionPanel } from './components/SurfaceSelectionPanel';
import { DimensionInspector } from './components/DimensionInspector';
import { RevolveSettingsPanel } from './components/RevolveSettingsPanel';
import './index.css';

function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Viewport />
      <UIOverlay />
      <DimensionInspector />
      <SurfaceSelectionPanel />
      <RevolveSettingsPanel />
    </div>
  );
}

export default App;
