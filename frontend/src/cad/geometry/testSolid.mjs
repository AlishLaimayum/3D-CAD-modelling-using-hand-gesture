import { ExtrusionEngine } from './ExtrusionEngine.js';
import { GEOMETRY_KIND } from './GeometryTypes.js';

// Test 1: Rectangle (width=4, depth=2) extruded by height=3
const corners = [
    [0, 0, 0],
    [4, 0, 0],
    [4, 0, 2],
    [0, 0, 2]
];

const solid = ExtrusionEngine.createBoxSolid(corners, 3.0);
const val = solid.validateSolid();

console.log('=== CAD SOLID VERIFICATION REPORT ===');
console.log('Kind:', solid.kind);
console.log('Vertex Count:', val.vertexCount, '(Expected: 8)');
console.log('Edge Count:', val.edgeCount, '(Expected: 18)');
console.log('Face Count:', val.faceCount, '(Expected: 12)');
console.log('Dimensions:', val.dimensions, '(Expected: x:4, y:3, z:2)');
console.log('Volume:', solid.volume, '(Expected: 24)');
console.log('Surface Area:', solid.surfaceArea, '(Expected: 2*(4*2 + 4*3 + 2*3) = 52)');
console.log('Euler Characteristic:', val.eulerCharacteristic, '(Expected: 2)');
console.log('Is Closed:', val.isClosed, '(Expected: true)');
console.log('Is Watertight:', val.isWatertight, '(Expected: true)');
console.log('Is Manifold:', val.isManifold, '(Expected: true)');
console.log('Normals Consistent:', val.normalsConsistent, '(Expected: true)');
console.log('Degenerate Faces:', val.degenerateFaceCount, '(Expected: 0)');
console.log('Boundary Edges:', val.boundaryEdgeCount, '(Expected: 0)');
console.log('Non-manifold Edges:', val.nonManifoldEdgeCount, '(Expected: 0)');
console.log('Is Valid Solid:', val.isValidSolid, '(Expected: true)');

// Test 2: Modify extrusion height to 5
solid.setExtrusionHeight(5.0);
const val2 = solid.validateSolid();
console.log('\n=== AFTER ELONGATION TO HEIGHT=5 ===');
console.log('Dimensions:', val2.dimensions, '(Expected: x:4, y:5, z:2)');
console.log('Volume:', solid.volume, '(Expected: 40)');
console.log('Surface Area:', solid.surfaceArea, '(Expected: 2*(4*2 + 4*5 + 2*5) = 76)');
console.log('Is Valid Solid:', val2.isValidSolid, '(Expected: true)');
