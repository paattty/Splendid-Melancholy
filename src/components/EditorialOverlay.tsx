import React, { useState } from 'react';
import { EXHIBITS } from '../data/exhibits';
import { ExhibitItem, NavigationMode } from '../types/gallery';
import {
  Compass,
  Eye,
  ArrowRight,
  ArrowLeft,
  X,
  Info,
  Home,
  ShoppingBag,
} from 'lucide-react';

interface EditorialOverlayProps {
  selectedExhibit: ExhibitItem | null;
  onSelectExhibit: (exhibit: ExhibitItem | null) => void;
  navigationMode: NavigationMode;
  onNavigationModeChange: (mode: NavigationMode) => void;
  onResetCamera: () => void;
  onOpenCounter: () => void;
  onAcquireAtCounter: (exhibit: ExhibitItem) => void;
  cartCount: number;
}

export const EditorialOverlay: React.FC<EditorialOverlayProps> = ({
  selectedExhibit,
  onSelectExhibit,
  navigationMode,
  onNavigationModeChange,
  onResetCamera,
  onOpenCounter,
  onAcquireAtCounter,
  cartCount,
}) => {
  const [showCatalogDrawer, setShowCatalogDrawer] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleSelectExhibitByIndex = (index: number) => {
    const exhibit = EXHIBITS[index];
    if (exhibit) {
      onSelectExhibit(exhibit);
      onNavigationModeChange('inspecting');
    }
  };

  const handleNextExhibit = () => {
    if (!selectedExhibit) {
      handleSelectExhibitByIndex(0);
      return;
    }
    const currentIndex = EXHIBITS.findIndex((e) => e.id === selectedExhibit.id);
    const nextIndex = (currentIndex + 1) % EXHIBITS.length;
    handleSelectExhibitByIndex(nextIndex);
  };

  const handlePrevExhibit = () => {
    if (!selectedExhibit) {
      handleSelectExhibitByIndex(EXHIBITS.length - 1);
      return;
    }
    const currentIndex = EXHIBITS.findIndex((e) => e.id === selectedExhibit.id);
    const prevIndex = (currentIndex - 1 + EXHIBITS.length) % EXHIBITS.length;
    handleSelectExhibitByIndex(prevIndex);
  };

  const handleResumeFreeWalk = () => {
    onNavigationModeChange('free');
    onSelectExhibit(null);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3.5 sm:p-5 md:p-6">
      {/* Top Bar: Brand & Unobtrusive Action Controls */}
      <header className="flex items-center justify-between w-full">
        {/* Brand identity - Low-profile and refined with crisp legibility */}
        <div className="pointer-events-auto flex items-baseline gap-2.5 bg-[#141418]/94 border border-stone-800/80 px-3.5 py-1.5 rounded-sm shadow-sm">
          <h1 className="font-geographica text-2xl sm:text-3xl font-normal text-stone-100 drop-shadow-sm leading-none">
            Splendid Melancholy
          </h1>
          <span className="text-[10px] tracking-widest uppercase text-stone-400 hidden sm:inline font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
            Korea
          </span>
        </div>

        {/* Quiet top action controls - Low profile */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#141418]/94 border border-stone-800/80 p-1 rounded-sm shadow-sm">
          {/* Home / Overview distance viewpoint button */}
          <button
            onClick={onResetCamera}
            className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-white py-1 px-2.5 transition-colors cursor-pointer rounded-sm hover:bg-stone-800/60 font-medium"
            title="Home: Return to original overview position"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              Home
            </span>
          </button>

          <span className="w-px h-3 bg-stone-800 mx-0.5" />

          {/* Exhibition index drawer toggle */}
          <button
            onClick={() => setShowCatalogDrawer(!showCatalogDrawer)}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-100 py-1 px-2 transition-colors cursor-pointer rounded-sm hover:bg-stone-800/40"
            title="View Collection Index"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              Index
            </span>
          </button>

          <span className="w-px h-3 bg-stone-800 mx-0.5" />

          {/* Philosophy modal toggle */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="text-stone-400 hover:text-stone-100 p-1.5 transition-colors cursor-pointer rounded-sm hover:bg-stone-800/40"
            title="Philosophy & Statement"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Center Right: Selected Exhibit Details Card (when inspecting) - Shifted right & scaled compact */}
      {selectedExhibit && navigationMode === 'inspecting' && (
        <aside className="pointer-events-auto absolute top-16 md:top-20 right-3 md:right-5 w-72 sm:w-80 max-w-[85vw] max-h-[calc(100vh-130px)] overflow-y-auto bg-[#131317]/96 border border-stone-800/80 p-5 rounded-sm shadow-2xl transition-all duration-300 animate-fade-in text-stone-300">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2.5 mb-3.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
              Exhibit {selectedExhibit.number} · {selectedExhibit.category}
            </span>
            <button
              onClick={handleResumeFreeWalk}
              className="text-stone-500 hover:text-stone-200 transition-colors p-1"
              title="Close Inspection View"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-light tracking-wide text-stone-100">
                {selectedExhibit.title}
              </h2>
              <p className="text-[11px] text-stone-400 tracking-wider mt-0.5 font-light italic">
                {selectedExhibit.subtitle}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-stone-300 font-light border-l border-stone-700/60 pl-2.5 py-0.5">
              {selectedExhibit.description}
            </p>

            <div className="pt-1.5 border-t border-stone-800/80 space-y-1.5 text-[10px] sm:text-[11px]">
              <div className="flex justify-between py-0.5 border-b border-stone-800/40">
                <span className="text-stone-500 tracking-wider uppercase font-mono">Materials</span>
                <span className="text-stone-300 font-light text-right">
                  {selectedExhibit.materials.join(' · ')}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-800/40">
                <span className="text-stone-500 tracking-wider uppercase font-mono">Dimensions</span>
                <span className="text-stone-300 font-mono">{selectedExhibit.dimensions}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-800/40">
                <span className="text-stone-500 tracking-wider uppercase font-mono">Weight</span>
                <span className="text-stone-300 font-mono">{selectedExhibit.weight}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-stone-500 tracking-wider uppercase font-mono">Colorway</span>
                <span className="text-stone-300 font-light">{selectedExhibit.colorway}</span>
              </div>
            </div>

            <div className="bg-[#0f0f12]/80 p-2.5 rounded-sm border border-stone-800/50 mt-2">
              <span className="block text-[9px] font-mono tracking-widest uppercase text-stone-500 mb-0.5">
                Curator Note
              </span>
              <p className="text-[11px] text-stone-400 font-light italic leading-snug">
                "{selectedExhibit.curatorNote}"
              </p>
            </div>

            {/* Price & Acquisition Action */}
            <div className="pt-2 border-t border-stone-800/80 space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500">
                  Acquisition Value
                </span>
                <div className="text-right">
                  <span className="font-serif text-lg text-stone-100 font-light">
                    ${selectedExhibit.price}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400 ml-1">USD</span>
                </div>
              </div>

              <button
                onClick={() => onAcquireAtCounter(selectedExhibit)}
                className="w-full bg-stone-200 hover:bg-white text-stone-900 text-[11px] font-medium tracking-wider uppercase py-2.5 px-3 rounded-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-stone-900" />
                <span>Acquire Piece at Counter</span>
              </button>
            </div>

            {/* Orbit & Resume Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={handleResumeFreeWalk}
                className="flex-1 bg-stone-200 text-stone-900 hover:bg-white text-[11px] font-medium tracking-wider uppercase py-2 px-3 rounded-sm transition-colors text-center"
              >
                Resume Free Walk
              </button>
              <div className="flex gap-1">
                <button
                  onClick={handlePrevExhibit}
                  className="p-2 bg-stone-800/60 hover:bg-stone-800 text-stone-300 rounded-sm border border-stone-700/50 transition-colors"
                  title="Previous Pedestal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextExhibit}
                  className="p-2 bg-stone-800/60 hover:bg-stone-800 text-stone-300 rounded-sm border border-stone-700/50 transition-colors"
                  title="Next Pedestal"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[9px] text-stone-500 text-center tracking-wider pt-0.5">
              Drag mouse/touch to orbit 360°
            </p>
          </div>
        </aside>
      )}

      {/* Catalog / Index Drawer */}
      {showCatalogDrawer && (
        <aside className="pointer-events-auto absolute top-20 right-6 md:right-8 w-80 bg-[#161619]/98 border border-stone-800 p-5 rounded-sm shadow-2xl z-30 transition-all animate-fade-in">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-stone-400">
              Exhibition Catalog
            </span>
            <button
              onClick={() => setShowCatalogDrawer(false)}
              className="text-stone-500 hover:text-stone-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {EXHIBITS.map((item, idx) => {
              const isSelected = selectedExhibit?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleSelectExhibitByIndex(idx);
                    setShowCatalogDrawer(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-sm flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'border-stone-600 bg-stone-800/70 text-stone-100'
                      : 'border-transparent hover:border-stone-800 hover:bg-stone-800/30 text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-stone-500">
                      {item.number}
                    </span>
                    <div>
                      <div className="font-serif text-sm tracking-wide text-stone-200">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono tracking-wider">
                        {item.category}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-stone-500" />
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Philosophy / Brand Modal */}
      {showInfoModal && (
        <div className="pointer-events-auto fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#17171a] border border-stone-800 max-w-lg w-full p-7 md:p-8 rounded-sm shadow-2xl relative text-stone-300 space-y-4">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-5 right-5 text-stone-500 hover:text-stone-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-stone-500 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
                Philosophy
              </span>
              <h3 className="font-geographica text-3xl sm:text-4xl text-stone-100 leading-tight">
                Splendid Melancholy
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-stone-300 font-light">
              Rooted in the quiet tension between Korean architectural minimalism and contemplative craft,
              the collection rejects ephemeral ornamentation in pursuit of pure structural restraint.
            </p>
            <p className="text-xs leading-relaxed text-stone-400 font-light">
              Move freely through the space, observe each silhouette from 360 degrees, and discover the interplay of light and form.
            </p>
            <div className="pt-3 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-stone-200 text-stone-900 px-4 py-2 text-xs font-medium uppercase tracking-wider rounded-sm hover:bg-white transition-colors"
              >
                Return to Gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Dock - Compact & Non-obstructive */}
      <footer className="w-full flex items-end justify-between gap-4 pointer-events-none">
        {/* Minimal, elegant navigation instructions badge (bottom left) */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-[#121216]/94 border border-stone-800/80 px-3 py-1.5 rounded-sm shadow-lg text-[10px] text-stone-400 select-none font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
          <div className="flex items-center gap-1.5 text-stone-300">
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">W</kbd>
              <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">A</kbd>
              <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">S</kbd>
              <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">D</kbd>
            </span>
            <span className="tracking-wide">Move</span>
          </div>

          <span className="text-stone-700 font-mono">/</span>

          <div className="flex items-center gap-1 text-stone-300">
            <span className="text-stone-400 hidden xs:inline">Drag</span>
            <span className="tracking-wide">Look</span>
          </div>

          <span className="text-stone-700 font-mono hidden sm:inline">/</span>

          <div className="hidden sm:flex items-center gap-1 text-stone-300">
            <span className="tracking-wide text-stone-400">Click Pedestal to Inspect</span>
          </div>
        </div>

        {/* Curated Waypoints quick jump buttons (01 - 05) */}
        <div className="pointer-events-auto ml-auto flex items-center bg-[#141418]/94 border border-stone-800/80 p-1 rounded-sm gap-0.5 shadow-xl">
          <button
            onClick={handleResumeFreeWalk}
            className={`px-2.5 py-1 text-xs font-mono tracking-wider transition-all rounded-sm flex items-center gap-1 cursor-pointer ${
              navigationMode === 'free'
                ? 'bg-stone-200 text-stone-900 font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/40'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span className="text-[10px]">Walk</span>
          </button>

          <span className="w-px h-3 bg-stone-800 mx-0.5" />

          {EXHIBITS.map((item, idx) => {
            const isSelected = selectedExhibit?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectExhibitByIndex(idx)}
                className={`px-2 py-1 text-xs font-mono transition-all rounded-sm cursor-pointer ${
                  isSelected
                    ? 'bg-stone-200 text-stone-900 font-semibold shadow-sm'
                    : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/40'
                }`}
                title={`${item.number}: ${item.title}`}
              >
                {item.number}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};
