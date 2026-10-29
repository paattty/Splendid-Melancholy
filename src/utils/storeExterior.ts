import * as THREE from 'three';

/**
 * Procedural generation of the authentic architectural exterior for Splendid Melancholy.
 *
 * Monolithic stacked red Roman brick flagship building:
 * - Stacked narrow terracotta red Roman brick facade with mortar joints and stone parapet coping
 * - Stepped right wing with circular portal window and upper slit window
 * - Modern recessed glass entrance portal with brushed steel double doors, handles, interior ambient glow
 * - Dimensional brushed metallic brand signage "SPLENDID MELANCHOLY" and directory plaque
 * - Low red brick forecourt wall along the walkway
 * - Lush surrounding deciduous green trees
 * - Realistic daytime sky dome and warm directional sunlight
 * - Expansive paved plaza ground
 */

// Generate high-resolution procedural stacked red Roman brick texture
function createBrickTexture(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 1024;
  bumpCanvas.height = 1024;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base mortar color
  ctx.fillStyle = '#2e1614';
  ctx.fillRect(0, 0, 1024, 1024);

  bCtx.fillStyle = '#222222';
  bCtx.fillRect(0, 0, 1024, 1024);

  const numRows = 32;
  const rowHeight = 1024 / numRows;
  const mortar = 2.5;

  const brickPalette = [
    '#8d352e',
    '#9c3e36',
    '#a8453d',
    '#832f28',
    '#943831',
    '#7c2b25',
    '#a14138',
    '#8f3730',
  ];

  for (let r = 0; r < numRows; r++) {
    const y = r * rowHeight + mortar;
    const h = rowHeight - mortar;
    const isOdd = r % 2 === 1;
    const brickWidth = 1024 / 8;
    const offsetX = isOdd ? brickWidth / 2 : 0;

    for (let x = -brickWidth; x < 1024 + brickWidth; x += brickWidth) {
      const bx = x + offsetX + mortar;
      const bw = brickWidth - mortar;

      const color = brickPalette[Math.floor(Math.random() * brickPalette.length)];
      ctx.fillStyle = color;
      ctx.fillRect(bx, y, bw, h);

      // Subtle surface speckling
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let p = 0; p < 12; p++) {
        const px = bx + Math.random() * bw;
        const py = y + Math.random() * h;
        ctx.fillRect(px, py, 2, 1);
      }

      // Bump map: white bricks, dark mortar
      const bumpVal = Math.floor(180 + Math.random() * 60);
      bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
      bCtx.fillRect(bx, y, bw, h);
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;

  return { map, bump };
}

// Generate the 360-degree spherical sky texture
function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, 1024);
  skyGrad.addColorStop(0, '#2466ac');    // Deep zenith blue
  skyGrad.addColorStop(0.28, '#4d8ecd'); // Bright azure
  skyGrad.addColorStop(0.55, '#85bee8'); // Low sky
  skyGrad.addColorStop(0.70, '#cce4f5'); // Horizon atmospheric haze
  skyGrad.addColorStop(0.78, '#524c4e'); // Horizon transition line
  skyGrad.addColorStop(1.0, '#282528');  // Ground base
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Soft scattered cumulus clouds in the upper sky
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  const drawCloud = (cx: number, cy: number, scale: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 70 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 60 * scale, cy - 20 * scale, 85 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 140 * scale, cy - 10 * scale, 75 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 200 * scale, cy + 15 * scale, 55 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 90 * scale, cy + 30 * scale, 65 * scale, 0, Math.PI * 2);
    ctx.fill();
  };

  drawCloud(180, 240, 1.3);
  drawCloud(620, 180, 1.5);
  drawCloud(860, 360, 1.1);
  drawCloud(340, 420, 0.95);

  return new THREE.CanvasTexture(canvas);
}

