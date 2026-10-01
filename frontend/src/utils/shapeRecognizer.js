/**
 * shapeRecognizer.js - Geometric Shape Recognition Engine
 * 
 * Analyzes a freehand stroke (array of 3D points) and determines whether it
 * closely resembles a supported geometric shape. Returns the recognized shape
 * type and the corresponding "perfect" replacement points.
 *
 * Supported shapes: LINE, CIRCLE, ELLIPSE, RECTANGLE, SQUARE, TRIANGLE
 * 
 * Algorithm: Project 3D points onto the working plane (best-fit 2D), run
 * 2D geometric analysis, then lift perfect shape points back to 3D.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    // Minimum confidence to accept a shape recognition result
    MIN_CONFIDENCE: 0.70,

    // Minimum number of points for shape analysis (below this, skip)
    MIN_POINTS: 8,

    // Line: ratio of start-end distance to total path length
    LINE_STRAIGHTNESS_THRESHOLD: 0.90,

    // Circle: max coefficient of variation of radius distances
    CIRCLE_MAX_RADIUS_CV: 0.18,

    // Circle: max distance between start and end relative to avg radius
    CIRCLE_CLOSURE_THRESHOLD: 0.45,

    // Ellipse: max average normalized fit error
    ELLIPSE_MAX_FIT_ERROR: 0.20,

    // Polygon (rect/tri): max Hausdorff-like distance as fraction of perimeter
    POLYGON_MAX_FIT_ERROR: 0.08,

    // Rectangle: tolerance for 90-degree angles (in radians, ~15°)
    RECT_ANGLE_TOLERANCE: 0.28,

    // Square: max aspect ratio deviation from 1.0
    SQUARE_ASPECT_TOLERANCE: 0.20,

    // Triangle: tolerance for corner detection
    TRIANGLE_ANGLE_TOLERANCE: 0.35,

    // Number of points to generate for perfect circle/ellipse
    CIRCLE_RESOLUTION: 64,
};


// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Recognize a geometric shape from a freehand stroke.
 * 
 * @param {Array<Array<number>>} points3D - Array of [x, y, z] points
 * @param {Object} [planeManager] - Optional PlaneManager for 3D→2D projection
 * @returns {{ shape: string|null, confidence: number, perfectPoints: Array<Array<number>>|null }}
 */
export function recognizeShape(points3D, planeManager = null) {
    if (!points3D || points3D.length < CONFIG.MIN_POINTS) {
        return { shape: null, confidence: 0, perfectPoints: null };
    }

    // 1. Project to 2D working plane (or use XZ if no plane manager)
    const { points2D, projectTo3D } = projectPoints(points3D, planeManager);

    // 2. Compute stroke metrics
    const metrics = computeStrokeMetrics(points2D);

    // 3. Test each shape candidate
    const candidates = [];

    // Test LINE first (simple and fast)
    const lineResult = testLine(points2D, metrics);
    if (lineResult) candidates.push(lineResult);

    // Test CIRCLE
    const circleResult = testCircle(points2D, metrics);
    if (circleResult) candidates.push(circleResult);

    // Test ELLIPSE (only if circle didn't score very high)
    if (!circleResult || circleResult.confidence < 0.85) {
        const ellipseResult = testEllipse(points2D, metrics);
        if (ellipseResult) candidates.push(ellipseResult);
    }

    // Test TRIANGLE
    const triangleResult = testTriangle(points2D, metrics);
    if (triangleResult) candidates.push(triangleResult);

    // Test RECTANGLE (includes SQUARE detection)
    const rectResult = testRectangle(points2D, metrics);
    if (rectResult) candidates.push(rectResult);

    // 4. Pick the best candidate above the confidence threshold
    if (candidates.length === 0) {
        return { shape: null, confidence: 0, perfectPoints: null };
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];

    if (best.confidence < CONFIG.MIN_CONFIDENCE) {
        return { shape: null, confidence: best.confidence, perfectPoints: null };
    }

    // 5. Lift perfect 2D points back to 3D
    const perfectPoints3D = best.perfectPoints2D.map(p => projectTo3D(p));

    return {
        shape: best.shape,
        confidence: best.confidence,
        perfectPoints: perfectPoints3D
    };
}


// ============================================================
// 3D ↔ 2D PROJECTION
// ============================================================

function projectPoints(points3D) {
    // Points are in local working plane coordinates where Y ~ 0 (X-Z plane)
    const points2D = points3D.map(p => [p[0], p[2]]);
    const projectTo3D = (p2d) => [p2d[0], 0, p2d[1]];

    return { points2D, projectTo3D };
}

