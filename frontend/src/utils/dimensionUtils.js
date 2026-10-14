/**
 * dimensionUtils.js - Geometric Dimension Calculations and Manual Resizing in Centimeters (cm)
 *
 * In this CAD application, 1 Three.js world unit = 1.0 centimeter (cm).
 * This module provides precision calculation and recalculation functions for all 2D
 * sketch profiles and 3D extruded solids.
 */

import { Profile2D } from '../cad/geometry/Profile2D.js';
import { ExtrusionEngine } from '../cad/geometry/ExtrusionEngine.js';
import { GEOMETRY_KIND } from '../cad/geometry/GeometryTypes.js';

/**
 * Extract all relevant measurements (in cm) for any CAD object
 */
export function getDimensionsInCm(obj) {
    if (!obj) return null;

    const type = obj.type || 'FREEHAND';
    const points = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
    const extrudeHeight = Math.max(0, obj.extrudeHeight ?? ((obj.scaleZ && obj.scaleZ > 0.05 && obj.scaleZ !== 1) ? obj.scaleZ : 0));
    const isExtruded = extrudeHeight > 0.01;

    const result = {
        type,
        isExtruded,
        extrudeHeightCm: extrudeHeight,
        pointsCount: points.length,
        unit: 'cm'
    };

    if (type === 'LINE' && points.length >= 2) {
        const s = points[0];
        const e = points[points.length - 1];
        const dx = e[0] - s[0];
        const dy = e[1] - s[1];
        const dz = e[2] - s[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        result.lengthCm = length;
        result.start = [...s];
        result.end = [...e];
    } else if (type === 'RECTANGLE' && points.length >= 4) {
        // Points: 4 corners in plane
        const p0 = points[0];
        const p1 = points[1];
        const p2 = points[2];
        const p3 = points[3];

        // Edge 0->1 is width, Edge 1->2 (or 0->3) is length/depth
        const w = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        const l = Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
        const center = [
            (p0[0] + p2[0]) / 2,
            (p0[1] + p2[1]) / 2,
            (p0[2] + p2[2]) / 2
        ];

        result.widthCm = w;
        result.lengthCm = l;
        result.areaCm2 = w * l;
        result.center = center;
    } else if (type === 'CIRCLE' && points.length >= 3) {
        // Circle center is the centroid of points
        let cx = 0, cy = 0, cz = 0;
        for (const p of points) {
            cx += p[0];
            cy += p[1];
            cz += p[2];
        }
        cx /= points.length;
        cy /= points.length;
        cz /= points.length;

        const p0 = points[0];
        const radius = Math.hypot(p0[0] - cx, p0[1] - cy, p0[2] - cz);

        result.radiusCm = radius;
        result.diameterCm = radius * 2;
        result.circumferenceCm = 2 * Math.PI * radius;
        result.areaCm2 = Math.PI * radius * radius;
        result.center = [cx, cy, cz];
    } else {
        // FREEHAND or arbitrary closed polygon
        let totalLen = 0;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
            minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);

            if (i > 0) {
                const prev = points[i - 1];
                totalLen += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
            }
        }

        result.lengthCm = totalLen;
        result.bboxWidthCm = Math.max(0, maxX - minX);
        result.bboxHeightCm = Math.max(0, maxZ - minZ);
        result.center = [
            (minX + maxX) / 2 || 0,
            (minY + maxY) / 2 || 0,
            (minZ + maxZ) / 2 || 0
        ];
    }

    // 3D Solid Bounding volume & dimensions if revolved or extruded
    if (obj.operation === 'REVOLVE' || obj.revolveData) {
        result.isRevolved = true;
        result.revolveAngleDeg = obj.revolveData?.angleDeg || 360;
        result.revolveAxis = obj.revolveData?.axis;
        result.isSurface = obj.revolveData?.isSurface;
        if (obj.solidMesh) {
            result.solidDimensions = obj.solidMesh.dimensions || { x: 0, y: 0, z: 0 };
            result.volumeCm3 = obj.solidMesh.volume || 0;
            result.surfaceAreaCm2 = obj.solidMesh.surfaceArea || 0;
            result.isWatertight = obj.solidMesh.isWatertight;
        }
    } else if (isExtruded && obj.solidMesh) {
        result.solidDimensions = obj.solidMesh.dimensions || { x: 0, y: extrudeHeight, z: 0 };
        result.volumeCm3 = obj.solidMesh.volume || 0;
    }

    return result;
}

/**
 * Manually update the length of a LINE object in centimeters (cm).
 * Keeps start point anchored and moves the end point along the direction vector.
 */
export function resizeLineInCm(obj, newLengthCm) {
    const len = Math.max(0.01, Number(newLengthCm));
    const points = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
    if (points.length < 2) return null;

    const s = [...points[0]];
    const e = [...points[points.length - 1]];
    const dx = e[0] - s[0];
    const dy = e[1] - s[1];
    const dz = e[2] - s[2];
    const curLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

    let dir;
    if (curLen < 1e-6) {
        dir = [1, 0, 0];
    } else {
        dir = [dx / curLen, dy / curLen, dz / curLen];
    }

    const newEnd = [
        s[0] + dir[0] * len,
        s[1] + dir[1] * len,
        s[2] + dir[2] * len
    ];

    const newPoints = [s, newEnd];
    const profile = new Profile2D({
        points: newPoints,
        type: 'LINE',
        isClosed: false
    });

    const updates = {
        type: 'LINE',
        points: newPoints,
        start: s,
        end: newEnd,
        profile
    };

    if (obj.extrudeHeight > 0.01) {
        updates.solidMesh = ExtrusionEngine.extrude(profile, obj.extrudeHeight);
    }

    return updates;
}

