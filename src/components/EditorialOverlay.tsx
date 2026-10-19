import React, { useState, useEffect } from 'react';
import { ExhibitItem, NavigationMode } from '../types/gallery';
import {
  X,
  Info,
  DoorOpen,
  Layers,
  ChevronDown,
  Check,
  Compass,
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
  currentStory?: 1 | 2 | 'exterior';
  onTeleportToStory?: (story: 1 | 2 | 'exterior') => void;
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
  currentStory = 1,
  onTeleportToStory,
}) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLevelsMenu, setShowLevelsMenu] = useState(false);
  const [showTurnHint, setShowTurnHint] = useState(true);
  const levelsMenuRef = React.useRef<HTMLDivElement>(null);

  // Dismiss turn guidance on first mouse interaction or after 7s
  useEffect(() => {
    const handleFirstDrag = () => {
      setShowTurnHint(false);
    };
    window.addEventListener('pointerdown', handleFirstDrag, { once: true });
    const timer = setTimeout(() => setShowTurnHint(false), 7000);
    return () => {
      window.removeEventListener('pointerdown', handleFirstDrag);
      clearTimeout(timer);
    };
  }, []);

  // Close levels dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        levelsMenuRef.current &&
        !levelsMenuRef.current.contains(e.target as Node)
      ) {
        setShowLevelsMenu(false);
      }
    };
    if (showLevelsMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showLevelsMenu]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3.5 sm:p-5 md:p-6">
      {/* Top Bar: Brand & Unobtrusive Action Controls */}
      <header className="flex items-center justify-between w-full">
        {/* Brand identity - Minimal, low-profile and scaled small for zero visual obstruction */}
        <div className="pointer-events-auto flex items-baseline gap-1.5 bg-[#141418]/94 border border-stone-800/80 px-2.5 py-1 rounded-sm shadow-sm">
          <h1 className="font-geographica text-base sm:text-lg font-normal text-stone-100 drop-shadow-xs leading-none">
            Splendid Melancholy
          </h1>
          <span className="text-[8px] tracking-[0.16em] uppercase text-stone-400 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
            Korea
          </span>
        </div>

        {/* Quiet top action controls - Low profile */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#141418]/94 border border-stone-800/80 p-1 rounded-sm shadow-sm">
          {/* Architectural Levels Dropdown Menu */}
          <div ref={levelsMenuRef} className="relative">
            <button
              onClick={() => setShowLevelsMenu(!showLevelsMenu)}
              className={`flex items-center gap-1.5 text-xs py-1 px-2.5 transition-colors cursor-pointer rounded-sm ${
                showLevelsMenu
                  ? 'bg-stone-800 text-stone-100'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/60 font-medium'
              }`}
              title="Levels / Waypoints: Select floor or exterior"
              aria-expanded={showLevelsMenu}
              aria-haspopup="true"
            >
              <Layers className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Levels
              </span>
              <span className="text-[9px] font-mono text-stone-300 px-1 py-0.2 bg-stone-800/90 rounded-[2px] border border-stone-700/60 leading-none">
                {currentStory === 2 ? '2' : '1'}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-stone-400 transition-transform duration-150 ${
                  showLevelsMenu ? 'rotate-180 text-stone-200' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showLevelsMenu && (
              <div className="absolute top-full left-0 mt-1.5 w-36 bg-[#141418]/98 border border-stone-800 rounded-sm shadow-2xl py-1 z-50 backdrop-blur-md">
                <button
                  onClick={() => {
                    onTeleportToStory?.(1);
                    setShowLevelsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    currentStory === 1
                      ? 'bg-stone-200 text-stone-900 font-semibold'
                      : 'text-stone-300 hover:text-white hover:bg-stone-800/70'
                  }`}
                >
                  <span>Level 1</span>
                  {currentStory === 1 && <Check className="w-3 h-3 stroke-[2.5]" />}
                </button>

                <button
                  onClick={() => {
                    onTeleportToStory?.(2);
                    setShowLevelsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    currentStory === 2
                      ? 'bg-stone-200 text-stone-900 font-semibold shadow-xs'
                      : 'text-stone-300 hover:text-white hover:bg-stone-800/70'
                  }`}
                >
                  <span>Level 2</span>
                  {currentStory === 2 && <Check className="w-3 h-3 stroke-[2.5]" />}
                </button>
              </div>
            )}
          </div>

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

      {/* Intuitive initial turn guidance pill */}
      {showTurnHint && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-[#121216]/95 border border-stone-700/80 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md transition-opacity duration-700 animate-fade-in select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-ping" />
          <span className="text-[11px] font-mono tracking-wide text-stone-200">
            Click & hold mouse anywhere, then drag to turn
          </span>
        </div>
      )}

      {/* Bottom Navigation Dock - Compact & Non-obstructive */}
      <footer className="w-full flex items-end justify-between gap-4 pointer-events-none">
        {/* Navigation instructions guide (bottom left) */}
        <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 bg-[#121216]/94 border border-stone-800/80 px-3.5 py-1.5 rounded-sm shadow-lg text-[10px] text-stone-400 select-none font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
          {/* Click & Turn with mouse */}
          <div className="flex items-center gap-1.5 text-stone-200">
            <span className="px-1.5 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-100 font-medium">
              Click & Drag
            </span>
            <span className="tracking-wide text-stone-300">Turn / Look</span>
          </div>

          {/* Keyboard Walk guidance (active only inside store) */}
          {currentStory !== 'exterior' && (
            <>
              <span className="text-stone-700 font-mono">/</span>
              <div className="flex items-center gap-1.5 text-stone-300">
                <span className="flex items-center gap-0.5">
                  <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">W</kbd>
                  <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">A</kbd>
                  <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">S</kbd>
                  <kbd className="px-1 py-0.5 bg-stone-800/90 border border-stone-700/70 rounded-[2px] text-[9px] font-mono text-stone-200 leading-none">D</kbd>
                </span>
                <span className="tracking-wide text-stone-400">Move</span>
              </div>
            </>
          )}
        </div>

        {/* Dynamic toggle button: changes between Interior and Exterior based on current location */}
        <div className="pointer-events-auto ml-auto flex items-center bg-[#141418]/94 border border-stone-800/80 p-1 rounded-sm gap-0.5 shadow-xl">
          <button
            onClick={() => {
              if (currentStory === 'exterior') {
                onTeleportToStory ? onTeleportToStory(1) : onResetCamera();
              } else {
                onTeleportToStory ? onTeleportToStory('exterior') : onResetCamera();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-white py-1 px-2.5 transition-colors cursor-pointer rounded-sm hover:bg-stone-800/60 font-medium"
            title={
              currentStory === 'exterior'
                ? 'Interior: Enter gallery interior'
                : 'Exterior: View store exterior architecture'
            }
          >
            {currentStory === 'exterior' ? (
              <DoorOpen className="w-3.5 h-3.5 text-stone-300" />
            ) : (
              <Compass className="w-3.5 h-3.5 text-stone-300" />
            )}
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {currentStory === 'exterior' ? 'Interior' : 'Exterior'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};
