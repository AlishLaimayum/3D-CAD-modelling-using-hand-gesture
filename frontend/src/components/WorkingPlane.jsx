export function WorkingPlane() {
    return (
        <group>
            {/* Visual Grid Plane */}
            <gridHelper args={[20, 20, 0x00ffff, 0x334455]} />
            <axesHelper args={[3]} />
        </group>
    );
}