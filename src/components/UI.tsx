import React, { useEffect, useState } from 'react';
import { CARS, TRACKS, CAREER, CarSpec, TrackSpec } from '../game/data';
import { HUDData, RaceResult } from '../game/Engine';

// ==============================
// Utility
// ==============================
const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s * 1000) % 1000);
  return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// ==============================
// Progress store
// ==============================
export interface SaveData {
  careerRaceUnlocked: number; // index of next race to play
  carsUnlocked: string[]; // car ids
  money: number;
  bestTimes: Record<string, number>; // trackId -> best time
  highScores: { name: string; score: number; date: string }[];
}

const defaultSave: SaveData = {
  careerRaceUnlocked: 0,
  carsUnlocked: ['blaze-gt'],
  money: 0,
  bestTimes: {},
  highScores: [],
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem('apex-street-save');
    if (raw) return { ...defaultSave, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultSave };
}

export function writeSave(s: SaveData) {
  try { localStorage.setItem('apex-street-save', JSON.stringify(s)); } catch {}
}

// ==============================
// Main Menu
// ==============================
interface MainMenuProps {
  onPlay: () => void;
  onQuickRace: () => void;
  onGarage: () => void;
  onSettings: () => void;
  onControls: () => void;
  onCredits: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onPlay, onQuickRace, onGarage, onSettings, onControls, onCredits }) => {
  return (
    <div className="absolute inset-0 flex flex-col scanlines" style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #1a0a1a 50%, #0a0a14 100%)' }}>
      <div className="absolute inset-0 vignette" />
      <div className="relative z-10 flex flex-col md:flex-row h-full">
        <div className="flex-1 flex flex-col justify-center p-8 md:p-16">
          <div className="mb-2 text-red-500 font-black text-sm tracking-[0.3em]">★ UNDERGROUND RACING ★</div>
          <h1 className="text-6xl md:text-8xl font-black hud-font text-white title-glow leading-none">APEX</h1>
          <h1 className="text-6xl md:text-8xl font-black hud-font text-white leading-none mb-2" style={{ color: '#ff3b3b' }}>STREET</h1>
          <div className="text-white/60 text-sm tracking-widest mb-10">OUTRUN. OUTDRIFT. OUTLAST.</div>
          <div className="flex flex-col gap-2 max-w-xs">
            <button className="btn-race text-xl" onClick={onPlay}>▶ Play Career</button>
            <button className="btn-race" onClick={onQuickRace}>⚡ Quick Race</button>
            <button className="btn-race" onClick={onGarage}>🏁 Garage</button>
            <button className="btn-race" onClick={onSettings}>⚙ Settings</button>
            <button className="btn-race" onClick={onControls}>🎮 Controls</button>
            <button className="btn-race" onClick={onCredits}>★ Credits</button>
          </div>
        </div>
        <div className="flex-1 relative hidden md:flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,59,59,0.25), transparent 70%)' }} />
          </div>
          <div className="relative text-center">
            <div className="text-white/30 text-xs tracking-[0.3em] mb-4">SEASON 01</div>
            <div className="text-9xl font-black hud-font text-white/10">01</div>
            <div className="text-white/50 tracking-widest text-sm mt-4">RISE OF THE APEX</div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-0 right-0 text-center text-white/40 text-xs tracking-widest">v1.0 — ORIGINAL CONTENT</div>
    </div>
  );
};

// ==============================
// Career Select
// ==============================
interface CareerProps {
  save: SaveData;
  selectedCar: CarSpec;
  onStart: (raceIdx: number) => void;
  onBack: () => void;
  onOpenGarage: () => void;
}