// ============================================================
// STROKE METRICS
// ============================================================

function computeStrokeMetrics(points2D) {
    const n = points2D.length;

    // Centroid
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
        cx += points2D[i][0];
        cy += points2D[i][1];
    }
    cx /= n;
    cy /= n;

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
        const [x, y] = points2D[i];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    const bbWidth = maxX - minX;
    const bbHeight = maxY - minY;
    const bbDiag = Math.hypot(bbWidth, bbHeight);

    // Total path length
    let pathLength = 0;
    for (let i = 1; i < n; i++) {
        pathLength += dist2D(points2D[i - 1], points2D[i]);
    }

    // Start-end distance
    const startEndDist = dist2D(points2D[0], points2D[n - 1]);

    // Closure ratio (how "closed" the stroke is)
    const closureRatio = bbDiag > 0.0001 ? startEndDist / bbDiag : 0;

    // Average radius from centroid
    let avgRadius = 0;
    const radii = [];
    for (let i = 0; i < n; i++) {
        const r = dist2D(points2D[i], [cx, cy]);
        radii.push(r);
        avgRadius += r;
    }
    avgRadius /= n;

    // Radius coefficient of variation
    let radiusVariance = 0;
    for (let i = 0; i < n; i++) {
        const diff = radii[i] - avgRadius;
        radiusVariance += diff * diff;
    }
    radiusVariance /= n;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const radiusCV = avgRadius > 0.0001 ? radiusStdDev / avgRadius : Infinity;

    // Aspect ratio of bounding box
    const aspectRatio = bbHeight > 0.0001 ? bbWidth / bbHeight : 1;

    return {
        n,
        centroid: [cx, cy],
        bbMin: [minX, minY],
        bbMax: [maxX, maxY],
        bbWidth,
        bbHeight,
        bbDiag,
        pathLength,
        startEndDist,
        closureRatio,
        avgRadius,
        radii,
        radiusCV,
        aspectRatio
    };
}


// ============================================================
// SHAPE TESTS
// ============================================================

/**
 * LINE: Check if the stroke is approximately straight
 */
function testLine(points2D, metrics) {
    const { pathLength, startEndDist, n } = metrics;
    if (pathLength < 0.0001) return null;

    const straightness = startEndDist / pathLength;

    if (straightness < CONFIG.LINE_STRAIGHTNESS_THRESHOLD) return null;

    // Compute max deviation from the straight line
    const start = points2D[0];
    const end = points2D[n - 1];
    let maxDev = 0;

    const lineLen = startEndDist;
    if (lineLen > 0.0001) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];

        for (let i = 1; i < n - 1; i++) {
            const px = points2D[i][0] - start[0];
            const py = points2D[i][1] - start[1];
            const cross = Math.abs(px * dy - py * dx) / lineLen;
            if (cross > maxDev) maxDev = cross;
        }
    }

    const deviationRatio = lineLen > 0.0001 ? maxDev / lineLen : 0;

    // Confidence: straightness weighted + deviation penalty
    let confidence = straightness * 0.6 + (1 - Math.min(1, deviationRatio * 5)) * 0.4;
    confidence = Math.max(0, Math.min(1, confidence));

    return {
        shape: 'LINE',
        confidence,
        perfectPoints2D: [points2D[0], points2D[n - 1]]
    };
}

/**
 * CIRCLE: Check if points are approximately equidistant from centroid
 */
function testCircle(points2D, metrics) {
    const { radiusCV, closureRatio, avgRadius, centroid, n } = metrics;

    // Must be somewhat closed
    if (closureRatio > CONFIG.CIRCLE_CLOSURE_THRESHOLD) return null;

    // Radius must be consistent
    if (radiusCV > CONFIG.CIRCLE_MAX_RADIUS_CV) return null;

    // Must have enough points to form a circle
    if (n < 12) return null;

    // Compute average fit error (distance of each point from the ideal circle)
    let fitError = 0;
    for (let i = 0; i < n; i++) {
        const r = dist2D(points2D[i], centroid);
        fitError += Math.abs(r - avgRadius);
    }
    fitError /= (n * avgRadius);

    // Confidence
    let confidence = 0;
    confidence += (1 - Math.min(1, radiusCV / CONFIG.CIRCLE_MAX_RADIUS_CV)) * 0.35;
    confidence += (1 - Math.min(1, closureRatio / CONFIG.CIRCLE_CLOSURE_THRESHOLD)) * 0.25;
    confidence += (1 - Math.min(1, fitError * 3)) * 0.40;
    confidence = Math.max(0, Math.min(1, confidence));

    // Generate perfect circle points
    const perfectPoints2D = [];
    for (let i = 0; i <= CONFIG.CIRCLE_RESOLUTION; i++) {
        const angle = (i / CONFIG.CIRCLE_RESOLUTION) * Math.PI * 2;
        perfectPoints2D.push([
            centroid[0] + avgRadius * Math.cos(angle),
            centroid[1] + avgRadius * Math.sin(angle)
        ]);
    }

    return { shape: 'CIRCLE', confidence, perfectPoints2D };
}

