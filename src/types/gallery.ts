export interface ExhibitItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  category: string;
  season: string;
  price: number;
  materials: string[];
  dimensions: string;
  weight: string;
  colorway: string;
  description: string;
  curatorNote: string;
  position: [number, number, number];
  inspectionCameraOffset: [number, number, number];
  rotationY?: number;
  pedestalColor: string;
  highlightColor: string;
  accentRgb: [number, number, number];
}

export type NavigationMode = 'free' | 'inspecting' | 'counter';

export interface CartItem {
  id: string; // unique item id
  exhibitId: string;
  title: string;
  number: string;
  category: string;
  colorway: string;
  unitPrice: number;
  lensType: string;
  lensPrice: number;
  quantity: number;
}

export interface PurchaseOrder {
  orderId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  packagingTier: string;
  timestamp: string;
}

export interface CameraState {
  mode: NavigationMode;
  targetExhibitId: string | null;
}
