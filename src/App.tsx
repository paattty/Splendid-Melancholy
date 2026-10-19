import React, { useState } from 'react';
import { GalleryCanvas } from './components/GalleryCanvas';
import { EditorialOverlay } from './components/EditorialOverlay';
import { CheckoutCounterModal } from './components/CheckoutCounterModal';
import { ExhibitItem, NavigationMode, CartItem } from './types/gallery';
import { EXHIBITS } from './data/exhibits';
import { ArrowRight } from 'lucide-react';

export default function App() {
  const [selectedExhibit, setSelectedExhibit] = useState<ExhibitItem | null>(null);
  const [hoveredExhibit, setHoveredExhibit] = useState<ExhibitItem | null>(null);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>('free');
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [resetCameraTrigger, setResetCameraTrigger] = useState<number>(0);
  const [isCounterOpen, setIsCounterOpen] = useState<boolean>(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentStory, setCurrentStory] = useState<1 | 2 | 'exterior'>(1);
  const [teleportTargetStory, setTeleportTargetStory] = useState<{ story: 1 | 2 | 'exterior'; id: number } | null>(null);

  const handleTeleportToStory = React.useCallback((story: 1 | 2 | 'exterior') => {
    setSelectedExhibit(null);
    setIsCounterOpen(false);
    setNavigationMode('free');
    setTeleportTargetStory({ story, id: Date.now() });
  }, []);

  const handleSelectExhibit = React.useCallback((exhibit: ExhibitItem | null) => {
    setSelectedExhibit(exhibit);
    if (exhibit) {
      setNavigationMode('inspecting');
    }
  }, []);

  const handleResetCamera = React.useCallback(() => {
    setSelectedExhibit(null);
    setIsCounterOpen(false);
    setNavigationMode('free');
    setResetCameraTrigger((prev) => prev + 1);
  }, []);

  const handleOpenCounter = React.useCallback(() => {
    setSelectedExhibit(null);
    setNavigationMode('counter');
    setIsCounterOpen(true);
  }, []);

  const handleCloseCounter = React.useCallback(() => {
    setIsCounterOpen(false);
    setNavigationMode('free');
  }, []);

  const handleAddToCart = React.useCallback(
    (exhibit: ExhibitItem, lensType: string = 'Archival Display Lenses', lensPrice: number = 0) => {
      setCartItems((prev) => {
        const existing = prev.find((it) => it.exhibitId === exhibit.id && it.lensType === lensType);
        if (existing) {
          return prev.map((it) =>
            it.id === existing.id ? { ...it, quantity: it.quantity + 1 } : it
          );
        }
        return [
          ...prev,
          {
            id: `${exhibit.id}-${Date.now()}`,
            exhibitId: exhibit.id,
            title: exhibit.title,
            number: exhibit.number,
            category: exhibit.category,
            colorway: exhibit.colorway,
            unitPrice: exhibit.price,
            lensType,
            lensPrice,
            quantity: 1,
          },
        ];
      });
    },
    []
  );

  const handleAcquireExhibit = React.useCallback(
    (exhibit: ExhibitItem) => {
      handleAddToCart(exhibit);
      handleOpenCounter();
    },
    [handleAddToCart, handleOpenCounter]
  );

  const handleUpdateQuantity = React.useCallback((itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter((it): it is CartItem => it !== null)
    );
  }, []);

  const handleRemoveItem = React.useCallback((itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
  }, []);

  const handleClearCart = React.useCallback(() => {
    setCartItems([]);
  }, []);

  const handleStartExploring = React.useCallback((initialIndex?: number) => {
    setHasEntered(true);
    if (typeof initialIndex === 'number' && EXHIBITS[initialIndex]) {
      setSelectedExhibit(EXHIBITS[initialIndex]);
      setNavigationMode('inspecting');
    }
  }, []);

  const totalCartCount = cartItems.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#111114] text-[#E2DFD8]">
      {/* 3D WebGL Three.js Canvas Engine */}
      <GalleryCanvas
        selectedExhibit={selectedExhibit}
        onSelectExhibit={handleSelectExhibit}
        navigationMode={navigationMode}
        onNavigationModeChange={setNavigationMode}
        hoveredExhibit={hoveredExhibit}
        onHoverExhibit={setHoveredExhibit}
        resetCameraTrigger={resetCameraTrigger}
        onOpenCounter={handleOpenCounter}
        currentStory={currentStory}
        onStoryChange={setCurrentStory}
        teleportTargetStory={teleportTargetStory}
      />

      {/* Editorial DOM Overlay & Controls */}
      <EditorialOverlay
        selectedExhibit={selectedExhibit}
        onSelectExhibit={handleSelectExhibit}
        navigationMode={navigationMode}
        onNavigationModeChange={setNavigationMode}
        onResetCamera={handleResetCamera}
        onOpenCounter={handleOpenCounter}
        onAcquireAtCounter={handleAcquireExhibit}
        cartCount={totalCartCount}
        currentStory={currentStory}
        onTeleportToStory={handleTeleportToStory}
      />

      {/* Acquisitions & Checkout Counter Modal */}
      <CheckoutCounterModal
        isOpen={isCounterOpen}
        onClose={handleCloseCounter}
        cartItems={cartItems}
        onAddToCart={handleAddToCart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />

      {/* Simple, refined introductory curtain */}
      {!hasEntered && (
        <div className="absolute inset-0 z-40 bg-[#111114]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in transition-opacity duration-700">
          <div className="max-w-xl flex flex-col items-center">
            {/* Brand title and subtext with generous, balanced vertical spacing */}
            <div className="flex flex-col items-center">
              <h1 className="font-geographica text-5xl sm:text-6xl md:text-7xl font-normal text-stone-100 tracking-wide drop-shadow-sm leading-tight block mb-6 sm:mb-8 md:mb-10 px-4">
                Splendid Melancholy
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 font-light tracking-[0.14em] uppercase font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
                A quiet expression of identity where beauty meets restraint.
              </p>
            </div>

            {/* Subtle dividing line with balanced spacing */}
            <div className="w-16 h-px bg-stone-700/60 my-7 sm:my-8" />

            {/* Secondary introductory description */}
            <p className="text-xs sm:text-sm text-stone-400/90 leading-relaxed font-light font-['Helvetica_Neue',Helvetica,Arial,sans-serif] max-w-md mb-8 sm:mb-9">
              Explore the virtual store and discover the contemporary eyewear collection.
            </p>

            {/* Action button */}
            <div className="flex justify-center">
              <button
                onClick={() => handleStartExploring()}
                className="bg-stone-200 text-stone-900 hover:bg-white px-9 py-3.5 text-xs uppercase tracking-[0.22em] font-medium rounded-sm transition-all flex items-center justify-center gap-2.5 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] group cursor-pointer font-['Helvetica_Neue',Helvetica,Arial,sans-serif]"
              >
                <span>Explore Store</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