/**
 * ELLIPSE: Fit an axis-aligned ellipse and check fit quality
 */
function testEllipse(points2D, metrics) {
    const { bbWidth, bbHeight, closureRatio, n } = metrics;

    // Must be somewhat closed
    if (closureRatio > CONFIG.CIRCLE_CLOSURE_THRESHOLD) return null;
    if (n < 12) return null;

    // Semi-axes from bounding box (approximate)
    const a = bbWidth / 2;  // semi-major
    const b = bbHeight / 2; // semi-minor

    if (a < 0.001 || b < 0.001) return null;

    // Aspect ratio must indicate a non-circular ellipse
    const ar = Math.max(a, b) / Math.min(a, b);
    if (ar < 1.15) return null; // Too circular, let circle detector handle it

    // Compute fit error: for each point, compute distance to ellipse
    let fitError = 0;
    const bbCenterX = (metrics.bbMin[0] + metrics.bbMax[0]) / 2;
    const bbCenterY = (metrics.bbMin[1] + metrics.bbMax[1]) / 2;

    for (let i = 0; i < n; i++) {
        const px = points2D[i][0] - bbCenterX;
        const py = points2D[i][1] - bbCenterY;

        // Normalized distance to ellipse (1.0 = on ellipse)
        const ellipseVal = (px * px) / (a * a) + (py * py) / (b * b);
        fitError += Math.abs(ellipseVal - 1.0);
    }
    fitError /= n;

    if (fitError > CONFIG.ELLIPSE_MAX_FIT_ERROR) return null;

    // Confidence
    let confidence = 0;
    confidence += (1 - Math.min(1, fitError / CONFIG.ELLIPSE_MAX_FIT_ERROR)) * 0.50;
    confidence += (1 - Math.min(1, closureRatio / CONFIG.CIRCLE_CLOSURE_THRESHOLD)) * 0.25;
    confidence += Math.min(1, (ar - 1) / 2) * 0.25; // Reward clear elliptical shape
    confidence = Math.max(0, Math.min(1, confidence));

    // Generate perfect ellipse points
    const perfectPoints2D = [];
    for (let i = 0; i <= CONFIG.CIRCLE_RESOLUTION; i++) {
        const angle = (i / CONFIG.CIRCLE_RESOLUTION) * Math.PI * 2;
        perfectPoints2D.push([
            bbCenterX + a * Math.cos(angle),
            bbCenterY + b * Math.sin(angle)
        ]);
    }

    return { shape: 'ELLIPSE', confidence, perfectPoints2D };
}

/**
 * TRIANGLE: Detect 3 dominant corners using Douglas-Peucker simplification
 */
function testTriangle(points2D, metrics) {
    const { closureRatio, pathLength, n } = metrics;

    // Must be somewhat closed
    if (closureRatio > 0.35) return null;
    if (n < 10) return null;

    // Simplify the stroke to find dominant corners
    const corners = findDominantCorners(points2D, 3);
    if (!corners || corners.length !== 3) return null;

    // Compute the fit error: average distance from each point to the nearest triangle edge
    const triangleEdges = [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[0]]
    ];

    let fitError = 0;
    for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        for (const [a, b] of triangleEdges) {
            const d = pointToSegmentDist(points2D[i], a, b);
            if (d < minDist) minDist = d;
        }
        fitError += minDist;
    }
    fitError /= (n * pathLength);

    if (fitError > CONFIG.POLYGON_MAX_FIT_ERROR) return null;

    // Check that triangle has reasonable angles (not too flat)
    const angles = computePolygonAngles(corners);
    const minAngle = Math.min(...angles);
    if (minAngle < 0.15) return null; // Too degenerate (~8.5°)

    // Confidence
    let confidence = 0;
    confidence += (1 - Math.min(1, fitError / CONFIG.POLYGON_MAX_FIT_ERROR)) * 0.50;
    confidence += (1 - Math.min(1, closureRatio / 0.35)) * 0.25;
    confidence += Math.min(1, minAngle / 0.5) * 0.25;
    confidence = Math.max(0, Math.min(1, confidence));

    // Perfect triangle: use detected corners + close
    const perfectPoints2D = [...corners, corners[0]];

    return { shape: 'TRIANGLE', confidence, perfectPoints2D };
}