export const CareerScreen: React.FC<CareerProps> = ({ save, selectedCar, onStart, onBack, onOpenGarage }) => {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'linear-gradient(135deg, #0a0a14, #1a0a1a)' }}>
      <div className="absolute inset-0 vignette pointer-events-none" />
      <div className="relative z-10 p-6 md:p-10 flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <h2 className="text-3xl md:text-5xl font-black hud-font text-white title-glow">CAREER</h2>
          <div className="text-yellow-400 font-black tracking-wider">${save.money.toLocaleString()}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <div className="text-white/60 tracking-widest text-xs mb-2">SELECT RACE</div>
            <div className="space-y-2">
              {CAREER.map((race, i) => {
                const track = TRACKS.find(t => t.id === race.trackId)!;
                const unlocked = i <= save.careerRaceUnlocked;
                const completed = i < save.careerRaceUnlocked;
                return (
                  <button
                    key={race.trackId}
                    disabled={!unlocked}
                    onClick={() => onStart(i)}
                    className={`w-full text-left p-4 border transition-all ${
                      unlocked
                        ? completed
                          ? 'bg-green-900/20 border-green-500/40 hover:border-green-500'
                          : 'bg-red-900/20 border-red-500/40 hover:border-red-500 hover:bg-red-900/40'
                        : 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-black text-white/40 tracking-widest">ROUND {String(i + 1).padStart(2, '0')}</span>
                          {completed && <span className="text-xs bg-green-500/30 text-green-300 px-2 py-0.5 font-bold tracking-wider">✓ CLEARED</span>}
                          {!unlocked && <span className="text-xs">🔒</span>}
                        </div>
                        <div className="text-xl font-black hud-font text-white">{track.name}</div>
                        <div className="text-white/50 text-sm mt-1">{race.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-bold">${race.reward.toLocaleString()}</div>
                        <div className="text-white/40 text-xs">{track.laps} LAPS • {track.aiCount + 1} RACERS</div>
                        <div className="text-white/40 text-xs">{'★'.repeat(track.difficulty)}{'☆'.repeat(5 - track.difficulty)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-white/60 tracking-widest text-xs mb-2">ACTIVE CAR</div>
            <div className="p-6 border border-white/20 bg-black/40 backdrop-blur">
              <div
                className="aspect-video mb-4 rounded relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, #${selectedCar.color.toString(16).padStart(6, '0')}44, #000)` }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <CarIcon spec={selectedCar} size={120} />
                </div>
              </div>
              <div className="text-2xl font-black hud-font" style={{ color: `#${selectedCar.color.toString(16).padStart(6, '0')}` }}>{selectedCar.name}</div>
              <div className="text-white/60 text-sm mb-3">{selectedCar.tagline}</div>
              <div className="space-y-2 text-sm">
                <StatBar label="SPEED" value={selectedCar.topSpeed / 50} />
                <StatBar label="ACCEL" value={selectedCar.acceleration} />
                <StatBar label="HANDLING" value={selectedCar.handling} />
                <StatBar label="BRAKING" value={selectedCar.braking} />
                <StatBar label="NITRO" value={selectedCar.nitroCapacity} />
                <StatBar label="DRIFT" value={selectedCar.driftRating} />
              </div>
              <button className="btn-secondary w-full mt-4" onClick={onOpenGarage}>Change Car</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center gap-3">
    <span className="text-white/50 text-xs w-20 tracking-wider">{label}</span>
    <div className="stat-bar flex-1"><div className="stat-bar-fill" style={{ width: `${(value / 10) * 100}%` }} /></div>
    <span className="text-white/70 text-xs font-bold w-8 text-right">{value.toFixed(1)}</span>
  </div>
);

const CarIcon: React.FC<{ spec: CarSpec; size?: number }> = ({ spec, size = 80 }) => {
  const color = `#${spec.color.toString(16).padStart(6, '0')}`;
  const accent = `#${spec.accentColor.toString(16).padStart(6, '0')}`;
  return (
    <svg viewBox="0 0 200 80" width={size} height={size * 0.4} style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))' }}>
      {/* Shadow */}
      <ellipse cx="100" cy="72" rx="85" ry="4" fill="black" opacity="0.5" />
      {/* Body lower */}
      <path d="M20 55 L30 45 L50 38 L90 35 L140 35 L170 40 L185 48 L185 58 L15 58 L15 55 Z" fill={color} />
      {/* Cabin */}
      <path d="M55 38 L75 22 L130 22 L145 38 Z" fill={color} opacity="0.9" />
      {/* Windows */}
      <path d="M62 36 L78 26 L125 26 L138 36 Z" fill="#111820" opacity="0.8" />
      {/* Accent stripe */}
      <rect x="15" y="52" width="170" height="2" fill={accent} />
      {/* Wheels */}
      <circle cx="55" cy="58" r="10" fill="#111" />
      <circle cx="55" cy="58" r="5" fill="#555" />
      <circle cx="145" cy="58" r="10" fill="#111" />
      <circle cx="145" cy="58" r="5" fill="#555" />
      {/* Headlight */}
      <rect x="180" y="48" width="5" height="4" fill="#ffffaa" />
      {/* Taillight */}
      <rect x="15" y="48" width="4" height="4" fill="#ff3030" />
    </svg>
  );
};

// ==============================
// Quick Race — track select
// ==============================
interface QuickRaceProps {
  save: SaveData;
  selectedCar: CarSpec;
  onStart: (track: TrackSpec) => void;
  onBack: () => void;
  onOpenGarage: () => void;
}

export const QuickRaceScreen: React.FC<QuickRaceProps> = ({ save, selectedCar, onStart, onBack, onOpenGarage }) => {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'linear-gradient(135deg, #0a0a14, #0a1a2a)' }}>
      <div className="absolute inset-0 vignette pointer-events-none" />
      <div className="relative z-10 p-6 md:p-10 flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <h2 className="text-3xl md:text-5xl font-black hud-font text-white title-glow">QUICK RACE</h2>
          <button className="btn-secondary" onClick={onOpenGarage}>Garage →</button>
        </div>
        <div className="text-white/60 tracking-widest text-xs mb-4">CURRENT CAR: <span className="text-white font-bold">{selectedCar.name}</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRACKS.map(track => {
            const idx = CAREER.findIndex(r => r.trackId === track.id);
            const unlockedByCareer = idx === -1 || save.careerRaceUnlocked >= idx;
            const isAvailable = track.unlockRace <= save.careerRaceUnlocked || unlockedByCareer || save.careerRaceUnlocked >= CAREER.length;
            return (
              <button
                key={track.id}
                disabled={!isAvailable}
                onClick={() => onStart(track)}
                className={`relative p-5 border text-left transition-all ${
                  isAvailable
                    ? 'bg-gradient-to-br from-red-900/30 to-black border-red-500/30 hover:border-red-500 hover:from-red-900/50'
                    : 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="aspect-video mb-3 relative overflow-hidden rounded"
                  style={{ background: `linear-gradient(135deg, #${track.skyColor.toString(16).padStart(6, '0')}, #${track.groundColor.toString(16).padStart(6, '0')})` }}
                >
                  <div className="absolute bottom-2 left-2 text-white/80 text-xs tracking-widest uppercase">{track.environment}</div>
                  {!isAvailable && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-3xl">🔒</div>}
                </div>
                <div className="text-lg font-black hud-font text-white">{track.name}</div>
                <div className="text-white/50 text-xs mt-1">{track.description}</div>
                <div className="flex justify-between mt-3 text-xs text-white/40">
                  <span>{track.laps} LAPS</span>
                  <span>{track.aiCount + 1} RACERS</span>
                  <span>{'★'.repeat(track.difficulty)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==============================
// Garage
// ==============================
interface GarageProps {
  save: SaveData;
  selectedCar: CarSpec;
  onSelect: (c: CarSpec) => void;
  onUnlock: (c: CarSpec) => void;
  onBack: () => void;
}

export const GarageScreen: React.FC<GarageProps> = ({ save, selectedCar, onSelect, onUnlock, onBack }) => {
  const [viewing, setViewing] = useState<CarSpec>(selectedCar);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => { setRotation(r => (r + 0.3) % 360); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: 'radial-gradient(ellipse at center, #1a0a1a 0%, #0a0a14 70%)' }}>
      <div className="absolute inset-0 vignette pointer-events-none" />
      <div className="relative z-10 p-6 md:p-10 flex-1 flex flex-col overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <h2 className="text-3xl md:text-5xl font-black hud-font text-white title-glow">GARAGE</h2>
          <div className="text-yellow-400 font-black tracking-wider">${save.money.toLocaleString()}</div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          <div className="lg:col-span-2 flex flex-col">
            <div className="garage-car-stage flex-1 rounded flex items-center justify-center relative overflow-hidden min-h-[300px]">
              <div
                style={{
                  transform: `perspective(800px) rotateY(${rotation}deg)`,
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.05s linear',
                }}
              >
                <CarIcon spec={viewing} size={280} />
              </div>
              <div className="absolute top-4 left-4 text-white/40 text-xs tracking-widest">3D PREVIEW</div>
              <div className="absolute bottom-4 right-4 text-white/40 text-xs tracking-widest">ROTATING</div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
              {CARS.map(c => {
                const unlocked = save.carsUnlocked.includes(c.id);
                const selected = viewing.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setViewing(c)}
                    className={`p-2 border transition-all ${
                      selected ? 'border-red-500 bg-red-900/30' : unlocked ? 'border-white/20 bg-black/30 hover:border-white/50' : 'border-white/10 bg-black/30 opacity-60'
                    }`}
                  >
                    <CarIcon spec={c} size={80} />
                    <div className="text-xs font-bold text-white mt-1 truncate">{c.name}</div>
                    {!unlocked && <div className="text-[10px] text-white/40">🔒 Race {c.unlockRace + 1}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="p-5 border border-white/20 bg-black/40 backdrop-blur flex-1 flex flex-col">
              <div className="text-white/40 text-xs tracking-widest mb-1">{viewing.bodyStyle.toUpperCase()}</div>
              <div className="text-3xl font-black hud-font mb-1" style={{ color: `#${viewing.color.toString(16).padStart(6, '0')}` }}>{viewing.name}</div>
              <div className="text-white/60 text-sm mb-4">{viewing.tagline}</div>

              <div className="text-xs text-white/40 tracking-widest mb-1">TOP SPEED</div>
              <div className="text-4xl font-black hud-font text-white mb-4">{viewing.topSpeed} <span className="text-white/50 text-lg">KM/H</span></div>

              <div className="space-y-2 mb-6">
                <StatBar label="SPEED" value={viewing.topSpeed / 50} />
                <StatBar label="ACCEL" value={viewing.acceleration} />
                <StatBar label="HANDLING" value={viewing.handling} />
                <StatBar label="BRAKING" value={viewing.braking} />
                <StatBar label="NITRO" value={viewing.nitroCapacity} />
                <StatBar label="DRIFT" value={viewing.driftRating} />
              </div>

              <div className="mt-auto space-y-2">
                {save.carsUnlocked.includes(viewing.id) ? (
                  selectedCar.id === viewing.id ? (
                    <button disabled className="btn-secondary w-full opacity-50">✓ ACTIVE</button>
                  ) : (
                    <button className="btn-race w-full text-center" onClick={() => onSelect(viewing)}>Select</button>
                  )
                ) : (
                  <div>
                    <div className="text-white/50 text-xs mb-2">UNLOCK BY: Winning career race {viewing.unlockRace + 1}</div>
                    <div className="text-white/50 text-xs mb-2">OR BUY: ${viewing.price.toLocaleString()}</div>
                    <button
                      className="btn-secondary w-full disabled:opacity-40"
                      disabled={save.money < viewing.price || save.careerRaceUnlocked < viewing.unlockRace}
                      onClick={() => onUnlock(viewing)}
                    >
                      {save.careerRaceUnlocked >= viewing.unlockRace ? `BUY — $${viewing.price.toLocaleString()}` : `LOCKED — RACE ${viewing.unlockRace + 1}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==============================
// Settings / Controls / Credits
// ==============================
interface SettingsProps {
  sfxOn: boolean; musicOn: boolean; quality: 'low' | 'medium' | 'high';
  onToggleSfx: () => void; onToggleMusic: () => void; onQuality: (q: 'low' | 'medium' | 'high') => void;
  onBack: () => void;
}
export const SettingsScreen: React.FC<SettingsProps> = ({ sfxOn, musicOn, quality, onToggleSfx, onToggleMusic, onQuality, onBack }) => (
  <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0a0a14, #1a0a1a)' }}>
    <div className="w-full max-w-lg border border-white/20 bg-black/60 backdrop-blur p-8">
      <h2 className="text-4xl font-black hud-font text-white mb-6 title-glow">SETTINGS</h2>
      <div className="space-y-4">
        <Toggle label="Sound Effects" on={sfxOn} onClick={onToggleSfx} />
        <Toggle label="Music" on={musicOn} onClick={onToggleMusic} />
        <div>
          <div className="text-white/60 tracking-widest text-xs mb-2">GRAPHICS QUALITY</div>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map(q => (
              <button key={q} onClick={() => onQuality(q)} className={`flex-1 py-2 border font-bold uppercase tracking-wider text-sm ${quality === q ? 'border-red-500 bg-red-900/40 text-white' : 'border-white/20 text-white/60'}`}>{q}</button>
            ))}
          </div>
        </div>
        <div className="pt-4 border-t border-white/10">
          <button className="btn-secondary w-full" onClick={() => {
            if (confirm('Reset all progress?')) { localStorage.removeItem('apex-street-save'); location.reload(); }
          }}>RESET PROGRESS</button>
        </div>
      </div>
      <button className="btn-secondary w-full mt-6" onClick={onBack}>← Back</button>
    </div>
  </div>
);

const Toggle: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label, on, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-3 border border-white/20 hover:border-white/40">
    <span className="text-white font-bold tracking-wider">{label}</span>
    <span className={`w-14 h-7 rounded-full relative transition-all ${on ? 'bg-red-500' : 'bg-white/20'}`}>
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${on ? 'left-7' : 'left-0.5'}`} />
    </span>
  </button>
);

export const ControlsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0a0a14, #1a0a1a)' }}>
    <div className="w-full max-w-2xl border border-white/20 bg-black/60 backdrop-blur p-8">
      <h2 className="text-4xl font-black hud-font text-white mb-6 title-glow">CONTROLS</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-red-500 font-bold tracking-widest text-xs mb-3">KEYBOARD</div>
          <div className="space-y-2 text-sm">
            <Key label="Accelerate" k="W / ↑" />
            <Key label="Brake / Reverse" k="S / ↓" />
            <Key label="Steer Left" k="A / ←" />
            <Key label="Steer Right" k="D / →" />
            <Key label="Drift / Handbrake" k="SHIFT" />
            <Key label="Nitro" k="SPACE" />
            <Key label="Repair" k="F1" />
            <Key label="Camera" k="C" />
            <Key label="Pause" k="ESC" />
          </div>
        </div>
        <div>
          <div className="text-red-500 font-bold tracking-widest text-xs mb-3">TOUCH (MOBILE)</div>
          <div className="space-y-2 text-sm text-white/70">
            <p>• Left pad: steer</p>
            <p>• Right pad: gas (top) / brake (bottom)</p>
            <p>• Nitro button (blue)</p>
            <p>• Drift button (yellow)</p>
            <p>• C / 🔧 buttons for camera and repair</p>
          </div>
          <div className="text-red-500 font-bold tracking-widest text-xs mb-3 mt-6">TIPS</div>
          <ul className="space-y-1 text-sm text-white/70 list-disc list-inside">
            <li>Drift to refill nitro</li>
            <li>Use nitro on straights</li>
            <li>Repair before damage hits 100%</li>
            <li>Switch camera for better visibility</li>
          </ul>
        </div>
      </div>
      <button className="btn-secondary w-full mt-6" onClick={onBack}>← Back</button>
    </div>
  </div>
);

const Key: React.FC<{ label: string; k: string }> = ({ label, k }) => (
  <div className="flex items-center justify-between p-2 border border-white/10">
    <span className="text-white/80">{label}</span>
    <span className="px-2 py-1 bg-white/10 font-mono text-xs text-white">{k}</span>
  </div>
);

export const CreditsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0a0a14, #1a0a1a)' }}>
    <div className="w-full max-w-lg border border-white/20 bg-black/60 backdrop-blur p-8 text-center">
      <h2 className="text-4xl font-black hud-font text-white mb-6 title-glow">CREDITS</h2>
      <div className="space-y-4 text-white/70">
        <div>
          <div className="text-red-500 tracking-widest text-xs">APEX STREET</div>
          <div className="text-white font-bold">An original browser racing game</div>
        </div>
        <div className="text-sm">Built with Three.js, React, WebAudio</div>
        <div className="text-xs text-white/40">All content is original. No copyrighted assets used.</div>
        <div className="pt-4 border-t border-white/10 text-xs text-white/50">Inspired by arcade street racing games</div>
      </div>
      <button className="btn-secondary w-full mt-6" onClick={onBack}>← Back</button>
    </div>
  </div>
);

// ==============================
// HUD
// ==============================
interface HUDProps {
  hud: HUDData;
  cameraMode: 'chase' | 'cockpit';
  onPause: () => void;
  trackCurve: { getPointAt: (t: number) => { x: number; y: number; z: number } } | null;
  carPositions: { pos: { x: number; z: number }; isPlayer: boolean; color: number }[];
}

export const RaceHUD: React.FC<HUDProps> = ({ hud, cameraMode, onPause, trackCurve, carPositions }) => {
  const speedInt = Math.floor(hud.speed);
  const speedRatio = Math.min(1, hud.speed / 500);
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Speed lines overlay at high speed */}
      {hud.speed > 250 && (
        <div className="absolute inset-0 speedline" style={{ opacity: Math.min(0.6, (hud.speed - 250) / 300) }} />
      )}
      {hud.isNitro && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,229,255,0.12), transparent 70%)' }} />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-3 md:p-5 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <button className="btn-secondary pointer-events-auto text-xs px-3 py-2" onClick={onPause}>☰ PAUSE</button>
          <div className="text-white/70 text-xs tracking-widest">LAP</div>
          <div className="text-2xl font-black hud-font text-white">{Math.min(hud.lap, hud.totalLaps)}<span className="text-white/40 text-base">/{hud.totalLaps}</span></div>
        </div>
        <div className="text-center">
          <div className="text-white/50 text-xs tracking-widest">RACE TIME</div>
          <div className="text-xl font-black hud-font text-white mono">{formatTime(hud.raceTime)}</div>
        </div>
        <div className="text-right">
          <div className="text-white/50 text-xs tracking-widest">POSITION</div>
          <div className="text-3xl font-black hud-font" style={{ color: hud.position === 1 ? '#ffae00' : '#fff' }}>{hud.position}<span className="text-white/40 text-base">/{hud.totalRacers}</span></div>
        </div>
      </div>

      {/* Minimap */}
      <div className="absolute top-20 right-3 md:right-5 w-32 h-32 md:w-40 md:h-40 bg-black/50 backdrop-blur border border-white/20 rounded">
        <Minimap curve={trackCurve} cars={carPositions} />
      </div>

      {/* Bottom: speedometer */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 flex items-end justify-between">
        {/* Left: drift score */}
        <div className="flex flex-col gap-2">
          {hud.isDrifting && hud.driftScore > 50 && (
            <div className="flash-in px-4 py-2 bg-yellow-500/20 border border-yellow-400 backdrop-blur">
              <div className="text-yellow-400 text-xs tracking-widest">DRIFT!</div>
              <div className="text-2xl font-black hud-font text-yellow-300">+{Math.floor(hud.driftScore)}</div>
            </div>
          )}
          <div className="bg-black/50 backdrop-blur px-3 py-2 border border-white/20">
            <div className="text-white/50 text-xs tracking-widest">DRIFT SCORE</div>
            <div className="text-xl font-black hud-font text-yellow-400">{Math.floor(hud.totalDriftScore).toLocaleString()}</div>
          </div>
        </div>

        {/* Center: speedometer */}
        <div className="flex flex-col items-center">
          <div className="relative w-40 h-28 md:w-56 md:h-40">
            <svg viewBox="0 0 200 140" className="w-full h-full">
              {/* Gauge arc */}
              <path d="M20 130 A 80 80 0 0 1 180 130" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <path d="M20 130 A 80 80 0 0 1 180 130" fill="none" stroke="url(#speedGrad)" strokeWidth="8"
                strokeDasharray={`${speedRatio * 251} 251`} />
              <defs>
                <linearGradient id="speedGrad" x1="0" x2="1">
                  <stop offset="0%" stopColor="#00e5ff" />
                  <stop offset="60%" stopColor="#ffae00" />
                  <stop offset="100%" stopColor="#ff3b3b" />
                </linearGradient>
              </defs>
              {/* Needle */}
              <line x1="100" y1="130" x2={100 + 65 * Math.cos(Math.PI + speedRatio * Math.PI)} y2={130 + 65 * Math.sin(Math.PI + speedRatio * Math.PI)} stroke="#ff3b3b" strokeWidth="2" />
              <circle cx="100" cy="130" r="5" fill="#ff3b3b" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <div className="text-4xl md:text-6xl font-black hud-font text-white leading-none">{speedInt}</div>
              <div className="text-white/60 text-xs tracking-widest">KM/H</div>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <div className="bg-black/60 backdrop-blur px-3 py-1 border border-white/20 text-white text-xs tracking-wider font-bold">GEAR {hud.gear}</div>
            <div className="bg-black/60 backdrop-blur px-3 py-1 border border-white/20 text-white text-xs tracking-wider font-bold">{cameraMode === 'chase' ? 'CHASE' : 'COCKPIT'}</div>
          </div>
        </div>

        {/* Right: nitro + damage */}
        <div className="flex flex-col items-end gap-2 min-w-[120px]">
          <div className={`w-full bg-black/50 backdrop-blur p-2 border ${hud.isNitro ? 'border-cyan-400 nitro-active' : 'border-white/20'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-cyan-400 text-xs tracking-widest font-bold">N2O</span>
              <span className="text-white text-xs font-mono">{Math.floor(hud.nitro * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${hud.nitro * 100}%`, background: 'linear-gradient(90deg, #00e5ff, #00aaff)' }} />
            </div>
          </div>
          <div className="w-full bg-black/50 backdrop-blur p-2 border border-white/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-red-400 text-xs tracking-widest font-bold">DAMAGE</span>
              <span className="text-white text-xs font-mono">{Math.floor(hud.damage * 100)}%</span>
            </div>
            <div className="h-2 bg-white/10 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${hud.damage * 100}%`, background: 'linear-gradient(90deg, #ffae00, #ff3b3b)' }} />
            </div>
          </div>
          <div className="text-white/40 text-[10px] tracking-widest text-right">TOP: {Math.floor(hud.topSpeed)} KM/H</div>
        </div>
      </div>

      {/* Countdown */}
      {hud.countdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div key={hud.countdown} className="text-[180px] md:text-[240px] font-black hud-font text-white title-glow flash-in" style={{ color: hud.countdown === 0 ? '#00ff00' : '#ff3b3b' }}>{hud.countdown}</div>
        </div>
      )}
      {hud.countdown === 0 && hud.raceTime < 1.2 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[140px] md:text-[180px] font-black hud-font flash-in" style={{ color: '#00ff00', textShadow: '0 0 40px #00ff00' }}>GO!</div>
        </div>
      )}
    </div>
  );
};

// ==============================
// Minimap
// ==============================
const Minimap: React.FC<{ curve: any; cars: { pos: { x: number; z: number }; isPlayer: boolean; color: number }[] }> = ({ curve, cars }) => {
  if (!curve) return null;
  const pts: { x: number; y: number }[] = [];
  const N = 80;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N);
    pts.push({ x: p.x, y: p.z });
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxZ - minZ);
  const pad = 10;
  const size = 160;
  const scale = (size - pad * 2) / Math.max(w, h);
  const transform = (p: { x: number; y: number }) => ({
    x: (p.x - minX) * scale + pad,
    y: (p.y - minZ) * scale + pad,
  });
  const pathD = pts.map((p, i) => { const t = transform(p); return `${i === 0 ? 'M' : 'L'} ${t.x} ${t.y}`; }).join(' ') + ' Z';
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <path d={pathD} className="minimap-road" />
      {cars.map((c, i) => {
        const t = transform({ x: c.pos.x, y: c.pos.z });
        return <circle key={i} cx={t.x} cy={t.y} r={c.isPlayer ? 5 : 3} className={c.isPlayer ? 'minimap-player' : 'minimap-ai'} fill={c.isPlayer ? undefined : `#${c.color.toString(16).padStart(6, '0')}`} />;
      })}
    </svg>
  );
};

// ==============================
// Touch Controls
// ==============================
interface TouchControlsProps {
  onInput: (patch: { throttle?: number; brake?: number; steer?: number; drift?: boolean; nitro?: boolean; repair?: boolean; camera?: boolean }) => void;
  onCamera: () => void;
  onRepair: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onInput, onCamera, onRepair }) => {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [gas, setGas] = useState(false);
  const [brake, setBrake] = useState(false);
  const [drift, setDrift] = useState(false);
  const [nitro, setNitro] = useState(false);

  useEffect(() => {
    onInput({ steer: (left ? -1 : 0) + (right ? 1 : 0), throttle: gas ? 1 : 0, brake: brake ? 1 : 0, drift, nitro });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right, gas, brake, drift, nitro]);

  const bind = (setter: (v: boolean) => void) => ({
    onTouchStart: (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); setter(true); },
    onTouchEnd: (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); setter(false); },
    onTouchCancel: () => setter(false),
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); setter(true); },
    onMouseUp: () => setter(false),
    onMouseLeave: () => setter(false),
  });

  return (
    <div className="absolute inset-0 pointer-events-none md:hidden">
      {/* Left side: steering */}
      <div className="absolute left-4 bottom-24 flex gap-3 pointer-events-auto">
        <button className={`touch-btn w-20 h-20 rounded-full text-2xl ${left ? 'active' : ''}`} {...bind(setLeft)}>◀</button>
        <button className={`touch-btn w-20 h-20 rounded-full text-2xl ${right ? 'active' : ''}`} {...bind(setRight)}>▶</button>
      </div>
      {/* Right side: gas/brake */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-3 pointer-events-auto">
        <button className={`touch-btn w-20 h-20 rounded-full text-xs font-black ${gas ? 'active' : ''}`} {...bind(setGas)}>GAS</button>
        <button className={`touch-btn w-20 h-20 rounded-full text-xs font-black ${brake ? 'active' : ''}`} {...bind(setBrake)}>BRAKE</button>
      </div>
      {/* Top right: nitro, drift, camera, repair */}
      <div className="absolute right-4 top-24 flex flex-col gap-2 pointer-events-auto">
        <button className={`touch-btn nitro w-16 h-16 rounded-full text-xs font-black ${nitro ? 'active' : ''}`} {...bind(setNitro)}>N2O</button>
        <button className={`touch-btn drift w-16 h-16 rounded-full text-xs font-black ${drift ? 'active' : ''}`} {...bind(setDrift)}>DRIFT</button>
        <button className="touch-btn w-16 h-16 rounded-full text-xs font-black" onClick={onCamera}>CAM</button>
        <button className="touch-btn w-16 h-16 rounded-full text-xs font-black" onClick={onRepair}>🔧</button>
      </div>
    </div>
  );
};

