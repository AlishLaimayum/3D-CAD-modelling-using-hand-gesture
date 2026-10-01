import { Grid } from '@react-three/drei';

export function WorkingPlane() {
    return (
        <group>
            {/* Infinite Fade Visual Grid Plane */}
            <Grid
                position={[0, 0, 0]}
                args={[1000, 1000]}
                cellSize={1}
                cellThickness={1}
                cellColor="#2a435a"
                sectionSize={0}
                sectionThickness={0}
                fadeDistance={80}
                fadeStrength={1.5}
                infiniteGrid
            />
            <axesHelper args={[3]} />
        </group>
    );
}
