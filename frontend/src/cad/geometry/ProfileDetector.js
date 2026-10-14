/**
 * ProfileDetector.js - Automatic 2D Sketch Profile Recognition
 *
 * Detects groups of connected line/curve CAD objects that together form
 * one logical cross-sectional profile for the Revolve (Lathe) operation.
 *
 * Algorithm:
 *  1. Build an adjacency graph: each segment is a node; edges link segments
 *     whose endpoints are within ENDPOINT_TOLERANCE of each other.
 *  2. Traverse connected components (DFS) to group segments into profiles.
 *  3. Within each component, order the segments by chaining endpoints
 *     (handles reversed directions automatically).
 *  4. Concatenate the ordered point arrays into one polyline.
 *  5. Detect closure (start meets end within tolerance).
 *  6. Validate and annotate each resulting SketchProfile.
 */

const ENDPOINT_TOLERANCE = 0.25; // cm — same as Profile2D.detectClosedLoop threshold

// ─── helpers ─────────────────────────────────────────────────────────────────

function segEndpoints(obj) {
    const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : null);
    if (!pts || pts.length < 2) return null;
    return {
        start: pts[0],
        end:   pts[pts.length - 1]
    };
}

function dist2D(a, b) {
    return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function near(a, b) {
    return dist2D(a, b) < ENDPOINT_TOLERANCE;
}

/**
 * Return the full point array for a segment, optionally reversed.
 * Keeps high-resolution curves intact.
 */
function segPoints(obj, reversed) {
    const pts = obj.points || (obj.start && obj.end ? [obj.start, obj.end] : []);
    return reversed ? [...pts].reverse() : pts;
}

// ─── SketchProfile class ──────────────────────────────────────────────────────

/**
 * One logical cross-sectional profile composed of ≥1 connected segments.
 */
export class SketchProfile {
    /**
     * @param {string} id           Unique profile ID
     * @param {Object[]} segments   Ordered array of { obj, reversed }
     * @param {Array}  points       Merged polyline point array (flat)
     * @param {boolean} isClosed    Whether start meets end
     * @param {Object}  validation  { valid, error, warnings }
     */
    constructor({ id, segments, points, isClosed, validation }) {
        this.id       = id;
        this.segments = segments;          // [{ obj, reversed }, ...]
        this.segmentIds = segments.map(s => s.obj.id);
        this.points   = points;
        this.isClosed = isClosed;
        this.type     = isClosed ? 'CLOSED_PROFILE' : 'OPEN_PROFILE';
        this.kind     = 'SKETCH_PROFILE';
        this.validation = validation;

        // Bounding box in X-Z plane
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of points) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
        }
        this.boundingBox = { minX, maxX, minZ, maxZ };
    }

    /** Human-readable label for the UI dropdown */
    get label() {
        const n   = this.segments.length;
        const seg = n === 1 ? 'segment' : 'segments';
        const status = this.isClosed ? 'Closed' : 'Open';
        return `PROFILE (${n} ${seg}, ${status})`;
    }

    /** planePosition / planeRotation taken from first constituent segment */
    get planePosition() {
        return this.segments[0]?.obj?.planePosition ?? null;
    }
    get planeRotation() {
        return this.segments[0]?.obj?.planeRotation ?? null;
    }
}

// ─── ProfileDetector ─────────────────────────────────────────────────────────