// ==============================
// Pause / Results
// ==============================
interface PauseProps { onResume: () => void; onQuit: () => void; onRestart: () => void; }
export const PauseMenu: React.FC<PauseProps> = ({ onResume, onQuit, onRestart }) => (
  <div className="absolute inset-0 bg-black/70 backdrop-blur flex items-center justify-center p-6 z-20">
    <div className="border border-white/20 bg-black/80 p-8 max-w-md w-full">
      <h2 className="text-5xl font-black hud-font text-white mb-6 text-center title-glow">PAUSED</h2>
      <div className="space-y-2">
        <button className="btn-race w-full text-center" onClick={onResume}>▶ Resume</button>
        <button className="btn-race w-full text-center" onClick={onRestart}>↻ Restart</button>
        <button className="btn-race w-full text-center" onClick={onQuit}>✕ Quit to Menu</button>
      </div>
    </div>
  </div>
);

interface ResultsProps {
  result: RaceResult;
  reward: number;
  careerIdx: number | null;
  newCar?: CarSpec;
  onNext: () => void;
  onReplay: () => void;
  onGarage: () => void;
  onMenu: () => void;
}
export const ResultsScreen: React.FC<ResultsProps> = ({ result, reward, careerIdx, newCar, onNext, onReplay, onGarage, onMenu }) => {
  const podium = result.position <= 3;
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-20" style={{ background: 'linear-gradient(135deg, #0a0a14ee, #1a0a1aee)' }}>
      <div className="border border-white/20 bg-black/80 backdrop-blur p-8 max-w-2xl w-full slide-up">
        <div className="text-center mb-6">
          <div className="text-white/40 tracking-widest text-xs mb-2">{podium ? '★ VICTORY ★' : 'RACE COMPLETE'}</div>
          <div className="text-7xl font-black hud-font mb-2" style={{ color: podium ? '#ffae00' : '#fff' }}>
            {result.position}<span className="text-3xl text-white/40">{['st','nd','rd','th','th','th','th','th','th','th'][result.position-1] || 'th'}</span>
          </div>
          <div className="text-white/60 tracking-widest text-sm">POSITION</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Stat label="RACE TIME" value={formatTime(result.totalTime)} />
          <Stat label="BEST LAP" value={formatTime(result.bestLap)} />
          <Stat label="TOP SPEED" value={`${result.topSpeed} km/h`} />
          <Stat label="DRIFT SCORE" value={result.driftScore.toLocaleString()} />
          <Stat label="NITRO USED" value={`${result.nitroUsed}s`} />
          <Stat label="REWARD" value={`$${reward.toLocaleString()}`} highlight />
        </div>

        {newCar && (
          <div className="mb-6 p-4 border-2 border-yellow-400 bg-yellow-400/10 text-center flash-in">
            <div className="text-yellow-400 text-xs tracking-widest font-bold mb-2">★ NEW CAR UNLOCKED ★</div>
            <div className="text-3xl font-black hud-font" style={{ color: `#${newCar.color.toString(16).padStart(6, '0')}` }}>{newCar.name}</div>
            <div className="text-white/60 text-sm mt-1">{newCar.tagline}</div>
          </div>
        )}

        <div className="mb-6">
          <div className="text-white/40 text-xs tracking-widest mb-2">SAVE TO HIGH SCORES</div>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value.slice(0, 10))} placeholder="YOUR NAME"
              className="flex-1 bg-black/50 border border-white/20 px-3 py-2 text-white font-bold"
              disabled={saved}
            />
            <button disabled={saved || !name} onClick={() => { setSaved(true); }} className="btn-secondary disabled:opacity-40">SAVE</button>
          </div>
          {saved && <div className="text-green-400 text-xs mt-1">✓ Saved!</div>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {careerIdx !== null && <button className="btn-race text-center" onClick={onNext}>NEXT →</button>}
          <button className="btn-secondary" onClick={onReplay}>REPLAY</button>
          <button className="btn-secondary" onClick={onGarage}>GARAGE</button>
          <button className="btn-secondary" onClick={onMenu}>MENU</button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-3 border ${highlight ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/20 bg-black/40'}`}>
    <div className="text-white/50 text-xs tracking-widest mb-1">{label}</div>
    <div className={`text-xl font-black hud-font ${highlight ? 'text-yellow-400' : 'text-white'}`}>{value}</div>
  </div>
);
