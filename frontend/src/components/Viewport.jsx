import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { WorkingPlane } from './WorkingPlane';
import { GeometryRenderer } from './GeometryRenderer';
import { useGestureInteraction } from '../hooks/useGestureInteraction';
import { useCadStore } from '../store/useCadStore';

function Scene() {
    useGestureInteraction();
    const planeRotation = useCadStore((state) => state.planeRotation);
    const planePosition = useCadStore((state) => state.planePosition);

    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 15, 10]} intensity={1.2} />
            {/* Shared plane group — grid, axes, and all drawn geometry rotate together */}
            <group position={planePosition} rotation={planeRotation}>
                <WorkingPlane />
                <GeometryRenderer />
            </group>
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
