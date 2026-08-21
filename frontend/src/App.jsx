import { Viewport } from './components/Viewport';
import { UIOverlay } from './components/UIOverlay';
import './index.css';

function App() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Viewport />
      <UIOverlay />
    </div>
  );
}

export default App;
