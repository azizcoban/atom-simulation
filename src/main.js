import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./styles.css";

const viewport = document.querySelector("#viewport");
const atomCountEl = document.querySelector("#atom-count");
const bondCountEl = document.querySelector("#bond-count");
const structureNameEl = document.querySelector("#structure-name");
const bondsToggle = document.querySelector("#bonds-toggle");
const rotateToggle = document.querySelector("#rotate-toggle");
const fileInput = document.querySelector("#file-input");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a0f);
scene.fog = new THREE.FogExp2(0x070a0f, 0.012);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(20, 18, 32);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;

scene.add(new THREE.HemisphereLight(0xb8d5ff, 0x090b0f, 1.9));

const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
keyLight.position.set(14, 20, 10);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8f7cff, 2.2);
rimLight.position.set(-18, 8, -14);
scene.add(rimLight);

const structureGroup = new THREE.Group();
const bondsGroup = new THREE.Group();
scene.add(structureGroup);
scene.add(bondsGroup);

const elementStyles = {
  C: {
    color: 0x626d7a,
    radius: 0.46,
    covalentRadius: 0.76,
    metalness: 0.18,
    roughness: 0.28,
  },
  Bi: {
    color: 0xa97af2,
    radius: 0.78,
    covalentRadius: 1.48,
    metalness: 0.42,
    roughness: 0.22,
  },
};

const fallbackStyle = {
  color: 0x69c5ff,
  radius: 0.55,
  covalentRadius: 0.9,
  metalness: 0.15,
  roughness: 0.32,
};

let currentAtoms = [];
let currentStructureName = "—";
let currentBondCount = 0;

function parseXYZ(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error("XYZ file is too short.");
  }

  const declaredCount = Number(lines[0]);
  const structureName = lines[1] || "XYZ structure";
  const atoms = [];

  for (const line of lines.slice(2)) {
    const [element, x, y, z] = line.split(/\s+/);
    const position = [Number(x), Number(y), Number(z)];

    if (!element || position.some((value) => Number.isNaN(value))) {
      continue;
    }

    atoms.push({ element, position: new THREE.Vector3(...position) });
  }

  if (Number.isFinite(declaredCount) && declaredCount !== atoms.length) {
    console.warn(
      `XYZ declared ${declaredCount} atoms but parsed ${atoms.length}. Rendering parsed atoms.`
    );
  }

  return { atoms, structureName };
}

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  }
}

function getElementStyle(element) {
  return elementStyles[element] ?? fallbackStyle;
}

function renderAtoms(atoms) {
  clearGroup(structureGroup);

  for (const atom of atoms) {
    const style = getElementStyle(atom.element);
    const geometry = new THREE.SphereGeometry(style.radius, 36, 24);
    const material = new THREE.MeshPhysicalMaterial({
      color: style.color,
      metalness: style.metalness,
      roughness: style.roughness,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(atom.position);
    sphere.userData = { element: atom.element };
    structureGroup.add(sphere);
  }
}

function createBond(start, end) {
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  const geometry = new THREE.CylinderGeometry(0.07, 0.07, length, 10);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8793a3,
    transparent: true,
    opacity: 0.48,
    metalness: 0.12,
    roughness: 0.5,
  });

  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return cylinder;
}

function renderBonds(atoms) {
  clearGroup(bondsGroup);
  currentBondCount = 0;

  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      const a = atoms[i];
      const b = atoms[j];
      const styleA = getElementStyle(a.element);
      const styleB = getElementStyle(b.element);
      const cutoff = (styleA.covalentRadius + styleB.covalentRadius) * 1.22;
      const distance = a.position.distanceTo(b.position);

      if (distance > 0.15 && distance <= cutoff) {
        bondsGroup.add(createBond(a.position, b.position));
        currentBondCount += 1;
      }
    }
  }

  bondsGroup.visible = bondsToggle.checked;
  bondCountEl.textContent = currentBondCount.toLocaleString();
}

function centerStructure(atoms) {
  if (!atoms.length) return;

  const box = new THREE.Box3();
  atoms.forEach((atom) => box.expandByPoint(atom.position));

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  structureGroup.position.copy(center).multiplyScalar(-1);
  bondsGroup.position.copy(center).multiplyScalar(-1);

  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDimension * 2.15;

  camera.position.set(distance * 0.75, distance * 0.6, distance);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 25;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.update();
}

function updateStats() {
  atomCountEl.textContent = currentAtoms.length.toLocaleString();
  bondCountEl.textContent = currentBondCount.toLocaleString();
  structureNameEl.textContent = currentStructureName;
}

function loadStructure(text) {
  const { atoms, structureName } = parseXYZ(text);

  currentAtoms = atoms;
  currentStructureName = structureName;

  renderAtoms(atoms);
  renderBonds(atoms);
  centerStructure(atoms);
  updateStats();
}

async function loadDefaultStructure() {
  const response = await fetch("./points.xyz");
  if (!response.ok) {
    throw new Error("Could not load points.xyz");
  }

  loadStructure(await response.text());
}

bondsToggle.addEventListener("change", () => {
  bondsGroup.visible = bondsToggle.checked;
});

rotateToggle.addEventListener("change", () => {
  controls.autoRotate = rotateToggle.checked;
});

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) return;

  try {
    loadStructure(await file.text());
  } catch (error) {
    console.error(error);
    window.alert("Could not parse this XYZ file.");
  }
});

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(viewport);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadDefaultStructure().catch((error) => {
  console.error(error);
  structureNameEl.textContent = "Load an .xyz file";
});

resize();
animate();
