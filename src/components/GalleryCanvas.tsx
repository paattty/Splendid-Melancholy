import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EXHIBITS } from '../data/exhibits';
import { ExhibitItem, NavigationMode } from '../types/gallery';

interface GalleryCanvasProps {
  selectedExhibit: ExhibitItem | null;
  onSelectExhibit: (exhibit: ExhibitItem | null) => void;
  navigationMode: NavigationMode;
  onNavigationModeChange: (mode: NavigationMode) => void;
  hoveredExhibit: ExhibitItem | null;
  onHoverExhibit: (exhibit: ExhibitItem | null) => void;
  resetCameraTrigger?: number;
  onOpenCounter?: () => void;
}

interface PedestalNode {
  exhibit: ExhibitItem;
  group: THREE.Group;
  collider: THREE.Mesh;
  haloMesh: THREE.Mesh;
  eyewearGroup: THREE.Group;
  keySpotlight: THREE.SpotLight;
  rimSpotlight: THREE.SpotLight;
  baseMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.MeshStandardMaterial;
  currentHoverProgress: number; // 0 to 1 smooth lerp
  currentSelectProgress: number; // 0 to 1 smooth lerp
}

export const GalleryCanvas: React.FC<GalleryCanvasProps> = ({
  selectedExhibit,
  onSelectExhibit,
  navigationMode,
  onNavigationModeChange,
  hoveredExhibit,
  onHoverExhibit,
  resetCameraTrigger = 0,
  onOpenCounter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // References to keep in sync without re-running scene init
  const selectedExhibitRef = useRef<ExhibitItem | null>(selectedExhibit);
  selectedExhibitRef.current = selectedExhibit;

  const navModeRef = useRef<NavigationMode>(navigationMode);
  navModeRef.current = navigationMode;

  const hoveredExhibitRef = useRef<ExhibitItem | null>(hoveredExhibit);
  hoveredExhibitRef.current = hoveredExhibit;

  const onSelectExhibitRef = useRef(onSelectExhibit);
  onSelectExhibitRef.current = onSelectExhibit;

  const onNavigationModeChangeRef = useRef(onNavigationModeChange);
  onNavigationModeChangeRef.current = onNavigationModeChange;

  const onHoverExhibitRef = useRef(onHoverExhibit);
  onHoverExhibitRef.current = onHoverExhibit;

  const onOpenCounterRef = useRef(onOpenCounter);
  onOpenCounterRef.current = onOpenCounter;

  // Scene object refs
  const pedestalsRef = useRef<PedestalNode[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Free movement state - Overview viewpoint from distance showcasing all 5 pedestals
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const cameraPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 2.8, 13.0));
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.9, 0));
  const cameraVelocity = useRef<THREE.Vector3>(new THREE.Vector3());
  const cameraYaw = useRef<number>(Math.PI); // Facing negative Z initially
  const cameraPitch = useRef<number>(-0.16); // Downward panoramic gaze showcasing all exhibits
  const targetYaw = useRef<number>(Math.PI);
  const targetPitch = useRef<number>(-0.16);
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistance = useRef<number>(0);

  // Smooth Home / Overview Reset transition state
  const resetTransition = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startYaw: number;
    targetYaw: number;
    startPitch: number;
    targetPitch: number;
  }>({
    active: false,
    startTime: 0,
    duration: 1.25,
    startPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(0, 2.8, 13.0),
    startYaw: 0,
    targetYaw: Math.PI,
    startPitch: 0,
    targetPitch: -0.16,
  });

  const lastResetTrigger = useRef(resetCameraTrigger);
  useEffect(() => {
    if (resetCameraTrigger > 0 && resetCameraTrigger !== lastResetTrigger.current) {
      lastResetTrigger.current = resetCameraTrigger;
      cameraVelocity.current.set(0, 0, 0);
      isElevatedHome.current = true;

      // Start smooth cinematic return to panoramic overview viewpoint
      resetTransition.current.active = true;
      resetTransition.current.startTime = performance.now();
      resetTransition.current.startPos.copy(cameraPos.current);
      resetTransition.current.targetPos.set(0, 2.8, 13.0);
      resetTransition.current.startYaw = cameraYaw.current;

      // Calculate shortest angular turn to Math.PI
      let diff = Math.PI - (cameraYaw.current % (Math.PI * 2));
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      resetTransition.current.targetYaw = cameraYaw.current + diff;

      resetTransition.current.startPitch = cameraPitch.current;
      resetTransition.current.targetPitch = -0.16;

      targetYaw.current = resetTransition.current.targetYaw;
      targetPitch.current = -0.16;
    }
  }, [resetCameraTrigger]);

  // Orbit state when inspecting
  const inspectOrbitAngle = useRef<number>(0);
  const inspectOrbitPitch = useRef<number>(0.2);
  const targetOrbitAngle = useRef<number>(0);
  const targetOrbitPitch = useRef<number>(0.2);

  // Animation walk distance for subtle bobbing
  const walkDistanceRef = useRef<number>(0);

  // Tracks whether the camera is in the elevated overview state (via Home button)
  const isElevatedHome = useRef<boolean>(true);

  // Pointer position for raycasting
  const mousePointer = useRef<THREE.Vector2>(new THREE.Vector2(-10, -10));

  // Build the scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 1. Scene setup: Refined, luminous gallery space inspired by reference image palette
    const scene = new THREE.Scene();
    const blushAtmosphereColor = 0xe4b4bc; // Chic dusty blush rose from reference image
    scene.background = new THREE.Color(blushAtmosphereColor);
    // Soft architectural distance atmosphere seamlessly fading into perimeter walls
    scene.fog = new THREE.Fog(blushAtmosphereColor, 18, 54);

    // 2. Camera setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 75);
    camera.position.copy(cameraPos.current);
    cameraRef.current = camera;

    // 3. Renderer setup - Optimized for locked high frame rates (60–120+ FPS)
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      precision: 'highp',
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Static architectural shadows are baked into shadow buffer and only refreshed on demand,
    // saving ~3-5ms of GPU overhead per frame while moving around
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    // Environment reflections for authentic light silver metallic sheen and specular highlights
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTexture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 4. Lighting Setup: Calibrated, soothing illumination accentuating eyewear forms
    // Soft ambient fill with warm undertones
    const ambientLight = new THREE.AmbientLight(0xfff7ec, 0.68);
    scene.add(ambientLight);

    // Architectural hemisphere bounce reflecting blush floor and gentle ceiling light
    const hemiLight = new THREE.HemisphereLight(0xfffef8, 0xd8a9b2, 0.80);
    scene.add(hemiLight);

    // Primary directional key light from ceiling
    const ceilingHeight = 6.85;
    const keyLight = new THREE.DirectionalLight(0xfff9ef, 0.88);
    keyLight.position.set(4, 7.5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 38;
    const d = 18;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.radius = 3.0;
    scene.add(keyLight);

    // Subtle counter fill
    const fillLight = new THREE.DirectionalLight(0xf8f2ee, 0.38);
    fillLight.position.set(-5, 6.5, -4);
    scene.add(fillLight);

    // Soft architectural wall grazing perimeter lights
    const wallLightNorth = new THREE.PointLight(0xfff0ee, 0.52, 32, 1.3);
    wallLightNorth.position.set(0, 6.2, -15);
    scene.add(wallLightNorth);

    const wallLightSouth = new THREE.PointLight(0xfff0ee, 0.52, 32, 1.3);
    wallLightSouth.position.set(0, 6.2, 15);
    scene.add(wallLightSouth);

    const wallLightEast = new THREE.PointLight(0xfff2f0, 0.52, 32, 1.3);
    wallLightEast.position.set(15, 6.2, 0);
    scene.add(wallLightEast);

    const wallLightWest = new THREE.PointLight(0xfff2f0, 0.52, 32, 1.3);
    wallLightWest.position.set(-15, 6.2, 0);
    scene.add(wallLightWest);

    // 5. Architectural Space Construction (Palette harmonious with reference image)
    // Floor: Continuous microcement floor with silky diffuse sheen
    const floorGeo = new THREE.PlaneGeometry(54, 54, 1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xd6c7cb,
      roughness: 0.42,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.matrixAutoUpdate = false;
    floor.updateMatrix();
    scene.add(floor);

    // Minimal architectural plaster slab grid joints
    const gridHelper = new THREE.GridHelper(44, 22, 0xcab5b9, 0xd4c2c7);
    gridHelper.position.y = 0.002;
    gridHelper.matrixAutoUpdate = false;
    gridHelper.updateMatrix();
    scene.add(gridHelper);

    // Central circular polished stone inlay
    const centerInlayGeo = new THREE.RingGeometry(0.1, 7.8, 64);
    const centerInlayMat = new THREE.MeshStandardMaterial({
      color: 0xdcb8c0,
      roughness: 0.32,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const centerInlay = new THREE.Mesh(centerInlayGeo, centerInlayMat);
    centerInlay.rotation.x = -Math.PI / 2;
    centerInlay.position.y = 0.003;
    centerInlay.receiveShadow = true;
    centerInlay.matrixAutoUpdate = false;
    centerInlay.updateMatrix();
    scene.add(centerInlay);

    // Outer architectural perimeter walls (Chic dusty blush rose matte plaster)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xe4b4bc,
      roughness: 0.88,
      metalness: 0.02,
    });

    const createWall = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, y, z);
      wall.receiveShadow = true;
      wall.matrixAutoUpdate = false;
      wall.updateMatrix();
      scene.add(wall);
      return wall;
    };

    const wallHeight = 7.5;
    createWall(0, wallHeight / 2, -18, 40, wallHeight, 1);
    createWall(0, wallHeight / 2, 18, 40, wallHeight, 1);
    createWall(-18, wallHeight / 2, 0, 1, wallHeight, 40);
    createWall(18, wallHeight / 2, 0, 1, wallHeight, 40);

    // Entire ceiling is one huge luminous stretch light (monolithic glowing ceiling membrane)
    const ceilingGeo = new THREE.PlaneGeometry(36, 36, 1, 1);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xfcf9f5,
      emissive: new THREE.Color(0xfff6ed), // Soothing, diffused warm architectural luminous radiance
      emissiveIntensity: 0.62,
      roughness: 0.22,
      metalness: 0.01,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(0, ceilingHeight, 0);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.matrixAutoUpdate = false;
    ceiling.updateMatrix();
    scene.add(ceiling);

    // 6. Curated Eyewear Pedestals (Architectural Monoliths)
    const pedestalNodes: PedestalNode[] = [];
    const colliders: THREE.Mesh[] = [];

    // Shared geometries to maximize GPU batching & frame rates
    const pedestalBaseGeo = new THREE.CylinderGeometry(0.52, 0.58, 1.08, 36);
    const pedestalCapGeo = new THREE.CylinderGeometry(0.56, 0.52, 0.06, 36);
    const haloGeo = new THREE.TorusGeometry(0.54, 0.015, 16, 48);
    haloGeo.rotateX(Math.PI / 2);

    const riserGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32);

    EXHIBITS.forEach((exhibit, index) => {
      const pedestalGroup = new THREE.Group();
      pedestalGroup.position.set(exhibit.position[0], 0, exhibit.position[2]);
      if (exhibit.rotationY) {
        pedestalGroup.rotation.y = exhibit.rotationY;
      }

      // Base material: Light silver / metallic look with high metalness and fine brushed finish
      const initialPedestalColor = new THREE.Color(exhibit.pedestalColor);

      const baseMaterial = new THREE.MeshStandardMaterial({
        color: initialPedestalColor,
        roughness: 0.18, // Fine brushed light silver surface
        metalness: 0.94, // Distinctive light silver metallic look
      });

      // Pedestal Base
      const baseMesh = new THREE.Mesh(pedestalBaseGeo, baseMaterial);
      baseMesh.position.y = 1.08 / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      pedestalGroup.add(baseMesh);

      // Pedestal Top Cap
      const capMesh = new THREE.Mesh(pedestalCapGeo, baseMaterial);
      capMesh.position.y = 1.08 + 0.03;
      capMesh.castShadow = true;
      capMesh.receiveShadow = true;
      pedestalGroup.add(capMesh);

      // Interactive Light Halo Collar Ring: Polished sterling silver / mirror chrome
      const haloMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f8fc,
        emissive: new THREE.Color(exhibit.accentRgb[0] * 0.25, exhibit.accentRgb[1] * 0.25, exhibit.accentRgb[2] * 0.25),
        emissiveIntensity: 0.35,
        roughness: 0.06,
        metalness: 0.98,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMaterial);
      haloMesh.position.y = 1.11;
      pedestalGroup.add(haloMesh);

      // Acrylic Riser Stand: Crystal-clear polished acrylic holding the frames (optimized PBR single-pass)
      const riserMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.04,
        metalness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
      const riserMesh = new THREE.Mesh(riserGeo, riserMat);
      riserMesh.position.y = 1.14;
      riserMesh.castShadow = true;
      pedestalGroup.add(riserMesh);

      // Invisible Raycasting Collider (transparent, depthWrite: false prevents shadow and depth fighting)
      const colliderGeo = new THREE.CylinderGeometry(0.72, 0.72, 2.0, 16);
      const colliderMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const collider = new THREE.Mesh(colliderGeo, colliderMat);
      collider.position.y = 1.0;
      collider.userData = { exhibitId: exhibit.id };
      pedestalGroup.add(collider);
      colliders.push(collider);

      // Eyewear Placeholder Display Model
      const eyewearGroup = new THREE.Group();
      eyewearGroup.position.set(0, 1.25, 0);

      // Frame materials with clean metallic and acetate definitions
      const frameColor = index === 1 ? 0x252528 : index === 3 ? 0xf0ece2 : 0xa4a4aa;
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: index === 3 ? 0.25 : 0.4,
        metalness: index === 1 ? 0.1 : 0.85,
      });

      const lensMaterial = new THREE.MeshPhysicalMaterial({
        color: index === 1 ? 0x161619 : 0xdfe5ed,
        transparent: true,
        opacity: index === 1 ? 0.85 : 0.38,
        roughness: 0.04,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        depthWrite: false,
      });

      // Left & Right Eyewire Rims
      const rimRadius = 0.085;
      const rimTube = 0.007;
      const leftRimGeo = new THREE.TorusGeometry(rimRadius, rimTube, 12, 32);
      const rightRimGeo = new THREE.TorusGeometry(rimRadius, rimTube, 12, 32);

      const leftRim = new THREE.Mesh(leftRimGeo, frameMaterial);
      leftRim.position.set(-0.11, 0, 0);
      leftRim.castShadow = true;

      const rightRim = new THREE.Mesh(rightRimGeo, frameMaterial);
      rightRim.position.set(0.11, 0, 0);
      rightRim.castShadow = true;

      // Lenses
      const lensGeo = new THREE.CircleGeometry(rimRadius - 0.003, 32);
      const leftLens = new THREE.Mesh(lensGeo, lensMaterial);
      leftLens.position.set(-0.11, 0, 0);
      const rightLens = new THREE.Mesh(lensGeo, lensMaterial);
      rightLens.position.set(0.11, 0, 0);

      // Bridge
      const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.06, 12);
      const bridge = new THREE.Mesh(bridgeGeo, frameMaterial);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, 0.02, 0);

      // Temples (Left and Right arms)
      const templeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.28, 8);
      const leftTemple = new THREE.Mesh(templeGeo, frameMaterial);
      leftTemple.rotation.x = Math.PI / 2;
      leftTemple.position.set(-0.19, -0.01, -0.14);

      const rightTemple = new THREE.Mesh(templeGeo, frameMaterial);
      rightTemple.rotation.x = Math.PI / 2;
      rightTemple.position.set(0.19, -0.01, -0.14);

      eyewearGroup.add(leftRim);
      eyewearGroup.add(rightRim);
      eyewearGroup.add(leftLens);
      eyewearGroup.add(rightLens);
      eyewearGroup.add(bridge);
      eyewearGroup.add(leftTemple);
      eyewearGroup.add(rightTemple);

      // Stand holding the glasses
      const standPostGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.1, 12);
      const standPost = new THREE.Mesh(standPostGeo, frameMaterial);
      standPost.position.set(0, -0.06, 0);
      eyewearGroup.add(standPost);

      pedestalGroup.add(eyewearGroup);

      // Architectural spotlight integrated into the stretch ceiling grid (Pure soft dispersion, penumbra 0.92)
      const keySpot = new THREE.SpotLight(0xfff8ee, 1.15);
      keySpot.position.set(exhibit.position[0], 6.6, exhibit.position[2]);
      keySpot.target = eyewearGroup;
      keySpot.angle = Math.PI / 4.6;
      keySpot.penumbra = 0.92;
      keySpot.decay = 1.15;
      keySpot.distance = 20;
      keySpot.castShadow = false;
      scene.add(keySpot);

      // Subtle crisp rim accent for beta-titanium eyewear bevels
      const rimSpot = new THREE.SpotLight(0xf2f7ff, 0.72);
      rimSpot.position.set(exhibit.position[0] + 0.8, 5.2, exhibit.position[2] - 1.2);
      rimSpot.target = eyewearGroup;
      rimSpot.angle = Math.PI / 5.2;
      rimSpot.penumbra = 0.88;
      rimSpot.decay = 1.15;
      rimSpot.distance = 18;
      rimSpot.castShadow = false;
      scene.add(rimSpot);

      scene.add(pedestalGroup);

      pedestalNodes.push({
        exhibit,
        group: pedestalGroup,
        collider,
        haloMesh,
        eyewearGroup,
        keySpotlight: keySpot,
        rimSpotlight: rimSpot,
        baseMaterial,
        haloMaterial,
        currentHoverProgress: 0,
        currentSelectProgress: 0,
      });
    });

    pedestalsRef.current = pedestalNodes;

    // 6.5 Architectural Acquisitions & Checkout Counter
    const counterGroup = new THREE.Group();
    // Positioned gracefully at [8.8, 0, 7.2] in the reception promenade wing, angled at -45 deg toward gallery entrance/center
    counterGroup.position.set(8.8, 0, 7.2);
    counterGroup.rotation.y = -Math.PI / 4;

    // Dark charcoal plinth kickplate
    const counterPlinthGeo = new THREE.BoxGeometry(3.1, 0.08, 1.25);
    const counterPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.8,
      metalness: 0.1,
    });
    const counterPlinth = new THREE.Mesh(counterPlinthGeo, counterPlinthMat);
    counterPlinth.position.y = 0.04;
    counterPlinth.receiveShadow = true;
    counterGroup.add(counterPlinth);

    // Warm undercounter LED cove glow ribbon
    const counterGlowGeo = new THREE.BoxGeometry(3.12, 0.02, 1.27);
    const counterGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfff2e0,
      emissive: new THREE.Color(0xffe8cc),
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const counterGlow = new THREE.Mesh(counterGlowGeo, counterGlowMat);
    counterGlow.position.y = 0.08;
    counterGroup.add(counterGlow);

    // Counter Main Desk Monolith (Light silver brushed metallic finish matching pedestals)
    const counterBodyGeo = new THREE.BoxGeometry(3.3, 1.02, 1.3);
    const counterBodyMat = new THREE.MeshStandardMaterial({
      color: 0xedf1f7,
      roughness: 0.18,
      metalness: 0.94,
    });
    const counterBody = new THREE.Mesh(counterBodyGeo, counterBodyMat);
    counterBody.position.y = 0.08 + 1.02 / 2;
    counterBody.castShadow = true;
    counterBody.receiveShadow = true;
    counterGroup.add(counterBody);

    // Top Counter Surface Slab (Polished light silver/white quartz)
    const counterTopGeo = new THREE.BoxGeometry(3.42, 0.05, 1.42);
    const counterTopMat = new THREE.MeshStandardMaterial({
      color: 0xf6f9fc,
      roughness: 0.14,
      metalness: 0.95,
    });
    const counterTop = new THREE.Mesh(counterTopGeo, counterTopMat);
    counterTop.position.y = 1.125;
    counterTop.castShadow = true;
    counterTop.receiveShadow = true;
    counterGroup.add(counterTop);

    // Register / POS Terminal Screen
    const terminalGroup = new THREE.Group();
    terminalGroup.position.set(-0.7, 1.15, 0.15);

    const termStandGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.26, 16);
    const termStandMat = new THREE.MeshStandardMaterial({ color: 0xdde2ea, roughness: 0.2, metalness: 0.9 });
    const termStand = new THREE.Mesh(termStandGeo, termStandMat);
    termStand.position.y = 0.13;
    terminalGroup.add(termStand);

    const screenHousingGeo = new THREE.BoxGeometry(0.56, 0.38, 0.025);
    const screenHousingMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.4, metalness: 0.8 });
    const screenHousing = new THREE.Mesh(screenHousingGeo, screenHousingMat);
    screenHousing.position.set(0, 0.32, 0);
    screenHousing.rotation.x = 0.38; // Tilted back ~22 deg
    terminalGroup.add(screenHousing);

    const screenFaceGeo = new THREE.PlaneGeometry(0.53, 0.35);
    const screenFaceMat = new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.22,
      metalness: 0.8,
    });
    const screenFace = new THREE.Mesh(screenFaceGeo, screenFaceMat);
    screenFace.position.set(0, 0, 0.014);
    screenHousing.add(screenFace);
    counterGroup.add(terminalGroup);

    // Contactless Payment / Card Pad
    const payPadGeo = new THREE.BoxGeometry(0.2, 0.035, 0.26);
    const payPadMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5, metalness: 0.5 });
    const payPad = new THREE.Mesh(payPadGeo, payPadMat);
    payPad.position.set(-0.25, 1.17, 0.22);
    counterGroup.add(payPad);

    const payLedGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.005, 12);
    const payLedMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
    const payLed = new THREE.Mesh(payLedGeo, payLedMat);
    payLed.position.set(-0.25, 1.19, 0.3);
    counterGroup.add(payLed);

    // Luxury Eyewear Presentation Tray
    const trayGroup = new THREE.Group();
    trayGroup.position.set(0.32, 1.15, 0.08);

    const trayRimGeo = new THREE.BoxGeometry(0.72, 0.03, 0.46);
    const trayRimMat = new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.7, metalness: 0.1 });
    const trayRim = new THREE.Mesh(trayRimGeo, trayRimMat);
    trayRim.position.y = 0.015;
    trayGroup.add(trayRim);

    const trayVelvetGeo = new THREE.BoxGeometry(0.68, 0.012, 0.42);
    const trayVelvetMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.96, metalness: 0.02 });
    const trayVelvet = new THREE.Mesh(trayVelvetGeo, trayVelvetMat);
    trayVelvet.position.y = 0.025;
    trayGroup.add(trayVelvet);

    // Sample eyewear resting on presentation tray
    const traySampleGeo = new THREE.TorusGeometry(0.065, 0.005, 8, 24);
    const traySampleMat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.2, metalness: 0.95 });
    const leftSampleEye = new THREE.Mesh(traySampleGeo, traySampleMat);
    leftSampleEye.position.set(-0.08, 0.038, 0);
    leftSampleEye.rotation.x = Math.PI / 2;
    trayGroup.add(leftSampleEye);

    const rightSampleEye = new THREE.Mesh(traySampleGeo, traySampleMat);
    rightSampleEye.position.set(0.08, 0.038, 0);
    rightSampleEye.rotation.x = Math.PI / 2;
    trayGroup.add(rightSampleEye);

    const clothGeo = new THREE.BoxGeometry(0.18, 0.01, 0.24);
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e2, roughness: 0.9 });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(0.2, 0.033, 0.05);
    cloth.rotation.y = 0.25;
    trayGroup.add(cloth);
    counterGroup.add(trayGroup);

    // Archival Packaging: Hard Box & Luxury Shopper Bag
    const hardBoxGeo = new THREE.BoxGeometry(0.38, 0.16, 0.24);
    const hardBoxMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.35, metalness: 0.6 });
    const hardBox = new THREE.Mesh(hardBoxGeo, hardBoxMat);
    hardBox.position.set(1.18, 1.23, -0.1);
    hardBox.rotation.y = 0.12;
    hardBox.castShadow = true;
    counterGroup.add(hardBox);

    const shopperBagGeo = new THREE.BoxGeometry(0.42, 0.52, 0.22);
    const shopperBagMat = new THREE.MeshStandardMaterial({ color: 0x161619, roughness: 0.5, metalness: 0.3 });
    const shopperBag = new THREE.Mesh(shopperBagGeo, shopperBagMat);
    shopperBag.position.set(1.18, 1.41, 0.25);
    shopperBag.castShadow = true;
    counterGroup.add(shopperBag);

    // Silver bag handles
    const handleGeo = new THREE.TorusGeometry(0.08, 0.007, 8, 24, Math.PI);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.2, metalness: 0.9 });
    const bagHandleFront = new THREE.Mesh(handleGeo, handleMat);
    bagHandleFront.position.set(1.18, 1.67, 0.35);
    bagHandleFront.rotation.y = Math.PI / 2;
    counterGroup.add(bagHandleFront);

    // Minimalist Desk Task Lamp
    const lampBaseGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.2, metalness: 0.92 });
    const lampBase = new THREE.Mesh(lampBaseGeo, lampMat);
    lampBase.position.set(-1.25, 1.16, -0.25);
    counterGroup.add(lampBase);

    const lampPoleGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.58, 16);
    const lampPole = new THREE.Mesh(lampPoleGeo, lampMat);
    lampPole.position.set(-1.25, 1.45, -0.25);
    counterGroup.add(lampPole);

    const lampArmGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 16);
    const lampArm = new THREE.Mesh(lampArmGeo, lampMat);
    lampArm.position.set(-1.12, 1.74, -0.15);
    lampArm.rotation.z = Math.PI / 3;
    counterGroup.add(lampArm);

    // Warm desk spotlight over counter presentation area
    const counterSpotlight = new THREE.PointLight(0xfff5ea, 0.72, 4.2, 1.8);
    counterSpotlight.position.set(8.8 - 0.7, 2.8, 7.2 + 0.2);
    scene.add(counterSpotlight);

    scene.add(counterGroup);

    // Pre-warm all shaders immediately so the initial look/walk movement has zero shader compilation hitch
    renderer.compile(scene, camera);

    // 7. Raycaster for Interaction
    const raycaster = new THREE.Raycaster();

    // Cache canvas rect to avoid forced synchronous layout reflows (getBoundingClientRect) on every pointermove
    const cachedRect = {
      left: 0,
      top: 0,
      width: width,
      height: height,
    };
    const updateRect = () => {
      const r = canvas.getBoundingClientRect();
      cachedRect.left = r.left;
      cachedRect.top = r.top;
      cachedRect.width = r.width || width;
      cachedRect.height = r.height || height;
    };
    updateRect();

    // 8. Event Handlers
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      resetTransition.current.active = false;
      if (e.code === 'Escape' && (navModeRef.current === 'inspecting' || navModeRef.current === 'counter')) {
        onNavigationModeChangeRef.current('free');
        onSelectExhibitRef.current(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      // Use cached rect for zero DOM layout thrashing during mouse drag
      mousePointer.current.x = ((e.clientX - cachedRect.left) / cachedRect.width) * 2 - 1;
      mousePointer.current.y = -((e.clientY - cachedRect.top) / cachedRect.height) * 2 + 1;

      if (isDragging.current) {
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        dragDistance.current += Math.hypot(deltaX, deltaY);

        dragStart.current = { x: e.clientX, y: e.clientY };

        if (navModeRef.current === 'free') {
          const sensitivity = 0.0032;
          targetYaw.current -= deltaX * sensitivity;
          targetPitch.current -= deltaY * sensitivity;
          targetPitch.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetPitch.current));
        } else {
          const orbitSensitivity = 0.006;
          targetOrbitAngle.current += deltaX * orbitSensitivity;
          targetOrbitPitch.current = Math.max(0.05, Math.min(Math.PI / 2.5, targetOrbitPitch.current - deltaY * orbitSensitivity));
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      resetTransition.current.active = false;
      updateRect();
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragDistance.current = 0;
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false;

      // Only treat as a click if mouse didn't drag substantially
      if (dragDistance.current < 6) {
        raycaster.setFromCamera(mousePointer.current, camera);
        const intersects = raycaster.intersectObjects(colliders, false);

        if (intersects.length > 0) {
          const hit = intersects[0];
          const hitExhibitId = hit.object.userData?.exhibitId;
          const found = EXHIBITS.find((ex) => ex.id === hitExhibitId);
          if (found) {
            onSelectExhibitRef.current(found);
            onNavigationModeChangeRef.current('inspecting');
            targetOrbitAngle.current = 0;
            targetOrbitPitch.current = 0.18;
            inspectOrbitAngle.current = 0;
            inspectOrbitPitch.current = 0.18;
            renderer.shadowMap.needsUpdate = true;
          }
        } else {
          if (navModeRef.current === 'inspecting' || navModeRef.current === 'counter') {
            onNavigationModeChangeRef.current('free');
            onSelectExhibitRef.current(null);
          }
        }
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateRect();
      renderer.shadowMap.needsUpdate = true;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    // 9. Animation Loop (Zero GC allocations, high-framerate exponential damping)
    let animationFrameId: number;
    let lastTime = performance.now();
    let lastRaycastTime = 0;
    let shadowUpdateCounter = 0;

    // Hoisted reusable math vectors - Prevents garbage collection stutter during continuous movement
    const forwardVector = new THREE.Vector3();
    const rightVector = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();
    const tempBaseColor = new THREE.Color();
    const tempTargetColor = new THREE.Color();
    const desiredPosVec = new THREE.Vector3();
    const desiredTargetVec = new THREE.Vector3();
    const lookDir = new THREE.Vector3();
    let lastHoveredExhibit: ExhibitItem | null = null;

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const rawDelta = (time - lastTime) / 1000;
      const delta = Math.min(rawDelta, 0.05);
      lastTime = time;

      // Throttle raycasting to ~30-45Hz while rendering at full 60/120/144Hz
      // Eliminates CPU overhead and garbage collection stutter during high-framerate movement
      if (time - lastRaycastTime > 24) {
        lastRaycastTime = time;
        raycaster.setFromCamera(mousePointer.current, camera);
        const hoveredIntersects = raycaster.intersectObjects(colliders, false);
        let detectedHovered: ExhibitItem | null = null;
        if (hoveredIntersects.length > 0) {
          const topHit = hoveredIntersects[0];
          const hoveredId = topHit.object.userData?.exhibitId;
          detectedHovered = EXHIBITS.find((ex) => ex.id === hoveredId) || null;
        }

        if (detectedHovered?.id !== lastHoveredExhibit?.id) {
          lastHoveredExhibit = detectedHovered;
          onHoverExhibitRef.current(detectedHovered);
        }

        canvas.style.cursor = detectedHovered ? 'pointer' : isDragging.current ? 'grabbing' : 'grab';
      }

      // Smooth Camera Navigation Updates
      if (resetTransition.current.active) {
        const elapsed = (time - resetTransition.current.startTime) / 1000;
        const progress = Math.min(elapsed / resetTransition.current.duration, 1);
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        cameraPos.current.lerpVectors(resetTransition.current.startPos, resetTransition.current.targetPos, ease);
        cameraYaw.current = resetTransition.current.startYaw + (resetTransition.current.targetYaw - resetTransition.current.startYaw) * ease;
        cameraPitch.current = resetTransition.current.startPitch + (resetTransition.current.targetPitch - resetTransition.current.startPitch) * ease;

        camera.position.copy(cameraPos.current);
        lookDir.set(
          Math.sin(cameraYaw.current) * Math.cos(cameraPitch.current),
          Math.sin(cameraPitch.current),
          Math.cos(cameraYaw.current) * Math.cos(cameraPitch.current)
        );
        cameraTarget.current.copy(cameraPos.current).add(lookDir);
        camera.lookAt(cameraTarget.current);

        if (progress >= 1) {
          resetTransition.current.active = false;
          cameraPos.current.set(0, 2.8, 13.0);
          cameraYaw.current = Math.PI;
          targetYaw.current = Math.PI;
          cameraPitch.current = -0.16;
          targetPitch.current = -0.16;
          renderer.shadowMap.needsUpdate = true;
        }
      } else if (navModeRef.current === 'free') {
        // Frame-rate invariant exponential damping for buttery-smooth camera gaze
        const rotDamp = 1 - Math.exp(-22 * delta);
        cameraYaw.current += (targetYaw.current - cameraYaw.current) * rotDamp;
        cameraPitch.current += (targetPitch.current - cameraPitch.current) * rotDamp;

        forwardVector.set(Math.sin(cameraYaw.current), 0, Math.cos(cameraYaw.current));
        rightVector.set(-Math.cos(cameraYaw.current), 0, Math.sin(cameraYaw.current));

        moveDirection.set(0, 0, 0);
        const keys = keysPressed.current;
        if (keys['KeyW'] || keys['ArrowUp']) moveDirection.add(forwardVector);
        if (keys['KeyS'] || keys['ArrowDown']) moveDirection.sub(forwardVector);
        if (keys['KeyA'] || keys['ArrowLeft']) moveDirection.sub(rightVector);
        if (keys['KeyD'] || keys['ArrowRight']) moveDirection.add(rightVector);

        const isMoving = moveDirection.lengthSq() > 0;
        if (isMoving) {
          // As soon as the user starts walking around, exit the elevated overview mode
          isElevatedHome.current = false;
          moveDirection.normalize();
          const walkSpeed = 5.4;
          cameraVelocity.current.addScaledVector(moveDirection, walkSpeed * delta * 7);
          walkDistanceRef.current += delta * 6;
        }

        const velDamp = Math.exp(-8 * delta);
        cameraVelocity.current.multiplyScalar(velDamp);

        cameraPos.current.addScaledVector(cameraVelocity.current, delta);
        cameraPos.current.x = Math.max(-15.5, Math.min(15.5, cameraPos.current.x));
        cameraPos.current.z = Math.max(-15.5, Math.min(15.5, cameraPos.current.z));

        // Smooth eye-level transition
        const targetEyeY = isElevatedHome.current ? 2.8 : 1.62;
        cameraPos.current.y += (targetEyeY - cameraPos.current.y) * (1 - Math.exp(-4.5 * delta));

        const bob = isMoving ? Math.sin(walkDistanceRef.current) * 0.012 : 0;
        camera.position.set(cameraPos.current.x, cameraPos.current.y + bob, cameraPos.current.z);

        lookDir.set(
          Math.sin(cameraYaw.current) * Math.cos(cameraPitch.current),
          Math.sin(cameraPitch.current),
          Math.cos(cameraYaw.current) * Math.cos(cameraPitch.current)
        );
        cameraTarget.current.copy(camera.position).add(lookDir);
        camera.lookAt(cameraTarget.current);

        // Smart shadow updates: When stationary, refresh periodically if needed without impacting moving FPS
        if (!isMoving && !isDragging.current) {
          shadowUpdateCounter++;
          if (shadowUpdateCounter > 35) {
            shadowUpdateCounter = 0;
            renderer.shadowMap.needsUpdate = true;
          }
        }
      } else if (navModeRef.current === 'inspecting') {
        const activeExhibit = selectedExhibitRef.current;
        if (activeExhibit) {
          inspectOrbitAngle.current += (targetOrbitAngle.current - inspectOrbitAngle.current) * Math.min(delta * 10, 1);
          inspectOrbitPitch.current += (targetOrbitPitch.current - inspectOrbitPitch.current) * Math.min(delta * 10, 1);

          const pedX = activeExhibit.position[0];
          const pedY = 1.22;
          const pedZ = activeExhibit.position[2];

          const orbitRadius = 1.65;
          const eyeY = pedY + Math.sin(inspectOrbitPitch.current) * orbitRadius;
          const eyeHorizontalDist = Math.cos(inspectOrbitPitch.current) * orbitRadius;
          const eyeX = pedX + Math.sin(inspectOrbitAngle.current) * eyeHorizontalDist;
          const eyeZ = pedZ + Math.cos(inspectOrbitAngle.current) * eyeHorizontalDist;

          // Calculate horizontal right vector perpendicular to orbit gaze
          // Shift camera slightly right so eyewear renders centered in the open left area of the viewport
          const camRightX = Math.cos(inspectOrbitAngle.current);
          const camRightZ = -Math.sin(inspectOrbitAngle.current);
          const lateralOffset = (container.clientWidth >= 768) ? 0.38 : 0;

          desiredPosVec.set(
            eyeX + camRightX * lateralOffset,
            eyeY,
            eyeZ + camRightZ * lateralOffset
          );

          desiredTargetVec.set(
            pedX + camRightX * lateralOffset,
            pedY,
            pedZ + camRightZ * lateralOffset
          );

          cameraPos.current.lerp(desiredPosVec, Math.min(delta * 6.5, 1));
          camera.position.copy(cameraPos.current);

          cameraTarget.current.lerp(desiredTargetVec, Math.min(delta * 7.5, 1));
          camera.lookAt(cameraTarget.current);

          targetYaw.current = Math.atan2(
            cameraTarget.current.x - cameraPos.current.x,
            cameraTarget.current.z - cameraPos.current.z
          );
          cameraYaw.current = targetYaw.current;
        }
      } else if (navModeRef.current === 'counter') {
        // Smoothly position camera in front of the counter desk:
        // Counter is at [8.8, 0, 7.2] with rotation.y = -Math.PI / 4.
        // Standing viewpoint in front of counter: [7.5, 1.58, 8.5] looking at [8.8, 1.12, 7.2]
        desiredPosVec.set(7.5, 1.58, 8.5);
        desiredTargetVec.set(8.8, 1.12, 7.2);

        cameraPos.current.lerp(desiredPosVec, Math.min(delta * 5.5, 1));
        camera.position.copy(cameraPos.current);

        cameraTarget.current.lerp(desiredTargetVec, Math.min(delta * 6.5, 1));
        camera.lookAt(cameraTarget.current);

        targetYaw.current = Math.atan2(
          cameraTarget.current.x - cameraPos.current.x,
          cameraTarget.current.z - cameraPos.current.z
        );
        cameraYaw.current = targetYaw.current;
      }

      // Update Pedestals & Eyewear Placeholders with smooth continuous interpolation
      const currentSelectedId = selectedExhibitRef.current?.id;
      const currentHoveredId = hoveredExhibitRef.current?.id;

      pedestalNodes.forEach((node) => {
        const isHovered = node.exhibit.id === currentHoveredId;
        const isSelected = node.exhibit.id === currentSelectedId;

        node.currentHoverProgress += ((isHovered ? 1 : 0) - node.currentHoverProgress) * Math.min(delta * 9, 1);
        node.currentSelectProgress += ((isSelected ? 1 : 0) - node.currentSelectProgress) * Math.min(delta * 7, 1);

        const combinedHighlight = Math.max(node.currentHoverProgress, node.currentSelectProgress);

        const spinSpeed = isSelected ? 0.35 : 0.2;
        node.eyewearGroup.rotation.y += delta * spinSpeed;

        const levitation = Math.sin(time * 0.002 + node.exhibit.position[0]) * 0.012 + (combinedHighlight * 0.025);
        node.eyewearGroup.position.y = 1.25 + levitation;

        const accent = node.exhibit.accentRgb;
        const haloEmissive = 0.2 + combinedHighlight * 0.8;
        node.haloMaterial.emissive.setRGB(
          accent[0] * haloEmissive,
          accent[1] * haloEmissive,
          accent[2] * haloEmissive
        );
        node.haloMaterial.emissiveIntensity = 0.15 + combinedHighlight * 0.75;

        // Radiant light silver metallic platform highlight tone and specular sheen
        tempBaseColor.set(node.exhibit.pedestalColor);
        if (combinedHighlight > 0.01) {
          tempTargetColor.set(node.exhibit.highlightColor);
          tempBaseColor.lerp(tempTargetColor, combinedHighlight * 0.35);
        }
        node.baseMaterial.color.copy(tempBaseColor);
        node.baseMaterial.roughness = Math.max(0.08, 0.18 - combinedHighlight * 0.08);
        node.baseMaterial.metalness = Math.min(0.98, 0.94 + combinedHighlight * 0.04);

        // Smooth dual spotlight blooms for key and rim lighting (calibrated, gentle illumination)
        const targetKeyIntensity = isSelected ? 1.6 : isHovered ? 1.3 : 1.0;
        node.keySpotlight.intensity += (targetKeyIntensity - node.keySpotlight.intensity) * Math.min(delta * 8, 1);

        const targetRimIntensity = isSelected ? 1.05 : isHovered ? 0.8 : 0.55;
        node.rimSpotlight.intensity += (targetRimIntensity - node.rimSpotlight.intensity) * Math.min(delta * 8, 1);
      });

      // Render the scene
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 10. Clean Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);

      renderer.dispose();
      pedestalBaseGeo.dispose();
      pedestalCapGeo.dispose();
      haloGeo.dispose();
      riserGeo.dispose();
      floorGeo.dispose();
      centerInlayGeo.dispose();
      ceilingGeo.dispose();
      ceilingMat.dispose();
      if (envTexture) envTexture.dispose();
    };
  }, []); // Run ONCE on mount; refs maintain dynamic state without rebuilding the scene!

  // Touch controls support for mobile
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragDistance.current = 0;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.current.x;
      const deltaY = touch.clientY - dragStart.current.y;
      dragDistance.current += Math.hypot(deltaX, deltaY);
      dragStart.current = { x: touch.clientX, y: touch.clientY };

      if (navModeRef.current === 'free') {
        const sensitivity = 0.005;
        targetYaw.current -= deltaX * sensitivity;
        targetPitch.current -= deltaY * sensitivity;
        targetPitch.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetPitch.current));
      } else {
        const orbitSensitivity = 0.008;
        targetOrbitAngle.current += deltaX * orbitSensitivity;
        targetOrbitPitch.current = Math.max(0.05, Math.min(Math.PI / 2.5, targetOrbitPitch.current - deltaY * orbitSensitivity));
      }
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Quick reset view helper
  const handleResetCamera = useCallback(() => {
    onNavigationModeChange('free');
    onSelectExhibit(null);
    isElevatedHome.current = true;
    cameraPos.current.set(0, 2.8, 13.0);
    targetYaw.current = Math.PI;
    cameraYaw.current = Math.PI;
    targetPitch.current = -0.16;
    cameraPitch.current = -0.16;
    cameraVelocity.current.set(0, 0, 0);
  }, [onNavigationModeChange, onSelectExhibit]);

  // Reusable vectors for touch navigation impulses
  const touchForwardVec = useRef(new THREE.Vector3());
  const touchRightVec = useRef(new THREE.Vector3());

  // On-screen walk navigation helper for mobile or direct click buttons
  const moveStep = useCallback((direction: 'forward' | 'backward' | 'left' | 'right') => {
    isElevatedHome.current = false;
    if (navModeRef.current !== 'free') {
      onNavigationModeChange('free');
      onSelectExhibit(null);
    }
    touchForwardVec.current.set(Math.sin(cameraYaw.current), 0, Math.cos(cameraYaw.current));
    touchRightVec.current.set(-Math.cos(cameraYaw.current), 0, Math.sin(cameraYaw.current));
    const impulse = 3.5;

    if (direction === 'forward') cameraVelocity.current.addScaledVector(touchForwardVec.current, impulse);
    if (direction === 'backward') cameraVelocity.current.addScaledVector(touchForwardVec.current, -impulse);
    if (direction === 'left') cameraVelocity.current.addScaledVector(touchRightVec.current, -impulse);
    if (direction === 'right') cameraVelocity.current.addScaledVector(touchRightVec.current, impulse);
  }, [onNavigationModeChange, onSelectExhibit]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Hover Indicator - Anchored at bottom center to prevent obstructing the view */}
      {hoveredExhibit && navigationMode === 'free' && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300 opacity-95 animate-fade-in z-20">
          <div className="bg-[#141418]/94 border border-stone-800/80 px-3 py-1 rounded-full shadow-xl flex items-center gap-2">
            <span className="text-[10px] tracking-wider font-mono text-stone-400">
              {hoveredExhibit.number}
            </span>
            <span className="w-1 h-1 rounded-full bg-stone-600" />
            <span className="font-serif text-xs tracking-wide text-stone-200">
              {hoveredExhibit.title}
            </span>
            <span className="text-[9px] tracking-wider uppercase text-stone-400 hidden sm:inline">
              · Inspect
            </span>
          </div>
        </div>
      )}

      {/* On-screen Directional Touch Controls - Low-profile and non-obstructive */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col items-center gap-1 md:hidden pointer-events-auto">
        <button
          onClick={() => moveStep('forward')}
          className="w-8 h-8 rounded-full bg-stone-900/90 border border-white/15 text-stone-300 active:bg-stone-800 flex items-center justify-center text-[10px]"
          title="Move Forward"
        >
          ▲
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => moveStep('left')}
            className="w-8 h-8 rounded-full bg-stone-900/90 border border-white/15 text-stone-300 active:bg-stone-800 flex items-center justify-center text-[10px]"
            title="Step Left"
          >
            ◀
          </button>
          <button
            onClick={() => moveStep('backward')}
            className="w-8 h-8 rounded-full bg-stone-900/90 border border-white/15 text-stone-300 active:bg-stone-800 flex items-center justify-center text-[10px]"
            title="Step Back"
          >
            ▼
          </button>
          <button
            onClick={() => moveStep('right')}
            className="w-8 h-8 rounded-full bg-stone-900/90 border border-white/15 text-stone-300 active:bg-stone-800 flex items-center justify-center text-[10px]"
            title="Step Right"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};
