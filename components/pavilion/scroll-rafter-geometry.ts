import * as THREE from 'three';

const IN = .0254;
/** Cut a scroll from the rafter stock, preserving its roof line, plumb end,
 * thickness and birdsmouth. The cut is sized from the section, never span. */
export function createFittedScrollRafter({iy, outerX, pitchAngle, t, depth, side, seatX, seatY = 0}: {
  iy: number; outerX: number; pitchAngle: number; t: number; depth: number;
  side: 1 | -1; seatX?: number; seatY?: number;
}) {
  const slope = Math.tan(pitchAngle), height = t / Math.cos(pitchAngle);
  const top = iy + height / 2, bottom = iy - height / 2;
  const endTop = top - slope * outerX;
  const run = Math.min(t * .8, seatX == null ? outerX / 4 : (outerX - seatX) * .8);
  const heelX = outerX - run, heelY = bottom - slope * heelX;
  const lipX = outerX - run * .18, lipY = endTop - height * .32;
  const k = .5522847498;
  const shape = new THREE.Shape();
  shape.moveTo(0, top);
  shape.lineTo(outerX, endTop);
  shape.lineTo(outerX, endTop - height * .21);
  shape.lineTo(lipX, endTop - height * .21);
  shape.lineTo(lipX, lipY);
  shape.bezierCurveTo(lipX - (lipX - heelX) * k, lipY,
    heelX, heelY + (lipY - heelY) * k, heelX, heelY);
  const notchY = seatY + .75 * IN;
  if (seatX != null && seatX < heelX) {
    const seatBottom = bottom - slope * seatX;
    const seatInner = (bottom - notchY) / slope;
    if (seatBottom < notchY && seatInner > 0 && seatInner < seatX) {
      shape.lineTo(seatX, seatBottom);
      shape.lineTo(seatX, notchY);
      shape.lineTo(seatInner, notchY);
    }
  }
  shape.lineTo(0, bottom);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 32});
  geometry.translate(0, 0, -depth / 2);
  // A proper rotation mirrors the profile without reversing face winding.
  if (side === -1) geometry.rotateY(Math.PI);
  geometry.computeBoundingBox();
  return geometry;
}
