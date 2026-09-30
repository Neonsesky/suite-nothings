/**
 * The 3D intro (lazy chunk; three.js). A toon-shaded hotel door with ink edge lines: the 619
 * key tag swings on its ring from the lever, a key card taps the reader, the light turns
 * green and the door opens inward into the app. Pure function of time, so it can be stepped.
 */
import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

export const INTRO_3D_MS = 2000;

/** The mark's "619" strokes (same geometry as KeyTagMark). */
const DIGITS =
  'M-3.1-5.2C-6.4-4.6-8.9-1.9-8.9 1.6M-5.9 5.5A3 3 0 1 0-5.9-0.5A3 3 0 1 0-5.9 5.5ZM0.7-3.6L3.4-5.5V5.5M11.9-5.5A3 3 0 1 0 11.9 0.5A3 3 0 1 0 11.9-5.5ZM14.9-2.5C14.9 1.4 12.8 4.4 9.2 5.4';

function token(name: string, fallback: string): THREE.Color {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeOut = (x: number) => 1 - (1 - x) ** 3;

export interface IntroHandle {
  /** Render the frame at `ms` into the timeline. */
  render(ms: number): void;
  resize(): void;
  dispose(): void;
}

export function createIntroScene(canvas: HTMLCanvasElement): IntroHandle {
  const ink = token('--color-ink', '#292935');
  const paper = token('--color-paper', '#ffffff');
  const cream = token('--color-cream', '#fff8e9');
  const honey = token('--color-honey', '#ffc536');
  const honeySoft = token('--color-honey-soft', '#ffeab0');
  const ginger = token('--color-ginger', '#fc5e57');
  const green = token('--color-success', '#17784f').lerp(new THREE.Color('#3ddc84'), 0.7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(cream);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);

  const grad = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;
  const toon = (color: THREE.Color, map?: THREE.Texture) => new THREE.MeshToonMaterial({ color, gradientMap: grad, map: map ?? null });
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-3, 4, 6);
  scene.add(sun);

  const lineMats: LineMaterial[] = [];
  const outline = (geo: THREE.BufferGeometry, width = 2.6, angle = 30) => {
    const g = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, angle));
    const m = new LineMaterial({ color: ink.getHex(), linewidth: width, worldUnits: false });
    lineMats.push(m);
    return new LineSegments2(g, m);
  };
  const solid = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], width?: number) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, mat), outline(geo, width));
    return grp;
  };

  // Wall and the lit room behind the door.
  const room = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.3), new THREE.MeshBasicMaterial({ color: honeySoft }));
  room.position.set(0, 0, -0.2);
  scene.add(room);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), toon(cream));
  wall.position.z = -0.25;
  scene.add(wall);
  const frameMat = toon(paper);
  for (const [w, h, x, y] of [
    [0.22, 4.7, -1.29, 0.1],
    [0.22, 4.7, 1.29, 0.1],
    [2.8, 0.22, 0, 2.34],
  ] as const) {
    const f = solid(new THREE.BoxGeometry(w, h, 0.18), frameMat);
    f.position.set(x, y, -0.12);
    scene.add(f);
  }

  // The door, hinged on its left edge.
  const hinge = new THREE.Group();
  hinge.position.set(-1.15, 0, 0);
  scene.add(hinge);
  const door = solid(new THREE.BoxGeometry(2.3, 4.3, 0.1), toon(paper));
  door.position.set(1.15, 0, -0.1);
  hinge.add(door);
  for (const [h, y] of [
    [1.7, 1.05],
    [1.5, -1.15],
  ] as const) {
    const panel = outline(new THREE.PlaneGeometry(1.7, h), 1.6);
    panel.position.set(1.15, y, -0.045);
    hinge.add(panel);
  }
  const numPlate = solid(new THREE.BoxGeometry(0.62, 0.3, 0.03), toon(honey));
  numPlate.position.set(1.15, 1.75, -0.03);
  hinge.add(numPlate);
  numPlate.add(digitsMesh(0.44, ink, 0.02));

  // Card reader with its light, and the lever below it.
  const reader = solid(new THREE.BoxGeometry(0.36, 0.78, 0.07), toon(ink.clone().lerp(paper, 0.12)));
  reader.position.set(1.85, 0.3, -0.01);
  hinge.add(reader);
  const ledMat = new THREE.MeshBasicMaterial({ color: ginger });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), ledMat);
  led.position.set(1.85, 0.56, 0.03);
  hinge.add(led);
  const glowMat = new THREE.MeshBasicMaterial({ color: green, transparent: true, opacity: 0, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), glowMat);
  glow.position.set(1.85, 0.56, 0.025);
  hinge.add(glow);
  const slot = outline(new THREE.PlaneGeometry(0.2, 0.34), 1.6);
  slot.position.set(1.85, 0.2, 0.03);
  hinge.add(slot);
  const rose = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 28).rotateX(Math.PI / 2), toon(ink.clone().lerp(paper, 0.25)));
  rose.position.set(1.85, -0.35, 0);
  hinge.add(rose);
  const lever = solid(new THREE.BoxGeometry(0.62, 0.09, 0.09), toon(ink.clone().lerp(paper, 0.25)));
  lever.position.set(1.6, -0.35, 0.1);
  hinge.add(lever);

  // The key tag: a honey fob on a ring, hung from the end of the lever.
  const tagPivot = new THREE.Group();
  tagPivot.position.set(1.34, -0.35, 0.16);
  hinge.add(tagPivot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 12, 40), toon(ink.clone().lerp(paper, 0.35)));
  const ringHull = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 12, 40), new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide }));
  ring.rotation.y = ringHull.rotation.y = Math.PI / 2.4;
  ring.position.y = ringHull.position.y = -0.06;
  tagPivot.add(ring, ringHull);
  const fob = new THREE.Shape();
  fob.moveTo(0, -0.02);
  fob.bezierCurveTo(0.2, -0.02, 0.34, -0.4, 0.34, -0.72);
  fob.bezierCurveTo(0.34, -1.02, 0.2, -1.2, 0, -1.2);
  fob.bezierCurveTo(-0.2, -1.2, -0.34, -1.02, -0.34, -0.72);
  fob.bezierCurveTo(-0.34, -0.4, -0.2, -0.02, 0, -0.02);
  const hole = new THREE.Path();
  hole.absarc(0, -0.16, 0.05, 0, Math.PI * 2, true);
  fob.holes.push(hole);
  const fobGeo = new THREE.ExtrudeGeometry(fob, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 28 });
  const fobGroup = solid(fobGeo, toon(honey), 2.4);
  fobGroup.position.set(0, -0.12, -0.035);
  tagPivot.add(fobGroup);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.22, 40).scale(1, 1.2, 1), toon(paper));
  inner.position.set(0, -0.86, 0.058);
  const innerLine = outline(new THREE.CircleGeometry(0.22, 40).scale(1, 1.2, 1), 1.8, 1);
  innerLine.position.copy(inner.position);
  fobGroup.add(inner, innerLine);
  const d = digitsMesh(0.34, ink, 0.03);
  d.position.set(0, -0.86, 0.062);
  fobGroup.add(d);

  // The key card, flying in from the right.
  const card = solid(new THREE.BoxGeometry(0.54, 0.86, 0.025), toon(honey), 2.2);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.12), new THREE.MeshBasicMaterial({ color: ink }));
  stripe.position.set(0, 0.25, 0.014);
  card.add(stripe);
  scene.add(card);

  function digitsMesh(width: number, color: THREE.Color, _z: number) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.translate(128, 64);
    ctx.scale(9.2, 9.2);
    ctx.translate(-3, 0);
    ctx.strokeStyle = `#${color.getHexString()}`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(DIGITS));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.z = 0.018;
    void _z;
    return m;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lineMats.forEach((m) => m.resolution.set(w, h));
  }

  function render(ms: number) {
    const t = ms / 1000;
    // 1. The tag swings in on its ring and settles (damped pendulum).
    const swing = Math.exp(-3.1 * t) * Math.cos(7.2 * t);
    tagPivot.rotation.z = 1.25 * swing;
    tagPivot.rotation.y = 0.35 * Math.exp(-2.5 * t) * Math.sin(5 * t);
    // 2. The card flies in, taps the reader and backs off.
    const inT = easeOut(seg(t, 0.35, 0.8));
    const outT = easeInOut(seg(t, 0.95, 1.3));
    const tap = Math.sin(Math.PI * seg(t, 0.78, 0.92));
    const readerX = hinge.position.x + 1.85;
    card.position.set(THREE.MathUtils.lerp(readerX + 2.6, readerX, inT) + outT * 2.6, 0.25 + (1 - inT) * 0.5, 0.35 - tap * 0.22 + outT * 0.4);
    card.rotation.set(-0.15 * (1 - inT), -0.5 * (1 - inT) + outT * 0.6, 0.35 * (1 - inT));
    // Light: red, then green on the tap.
    const on = t >= 0.86;
    ledMat.color.copy(on ? green : ginger);
    glowMat.opacity = on ? 0.55 * (1 - seg(t, 1.2, 1.6)) + 0.25 : 0;
    // 3. The door opens inward and the camera steps through.
    const open = easeInOut(seg(t, 1.0, 1.85));
    hinge.rotation.y = 1.75 * open;
    const push = easeInOut(seg(t, 1.05, 2.0));
    const portrait = camera.aspect < 1;
    const dist = portrait ? 4.1 / Math.max(camera.aspect, 0.45) / 1.9 + 1.6 : 4.6;
    camera.position.set(THREE.MathUtils.lerp(0.45, 0, push), THREE.MathUtils.lerp(0.05, 0.1, push), THREE.MathUtils.lerp(dist, 0.9, push));
    camera.lookAt(THREE.MathUtils.lerp(0.5, 0, push), THREE.MathUtils.lerp(-0.05, 0.1, push), -0.2);
    renderer.render(scene, camera);
  }

  resize();
  return {
    render,
    resize,
    dispose() {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.MeshBasicMaterial).map?.dispose();
          x.dispose();
        });
      });
      grad.dispose();
      renderer.dispose();
    },
  };
}