/**
 * Manually update the width and/or length of a RECTANGLE in centimeters (cm).
 * Preserves center position and planar orientation.
 */
export function resizeRectangleInCm(obj, { widthCm, lengthCm }) {
    const points = obj.points;
    if (!points || points.length < 4) return null;

    const p0 = points[0];
    const p1 = points[1];
    const p2 = points[2];
    const p3 = points[3];

    // Current width & length
    const curW = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    const curL = Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);

    const targetW = Math.max(0.05, widthCm !== undefined ? Number(widthCm) : curW);
    const targetL = Math.max(0.05, lengthCm !== undefined ? Number(lengthCm) : curL);

    // Direction unit vectors
    const u = curW > 1e-6 ? [
        (p1[0] - p0[0]) / curW,
        (p1[1] - p0[1]) / curW,
        (p1[2] - p0[2]) / curW
    ] : [1, 0, 0];

    const v = curL > 1e-6 ? [
        (p3[0] - p0[0]) / curL,
        (p3[1] - p0[1]) / curL,
        (p3[2] - p0[2]) / curL
    ] : [0, 0, 1];

    // Center point
    const cx = (p0[0] + p2[0]) / 2;
    const cy = (p0[1] + p2[1]) / 2;
    const cz = (p0[2] + p2[2]) / 2;

    const halfW = targetW / 2;
    const halfL = targetL / 2;

    const newP0 = [
        cx - u[0] * halfW - v[0] * halfL,
        cy - u[1] * halfW - v[1] * halfL,
        cz - u[2] * halfW - v[2] * halfL
    ];
    const newP1 = [
        cx + u[0] * halfW - v[0] * halfL,
        cy + u[1] * halfW - v[1] * halfL,
        cz + u[2] * halfW - v[2] * halfL
    ];
    const newP2 = [
        cx + u[0] * halfW + v[0] * halfL,
        cy + u[1] * halfW + v[1] * halfL,
        cz + u[2] * halfW + v[2] * halfL
    ];
    const newP3 = [
        cx - u[0] * halfW + v[0] * halfL,
        cy - u[1] * halfW + v[1] * halfL,
        cz - u[2] * halfW + v[2] * halfL
    ];

    const newPoints = [newP0, newP1, newP2, newP3];
    const profile = new Profile2D({
        points: newPoints,
        type: 'RECTANGLE',
        isClosed: true
    });

    const updates = {
        type: 'RECTANGLE',
        points: newPoints,
        start: newP0,
        end: newP2,
        profile
    };

    if (obj.extrudeHeight > 0.01) {
        updates.solidMesh = ExtrusionEngine.extrude(profile, obj.extrudeHeight);
    }

    return updates;
}

/**
 * Manually update the radius of a CIRCLE in centimeters (cm).
 * Re-evaluates circular boundary vertices around the existing center.
 */
export function resizeCircleInCm(obj, newRadiusCm) {
    const points = obj.points;
    if (!points || points.length < 3) return null;

    const r = Math.max(0.02, Number(newRadiusCm));

    // Centroid calculation
    let cx = 0, cy = 0, cz = 0;
    for (const p of points) {
        cx += p[0];
        cy += p[1];
        cz += p[2];
    }
    cx /= points.length;
    cy /= points.length;
    cz /= points.length;

    const SEGMENTS = Math.max(32, points.length > 3 ? points.length : 64);
    const newPoints = [];

    for (let i = 0; i < SEGMENTS; i++) {
        const theta = (i / SEGMENTS) * Math.PI * 2;
        newPoints.push([
            cx + r * Math.cos(theta),
            cy,
            cz + r * Math.sin(theta)
        ]);
    }

    const profile = new Profile2D({
        points: newPoints,
        type: 'CIRCLE',
        isClosed: true
    });

    const updates = {
        type: 'CIRCLE',
        points: newPoints,
        start: newPoints[0],
        end: newPoints[Math.floor(SEGMENTS / 2)],
        profile
    };

    if (obj.extrudeHeight > 0.01) {
        updates.solidMesh = ExtrusionEngine.extrude(profile, obj.extrudeHeight);
    }

    return updates;
}

/**
 * Manually scale the length / perimeter of a FREEHAND stroke in centimeters (cm).
 */
export function resizeFreehandInCm(obj, targetLengthCm) {
    const points = obj.points;
    if (!points || points.length < 2) return null;

    const target = Math.max(0.05, Number(targetLengthCm));

    // Current total length & centroid
    let curLen = 0;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        cx += p[0];
        cy += p[1];
        cz += p[2];
        if (i > 0) {
            const prev = points[i - 1];
            curLen += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
        }
    }
    cx /= points.length;
    cy /= points.length;
    cz /= points.length;

    if (curLen < 1e-4) return null;
    const scaleFactor = target / curLen;

    const newPoints = points.map((p) => [
        cx + (p[0] - cx) * scaleFactor,
        cy + (p[1] - cy) * scaleFactor,
        cz + (p[2] - cz) * scaleFactor
    ]);

    const profile = new Profile2D({
        points: newPoints,
        type: obj.type || 'FREEHAND',
        isClosed: obj.isClosed || false
    });

    const updates = {
        type: obj.type || 'FREEHAND',
        points: newPoints,
        start: newPoints[0],
        end: newPoints[newPoints.length - 1],
        profile
    };

    if (obj.extrudeHeight > 0.01) {
        updates.solidMesh = ExtrusionEngine.extrude(profile, obj.extrudeHeight);
    }

    return updates;
}
