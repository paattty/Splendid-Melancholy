import { ExhibitItem } from '../types/gallery';

export const EXHIBITS: ExhibitItem[] = [
  {
    id: 'sm-01',
    number: '01',
    title: 'Silent Equilibrium',
    subtitle: 'Beta-Titanium Optical Architecture',
    category: 'Optical Wireframe',
    season: 'Autumn / Winter 2026',
    price: 460,
    materials: ['Japanese Beta-Titanium', 'Cold-rolled Silver Alloy', 'Silicone Air-pads'],
    dimensions: '48 □ 21 - 145 mm',
    weight: '12.4 g',
    colorway: 'Matte Ash Silver',
    description:
      'Formulated through structural reduction. The bridge is cast from a single 0.8mm titanium ribbon that bends into the eyewire without external solder points, embodying beauty through structural tension.',
    curatorNote:
      'A quiet study on presence through absence. Designed for contemplative spaces.',
    position: [0, 0, -4.5], // Center-front highlight
    inspectionCameraOffset: [0, 1.4, -2.4],
    rotationY: 0,
    pedestalColor: '#edf2f7', // Radiant light silver metallic look
    highlightColor: '#ffffff',
    accentRgb: [0.94, 0.96, 1.0],
  },
  {
    id: 'sm-02',
    number: '02',
    title: 'Monolith in Void',
    subtitle: 'Smoked Bio-Cellulose Sun Frame',
    category: 'Sculptural Sun',
    season: 'Autumn / Winter 2026',
    price: 520,
    materials: ['8mm Cured Bio-Acetate', 'Solid Core Titanium Wire', 'Zeiss Mineral Lenses'],
    dimensions: '51 □ 20 - 148 mm',
    weight: '34.8 g',
    colorway: 'Smoked Obsidian / Charcoal Glass',
    description:
      'Carved from an 8-millimeter cured acetate block with faceted beveled brows that capture ambient gallery light at acute angles. Heavy in silhouette yet balanced across the temple counterweights.',
    curatorNote:
      'Introspective geometry inspired by minimalist Korean stone masonry.',
    position: [-6.5, 0, -1.5], // Left gallery flank
    inspectionCameraOffset: [-5.0, 1.4, -0.2],
    rotationY: 0.35,
    pedestalColor: '#e8edf4', // Radiant light silver metallic look
    highlightColor: '#ffffff',
    accentRgb: [0.93, 0.95, 1.0],
  },
  {
    id: 'sm-03',
    number: '03',
    title: 'Linear Reticence',
    subtitle: 'Geometric Dual-Bridge Silhouette',
    category: 'Hybrid Optical',
    season: 'Autumn / Winter 2026',
    price: 490,
    materials: ['Brushed Raw Titanium', 'Matte Horn Inlays', 'Ceramic Nose Mounts'],
    dimensions: '49 □ 22 - 145 mm',
    weight: '15.6 g',
    colorway: 'Deep Umber & Raw Bronze',
    description:
      'A dual browline designed as two parallel architectural beams. The upper wire hovers 1.2 millimeters above the eyewire, generating an introspective shadow line across the wearer’s brow.',
    curatorNote:
      'Explores the boundary where industrial rigidity yields to bodily grace.',
    position: [6.5, 0, -1.5], // Right gallery flank
    inspectionCameraOffset: [5.0, 1.4, -0.2],
    rotationY: -0.35,
    pedestalColor: '#ebf0f6', // Radiant light silver metallic look
    highlightColor: '#ffffff',
    accentRgb: [0.94, 0.96, 1.0],
  },
  {
    id: 'sm-04',
    number: '04',
    title: 'Alabaster Stillness',
    subtitle: 'Translucent Bone Acetate & Bone Titanium',
    category: 'Contemplative Sun',
    season: 'Autumn / Winter 2026',
    price: 540,
    materials: ['Cured Alabaster Acetate', 'Palladium Hardware', 'Anti-reflective Sage Tint'],
    dimensions: '50 □ 19 - 146 mm',
    weight: '29.2 g',
    colorway: 'Milky Alabaster & Pale Sage',
    description:
      'Translucent milky cellulose acetate treated with a micro-matte hand finish that catches and diffuses light like unpolished porcelain. A discreet expression of luxury that refuses to shout.',
    curatorNote:
      'A dialogue between soft translucency and rigid mechanical joints.',
    position: [-4.2, 0, 4.5], // Back-left alcove
    inspectionCameraOffset: [-3.2, 1.4, 3.2],
    rotationY: 0.8,
    pedestalColor: '#eff3f9', // Radiant light silver metallic look
    highlightColor: '#ffffff',
    accentRgb: [0.95, 0.97, 1.0],
  },
  {
    id: 'sm-05',
    number: '05',
    title: 'Tension & Horizon',
    subtitle: 'Rimless Archival Construction',
    category: 'Ultra-Minimal Rimless',
    season: 'Autumn / Winter 2026',
    price: 440,
    materials: ['High-Tensile Titanium Alloy', 'Cast Palladium Endpieces', 'Chamfered Quartz Glass'],
    dimensions: '52 □ 18 - 148 mm',
    weight: '9.8 g',
    colorway: 'Burnished Gunmetal',
    description:
      'Lens surfaces anchored only by calibrated tension lugs. No rim perimeter, allowing the eyes of the wearer to exist uninterrupted within space. Weightless, cinematic restraint.',
    curatorNote:
      'The purest articulation of Splendid Melancholy: beauty through reduction.',
    position: [4.2, 0, 4.5], // Back-right alcove
    inspectionCameraOffset: [3.2, 1.4, 3.2],
    rotationY: -0.8,
    pedestalColor: '#e7edf5', // Radiant light silver metallic look
    highlightColor: '#ffffff',
    accentRgb: [0.93, 0.96, 1.0],
  },
];
