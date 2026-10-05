/**
 * GeometryTypes.js - Geometric Classification & Entity Definitions
 * 
 * Formal classification of CAD geometry into 3 distinct categories:
 * 1. 2D Geometry: Points, lines, curves, sketches, planar profiles (dim normal = 0, volume = 0)
 * 2. 3D Surface Geometry: Open polygonal meshes, ribbons, sheets (volume = 0, boundary edges exist)
 * 3. 3D Solid Geometry: Closed, watertight B-Rep polyhedra (volume > 0, manifold boundary, 6+ connected faces)
 */

export const GEOMETRY_KIND = Object.freeze({
    SKETCH_2D: '2D_SKETCH',
    SURFACE_3D: '3D_SURFACE',
    SOLID_3D: '3D_SOLID'
});

export const SOLID_OPERATION = Object.freeze({
    EXTRUDE: 'EXTRUDE',
    PUSH_PULL: 'PUSH_PULL',
    BOOLEAN_UNION: 'BOOLEAN_UNION',
    BOOLEAN_DIFFERENCE: 'BOOLEAN_DIFFERENCE',
    BOOLEAN_INTERSECTION: 'BOOLEAN_INTERSECTION',
    CHAMFER: 'CHAMFER',
    FILLET: 'FILLET'
});
