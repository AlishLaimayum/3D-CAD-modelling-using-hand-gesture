/**
 * DimensionInspector.jsx - Precision Manual Length & Dimension Editor in Centimeters (cm)
 *
 * Appears when any CAD object (Line, Rectangle, Circle, Freehand, or 3D Extruded Solid)
 * is selected. Allows manual numeric input, precision steppers, and real-time updating
 * of lengths, widths, radii, and heights in centimeters (cm).
 */

import { useState, useEffect, useMemo } from 'react';
import { useCadStore } from '../store/useCadStore';
import { getDimensionsInCm } from '../utils/dimensionUtils';
import { 
    Ruler, 
    Maximize2, 
    Box, 
    X, 
    Plus, 
    Minus, 
    Check, 
    Layers, 
    RotateCcw,
    RotateCw
} from 'lucide-react';

const PANEL_BG = 'rgba(10, 13, 24, 0.94)';
const BORDER_COL = 'rgba(0, 240, 255, 0.28)';
const ACCENT = '#00f0ff';
const GREEN = '#00ff66';
const ORANGE = '#ffaa00';

export function DimensionInspector() {
    const selectedObjectId = useCadStore((s) => s.selectedObjectId);
    const cadObjects = useCadStore((s) => s.cadObjects);
    const deselectObject = useCadStore((s) => s.deselectObject);
    const updateObjectDimensions = useCadStore((s) => s.updateObjectDimensions);
    const updateCADObject = useCadStore((s) => s.updateCADObject);
    const rotateCADObject = useCadStore((s) => s.rotateCADObject);
    const extrudeObject = useCadStore((s) => s.extrudeObject);
    const defaultExtrudeHeight = useCadStore((s) => s.defaultExtrudeHeight);

    const obj = useMemo(
        () => cadObjects.find((o) => o.id === selectedObjectId),
        [cadObjects, selectedObjectId]
    );

    const dims = useMemo(() => getDimensionsInCm(obj), [obj]);

    // Local form states so typing doesn't jitter
    const [lineLengthInput, setLineLengthInput] = useState('');
    const [rectWidthInput, setRectWidthInput] = useState('');
    const [rectLengthInput, setRectLengthInput] = useState('');
    const [circleRadiusInput, setCircleRadiusInput] = useState('');
    const [circleDiameterInput, setCircleDiameterInput] = useState('');
    const [freehandLengthInput, setFreehandLengthInput] = useState('');
    const [extrudeHeightInput, setExtrudeHeightInput] = useState('');
    const [revolveAngleInput, setRevolveAngleInput] = useState('360');

    // Synchronize local input state whenever selected object or dimensions change
    useEffect(() => {
        if (!dims) return;

        if (dims.lengthCm !== undefined) {
            setLineLengthInput(dims.lengthCm.toFixed(2));
            setFreehandLengthInput(dims.lengthCm.toFixed(2));
        }
        if (dims.widthCm !== undefined) {
            setRectWidthInput(dims.widthCm.toFixed(2));
        }
        if (dims.lengthCm !== undefined && dims.type === 'RECTANGLE') {
            setRectLengthInput(dims.lengthCm.toFixed(2));
        }
        if (dims.radiusCm !== undefined) {
            setCircleRadiusInput(dims.radiusCm.toFixed(2));
            setCircleDiameterInput((dims.radiusCm * 2).toFixed(2));
        }
        if (dims.extrudeHeightCm !== undefined) {
            setExtrudeHeightInput(dims.extrudeHeightCm > 0 ? dims.extrudeHeightCm.toFixed(2) : defaultExtrudeHeight.toFixed(2));
        }
        if (dims.revolveAngleDeg !== undefined) {
            setRevolveAngleInput(String(dims.revolveAngleDeg));
        }
    }, [dims, defaultExtrudeHeight]);

    if (!obj || !dims) return null;

    const commitRevolveAngle = (newAngle) => {
        const val = Math.max(1, Math.min(360, Number(newAngle) || 360));
        updateCADObject(obj.id, {
            revolveData: {
                ...obj.revolveData,
                angleDeg: val
            }
        });
        setRevolveAngleInput(String(val));
    };

    // Handlers for committing changes
    const commitLineLength = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.01) {
            updateObjectDimensions(obj.id, { lengthCm: val });
            setLineLengthInput(val.toFixed(2));
        }
    };

    const commitRectWidth = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.05) {
            updateObjectDimensions(obj.id, { widthCm: val });
            setRectWidthInput(val.toFixed(2));
        }
    };

    const commitRectLength = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.05) {
            updateObjectDimensions(obj.id, { lengthCm: val });
            setRectLengthInput(val.toFixed(2));
        }
    };

    const commitCircleRadius = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.02) {
            updateObjectDimensions(obj.id, { radiusCm: val });
            setCircleRadiusInput(val.toFixed(2));
            setCircleDiameterInput((val * 2).toFixed(2));
        }
    };

    const commitCircleDiameter = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.04) {
            updateObjectDimensions(obj.id, { radiusCm: val / 2 });
            setCircleRadiusInput((val / 2).toFixed(2));
            setCircleDiameterInput(val.toFixed(2));
        }
    };

    const commitFreehandLength = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val > 0.05) {
            updateObjectDimensions(obj.id, { lengthCm: val });
            setFreehandLengthInput(val.toFixed(2));
        }
    };

    const commitExtrudeHeight = (newVal) => {
        const val = parseFloat(newVal);
        if (!isNaN(val) && val >= 0) {
            updateObjectDimensions(obj.id, { extrudeHeight: val });
            setExtrudeHeightInput(val.toFixed(2));
        }
    };

    return (
        <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '270px',
            background: PANEL_BG,
            border: `1px solid ${BORDER_COL}`,
            borderRadius: '14px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
            zIndex: 40,
            overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#e0e8ff',
            pointerEvents: 'auto',
            animation: 'fadeIn 0.15s ease-out'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid rgba(0, 240, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 240, 255, 0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ruler size={16} color={ACCENT} />
                    <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '1px',
                        color: ACCENT,
                        textTransform: 'uppercase'
                    }}>
                        Length / Dimensions
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        fontSize: '9px',
                        padding: '2px 6px',
                        background: 'rgba(0, 240, 255, 0.15)',
                        border: '1px solid rgba(0, 240, 255, 0.35)',
                        borderRadius: '4px',
                        color: ACCENT,
                        fontWeight: '700'
                    }}>
                        CM
                    </span>
                    <button
                        onClick={deselectObject}
                        title="Deselect (Esc)"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#88a',
                            cursor: 'pointer',
                            display: 'flex',
                            padding: '2px'
                        }}
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* Object Type Pill */}
            <div style={{
                padding: '8px 14px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#8da2c0'
            }}>
                <span>Element:</span>
                <span style={{
                    color: dims.isExtruded ? GREEN : ORANGE,
                    fontWeight: '700',
                    fontFamily: 'monospace'
                }}>
                    {dims.isExtruded ? `3D SOLID (${dims.type})` : `2D ${dims.type}`}
                </span>
            </div>

            {/* Content Body */}
            <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* ----------------- LINE CONTROLS ----------------- */}
                {dims.type === 'LINE' && (
                    <DimensionRow
                        label="Length"
                        unit="cm"
                        value={lineLengthInput}
                        onChange={setLineLengthInput}
                        onCommit={commitLineLength}
                        onStep={(delta) => commitLineLength(Math.max(0.1, (parseFloat(lineLengthInput) || 0) + delta))}
                    />
                )}

                {/* ----------------- RECTANGLE CONTROLS ----------------- */}
                {dims.type === 'RECTANGLE' && (
                    <>
                        <DimensionRow
                            label="Width"
                            unit="cm"
                            value={rectWidthInput}
                            onChange={setRectWidthInput}
                            onCommit={commitRectWidth}
                            onStep={(delta) => commitRectWidth(Math.max(0.1, (parseFloat(rectWidthInput) || 0) + delta))}
                        />
                        <DimensionRow
                            label="Length / Depth"
                            unit="cm"
                            value={rectLengthInput}
                            onChange={setRectLengthInput}
                            onCommit={commitRectLength}
                            onStep={(delta) => commitRectLength(Math.max(0.1, (parseFloat(rectLengthInput) || 0) + delta))}
                        />
                        {dims.areaCm2 !== undefined && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                                color: '#7e95b0',
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '6px'
                            }}>
                                <span>Planar Area:</span>
                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{dims.areaCm2.toFixed(2)} cm²</span>
                            </div>
                        )}
                    </>
                )}

                {/* ----------------- CIRCLE CONTROLS ----------------- */}
                {dims.type === 'CIRCLE' && (
                    <>
                        <DimensionRow
                            label="Radius"
                            unit="cm"
                            value={circleRadiusInput}
                            onChange={(val) => {
                                setCircleRadiusInput(val);
                                const num = parseFloat(val);
                                if (!isNaN(num)) setCircleDiameterInput((num * 2).toFixed(2));
                            }}
                            onCommit={commitCircleRadius}
                            onStep={(delta) => commitCircleRadius(Math.max(0.1, (parseFloat(circleRadiusInput) || 0) + delta))}
                        />
                        <DimensionRow
                            label="Diameter (Ø)"
                            unit="cm"
                            value={circleDiameterInput}
                            onChange={(val) => {
                                setCircleDiameterInput(val);
                                const num = parseFloat(val);
                                if (!isNaN(num)) setCircleRadiusInput((num / 2).toFixed(2));
                            }}
                            onCommit={commitCircleDiameter}
                            onStep={(delta) => commitCircleDiameter(Math.max(0.1, (parseFloat(circleDiameterInput) || 0) + delta))}
                        />
                        {dims.areaCm2 !== undefined && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                                color: '#7e95b0',
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '6px'
                            }}>
                                <span>Area / Circum:</span>
                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                                    {dims.areaCm2.toFixed(1)} cm² · {dims.circumferenceCm.toFixed(1)} cm
                                </span>
                            </div>
                        )}
                    </>
                )}

                {/* ----------------- FREEHAND CONTROLS ----------------- */}
                {dims.type !== 'LINE' && dims.type !== 'RECTANGLE' && dims.type !== 'CIRCLE' && (
                    <>
                        <DimensionRow
                            label={dims.type === 'CURVE' ? "Curve Arc Length" : "Perimeter / Path"}
                            unit="cm"
                            value={freehandLengthInput}
                            onChange={setFreehandLengthInput}
                            onCommit={commitFreehandLength}
                            onStep={(delta) => commitFreehandLength(Math.max(0.1, (parseFloat(freehandLengthInput) || 0) + delta))}
                        />
                        {dims.bboxWidthCm !== undefined && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                                color: '#7e95b0',
                                padding: '4px 8px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '6px'
                            }}>
                                <span>Bounding Box:</span>
                                <span style={{ color: '#00ffff', fontWeight: 'bold' }}>
                                    {dims.bboxWidthCm.toFixed(1)} × {dims.bboxHeightCm.toFixed(1)} cm
                                </span>
                            </div>
                        )}
                    </>
                )}

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(0, 240, 255, 0.12)', margin: '2px 0' }} />

                {/* ----------------- 3D SOLID / REVOLVE OR EXTRUSION HEIGHT ----------------- */}
                {dims.isRevolved ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: ACCENT, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RotateCw size={13} color={ACCENT} />
                                Revolve (Lathe) Feature
                            </span>
                            <span style={{
                                fontSize: '9px',
                                padding: '2px 5px',
                                background: dims.isWatertight ? 'rgba(0,255,102,0.1)' : 'rgba(255,200,0,0.1)',
                                border: `1px solid ${dims.isWatertight ? 'rgba(0,255,102,0.3)' : 'rgba(255,200,0,0.3)'}`,
                                borderRadius: '4px',
                                color: dims.isWatertight ? GREEN : ORANGE
                            }}>
                                {dims.isWatertight ? 'WATERTIGHT SOLID' : 'SURFACE MESH'}
                            </span>
                        </div>

                        <DimensionRow
                            label="Revolution Angle"
                            unit="°"
                            value={revolveAngleInput}
                            onChange={setRevolveAngleInput}
                            onCommit={commitRevolveAngle}
                            onStep={(delta) => commitRevolveAngle(Math.max(1, Math.min(360, (parseFloat(revolveAngleInput) || 360) + delta * 10)))}
                            highlightColor={ACCENT}
                        />

                        {dims.solidDimensions && (
                            <div style={{
                                fontSize: '10px',
                                color: '#7e95b0',
                                padding: '6px 8px',
                                background: 'rgba(0, 240, 255, 0.05)',
                                border: '1px solid rgba(0, 240, 255, 0.15)',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                            }}>
                                <div><strong>3D Size:</strong> X:{dims.solidDimensions.x.toFixed(1)}cm · Y:{dims.solidDimensions.y.toFixed(1)}cm · Z:{dims.solidDimensions.z.toFixed(1)}cm</div>
                                {dims.volumeCm3 !== undefined && (
                                    <div><strong>Volume:</strong> {dims.volumeCm3.toFixed(1)} cm³</div>
                                )}
                                {dims.surfaceAreaCm2 !== undefined && (
                                    <div><strong>Surface Area:</strong> {dims.surfaceAreaCm2.toFixed(1)} cm²</div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: dims.isExtruded ? GREEN : '#a0b0cb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Box size={13} color={dims.isExtruded ? GREEN : '#a0b0cb'} />
                                Extrusion Height
                            </span>
                            {dims.isExtruded && (
                                <button
                                    onClick={() => commitExtrudeHeight(0)}
                                    title="Flatten solid back to 2D sketch"
                                    style={{
                                        fontSize: '9px',
                                        padding: '2px 5px',
                                        background: 'rgba(255,100,100,0.1)',
                                        border: '1px solid rgba(255,100,100,0.25)',
                                        borderRadius: '4px',
                                        color: '#ff8888',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Flatten (2D)
                                </button>
                            )}
                        </div>

                        <DimensionRow
                            label="Height (Z / Normal)"
                            unit="cm"
                            value={extrudeHeightInput}
                            onChange={setExtrudeHeightInput}
                            onCommit={commitExtrudeHeight}
                            onStep={(delta) => commitExtrudeHeight(Math.max(0, (parseFloat(extrudeHeightInput) || 0) + delta))}
                            highlightColor={GREEN}
                        />

                        {!dims.isExtruded && (
                            <button
                                onClick={() => extrudeObject(obj.id, parseFloat(extrudeHeightInput) || defaultExtrudeHeight)}
                                style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    background: 'linear-gradient(135deg, rgba(0, 255, 102, 0.18), rgba(0, 240, 255, 0.15))',
                                    border: '1px solid rgba(0, 255, 102, 0.45)',
                                    borderRadius: '8px',
                                    color: '#00ff88',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Box size={14} />
                                Extrude to {parseFloat(extrudeHeightInput) || defaultExtrudeHeight} cm
                            </button>
                        )}

                        {dims.isExtruded && dims.solidDimensions && (
                            <div style={{
                                fontSize: '10px',
                                color: '#7e95b0',
                                padding: '6px 8px',
                                background: 'rgba(0, 255, 102, 0.05)',
                                border: '1px solid rgba(0, 255, 102, 0.15)',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                            }}>
                                <div><strong>3D Size:</strong> X:{dims.solidDimensions.x.toFixed(1)}cm · Y:{dims.solidDimensions.y.toFixed(1)}cm · Z:{dims.solidDimensions.z.toFixed(1)}cm</div>
                                {dims.volumeCm3 !== undefined && (
                                    <div><strong>Volume:</strong> {dims.volumeCm3.toFixed(1)} cm³</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(0, 240, 255, 0.12)', margin: '2px 0' }} />

                {/* ----------------- DELIBERATE MODEL ROTATION (CENTER PIVOT) ----------------- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: ACCENT, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RotateCw size={13} color={ACCENT} />
                            Rotate Object (Center Pivot)
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        <button
                            onClick={() => rotateCADObject(obj.id, [Math.PI / 2, 0, 0])}
                            title="Rotate +90° around X axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +90° X
                        </button>
                        <button
                            onClick={() => rotateCADObject(obj.id, [0, Math.PI / 2, 0])}
                            title="Rotate +90° around Y axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +90° Y
                        </button>
                        <button
                            onClick={() => rotateCADObject(obj.id, [0, 0, Math.PI / 2])}
                            title="Rotate +90° around Z axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +90° Z
                        </button>
                        <button
                            onClick={() => rotateCADObject(obj.id, [Math.PI / 12, 0, 0])}
                            title="Rotate +15° around X axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +15° X
                        </button>
                        <button
                            onClick={() => rotateCADObject(obj.id, [0, Math.PI / 12, 0])}
                            title="Rotate +15° around Y axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +15° Y
                        </button>
                        <button
                            onClick={() => rotateCADObject(obj.id, [0, 0, Math.PI / 12])}
                            title="Rotate +15° around Z axis (Center invariant)"
                            style={rotBtnStyle}
                        >
                            +15° Z
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

/**
 * Reusable single dimension row with numeric input and quick step buttons
 */
function DimensionRow({
    label,
    unit = 'cm',
    value,
    onChange,
    onCommit,
    onStep,
    highlightColor = ACCENT
}) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
            onCommit?.(value);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8da2c0' }}>
                <span>{label}</span>
                <span style={{ color: highlightColor, fontWeight: '600' }}>{unit}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => onCommit?.(value)}
                    onKeyDown={handleKeyDown}
                    style={{
                        flex: 1,
                        background: 'rgba(15, 20, 35, 0.9)',
                        border: '1px solid rgba(0, 240, 255, 0.22)',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        outline: 'none',
                        width: '100%'
                    }}
                />

                {/* Quick step decrement/increment buttons */}
                <button
                    onClick={() => onStep?.(-1)}
                    title="Subtract 1 cm"
                    style={stepBtnStyle}
                >
                    -1
                </button>
                <button
                    onClick={() => onStep?.(-0.1)}
                    title="Subtract 0.1 cm"
                    style={stepBtnStyle}
                >
                    -.1
                </button>
                <button
                    onClick={() => onStep?.(+0.1)}
                    title="Add 0.1 cm"
                    style={stepBtnStyle}
                >
                    +.1
                </button>
                <button
                    onClick={() => onStep?.(+1)}
                    title="Add 1 cm"
                    style={stepBtnStyle}
                >
                    +1
                </button>
            </div>
        </div>
    );
}

const stepBtnStyle = {
    background: 'rgba(0, 240, 255, 0.08)',
    border: '1px solid rgba(0, 240, 255, 0.2)',
    borderRadius: '4px',
    color: '#00f0ff',
    padding: '4px 5px',
    fontSize: '9px',
    fontWeight: '700',
    fontFamily: 'monospace',
    cursor: 'pointer',
    flexShrink: 0
};

const rotBtnStyle = {
    background: 'rgba(0, 240, 255, 0.08)',
    border: '1px solid rgba(0, 240, 255, 0.25)',
    borderRadius: '6px',
    color: '#00f0ff',
    padding: '6px 4px',
    fontSize: '10px',
    fontWeight: '700',
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease'
};
