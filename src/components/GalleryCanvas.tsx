import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EXHIBITS } from '../data/exhibits';
import { ExhibitItem, NavigationMode } from '../types/gallery';
import { buildStoreExterior } from '../utils/storeExterior';

interface GalleryCanvasProps {
  selectedExhibit: ExhibitItem | null;
  onSelectExhibit: (exhibit: ExhibitItem | null) => void;
  navigationMode: NavigationMode;
  onNavigationModeChange: (mode: NavigationMode) => void;
  hoveredExhibit: ExhibitItem | null;
  onHoverExhibit: (exhibit: ExhibitItem | null) => void;
  resetCameraTrigger?: number;
  onOpenCounter?: () => void;
  currentStory?: 1 | 2 | 'exterior';
  onStoryChange?: (story: 1 | 2 | 'exterior') => void;
  teleportTargetStory?: { story: 1 | 2 | 'exterior'; id: number } | null;
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
  currentStory = 1,
  onStoryChange,
  teleportTargetStory,
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

  const currentStoryRef = useRef<1 | 2 | 'exterior'>(currentStory);
  currentStoryRef.current = currentStory;
  const onStoryChangeRef = useRef(onStoryChange);
  onStoryChangeRef.current = onStoryChange;

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
  const lastDoorTransitionTime = useRef<number>(0);

  // Seamless portal transition state between exterior and interior
  const [doorFade, setDoorFade] = useState<{ active: boolean; opacity: number; label: string }>({
    active: false,
    opacity: 0,
    label: '',
  });

