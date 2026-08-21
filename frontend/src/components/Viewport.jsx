import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { WorkingPlane } from './WorkingPlane';
import { GeometryRenderer } from './GeometryRenderer';
import { useGestureInteraction } from '../hooks/useGestureInteraction';

function Scene() {
    useGestureInteraction();
    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 15, 10]} intensity={1.2} />
            <WorkingPlane />
            <GeometryRenderer />
        </>
    );
}

export function Viewport() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: '#0a0a0f' }}>
            <Canvas 
                camera={{ position: [6, 6, 6], fov: 50 }}
                gl={{ preserveDrawingBuffer: true }}
            >
                <Scene />
                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
}
