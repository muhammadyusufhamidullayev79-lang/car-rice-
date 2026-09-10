import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCarMesh } from '../game/Engine';
import { CarSpec } from '../game/data';

interface CarShowcaseProps {
  car: CarSpec;
  className?: string;
}

/**
 * Small self-contained 3D turntable that shows the given car model
 * slowly rotating on a neon-lit platform (used in menu & garage).
 */
export const CarShowcase: React.FC<CarShowcaseProps> = ({ car, className }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const spinnerRef = useRef<THREE.Group | null>(null);
  const carRef = useRef<THREE.Group | null>(null);

  // One-time scene setup
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(5.4, 2.7, 6.4);
    camera.lookAt(0, 0.55, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lights: bright key, soft fill, red rim for that underground glow
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(4, 7, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const rim = new THREE.DirectionalLight(0xff4a4a, 1.4);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    // Platform disc + neon ring
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(2.95, 2.95, 0.1, 48),
      new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.35, metalness: 0.7 })
    );
    disc.position.y = -0.05;
    disc.receiveShadow = true;
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.02, 0.035, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 1.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    const spinner = new THREE.Group();
    spinnerRef.current = spinner;
    scene.add(spinner);

    const resize = () => {
      const w = host.clientWidth || 300;
      const h = host.clientHeight || 300;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      spinner.rotation.y += dt * 0.5;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      sceneRef.current = null;
      spinnerRef.current = null;
      carRef.current = null;
    };
  }, []);

  // Swap the car model whenever the selection changes
  useEffect(() => {
    const spinner = spinnerRef.current;
    if (!spinner) return;
    if (carRef.current) {
      spinner.remove(carRef.current);
      carRef.current = null;
    }
    const mesh = buildCarMesh(car, false);
    carRef.current = mesh;
    spinner.add(mesh);
  }, [car]);

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%' }} />;
};

export default CarShowcase;
