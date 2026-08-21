import { useCadStore } from '../store/useCadStore';

export function WorkingPlane() {
    const planeRotation = useCadStore((state) => state.planeRotation);
    const planePosition = useCadStore((state) => state.planePosition);

    return (
        <group position={planePosition} rotation={planeRotation}>
            {/* Visual Grid Plane */}
            <gridHelper args={[20, 20, 0x00ffff, 0x334455]} />
            <axesHelper args={[3]} />
        </group>
    );
}