/**
 * RECTANGLE / SQUARE: Detect 4 dominant corners and validate right angles
 */
function testRectangle(points2D, metrics) {
    const { closureRatio, pathLength, n } = metrics;

    // Must be somewhat closed
    if (closureRatio > 0.35) return null;
    if (n < 12) return null;

    // Simplify the stroke to find 4 dominant corners
    const corners = findDominantCorners(points2D, 4);
    if (!corners || corners.length !== 4) return null;

    // Sort corners into consistent winding order
    const sortedCorners = sortCorners(corners);

    // Compute angles at each corner
    const angles = computePolygonAngles(sortedCorners);

    // Check that all angles are approximately 90° (π/2)
    const halfPi = Math.PI / 2;
    let maxAngleDeviation = 0;
    for (const angle of angles) {
        const dev = Math.abs(angle - halfPi);
        if (dev > maxAngleDeviation) maxAngleDeviation = dev;
    }

    if (maxAngleDeviation > CONFIG.RECT_ANGLE_TOLERANCE) return null;

    // Compute fit error: average distance from each point to nearest rectangle edge
    const rectEdges = [
        [sortedCorners[0], sortedCorners[1]],
        [sortedCorners[1], sortedCorners[2]],
        [sortedCorners[2], sortedCorners[3]],
        [sortedCorners[3], sortedCorners[0]]
    ];

    let fitError = 0;
    for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        for (const [a, b] of rectEdges) {
            const d = pointToSegmentDist(points2D[i], a, b);
            if (d < minDist) minDist = d;
        }
        fitError += minDist;
    }
    fitError /= (n * pathLength);

    if (fitError > CONFIG.POLYGON_MAX_FIT_ERROR) return null;

    // Determine if it's a SQUARE (all sides approximately equal)
    const sideLengths = [
        dist2D(sortedCorners[0], sortedCorners[1]),
        dist2D(sortedCorners[1], sortedCorners[2]),
        dist2D(sortedCorners[2], sortedCorners[3]),
        dist2D(sortedCorners[3], sortedCorners[0])
    ];

    const avgSide = sideLengths.reduce((a, b) => a + b, 0) / 4;
    const maxSideDev = Math.max(...sideLengths.map(s => Math.abs(s - avgSide) / avgSide));
    const isSquare = maxSideDev < CONFIG.SQUARE_ASPECT_TOLERANCE;

    // Confidence
    let confidence = 0;
    confidence += (1 - Math.min(1, fitError / CONFIG.POLYGON_MAX_FIT_ERROR)) * 0.40;
    confidence += (1 - Math.min(1, maxAngleDeviation / CONFIG.RECT_ANGLE_TOLERANCE)) * 0.35;
    confidence += (1 - Math.min(1, closureRatio / 0.35)) * 0.25;
    confidence = Math.max(0, Math.min(1, confidence));

    // Perfect rectangle: use sorted corners + close
    const perfectPoints2D = [...sortedCorners, sortedCorners[0]];

    return {
        shape: isSquare ? 'SQUARE' : 'RECTANGLE',
        confidence,
        perfectPoints2D
    };
}


// ============================================================
// GEOMETRY UTILITIES
// ============================================================

function dist2D(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance from point p to line segment [a, b]
 */
function pointToSegmentDist(p, a, b) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = p[0] - a[0];
    const apy = p[1] - a[1];

    const abLenSq = abx * abx + aby * aby;
    if (abLenSq < 1e-12) return dist2D(p, a);

    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a[0] + t * abx;
    const projY = a[1] + t * aby;

    return dist2D(p, [projX, projY]);
}

/**
 * Compute interior angles of a polygon given its vertices in order
 */