// Helper to create leafy natural tree cluster
function createTree(x: number, y: number, z: number, scale: number = 1.0): THREE.Group {
  const treeGroup = new THREE.Group();
  treeGroup.position.set(x, y, z);

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.22 * scale, 0.38 * scale, 5.5 * scale, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d3128,
    roughness: 0.95,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = (5.5 * scale) / 2;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  // Multi-layered lush foliage spheres
  const foliageMat1 = new THREE.MeshStandardMaterial({
    color: 0x3a5a2b,
    roughness: 0.85,
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: 0x4d7539,
    roughness: 0.82,
  });
  const foliageMat3 = new THREE.MeshStandardMaterial({
    color: 0x2e4822,
    roughness: 0.88,
  });

  const clusterOffsets = [
    { pos: [0, 5.2, 0], r: 2.4, mat: foliageMat1 },
    { pos: [-1.1, 4.6, 0.8], r: 1.9, mat: foliageMat2 },
    { pos: [1.2, 4.8, -0.6], r: 2.1, mat: foliageMat3 },
    { pos: [0.3, 6.4, 0.2], r: 1.8, mat: foliageMat1 },
    { pos: [-0.6, 5.8, -0.9], r: 1.7, mat: foliageMat2 },
  ];

  clusterOffsets.forEach(({ pos, r, mat }) => {
    const geo = new THREE.DodecahedronGeometry(r * scale, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0] * scale, pos[1] * scale, pos[2] * scale);
    mesh.castShadow = true;
    treeGroup.add(mesh);
  });

  return treeGroup;
}

/**
 * Builds the monolithic store exterior in the 3D scene.
 * Clean, sculptural red Roman brick architecture without billboards, cantilever overhangs, or side window boxes.
 */