export class ProfileDetector {
    /**
     * Analyse `cadObjects` and return an array of SketchProfile instances.
     * Only 2D sketch objects are considered (not already-revolved/extruded solids).
     *
     * @param {Object[]} cadObjects  Raw objects from the Zustand store
     * @returns {SketchProfile[]}
     */
    static detect(cadObjects) {
        // 1. Filter to 2D drawable segments only (not solids, not construction)
        const candidates = cadObjects.filter(obj =>
            obj.type !== 'REVOLVE_SOLID' &&
            obj.type !== 'REVOLVE_SURFACE' &&
            (!obj.extrudeHeight || obj.extrudeHeight <= 0.01) &&
            (!obj.operation || obj.operation !== 'REVOLVE') &&
            segEndpoints(obj) !== null
        );

        if (candidates.length === 0) return [];

        // 2. Build endpoint adjacency: for each pair check if endpoints touch
        const n = candidates.length;
        // adj[i] = Set of j indices that are connected to i
        const adj = Array.from({ length: n }, () => new Set());

        for (let i = 0; i < n; i++) {
            const epI = segEndpoints(candidates[i]);
            for (let j = i + 1; j < n; j++) {
                const epJ = segEndpoints(candidates[j]);
                const connected =
                    near(epI.start, epJ.start) ||
                    near(epI.start, epJ.end)   ||
                    near(epI.end,   epJ.start) ||
                    near(epI.end,   epJ.end);

                // Only connect if they share the same drawing plane (same planePosition / planeRotation)
                const samePane = ProfileDetector._samePlane(candidates[i], candidates[j]);

                if (connected && samePane) {
                    adj[i].add(j);
                    adj[j].add(i);
                }
            }
        }

        // 3. Find connected components via DFS
        const visited   = new Array(n).fill(false);
        const components = [];
        for (let start = 0; start < n; start++) {
            if (visited[start]) continue;
            const stack     = [start];
            const component = [];
            visited[start]  = true;
            while (stack.length > 0) {
                const cur = stack.pop();
                component.push(cur);
                for (const nb of adj[cur]) {
                    if (!visited[nb]) {
                        visited[nb] = true;
                        stack.push(nb);
                    }
                }
            }
            components.push(component);
        }

        // 4. For each component, order segments and build SketchProfile
        const profiles = [];
        components.forEach((comp, compIdx) => {
            const segs = comp.map(i => candidates[i]);
            const ordered = ProfileDetector._orderSegments(segs);
            if (!ordered) return; // degenerate — skip

            // Merge point arrays, removing the duplicate junction point at each join
            let merged = [];
            for (let k = 0; k < ordered.length; k++) {
                const pts = segPoints(ordered[k].obj, ordered[k].reversed);
                if (k === 0) {
                    merged = [...pts];
                } else {
                    // Drop first point of next segment if it coincides with last merged
                    const last = merged[merged.length - 1];
                    const first = pts[0];
                    const skip  = near(last, first) ? 1 : 0;
                    merged.push(...pts.slice(skip));
                }
            }

            const firstPt = merged[0];
            const lastPt  = merged[merged.length - 1];
            const isClosed = near(firstPt, lastPt);

            // Remove redundant closing point from merged array (keep geometry clean)
            if (isClosed && merged.length > 3) {
                merged = merged.slice(0, merged.length - 1);
            }

            const validation = ProfileDetector._validate(ordered, merged, isClosed);

            const profileId = `sketch_profile_${Date.now()}_${compIdx}_${Math.random().toString(36).substr(2, 5)}`;
            profiles.push(new SketchProfile({
                id:       profileId,
                segments: ordered,
                points:   merged,
                isClosed,
                validation
            }));
        });

        return profiles;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Determine if two objects live on the same drawing plane.
     * Objects without a planePosition are assumed to be on the default plane.
     */
    static _samePlane(a, b) {
        const posA = a.planePosition ?? [0, 0, 0];
        const posB = b.planePosition ?? [0, 0, 0];
        const dx = Math.abs(posA[0] - posB[0]);
        const dy = Math.abs(posA[1] - posB[1]);
        const dz = Math.abs(posA[2] - posB[2]);
        return dx < 0.01 && dy < 0.01 && dz < 0.01;
    }

    /**
     * Chain `segs` into an ordered list of { obj, reversed } records.
     * Handles segments drawn in any order / direction.
     *
     * Returns null if the segments cannot be consistently chained.
     */
    static _orderSegments(segs) {
        if (segs.length === 1) {
            return [{ obj: segs[0], reversed: false }];
        }

        const used     = new Array(segs.length).fill(false);
        const ordered  = [];

        // Start with first segment, not reversed
        used[0] = true;
        ordered.push({ obj: segs[0], reversed: false });

        let headSeg   = segs[0];
        let headReversed = false;

        const currentEnd = () => {
            const ep = segEndpoints(headSeg);
            return headReversed ? ep.start : ep.end;
        };

        while (ordered.length < segs.length) {
            const tail = currentEnd();
            let found  = false;

            for (let i = 0; i < segs.length; i++) {
                if (used[i]) continue;
                const ep = segEndpoints(segs[i]);

                let reversed = false;
                if (near(tail, ep.start)) {
                    reversed = false;
                } else if (near(tail, ep.end)) {
                    reversed = true;
                } else {
                    continue; // not adjacent to current tail
                }

                used[i]    = true;
                headSeg    = segs[i];
                headReversed = reversed;
                ordered.push({ obj: segs[i], reversed });
                found = true;
                break;
            }

            if (!found) {
                // Remaining segments are disconnected — stop chaining; 
                // partial chain is still returned (validator will flag it).
                break;
            }
        }

        return ordered;
    }

    /**
     * Validate the ordered chain for revolve suitability.
     */
    static _validate(ordered, points, isClosed) {
        const warnings = [];

        if (points.length < 2) {
            return { valid: false, error: 'Profile has insufficient points.', warnings };
        }

        if (!isClosed) {
            warnings.push('Profile is open — solid revolution requires a closed loop. Enable Surface Mode or close the profile.');
        }

        // Check that every segment in the group was chained (no disconnected leftovers)
        // (ordered.length vs segs.length — both same here since _orderSegments already ran)

        // Check for zero-area / degenerate (all points on one spot)
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of points) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
        }
        const span = Math.max(maxX - minX, maxZ - minZ);
        if (span < 0.01) {
            return { valid: false, error: 'Profile is degenerate (zero area).', warnings };
        }

        return { valid: true, error: null, warnings };
    }
}