function computePolygonAngles(corners) {
    const n = corners.length;
    const angles = [];

    for (let i = 0; i < n; i++) {
        const prev = corners[(i - 1 + n) % n];
        const curr = corners[i];
        const next = corners[(i + 1) % n];

        const v1x = prev[0] - curr[0];
        const v1y = prev[1] - curr[1];
        const v2x = next[0] - curr[0];
        const v2y = next[1] - curr[1];

        const dot = v1x * v2x + v1y * v2y;
        const cross = v1x * v2y - v1y * v2x;

        const angle = Math.abs(Math.atan2(Math.abs(cross), dot));
        angles.push(angle);
    }

    return angles;
}

/**
 * Find N dominant corners in a stroke using iterative Douglas-Peucker simplification
 */
function findDominantCorners(points2D, targetCount) {
    // Start with a tolerance and iteratively adjust until we get the target count
    const n = points2D.length;
    if (n < targetCount) return null;

    // Close the loop for analysis
    const closed = [...points2D];
    if (dist2D(closed[0], closed[closed.length - 1]) > 0.01) {
        closed.push(closed[0]);
    }

    let lo = 0;
    let hi = dist2D(
        [Math.min(...points2D.map(p => p[0])), Math.min(...points2D.map(p => p[1]))],
        [Math.max(...points2D.map(p => p[0])), Math.max(...points2D.map(p => p[1]))]
    ) * 0.5;

    let bestCorners = null;
    let iterations = 0;

    while (iterations < 50) {
        const eps = (lo + hi) / 2;
        const simplified = douglasPeucker(closed, eps);

        // Remove the closing duplicate if present
        let unique = simplified;
        if (unique.length > 1 && dist2D(unique[0], unique[unique.length - 1]) < eps * 0.1) {
            unique = unique.slice(0, -1);
        }

        if (unique.length === targetCount) {
            bestCorners = unique;
            break;
        } else if (unique.length > targetCount) {
            lo = eps;
        } else {
            hi = eps;
        }

        iterations++;
    }

    // If exact match not found, try one more time with a slightly wider search
    if (!bestCorners) {
        // Use the most recent simplified result and take the N most angular points
        const simplified = douglasPeucker(closed, (lo + hi) / 2);
        let unique = simplified;
        if (unique.length > 1 && dist2D(unique[0], unique[unique.length - 1]) < 0.01) {
            unique = unique.slice(0, -1);
        }

        if (unique.length >= targetCount) {
            // Rank by angle sharpness and pick the top N
            const scored = unique.map((pt, idx) => {
                const prev = unique[(idx - 1 + unique.length) % unique.length];
                const next = unique[(idx + 1) % unique.length];
                const v1x = prev[0] - pt[0], v1y = prev[1] - pt[1];
                const v2x = next[0] - pt[0], v2y = next[1] - pt[1];
                const dot = v1x * v2x + v1y * v2y;
                const len1 = Math.hypot(v1x, v1y);
                const len2 = Math.hypot(v2x, v2y);
                const cosAngle = len1 > 0 && len2 > 0 ? dot / (len1 * len2) : 1;
                return { point: pt, sharpness: 1 - cosAngle }; // Higher = sharper corner
            });

            scored.sort((a, b) => b.sharpness - a.sharpness);
            bestCorners = scored.slice(0, targetCount).map(s => s.point);
        }
    }

    return bestCorners;
}

/**
 * Douglas-Peucker line simplification
 */
function douglasPeucker(points, epsilon) {
    if (points.length <= 2) return [...points];

    // Find the point with the maximum distance from the line [first, last]
    const first = points[0];
    const last = points[points.length - 1];

    let maxDist = 0;
    let maxIdx = 0;

    for (let i = 1; i < points.length - 1; i++) {
        const d = pointToSegmentDist(points[i], first, last);
        if (d > maxDist) {
            maxDist = d;
            maxIdx = i;
        }
    }

    if (maxDist > epsilon) {
        const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
        const right = douglasPeucker(points.slice(maxIdx), epsilon);

        return [...left.slice(0, -1), ...right];
    }

    return [first, last];
}

/**
 * Sort 4 corners into a consistent (counterclockwise) winding order
 */
function sortCorners(corners) {
    // Find centroid
    let cx = 0, cy = 0;
    for (const c of corners) {
        cx += c[0];
        cy += c[1];
    }
    cx /= corners.length;
    cy /= corners.length;

    // Sort by angle from centroid
    const sorted = [...corners].sort((a, b) => {
        const angleA = Math.atan2(a[1] - cy, a[0] - cx);
        const angleB = Math.atan2(b[1] - cy, b[0] - cx);
        return angleA - angleB;
    });

    return sorted;
}