export function buildStoreExterior(scene: THREE.Scene): THREE.Group {
  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'StoreExteriorGroup';

  // 1. Textures & Materials
  const { map: brickMap, bump: brickBump } = createBrickTexture();
  brickMap.repeat.set(5, 9);
  brickBump.repeat.set(5, 9);

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickMap,
    bumpMap: brickBump,
    bumpScale: 0.045,
    roughness: 0.82,
    metalness: 0.04,
  });

  // Dark stone / concrete trim material
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x282527,
    roughness: 0.88,
    metalness: 0.12,
  });

  // Brushed aluminum/stainless steel
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xd8dade,
    metalness: 0.92,
    roughness: 0.22,
  });

  // 2. Plaza Ground (Paved concrete & asphalt street)
  const plazaGeo = new THREE.PlaneGeometry(90, 90);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0x2a282b,
    roughness: 0.9,
    metalness: 0.06,
  });
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(-6, -0.02, 110);
  plazaMesh.receiveShadow = true;
  exteriorGroup.add(plazaMesh);

  // Subtle lighter pedestrian walkway pavers
  const walkwayGeo = new THREE.PlaneGeometry(16, 40);
  const walkwayMat = new THREE.MeshStandardMaterial({
    color: 0x444246,
    roughness: 0.85,
  });
  const walkwayMesh = new THREE.Mesh(walkwayGeo, walkwayMat);
  walkwayMesh.rotation.x = -Math.PI / 2;
  walkwayMesh.position.set(-2, 0.01, 118);
  walkwayMesh.receiveShadow = true;
  exteriorGroup.add(walkwayMesh);

  // 3. Main Red Brick Building Massing (Width 18m, Height 26m, Depth 22m)
  // Clean monolithic brick facade
  const mainBuildingGeo = new THREE.BoxGeometry(18, 26, 22);
  const mainBuilding = new THREE.Mesh(mainBuildingGeo, brickMat);
  mainBuilding.position.set(-1.0, 13.0, 91.0);
  mainBuilding.castShadow = true;
  mainBuilding.receiveShadow = true;
  exteriorGroup.add(mainBuilding);

  // Roof parapet coping cap
  const roofCapGeo = new THREE.BoxGeometry(18.4, 0.4, 22.4);
  const roofCap = new THREE.Mesh(roofCapGeo, darkStoneMat);
  roofCap.position.set(-1.0, 26.15, 91.0);
  exteriorGroup.add(roofCap);

  // 4. Ground Level Store Entrance Portal & Modernist Signage (Z = 102.1)
  // Identical architectural design, dimensions, and materials as the interior entrance door
  const entranceGroup = new THREE.Group();
  entranceGroup.position.set(2.2, 0, 102.1);

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

  // Outer portal frame casing lining the entrance portal
  const portalLeftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.65), steelPortalMat);
  portalLeftJamb.position.set(-2.15, 1.9, 0);
  entranceGroup.add(portalLeftJamb);

  const portalRightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.65), steelPortalMat);
  portalRightJamb.position.set(2.15, 1.9, 0);
  entranceGroup.add(portalRightJamb);

  const portalHeadReveal = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.25, 0.65), steelPortalMat);
  portalHeadReveal.position.set(0, 3.75, 0);
  entranceGroup.add(portalHeadReveal);

  const portalThreshold = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.03, 0.65), steelPortalMat);
  portalThreshold.position.set(0, 0.015, 0);
  entranceGroup.add(portalThreshold);

  // Double glass doors with architectural charcoal tint and frosted satin diffusion
  const doorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x14181f,       // Deep architectural charcoal-tinted glass
    transparent: true,
    opacity: 0.78,         // Visibly tinted and frosted
    roughness: 0.44,       // Silky satin frosted diffusion
    metalness: 0.08,
    reflectivity: 0.90,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    side: THREE.DoubleSide,
  });

  // Left and Right Glass Door Leaves
  const doorLeafGeo = new THREE.PlaneGeometry(1.92, 2.7);
  const leftDoorGlass = new THREE.Mesh(doorLeafGeo, doorGlassMat);
  leftDoorGlass.position.set(-0.98, 1.38, 0.12);
  entranceGroup.add(leftDoorGlass);

  const rightDoorGlass = new THREE.Mesh(doorLeafGeo, doorGlassMat);
  rightDoorGlass.position.set(0.98, 1.38, 0.12);
  entranceGroup.add(rightDoorGlass);

  // Upper transom glass window above doors
  const transomGeo = new THREE.PlaneGeometry(3.9, 0.72);
  const transomMesh = new THREE.Mesh(transomGeo, doorGlassMat);
  transomMesh.position.set(0, 3.16, 0.12);
  entranceGroup.add(transomMesh);

  // Transom dividing mullion bar
  const mullionGeo = new THREE.BoxGeometry(4.0, 0.06, 0.07);
  const mullionMesh = new THREE.Mesh(mullionGeo, brushedMetalMat);
  mullionMesh.position.set(0, 2.76, 0.13);
  entranceGroup.add(mullionMesh);

  // Center vertical dividing meeting stile between double doors
  const centerMullionGeo = new THREE.BoxGeometry(0.06, 2.74, 0.07);
  const centerMullion = new THREE.Mesh(centerMullionGeo, brushedMetalMat);
  centerMullion.position.set(0, 1.38, 0.13);
  entranceGroup.add(centerMullion);

  // Vertical brushed stainless steel pull handles
  const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.4, 16);
  const handleLeft = new THREE.Mesh(handleGeo, brushedMetalMat);
  handleLeft.position.set(-0.16, 1.38, 0.22);
  entranceGroup.add(handleLeft);

  const handleRight = new THREE.Mesh(handleGeo, brushedMetalMat);
  handleRight.position.set(0.16, 1.38, 0.22);
  entranceGroup.add(handleRight);

  // Entrance mat in polished basalt on walkway floor
  const matGeo = new THREE.BoxGeometry(4.2, 0.012, 2.0);
  const matMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1b1e,
    roughness: 0.88,
    metalness: 0.05,
  });
  const entranceMat = new THREE.Mesh(matGeo, matMaterial);
  entranceMat.position.set(0, 0.006, 1.1);
  entranceMat.receiveShadow = true;
  entranceGroup.add(entranceMat);

  // Subtle warm interior light glowing through the glass entrance doors
  const entranceGlow = new THREE.PointLight(0xffecd2, 1.4, 8);
  entranceGlow.position.set(0, 1.9, -0.3);
  entranceGroup.add(entranceGlow);

  exteriorGroup.add(entranceGroup);

  // Dimensional brushed metallic brand signage above entrance: "SPLENDID MELANCHOLY"
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext('2d')!;
  sCtx.clearRect(0, 0, 1024, 128);
  sCtx.fillStyle = '#e4e7eb';
  sCtx.font = 'bold 56px "Helvetica Neue", Helvetica, Arial, sans-serif';
  sCtx.textAlign = 'center';
  sCtx.textBaseline = 'middle';
  sCtx.letterSpacing = '0.22em';
  sCtx.fillText('SPLENDID MELANCHOLY', 512, 64);

  const signTexture = new THREE.CanvasTexture(signCanvas);
  const signGeo = new THREE.PlaneGeometry(4.2, 0.55);
  const signMat = new THREE.MeshStandardMaterial({
    map: signTexture,
    transparent: true,
    roughness: 0.25,
    metalness: 0.85,
  });
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(2.2, 4.4, 102.16);
  exteriorGroup.add(signMesh);

  // Architectural directory / hours plaque next to door
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 256;
  plaqueCanvas.height = 512;
  const pCtx = plaqueCanvas.getContext('2d')!;
  pCtx.fillStyle = '#1e1c1d';
  pCtx.fillRect(0, 0, 256, 512);
  pCtx.fillStyle = '#a6a29e';
  pCtx.font = '22px monospace';
  pCtx.fillText('SPLENDID', 24, 60);
  pCtx.fillText('MELANCHOLY', 24, 90);
  pCtx.font = '16px monospace';
  pCtx.fillText('FLAGSHIP SEOUL', 24, 140);
  pCtx.fillText('11:00 - 21:00', 24, 180);
  pCtx.fillText('LEVEL 01 / 02', 24, 220);

  const plaqueTexture = new THREE.CanvasTexture(plaqueCanvas);
  const plaqueGeo = new THREE.PlaneGeometry(0.45, 0.9);
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTexture,
    roughness: 0.6,
  });
  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
  plaqueMesh.position.set(5.1, 2.2, 102.14);
  exteriorGroup.add(plaqueMesh);

  // 6. Low Red Brick Boundary Wall along the Forecourt Walkway (Foreground Right)
  const forecourtWallGeo = new THREE.BoxGeometry(0.48, 1.35, 16.0);
  const forecourtWall = new THREE.Mesh(forecourtWallGeo, brickMat);
  forecourtWall.position.set(7.1, 1.35 / 2, 110.0);
  forecourtWall.castShadow = true;
  forecourtWall.receiveShadow = true;
  exteriorGroup.add(forecourtWall);

  // Wall granite cap
  const forecourtCapGeo = new THREE.BoxGeometry(0.58, 0.12, 16.2);
  const forecourtCap = new THREE.Mesh(forecourtCapGeo, darkStoneMat);
  forecourtCap.position.set(7.1, 1.35 + 0.06, 110.0);
  exteriorGroup.add(forecourtCap);

  // 7. Surrounding Deciduous Green Trees
  // Left corner background trees
  exteriorGroup.add(createTree(-17.0, 0, 94.0, 1.35));
  exteriorGroup.add(createTree(-19.5, 0, 84.0, 1.5));
  exteriorGroup.add(createTree(-14.0, 0, 78.0, 1.25));

  // Right wing background trees
  exteriorGroup.add(createTree(17.5, 0, 88.0, 1.4));
  exteriorGroup.add(createTree(21.0, 0, 98.0, 1.55));
  exteriorGroup.add(createTree(18.0, 0, 112.0, 1.3));

  // 8. Expansive 360-degree Daytime Sky Sphere (No clipping, no bubble effect)
  const skyTexture = createSkyTexture();
  const skyGeo = new THREE.SphereGeometry(320, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.position.set(-2, 0, 100);
  exteriorGroup.add(skyDome);

  // 9. Outdoor Daylight & Warm Sun Lighting
  const outdoorHemi = new THREE.HemisphereLight(0x9fd2f6, 0x42342b, 1.1);
  outdoorHemi.position.set(0, 50, 95);
  exteriorGroup.add(outdoorHemi);

  const sunLight = new THREE.DirectionalLight(0xfff7e8, 1.95);
  sunLight.position.set(38, 54, 125);
  sunLight.target = mainBuilding;
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.camera.left = -30;
  sunLight.shadow.camera.right = 30;
  sunLight.shadow.camera.top = 35;
  sunLight.shadow.camera.bottom = -15;
  sunLight.shadow.bias = -0.0005;
  exteriorGroup.add(sunLight);

  scene.add(exteriorGroup);
  return exteriorGroup;
}