  const doorFadeRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    halfPassed: boolean;
    targetStory: 1 | 2 | 'exterior';
    targetPos: THREE.Vector3;
    targetYaw: number;
    targetPitch: number;
    label: string;
  }>({
    active: false,
    startTime: 0,
    duration: 0.55,
    halfPassed: false,
    targetStory: 1,
    targetPos: new THREE.Vector3(),
    targetYaw: Math.PI,
    targetPitch: -0.06,
    label: '',
  });

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

  // Smooth Pedestal Inspection Glide transition state (high frame-rate cubic ease-out)
  const inspectTransition = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetTarget: THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 0.82,
    startPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    targetTarget: new THREE.Vector3(),
  });

  // Trigger high frame-rate glide to pedestal
  const triggerInspectTransition = useCallback((exhibit: ExhibitItem) => {
    const container = containerRef.current;
    resetTransition.current.active = false;
    isElevatedHome.current = false;
    cameraVelocity.current.set(0, 0, 0);

    const pedX = exhibit.position[0];
    const pedY = 1.22;
    const pedZ = exhibit.position[2];

    // Maintain continuous visual line from current camera position
    const dx = cameraPos.current.x - pedX;
    const dz = cameraPos.current.z - pedZ;
    let approachAngle = Math.atan2(dx, dz);
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
      approachAngle = 0;
    }

    targetOrbitAngle.current = approachAngle;
    inspectOrbitAngle.current = approachAngle;
    targetOrbitPitch.current = 0.18;
    inspectOrbitPitch.current = 0.18;

    const orbitRadius = 1.65;
    const eyeY = pedY + Math.sin(0.18) * orbitRadius;
    const eyeHorizontalDist = Math.cos(0.18) * orbitRadius;
    const eyeX = pedX + Math.sin(approachAngle) * eyeHorizontalDist;
    const eyeZ = pedZ + Math.cos(approachAngle) * eyeHorizontalDist;

    const camRightX = Math.cos(approachAngle);
    const camRightZ = -Math.sin(approachAngle);
    const lateralOffset = (container && container.clientWidth >= 768) ? 0.38 : 0;

    inspectTransition.current.active = true;
    inspectTransition.current.startTime = performance.now();
    inspectTransition.current.duration = 0.82;
    inspectTransition.current.startPos.copy(cameraPos.current);
    inspectTransition.current.targetPos.set(
      eyeX + camRightX * lateralOffset,
      eyeY,
      eyeZ + camRightZ * lateralOffset
    );
    inspectTransition.current.startTarget.copy(cameraTarget.current);
    inspectTransition.current.targetTarget.set(
      pedX + camRightX * lateralOffset,
      pedY,
      pedZ + camRightZ * lateralOffset
    );
  }, []);

  const lastSelectedExhibitId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedExhibit && selectedExhibit.id !== lastSelectedExhibitId.current) {
      lastSelectedExhibitId.current = selectedExhibit.id;
      triggerInspectTransition(selectedExhibit);
    } else if (!selectedExhibit) {
      lastSelectedExhibitId.current = null;
      inspectTransition.current.active = false;
    }
  }, [selectedExhibit, triggerInspectTransition]);

  const lastResetTrigger = useRef(resetCameraTrigger);
  useEffect(() => {
    if (resetCameraTrigger > 0 && resetCameraTrigger !== lastResetTrigger.current) {
      lastResetTrigger.current = resetCameraTrigger;
      cameraVelocity.current.set(0, 0, 0);
      inspectTransition.current.active = false;

      resetTransition.current.active = true;
      resetTransition.current.startTime = performance.now();
      resetTransition.current.startPos.copy(cameraPos.current);

      if (currentStoryRef.current === 'exterior') {
        // From exterior, clicking Entrance returns visitor smoothly to store entrance
        triggerTeleport(1);
      } else {
        isElevatedHome.current = true;
        resetTransition.current.active = true;
        resetTransition.current.startTime = performance.now();
        resetTransition.current.startPos.copy(cameraPos.current);
        resetTransition.current.targetPos.set(0, 1.62, 13.0);
        resetTransition.current.startYaw = cameraYaw.current;
        let diff = Math.PI - (cameraYaw.current % (Math.PI * 2));
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        resetTransition.current.targetYaw = cameraYaw.current + diff;
        resetTransition.current.startPitch = cameraPitch.current;
        resetTransition.current.targetPitch = -0.06;
        targetYaw.current = resetTransition.current.targetYaw;
        targetPitch.current = -0.06;
        currentStoryRef.current = 1;
        onStoryChangeRef.current?.(1);
      }
    }
  }, [resetCameraTrigger]);

  // Smooth Teleport between Story 1 and Story 2 transition state (0.75s cubic ease-in-out)
  const teleportTransition = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    targetTarget: THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 0.75,
    startPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    targetTarget: new THREE.Vector3(),
  });

  const triggerTeleport = useCallback((targetStory: 1 | 2 | 'exterior') => {
    resetTransition.current.active = false;
    inspectTransition.current.active = false;
    isElevatedHome.current = false;
    cameraVelocity.current.set(0, 0, 0);

    let targetX = 0;
    let targetY = 1.62;
    let targetZ = 12.8;
    let lookTargetX = 0;
    let lookTargetY = 1.3;
    let lookTargetZ = 0;
    let targetYawVal = Math.PI;
    let targetPitchVal = -0.06;

    const isExteriorTransition =
      (currentStoryRef.current === 'exterior' && targetStory !== 'exterior') ||
      (currentStoryRef.current !== 'exterior' && targetStory === 'exterior');

    if (targetStory === 'exterior') {
      // Vantage point outside store on plaza looking at monolithic flagship building
      targetX = -15.2;
      targetY = 1.65;
      targetZ = 126.0;
      lookTargetX = -2.0;
      lookTargetY = 11.2;
      lookTargetZ = 96.0;
      targetYawVal = Math.atan2(lookTargetX - targetX, lookTargetZ - targetZ);
      const horiz = Math.hypot(lookTargetX - targetX, lookTargetZ - targetZ);
      targetPitchVal = Math.atan2(lookTargetY - targetY, horiz);
    } else if (targetStory === 2) {
      targetY = 6.0 + 1.62;
      targetZ = 10.5;
      lookTargetY = 6.0 + 1.45;
    } else {
      // Store entrance vantage point on Level 1 looking in toward exhibits
      targetX = 0;
      targetY = 1.62;
      targetZ = 13.0;
      lookTargetX = 0;
      lookTargetY = 1.3;
      lookTargetZ = 0;
      targetYawVal = Math.PI;
      targetPitchVal = -0.06;
    }

    if (isExteriorTransition) {
      // Seamless portal transition: smooth cinematic dip without flying 100 meters through void
      teleportTransition.current.active = false;
      doorFadeRef.current.active = true;
      doorFadeRef.current.startTime = performance.now();
      doorFadeRef.current.duration = 0.55;
      doorFadeRef.current.halfPassed = false;
      doorFadeRef.current.targetStory = targetStory;
      doorFadeRef.current.targetPos.set(targetX, targetY, targetZ);
      doorFadeRef.current.targetYaw = targetYawVal;
      doorFadeRef.current.targetPitch = targetPitchVal;
      doorFadeRef.current.label = targetStory === 'exterior' ? 'Store Exterior' : 'Store Entrance';
      setDoorFade({ active: true, opacity: 0.05, label: doorFadeRef.current.label });
    } else {
      teleportTransition.current.active = true;
      teleportTransition.current.startTime = performance.now();
      teleportTransition.current.duration = 0.85;
      teleportTransition.current.startPos.copy(cameraPos.current);
      teleportTransition.current.targetPos.set(targetX, targetY, targetZ);
      teleportTransition.current.startTarget.copy(cameraTarget.current);
      teleportTransition.current.targetTarget.set(lookTargetX, lookTargetY, lookTargetZ);

      targetYaw.current = targetYawVal;
      targetPitch.current = targetPitchVal;

      currentStoryRef.current = targetStory;
      onStoryChangeRef.current?.(targetStory);
    }
  }, []);

  const lastTeleportId = useRef<number | null>(null);
  useEffect(() => {
    if (teleportTargetStory && teleportTargetStory.id !== lastTeleportId.current) {
      lastTeleportId.current = teleportTargetStory.id;
      triggerTeleport(teleportTargetStory.story);
    }
  }, [teleportTargetStory, triggerTeleport]);

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

    // Double-height architectural perimeter walls (matching chic dusty blush rose matte plaster)
    const totalWallHeight = 12.2;
    createWall(0, totalWallHeight / 2, -18, 40, totalWallHeight, 1);
    // South Wall with architectural portal opening for store entrance door (opening: X: [-2.2, 2.2], Y: [0, 3.8])
    createWall(-11.1, totalWallHeight / 2, 18, 17.8, totalWallHeight, 1);
    createWall(11.1, totalWallHeight / 2, 18, 17.8, totalWallHeight, 1);
    createWall(0, 8.0, 18, 4.4, 8.4, 1);
    createWall(-18, totalWallHeight / 2, 0, 1, totalWallHeight, 40);
    createWall(18, totalWallHeight / 2, 0, 1, totalWallHeight, 40);

    // Interior Entrance Portal & Double Glass Doors
    // Clearly visible from inside the store on Level 1 looking toward South Wall (Z = 17.6)
    const interiorDoorGroup = new THREE.Group();
    interiorDoorGroup.name = 'InteriorEntranceDoor';

    const steelPortalMat = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      metalness: 0.88,
      roughness: 0.22,
    });

    const brushedMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd6dade,
      metalness: 0.94,
      roughness: 0.16,
    });

    // Outer portal frame casing lining the wall cutout
    const portalLeftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 1.05), steelPortalMat);
    portalLeftJamb.position.set(-2.15, 1.9, 18.0);
    interiorDoorGroup.add(portalLeftJamb);

    const portalRightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 1.05), steelPortalMat);
    portalRightJamb.position.set(2.15, 1.9, 18.0);
    interiorDoorGroup.add(portalRightJamb);

    const portalHeadReveal = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.25, 1.05), steelPortalMat);
    portalHeadReveal.position.set(0, 3.75, 18.0);
    interiorDoorGroup.add(portalHeadReveal);

    const portalThreshold = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.03, 1.05), steelPortalMat);
    portalThreshold.position.set(0, 0.015, 18.0);
    interiorDoorGroup.add(portalThreshold);

    // Double glass doors with architectural reflections and translucency
    const interiorDoorGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x182433,
      transparent: true,
      opacity: 0.68,
      roughness: 0.06,
      reflectivity: 0.88,
      clearcoat: 1.0,
      side: THREE.DoubleSide,
    });

    // Left and Right Glass Door Leaves
    const doorLeafGeo = new THREE.PlaneGeometry(1.92, 2.7);
    const leftDoorGlass = new THREE.Mesh(doorLeafGeo, interiorDoorGlassMat);
    leftDoorGlass.position.set(-0.98, 1.38, 17.62);
    interiorDoorGroup.add(leftDoorGlass);

    const rightDoorGlass = new THREE.Mesh(doorLeafGeo, interiorDoorGlassMat);
    rightDoorGlass.position.set(0.98, 1.38, 17.62);
    interiorDoorGroup.add(rightDoorGlass);

    // Upper transom glass window above doors
    const transomGeo = new THREE.PlaneGeometry(3.9, 0.72);
    const transomMesh = new THREE.Mesh(transomGeo, interiorDoorGlassMat);
    transomMesh.position.set(0, 3.16, 17.62);
    interiorDoorGroup.add(transomMesh);

    // Transom dividing mullion bar
    const mullionGeo = new THREE.BoxGeometry(4.0, 0.06, 0.07);
    const mullionMesh = new THREE.Mesh(mullionGeo, brushedMetalMat);
    mullionMesh.position.set(0, 2.76, 17.63);
    interiorDoorGroup.add(mullionMesh);

    // Center vertical dividing meeting stile between double doors
    const centerMullionGeo = new THREE.BoxGeometry(0.06, 2.74, 0.07);
    const centerMullion = new THREE.Mesh(centerMullionGeo, brushedMetalMat);
    centerMullion.position.set(0, 1.38, 17.63);
    interiorDoorGroup.add(centerMullion);

    // Vertical brushed stainless steel pull handles (distinct doorHandleGeo avoids collision)
    const doorHandleGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.4, 16);
    const handleLeft = new THREE.Mesh(doorHandleGeo, brushedMetalMat);
    handleLeft.position.set(-0.16, 1.38, 17.52);
    interiorDoorGroup.add(handleLeft);

    const handleRight = new THREE.Mesh(doorHandleGeo, brushedMetalMat);
    handleRight.position.set(0.16, 1.38, 17.52);
    interiorDoorGroup.add(handleRight);

    // Exterior outdoor daytime backdrop visible through the door glass
    const outdoorBackdropGeo = new THREE.PlaneGeometry(8, 6);
    const outdoorBackdropMat = new THREE.MeshBasicMaterial({
      color: 0x98c6eb,
      side: THREE.DoubleSide,
    });
    const outdoorBackdrop = new THREE.Mesh(outdoorBackdropGeo, outdoorBackdropMat);
    outdoorBackdrop.position.set(0, 2.4, 20.2);
    interiorDoorGroup.add(outdoorBackdrop);

    // Entrance mat in polished basalt on floor
    const matGeo = new THREE.BoxGeometry(4.2, 0.012, 2.0);
    const matMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b1b1e,
      roughness: 0.88,
      metalness: 0.05,
    });
    const entranceMat = new THREE.Mesh(matGeo, matMaterial);
    entranceMat.position.set(0, 0.006, 16.5);
    entranceMat.receiveShadow = true;
    interiorDoorGroup.add(entranceMat);

    // Signage above door: "SPLENDID MELANCHOLY"
    const interiorSignCanvas = document.createElement('canvas');
    interiorSignCanvas.width = 1024;
    interiorSignCanvas.height = 128;
    const isCtx = interiorSignCanvas.getContext('2d')!;
    isCtx.clearRect(0, 0, 1024, 128);
    isCtx.fillStyle = '#e8ebed';
    isCtx.font = 'bold 52px "Helvetica Neue", Helvetica, Arial, sans-serif';
    isCtx.textAlign = 'center';
    isCtx.textBaseline = 'middle';
    isCtx.letterSpacing = '0.22em';
    isCtx.fillText('SPLENDID MELANCHOLY', 512, 64);

    const interiorSignTexture = new THREE.CanvasTexture(interiorSignCanvas);
    const interiorSignGeo = new THREE.PlaneGeometry(3.2, 0.42);
    const interiorSignMat = new THREE.MeshStandardMaterial({
      map: interiorSignTexture,
      transparent: true,
      roughness: 0.25,
      metalness: 0.8,
    });
    const interiorSign = new THREE.Mesh(interiorSignGeo, interiorSignMat);
    interiorSign.position.set(0, 3.65, 17.64);
    interiorDoorGroup.add(interiorSign);

    // Soft daylight illumination entering from outside through the doorway
    const doorGlowLight = new THREE.PointLight(0xfff5ea, 0.75, 10, 1.4);
    doorGlowLight.position.set(0, 2.0, 16.8);
    interiorDoorGroup.add(doorGlowLight);

    scene.add(interiorDoorGroup);

    // STORY 2 FLOOR SLABS (Elevation Y = 6.0m, identical 36m x 36m footprint as Story 1)
    // Slabs feature an architectural cutout well for the staircase at X: [-14.6, -11.4], Z: [-6.8, 6.2]
    const createFloorSlab = (x: number, z: number, w: number, d: number) => {
      const slabGeo = new THREE.BoxGeometry(w, 0.22, d);
      const slabMesh = new THREE.Mesh(slabGeo, floorMat);
      slabMesh.position.set(x, 5.89, z);
      slabMesh.receiveShadow = true;
      slabMesh.matrixAutoUpdate = false;
      slabMesh.updateMatrix();
      scene.add(slabMesh);
      return slabMesh;
    };

    // 1. East main floor slab (29.4m wide x 36m deep)
    createFloorSlab(3.3, 0, 29.4, 36);
    // 2. West walkway perimeter slab (3.4m wide x 36m deep)
    createFloorSlab(-16.3, 0, 3.4, 36);
    // 3. North bridge connection beyond staircase (3.2m wide x 12.25m deep, meeting top step flush with zero gap)
    createFloorSlab(-13.0, -11.875, 3.2, 12.25);
    // 4. South bridge connection before staircase (3.2m wide x 11.8m deep)
    createFloorSlab(-13.0, 12.1, 3.2, 11.8);

    // Story 2 architectural slab grid joints (with lines cleanly removed only in the cut-out walkway region)
    const createStory2Grid = () => {
      const size = 44;
      const divisions = 22;
      const step = size / divisions;
      const halfSize = size / 2;

      const color1 = new THREE.Color(0xcab5b9);
      const color2 = new THREE.Color(0xd4c2c7);

      // Cut-out region bounds where the user walks through the stairwell opening:
      // X corridor from -14.6 to -11.4
      // Z opening from -6.05 (top step landing) to 6.2 (south floor edge)
      const cutXMin = -14.6;
      const cutXMax = -11.4;
      const cutZMin = -6.05;
      const cutZMax = 6.2;

      const positions: number[] = [];
      const colors: number[] = [];

      const addSegment = (x1: number, z1: number, x2: number, z2: number, col: THREE.Color) => {
        positions.push(x1, 0, z1, x2, 0, z2);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      };

      for (let i = 0, k = -halfSize; i <= divisions; i++, k += step) {
        const col = k === 0 ? color1 : color2;

        // Line parallel to X (constant Z = k, varying X from -halfSize to halfSize)
        const z = k;
        if (z >= cutZMin && z <= cutZMax) {
          // Exclude cut-out walkway between cutXMin and cutXMax
          if (cutXMin > -halfSize) {
            addSegment(-halfSize, z, cutXMin, z, col);
          }
          if (cutXMax < halfSize) {
            addSegment(cutXMax, z, halfSize, z, col);
          }
        } else {
          // Outside cut-out in Z: full line
          addSegment(-halfSize, z, halfSize, z, col);
        }

        // Line parallel to Z (constant X = k, varying Z from -halfSize to halfSize)
        const x = k;
        if (x >= cutXMin && x <= cutXMax) {
          // Exclude cut-out walkway between cutZMin and cutZMax
          if (cutZMin > -halfSize) {
            addSegment(x, -halfSize, x, cutZMin, col);
          }
          if (cutZMax < halfSize) {
            addSegment(x, cutZMax, x, halfSize, col);
          }
        } else {
          // Outside cut-out in X: full line
          addSegment(x, -halfSize, x, halfSize, col);
        }
      }

      const gridGeo = new THREE.BufferGeometry();
      gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const gridMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        toneMapped: false,
      });

      const gridMesh = new THREE.LineSegments(gridGeo, gridMat);
      gridMesh.position.set(0, 6.002, 0);
      gridMesh.matrixAutoUpdate = false;
      gridMesh.updateMatrix();
      return gridMesh;
    };

    const gridHelperStory2 = createStory2Grid();
    scene.add(gridHelperStory2);

    // Story 2 central circular polished stone inlay
    const centerInlayStory2 = new THREE.Mesh(centerInlayGeo, centerInlayMat);
    centerInlayStory2.rotation.x = -Math.PI / 2;
    centerInlayStory2.position.set(0, 6.003, 0);
    centerInlayStory2.receiveShadow = true;
    centerInlayStory2.matrixAutoUpdate = false;
    centerInlayStory2.updateMatrix();
    scene.add(centerInlayStory2);

    // Story 1 Ceiling Membrane (over main gallery wing)
    const ceiling1Geo = new THREE.PlaneGeometry(29.4, 36, 1, 1);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xfcf9f5,
      emissive: new THREE.Color(0xfff6ed),
      emissiveIntensity: 0.62,
      roughness: 0.22,
      metalness: 0.01,
    });
    const ceiling1 = new THREE.Mesh(ceiling1Geo, ceilingMat);
    ceiling1.position.set(3.3, 5.76, 0);
    ceiling1.rotation.x = Math.PI / 2;
    ceiling1.matrixAutoUpdate = false;
    ceiling1.updateMatrix();
    scene.add(ceiling1);

    // Story 2 Full Luminous Ceiling Membrane (36m x 36m at Y = 12.0m)
    const ceiling2Geo = new THREE.PlaneGeometry(36, 36, 1, 1);
    const ceiling2 = new THREE.Mesh(ceiling2Geo, ceilingMat);
    ceiling2.position.set(0, 12.0, 0);
    ceiling2.rotation.x = Math.PI / 2;
    ceiling2.matrixAutoUpdate = false;
    ceiling2.updateMatrix();
    scene.add(ceiling2);

    // GRAND ARCHITECTURAL FLOATING STAIRCASE
    // Rises from Z = 6.0 (Y = 0) up to Z = -6.0 (Y = 6.0) at X = -13.0 (Width = 2.6m)
    const staircaseGroup = new THREE.Group();
    const stepTreadGeo = new THREE.BoxGeometry(2.6, 0.08, 0.52);
    const stepTreadMat = new THREE.MeshStandardMaterial({
      color: 0xedf1f7,
      roughness: 0.22,
      metalness: 0.92,
    });
    const stepGlowGeo = new THREE.BoxGeometry(2.58, 0.015, 0.04);
    const stepGlowMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });

    const totalSteps = 24;
    const stepDepth = 12.0 / totalSteps;
    const stepRise = 6.0 / totalSteps;

    for (let i = 0; i < totalSteps; i++) {
      const stepY = (i + 1) * stepRise - 0.04;
      const stepZ = 6.0 - (i + 0.5) * stepDepth;

      const step = new THREE.Mesh(stepTreadGeo, stepTreadMat);
      step.position.set(-13.0, stepY, stepZ);
      step.receiveShadow = true;
      step.castShadow = true;
      step.matrixAutoUpdate = false;
      step.updateMatrix();
      staircaseGroup.add(step);

      // Warm architectural under-tread LED glow
      const stepGlow = new THREE.Mesh(stepGlowGeo, stepGlowMat);
      stepGlow.position.set(-13.0, stepY - 0.045, stepZ + 0.22);
      stepGlow.matrixAutoUpdate = false;
      stepGlow.updateMatrix();
      staircaseGroup.add(stepGlow);
    }

    // Architectural base riser under bottom step down to 1F floor (zero gap at base)
    const baseRiserGeo = new THREE.BoxGeometry(2.6, 0.17, 0.52);
    const baseRiser = new THREE.Mesh(baseRiserGeo, stepTreadMat);
    baseRiser.position.set(-13.0, 0.17 / 2, 5.75);
    baseRiser.receiveShadow = true;
    baseRiser.castShadow = true;
    baseRiser.matrixAutoUpdate = false;
    baseRiser.updateMatrix();
    staircaseGroup.add(baseRiser);

    // Glass Balustrades & Brushed Metal Railings
    const glassRailMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const railMetalMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde5,
      roughness: 0.2,
      metalness: 0.94,
    });

    // Guardrail panels surrounding the Story 2 stairwell void (mezzanine safety)
    // East edge of void (at X = -11.4, length 11.95m from Z = -5.75 to 6.2)
    const voidRailGeoEast = new THREE.BoxGeometry(0.04, 1.05, 11.95);
    const voidRailEast = new THREE.Mesh(voidRailGeoEast, glassRailMat);
    voidRailEast.position.set(-11.4, 6.0 + 1.05 / 2, 0.225);
    voidRailEast.matrixAutoUpdate = false;
    voidRailEast.updateMatrix();
    staircaseGroup.add(voidRailEast);

    const voidCapGeoEast = new THREE.BoxGeometry(0.08, 0.04, 11.95);
    const voidCapEast = new THREE.Mesh(voidCapGeoEast, railMetalMat);
    voidCapEast.position.set(-11.4, 6.0 + 1.05, 0.225);
    voidCapEast.matrixAutoUpdate = false;
    voidCapEast.updateMatrix();
    staircaseGroup.add(voidCapEast);

    // South edge of void (at Z = 6.2, width 3.2m)
    const voidRailGeoSouth = new THREE.BoxGeometry(3.2, 1.05, 0.04);
    const voidRailSouth = new THREE.Mesh(voidRailGeoSouth, glassRailMat);
    voidRailSouth.position.set(-13.0, 6.0 + 1.05 / 2, 6.2);
    voidRailSouth.matrixAutoUpdate = false;
    voidRailSouth.updateMatrix();
    staircaseGroup.add(voidRailSouth);

    const voidCapGeoSouth = new THREE.BoxGeometry(3.2, 0.04, 0.08);
    const voidCapSouth = new THREE.Mesh(voidCapGeoSouth, railMetalMat);
    voidCapSouth.position.set(-13.0, 6.0 + 1.05, 6.2);
    voidCapSouth.matrixAutoUpdate = false;
    voidCapSouth.updateMatrix();
    staircaseGroup.add(voidCapSouth);

    // West edge of void (at X = -14.6, length 11.95m from Z = -5.75 to 6.2)
    const voidRailGeoWest = new THREE.BoxGeometry(0.04, 1.05, 11.95);
    const voidRailWest = new THREE.Mesh(voidRailGeoWest, glassRailMat);
    voidRailWest.position.set(-14.6, 6.0 + 1.05 / 2, 0.225);
    voidRailWest.matrixAutoUpdate = false;
    voidRailWest.updateMatrix();
    staircaseGroup.add(voidRailWest);

    const voidCapGeoWest = new THREE.BoxGeometry(0.08, 0.04, 11.95);
    const voidCapWest = new THREE.Mesh(voidCapGeoWest, railMetalMat);
    voidCapWest.position.set(-14.6, 6.0 + 1.05, 0.225);
    voidCapWest.matrixAutoUpdate = false;
    voidCapWest.updateMatrix();
    staircaseGroup.add(voidCapWest);

    // Architectural floor kick-curb skirting along the void perimeter (safety barrier against slips)
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.6,
      metalness: 0.35,
    });
    const curbGeoSides = new THREE.BoxGeometry(0.06, 0.04, 11.95);
    const eastCurb = new THREE.Mesh(curbGeoSides, curbMat);
    eastCurb.position.set(-11.4, 6.0 + 0.02, 0.225);
    eastCurb.matrixAutoUpdate = false;
    eastCurb.updateMatrix();
    staircaseGroup.add(eastCurb);

    const westCurb = new THREE.Mesh(curbGeoSides, curbMat);
    westCurb.position.set(-14.6, 6.0 + 0.02, 0.225);
    westCurb.matrixAutoUpdate = false;
    westCurb.updateMatrix();
    staircaseGroup.add(westCurb);

    const curbGeoSouth = new THREE.BoxGeometry(3.2, 0.04, 0.06);
    const southCurb = new THREE.Mesh(curbGeoSouth, curbMat);
    southCurb.position.set(-13.0, 6.0 + 0.02, 6.2);
    southCurb.matrixAutoUpdate = false;
    southCurb.updateMatrix();
    staircaseGroup.add(southCurb);

    // Structural balustrade corner stanchions for realistic architectural stability
    const postGeo = new THREE.BoxGeometry(0.06, 1.07, 0.06);
    const cornerPositions = [
      [-14.6, 6.2],
      [-11.4, 6.2],
      [-14.6, -5.75],
      [-11.4, -5.75],
    ];
    cornerPositions.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, railMetalMat);
      post.position.set(px, 6.0 + 1.07 / 2, pz);
      post.matrixAutoUpdate = false;
      post.updateMatrix();
      staircaseGroup.add(post);
    });

    // Ascending glass balustrades & brushed handrails along both borders of the staircase
    const stairRun = 11.5;
    const stairRise = 5.76;
    const stairAngle = Math.atan2(stairRise, stairRun);
    const stairRailLength = Math.hypot(stairRun, stairRise);

    const stairGlassGeo = new THREE.BoxGeometry(0.025, 0.95, stairRailLength);
    const stairHandrailGeo = new THREE.BoxGeometry(0.06, 0.04, stairRailLength);

    [-14.32, -11.68].forEach((rx) => {
      // Incline safety glass panel
      const stairGlass = new THREE.Mesh(stairGlassGeo, glassRailMat);
      stairGlass.position.set(rx, 3.555, 0.0);
      stairGlass.rotation.x = stairAngle;
      stairGlass.matrixAutoUpdate = false;
      stairGlass.updateMatrix();
      staircaseGroup.add(stairGlass);

      // Incline brushed metal safety handrail
      const stairHandrail = new THREE.Mesh(stairHandrailGeo, railMetalMat);
      stairHandrail.position.set(rx, 4.05, 0.0);
      stairHandrail.rotation.x = stairAngle;
      stairHandrail.matrixAutoUpdate = false;
      stairHandrail.updateMatrix();
      staircaseGroup.add(stairHandrail);
    });

    scene.add(staircaseGroup);



    // Story 2 Dedicated Lighting
    const keyLight2 = new THREE.DirectionalLight(0xfff9ef, 0.78);
    keyLight2.position.set(4, 13.5, 4);
    keyLight2.castShadow = false;
    scene.add(keyLight2);

    const story2WallNorth = new THREE.PointLight(0xfff0ee, 0.45, 30, 1.3);
    story2WallNorth.position.set(0, 11.2, -15);
    scene.add(story2WallNorth);

    const story2WallSouth = new THREE.PointLight(0xfff0ee, 0.45, 30, 1.3);
    story2WallSouth.position.set(0, 11.2, 15);
    scene.add(story2WallSouth);

    const story2WallEast = new THREE.PointLight(0xfff2f0, 0.45, 30, 1.3);
    story2WallEast.position.set(15, 11.2, 0);
    scene.add(story2WallEast);

    const story2WallWest = new THREE.PointLight(0xfff2f0, 0.45, 30, 1.3);
    story2WallWest.position.set(-15, 11.2, 0);
    scene.add(story2WallWest);

    // Architectural Store Exterior (Waypoint building)
    buildStoreExterior(scene);

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
      // If primary mouse button is released outside or not held, instantly release dragging
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        if (isDragging.current) {
          isDragging.current = false;
          if (canvas.hasPointerCapture(e.pointerId)) {
            try {
              canvas.releasePointerCapture(e.pointerId);
            } catch (_) {}
          }
        }
      }

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
      // Only react to primary (left) button click
      if (e.button !== 0 && e.button !== undefined) return;
      isDragging.current = true;
      resetTransition.current.active = false;
      inspectTransition.current.active = false;
      updateRect();
      dragStart.current = { x: e.clientX, y: e.clientY };
      dragDistance.current = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = dragDistance.current;
      isDragging.current = false;

      if (canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }

      // Only treat as a click if mouse didn't drag substantially
      if (dist < 6) {
        raycaster.setFromCamera(mousePointer.current, camera);
        const intersects = raycaster.intersectObjects(colliders, false);

        if (intersects.length > 0) {
          const hit = intersects[0];
          const hitExhibitId = hit.object.userData?.exhibitId;
          const found = EXHIBITS.find((ex) => ex.id === hitExhibitId);
          if (found) {
            onSelectExhibitRef.current(found);
            onNavigationModeChangeRef.current('inspecting');
            triggerInspectTransition(found);
          }
        } else {
          if (navModeRef.current === 'inspecting' || navModeRef.current === 'counter') {
            onNavigationModeChangeRef.current('free');
            onSelectExhibitRef.current(null);
          }
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      isDragging.current = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    const onPointerLeave = () => {
      // When cursor leaves canvas and isn't actively dragging, clear hover and reset cursor
      if (!isDragging.current) {
        mousePointer.current.set(-10, -10);
        if (lastHoveredExhibit !== null) {
          lastHoveredExhibit = null;
          onHoverExhibitRef.current(null);
        }
        canvas.style.cursor = 'default';
      }
    };

    const onBlur = () => {
      isDragging.current = false;
      keysPressed.current = {};
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
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('lostpointercapture', onPointerCancel);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur', onBlur);
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
        let detectedHovered: ExhibitItem | null = null;
        if (Math.abs(mousePointer.current.x) <= 1 && Math.abs(mousePointer.current.y) <= 1) {
          raycaster.setFromCamera(mousePointer.current, camera);
          const hoveredIntersects = raycaster.intersectObjects(colliders, false);
          if (hoveredIntersects.length > 0) {
            const topHit = hoveredIntersects[0];
            const hoveredId = topHit.object.userData?.exhibitId;
            detectedHovered = EXHIBITS.find((ex) => ex.id === hoveredId) || null;
          }
        }

        if (detectedHovered?.id !== lastHoveredExhibit?.id) {
          lastHoveredExhibit = detectedHovered;
          onHoverExhibitRef.current(detectedHovered);
        }

        if (Math.abs(mousePointer.current.x) <= 1 && Math.abs(mousePointer.current.y) <= 1) {
          canvas.style.cursor = detectedHovered ? 'pointer' : isDragging.current ? 'grabbing' : 'grab';
        }
      }

      // Seamless Portal Fade Transition between Exterior and Interior
      if (doorFadeRef.current.active) {
        const elapsed = (time - doorFadeRef.current.startTime) / 1000;
        const progress = Math.min(elapsed / doorFadeRef.current.duration, 1);
        const opacity = progress < 0.45 ? progress / 0.45 : 1 - (progress - 0.45) / 0.55;
        setDoorFade((prev) => ({ ...prev, active: true, opacity: Math.max(0, Math.min(1, opacity)) }));

        if (progress >= 0.45 && !doorFadeRef.current.halfPassed) {
          doorFadeRef.current.halfPassed = true;
          cameraPos.current.copy(doorFadeRef.current.targetPos);
          camera.position.copy(doorFadeRef.current.targetPos);
          targetYaw.current = doorFadeRef.current.targetYaw;
          cameraYaw.current = doorFadeRef.current.targetYaw;
          targetPitch.current = doorFadeRef.current.targetPitch;
          cameraPitch.current = doorFadeRef.current.targetPitch;
          cameraVelocity.current.set(0, 0, 0);
          currentStoryRef.current = doorFadeRef.current.targetStory;
          onStoryChangeRef.current?.(doorFadeRef.current.targetStory);
        }

        if (progress >= 1) {
          doorFadeRef.current.active = false;
          setDoorFade({ active: false, opacity: 0, label: '' });
        }
      }

      // Smooth Camera Navigation Updates
      if (teleportTransition.current.active) {
        const elapsed = (time - teleportTransition.current.startTime) / 1000;
        const progress = Math.min(elapsed / teleportTransition.current.duration, 1);
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        cameraPos.current.lerpVectors(
          teleportTransition.current.startPos,
          teleportTransition.current.targetPos,
          ease
        );
        cameraTarget.current.lerpVectors(
          teleportTransition.current.startTarget,
          teleportTransition.current.targetTarget,
          ease
        );

        camera.position.copy(cameraPos.current);
        camera.lookAt(cameraTarget.current);

        const tDx = cameraTarget.current.x - cameraPos.current.x;
        const tDy = cameraTarget.current.y - cameraPos.current.y;
        const tDz = cameraTarget.current.z - cameraPos.current.z;
        targetYaw.current = Math.atan2(tDx, tDz);
        cameraYaw.current = targetYaw.current;
        const horizDist = Math.hypot(tDx, tDz);
        targetPitch.current = Math.atan2(tDy, horizDist);
        cameraPitch.current = targetPitch.current;

        if (progress >= 1) {
          teleportTransition.current.active = false;
          cameraVelocity.current.set(0, 0, 0);
          if (currentStoryRef.current !== 'exterior') {
            const detectedStory = cameraPos.current.y >= 3.8 ? 2 : 1;
            if (currentStoryRef.current !== detectedStory) {
              currentStoryRef.current = detectedStory;
              onStoryChangeRef.current?.(detectedStory);
            }
          }
        }
      } else if (resetTransition.current.active) {
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
        let isMoving = false;
        if (currentStoryRef.current === 'exterior') {
          // In exterior mode: users cannot walk around; camera is locked at the viewpoint to admire the store
          cameraVelocity.current.set(0, 0, 0);
          cameraPos.current.set(-15.2, 1.65, 126.0);
        } else {
          forwardVector.set(Math.sin(cameraYaw.current), 0, Math.cos(cameraYaw.current));
          rightVector.set(-Math.cos(cameraYaw.current), 0, Math.sin(cameraYaw.current));

          moveDirection.set(0, 0, 0);
          const keys = keysPressed.current;
          if (keys['KeyW'] || keys['ArrowUp']) moveDirection.add(forwardVector);
          if (keys['KeyS'] || keys['ArrowDown']) moveDirection.sub(forwardVector);
          if (keys['KeyA'] || keys['ArrowLeft']) moveDirection.sub(rightVector);
          if (keys['KeyD'] || keys['ArrowRight']) moveDirection.add(rightVector);

          isMoving = moveDirection.lengthSq() > 0;
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
        }

        if (currentStoryRef.current !== 'exterior') {
          cameraPos.current.x = Math.max(-15.5, Math.min(15.5, cameraPos.current.x));

          // Seamless Door Walk-through from interior to exterior
          // If the visitor walks towards the entrance door on Level 1 (X: [-2.0, 2.0], Z >= 16.5)
          const isAtInteriorDoor = cameraPos.current.x >= -2.0 && cameraPos.current.x <= 2.0;
          if (isAtInteriorDoor && cameraPos.current.z >= 16.5 && cameraPos.current.y <= 2.5) {
            if (time - lastDoorTransitionTime.current > 1600 && !teleportTransition.current.active && !doorFadeRef.current.active) {
              lastDoorTransitionTime.current = time;
              triggerTeleport('exterior');
            }
          }

          const maxZ = isAtInteriorDoor ? 17.5 : 15.5;
          cameraPos.current.z = Math.max(-15.5, Math.min(maxZ, cameraPos.current.z));

          // Calculate ground elevation smoothly without any glitching
          // Staircase corridor: X centered at -13.0, runs between Z = 6.0 (bottom, 1F) and Z = -6.0 (top, 2F)
          const onStairs = cameraPos.current.x >= -14.4 &&
                           cameraPos.current.x <= -11.6 &&
                           cameraPos.current.z >= -6.2 &&
                           cameraPos.current.z <= 6.2;

          let groundY = 0;
          if (onStairs) {
            // Continuous, seamless slope up the stairs from 0.0 to 6.0
            const stairProgress = THREE.MathUtils.clamp((6.0 - cameraPos.current.z) / 12.0, 0, 1);
            groundY = stairProgress * 6.0;

            // Keep player safely within stair walkway width
            cameraPos.current.x = THREE.MathUtils.clamp(cameraPos.current.x, -14.1, -11.9);
          } else if (cameraPos.current.y >= 3.6) {
            // On Story 2 floor (Elevation 6.0m)
            groundY = 6.0;

            // Mezzanine perimeter safety borders: Prevent stepping through glass balustrades into the stairwell opening
            // East guardrail border (at X = -11.4): Keep visitor safely on the east floor
            if (cameraPos.current.z > -5.75 && cameraPos.current.z < 6.35) {
              if (cameraPos.current.x < -11.15 && cameraPos.current.x >= -13.0) {
                cameraPos.current.x = -11.15;
              }
            }

            // West guardrail border (at X = -14.6): Keep visitor safely on the west walkway
            if (cameraPos.current.z > -5.75 && cameraPos.current.z < 6.35) {
              if (cameraPos.current.x > -14.85 && cameraPos.current.x <= -13.0) {
                cameraPos.current.x = -14.85;
              }
            }

            // South guardrail border (at Z = 6.2): Keep visitor safely on the south bridge
            if (cameraPos.current.x > -14.85 && cameraPos.current.x < -11.15) {
              if (cameraPos.current.z < 6.45 && cameraPos.current.z >= 5.0) {
                cameraPos.current.z = 6.45;
              }
            }

            // North stair entrance safety: guide into stair walkway channel
            if (cameraPos.current.z > -5.85 && (cameraPos.current.x < -14.2 || cameraPos.current.x > -11.8)) {
              if (cameraPos.current.x <= -14.2 && cameraPos.current.x > -15.5) {
                cameraPos.current.x = -14.85;
              } else if (cameraPos.current.x >= -11.8 && cameraPos.current.x < -10.5) {
                cameraPos.current.x = -11.15;
              }
            }
          } else {
            // On Story 1 floor (Ground level 0.0m)
            groundY = 0.0;

            // Ground floor stair clearance safety: Prevent walking into low staircase underside from the sides
            if (cameraPos.current.z >= 2.0 && cameraPos.current.z <= 6.2 && !onStairs) {
              if (cameraPos.current.x > -14.5 && cameraPos.current.x < -13.0) {
                cameraPos.current.x = -14.6;
              } else if (cameraPos.current.x >= -13.0 && cameraPos.current.x < -11.5) {
                cameraPos.current.x = -11.4;
              }
            }
          }

          const targetEyeY = (isElevatedHome.current && groundY === 0)
            ? 2.8
            : groundY + 1.62;

          // Ultra-smooth, responsive vertical follow with zero lag or pop
          cameraPos.current.y += (targetEyeY - cameraPos.current.y) * (1 - Math.exp(-14.0 * delta));

          // Update current story state if user walked up or down the stairs on foot
          const activeStory = groundY >= 3.0 ? 2 : 1;
          if (activeStory !== currentStoryRef.current) {
            currentStoryRef.current = activeStory;
            onStoryChangeRef.current?.(activeStory);
          }
        }

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
          if (inspectTransition.current.active) {
            const elapsed = (time - inspectTransition.current.startTime) / 1000;
            const progress = Math.min(elapsed / inspectTransition.current.duration, 1);
            // High frame-rate cubic ease-out for immediate responsive start and smooth arrival
            const ease = 1 - Math.pow(1 - progress, 3);

            cameraPos.current.lerpVectors(
              inspectTransition.current.startPos,
              inspectTransition.current.targetPos,
              ease
            );
            cameraTarget.current.lerpVectors(
              inspectTransition.current.startTarget,
              inspectTransition.current.targetTarget,
              ease
            );

            camera.position.copy(cameraPos.current);
            camera.lookAt(cameraTarget.current);

            targetYaw.current = Math.atan2(
              cameraTarget.current.x - cameraPos.current.x,
              cameraTarget.current.z - cameraPos.current.z
            );
            cameraYaw.current = targetYaw.current;

            if (progress >= 1) {
              inspectTransition.current.active = false;
            }
          } else {
            // Interactive orbit with silky exponential damping in lockstep
            const orbitDamp = 1 - Math.exp(-18 * delta);
            inspectOrbitAngle.current += (targetOrbitAngle.current - inspectOrbitAngle.current) * orbitDamp;
            inspectOrbitPitch.current += (targetOrbitPitch.current - inspectOrbitPitch.current) * orbitDamp;

            const pedX = activeExhibit.position[0];
            const pedY = 1.22;
            const pedZ = activeExhibit.position[2];

            const orbitRadius = 1.65;
            const eyeY = pedY + Math.sin(inspectOrbitPitch.current) * orbitRadius;
            const eyeHorizontalDist = Math.cos(inspectOrbitPitch.current) * orbitRadius;
            const eyeX = pedX + Math.sin(inspectOrbitAngle.current) * eyeHorizontalDist;
            const eyeZ = pedZ + Math.cos(inspectOrbitAngle.current) * eyeHorizontalDist;

            const camRightX = Math.cos(inspectOrbitAngle.current);
            const camRightZ = -Math.sin(inspectOrbitAngle.current);
            const lateralOffset = (container.clientWidth >= 768) ? 0.38 : 0;

            cameraPos.current.set(
              eyeX + camRightX * lateralOffset,
              eyeY,
              eyeZ + camRightZ * lateralOffset
            );

            cameraTarget.current.set(
              pedX + camRightX * lateralOffset,
              pedY,
              pedZ + camRightZ * lateralOffset
            );

            camera.position.copy(cameraPos.current);
            camera.lookAt(cameraTarget.current);

            targetYaw.current = Math.atan2(
              cameraTarget.current.x - cameraPos.current.x,
              cameraTarget.current.z - cameraPos.current.z
            );
            cameraYaw.current = targetYaw.current;
          }
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

        node.currentHoverProgress += ((isHovered ? 1 : 0) - node.currentHoverProgress) * (1 - Math.exp(-10 * delta));
        node.currentSelectProgress += ((isSelected ? 1 : 0) - node.currentSelectProgress) * (1 - Math.exp(-8 * delta));

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
        node.keySpotlight.intensity += (targetKeyIntensity - node.keySpotlight.intensity) * (1 - Math.exp(-9 * delta));

        const targetRimIntensity = isSelected ? 1.05 : isHovered ? 0.8 : 0.55;
        node.rimSpotlight.intensity += (targetRimIntensity - node.rimSpotlight.intensity) * (1 - Math.exp(-9 * delta));
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
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('lostpointercapture', onPointerCancel);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);

      renderer.dispose();
      pedestalBaseGeo.dispose();
      pedestalCapGeo.dispose();
      haloGeo.dispose();
      riserGeo.dispose();
      floorGeo.dispose();
      centerInlayGeo.dispose();
      ceiling1Geo.dispose();
      ceiling2Geo.dispose();
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
    if (currentStoryRef.current === 'exterior') {
      cameraPos.current.set(-15.2, 3.6, 126.0);
      const lookAt = new THREE.Vector3(-2.0, 11.2, 96.0);
      cameraTarget.current.copy(lookAt);
      targetYaw.current = Math.atan2(lookAt.x - (-15.2), lookAt.z - 126.0);
      cameraYaw.current = targetYaw.current;
      targetPitch.current = 0.22;
      cameraPitch.current = 0.22;
      cameraVelocity.current.set(0, 0, 0);
    } else {
      isElevatedHome.current = true;
      cameraPos.current.set(0, 2.8, 13.0);
      targetYaw.current = Math.PI;
      cameraYaw.current = Math.PI;
      targetPitch.current = -0.16;
      cameraPitch.current = -0.16;
      cameraVelocity.current.set(0, 0, 0);
    }
  }, [onNavigationModeChange, onSelectExhibit]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Seamless Portal Transition Overlay between Exterior and Interior */}
      {doorFade.active && (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center transition-opacity"
          style={{
            backgroundColor: `rgba(18, 18, 22, ${doorFade.opacity})`,
          }}
        >
          {doorFade.opacity > 0.45 && (
            <div className="flex flex-col items-center gap-2 select-none animate-fade-in">
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-stone-200">
                {doorFade.label}
              </span>
              <div className="w-6 h-px bg-stone-500/70" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
