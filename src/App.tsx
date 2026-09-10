import { useCallback, useEffect, useRef, useState } from 'react';
import { CARS, TRACKS, CAREER, CarSpec, TrackSpec } from './game/data';
import { GameEngine, HUDData, RaceResult, InputState } from './game/Engine';
import { audio } from './game/audio';
import {
  MainMenu, CareerScreen, QuickRaceScreen, GarageScreen, SettingsScreen,
  ControlsScreen, CreditsScreen, RaceHUD, TouchControls, PauseMenu, ResultsScreen,
  loadSave, writeSave, SaveData,
} from './components/UI';

type Screen = 'menu' | 'career' | 'quickrace' | 'timetrial' | 'freedrive' | 'garage' | 'settings' | 'controls' | 'credits' | 'race' | 'paused' | 'results';

type RaceMode = 'career' | 'quick' | 'timetrial' | 'freedrive';

interface RaceConfig {
  track: TrackSpec;
  playerCar: CarSpec;
  aiSpecs: { spec: CarSpec; skill: number }[];
  careerIdx: number | null;
  mode: RaceMode;
  freeDrive: boolean;
}

function buildAIFleet(playerCar: CarSpec, count: number, level: number, save: SaveData): { spec: CarSpec; skill: number }[] {
  const available = CARS.filter(c => save.carsUnlocked.includes(c.id) || true); // AI can use locked cars
  const fleet: { spec: CarSpec; skill: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Prefer cars near player's tier, with variation
    const tierTarget = Math.max(0, CARS.indexOf(playerCar) + (Math.random() - 0.5) * 2);
    const idx = Math.max(0, Math.min(CARS.length - 1, Math.round(tierTarget)));
    const spec = available.includes(CARS[idx]) ? CARS[idx] : CARS[Math.floor(Math.random() * available.length)];
    const skill = Math.max(0.3, Math.min(1, level + (Math.random() - 0.5) * 0.25));
    fleet.push({ spec, skill });
  }
  return fleet;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [selectedCar, setSelectedCar] = useState<CarSpec>(() => {
    const s = loadSave();
    return CARS.find(c => s.carsUnlocked.includes(c.id)) || CARS[0];
  });
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>(() =>
    // Auto-detect: mobile/tablet starts on LOW for smooth FPS, desktop on HIGH
    typeof window !== 'undefined' && (('ontouchstart' in window && window.innerWidth < 900) || window.innerWidth < 700) ? 'low' : 'high'
  );

  const [hud, setHud] = useState<HUDData | null>(null);
  const [cameraMode, setCameraMode] = useState<'chase' | 'cockpit'>('chase');
  const [result, setResult] = useState<RaceResult | null>(null);
  const [raceConfig, setRaceConfig] = useState<RaceConfig | null>(null);
  const [newCarUnlock, setNewCarUnlock] = useState<CarSpec | null>(null);
  const [reward, setReward] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputState>({ throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, repair: false, camera: false });
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window && window.innerWidth < 900;

  // Persist save
  useEffect(() => { writeSave(save); }, [save]);

  // Init audio on first interaction
  useEffect(() => {
    const handler = () => { audio.init(); audio.resume(); };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  useEffect(() => {
    audio.setEnabled(sfxOn);
  }, [sfxOn]);

  useEffect(() => {
    audio.setMusicEnabled(musicOn);
  }, [musicOn]);

  // Keyboard input
  useEffect(() => {
    if (screen !== 'race' && screen !== 'paused') return;
    const keys = new Set<string>();
    const update = () => {
      const throttle = (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
      const brake = (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
      const steerL = keys.has('a') || keys.has('arrowleft');
      const steerR = keys.has('d') || keys.has('arrowright');
      const steer = (steerL ? -1 : 0) + (steerR ? 1 : 0);
      const drift = keys.has('shift');
      const nitro = keys.has(' ');
      inputRef.current = { ...inputRef.current, throttle, brake, steer, drift, nitro };
      engineRef.current?.setInput(inputRef.current);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) {
        e.preventDefault();
      }
      keys.add(k);
      update();
      if (k === 'escape') {
        if (screen === 'race') pauseRace();
        else if (screen === 'paused') resumeRace();
      }
      if (k === 'c' && screen === 'race') {
        engineRef.current?.toggleCamera();
        setCameraMode(engineRef.current?.getCameraMode() || 'chase');
      }
      if (k === 'f1' && screen === 'race') {
        e.preventDefault();
        inputRef.current.repair = true;
        engineRef.current?.setInput({ repair: true });
        setTimeout(() => { inputRef.current.repair = false; engineRef.current?.setInput({ repair: false }); }, 200);
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      update();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const startRace = useCallback((track: TrackSpec, car: CarSpec, careerIdx: number | null, mode: RaceMode, freeDrive = false) => {
    if (!containerRef.current) return;
    audio.init(); audio.resume();
    // cleanup old
    engineRef.current?.dispose();
    const engine = new GameEngine(containerRef.current, {
      onStateChange: (s) => {
        if (s === 'paused') setScreen('paused');
        else if (s === 'racing') setScreen('race');
        else if (s === 'finished') setScreen('results');
      },
      onHUD: (h) => setHud(h),
      onFinish: (r) => {
        const prevBest = save.bestTimes[track.id];
        const improved = careerIdx === null && (!prevBest || r.totalTime < prevBest);
        setNewBest(improved);
        const rewardMoney = careerIdx !== null ? CAREER[careerIdx].reward : 500;
        const positionBonus = r.position === 1 ? 1.5 : r.position === 2 ? 1.2 : r.position === 3 ? 1.0 : 0.5;
        const driftBonus = Math.floor(r.driftScore * 0.1);
        const totalReward = Math.floor(rewardMoney * positionBonus) + driftBonus;
        setResult(r);
        setReward(totalReward);
        setNewCarUnlock(null);
        // Progress save
        setSave(prev => {
          const next = { ...prev };
          next.money = prev.money + totalReward;
          // Update best time
          if (r.position <= 3) {
            const prev_best = prev.bestTimes[track.id];
            if (!prev_best || r.totalTime < prev_best) next.bestTimes = { ...prev.bestTimes, [track.id]: r.totalTime };
          }
          // Career progress
          if (careerIdx !== null && r.position <= 3 && careerIdx === prev.careerRaceUnlocked) {
            next.careerRaceUnlocked = Math.min(CAREER.length, prev.careerRaceUnlocked + 1);
          }
          // Car unlock
          if (careerIdx !== null && CAREER[careerIdx].unlockCarId && r.position <= 3) {
            const carId = CAREER[careerIdx].unlockCarId;
            if (!prev.carsUnlocked.includes(carId)) {
              next.carsUnlocked = [...prev.carsUnlocked, carId];
              const unlockedCar = CARS.find(c => c.id === carId);
              if (unlockedCar) setNewCarUnlock(unlockedCar);
            }
          }
          // High score
          const score = Math.floor(totalReward + r.driftScore * 0.5 + (r.position === 1 ? 1000 : 0));
          const hs = [...prev.highScores, { name: 'YOU', score, date: new Date().toISOString().slice(0, 10) }];
          hs.sort((a, b) => b.score - a.score);
          next.highScores = hs.slice(0, 10);
          return next;
        });
      },
      onShake: () => { /* handled via CSS by HUD */ },
    }, { quality });
    engineRef.current = engine;
    const noAI = freeDrive || mode === 'timetrial';
    const aiSpecs = noAI ? [] : buildAIFleet(car, track.aiCount, careerIdx !== null ? CAREER[careerIdx].opponentLevel : 0.6, save);
    setRaceConfig({ track, playerCar: car, aiSpecs, careerIdx, mode, freeDrive });
    setHud(null);
    setResult(null);
    setNewBest(false);
    setScreen('race');
    setCameraMode('chase');
    engine.startRace(car, track, aiSpecs, { freeDrive });
  }, [save, quality]);

  const pauseRace = () => {
    engineRef.current?.pause();
    setScreen('paused');
  };
  const resumeRace = () => {
    engineRef.current?.resume();
    setScreen('race');
  };
  const restartRace = () => {
    if (!raceConfig) return;
    startRace(raceConfig.track, raceConfig.playerCar, raceConfig.careerIdx, raceConfig.mode, raceConfig.freeDrive);
  };
  const quitRace = () => {
    engineRef.current?.cleanup();
    engineRef.current = null;
    setResult(null);
    setHud(null);
    setScreen('menu');
  };

  // Touch input handler
  const handleTouchInput = (patch: Partial<InputState>) => {
    inputRef.current = { ...inputRef.current, ...patch };
    engineRef.current?.setInput(inputRef.current);
  };
  const handleTouchCamera = () => {
    engineRef.current?.toggleCamera();
    setCameraMode(engineRef.current?.getCameraMode() || 'chase');
  };
  const handleTouchRepair = () => {
    inputRef.current.repair = true;
    engineRef.current?.setInput({ repair: true });
    setTimeout(() => { inputRef.current.repair = false; engineRef.current?.setInput({ repair: false }); }, 200);
  };

  // Cleanup engine on unmount
  useEffect(() => () => { engineRef.current?.dispose(); audio.dispose(); }, []);

  // Render based on screen
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black text-white">
      {/* 3D canvas container — always mounted AND keeps its size (visibility keeps layout,
          unlike display:none which makes the canvas 0x0 = black screen) */}
      <div ref={containerRef} className="absolute inset-0" style={{ visibility: (screen === 'race' || screen === 'paused' || screen === 'results') ? 'visible' : 'hidden' }} />

      {/* Menus */}
      {screen === 'menu' && (
        <MainMenu
          selectedCar={selectedCar}
          onPlay={() => setScreen('career')}
          onQuickRace={() => setScreen('quickrace')}
          onTimeTrial={() => setScreen('timetrial')}
          onFreeDrive={() => setScreen('freedrive')}
          onGarage={() => setScreen('garage')}
          onSettings={() => setScreen('settings')}
          onControls={() => setScreen('controls')}
          onCredits={() => setScreen('credits')}
        />
      )}
      {screen === 'career' && (
        <CareerScreen
          save={save}
          selectedCar={selectedCar}
          onStart={(idx) => {
            const race = CAREER[idx];
            const track = TRACKS.find(t => t.id === race.trackId)!;
            startRace(track, selectedCar, idx, 'career');
          }}
          onBack={() => setScreen('menu')}
          onOpenGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'quickrace' && (
        <QuickRaceScreen
          save={save}
          selectedCar={selectedCar}
          onStart={(track) => startRace(track, selectedCar, null, 'quick')}
          onBack={() => setScreen('menu')}
          onOpenGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'timetrial' && (
        <QuickRaceScreen
          title="TIME TRIAL"
          save={save}
          selectedCar={selectedCar}
          onStart={(track) => startRace(track, selectedCar, null, 'timetrial')}
          onBack={() => setScreen('menu')}
          onOpenGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'freedrive' && (
        <QuickRaceScreen
          title="FREE DRIVE"
          save={save}
          selectedCar={selectedCar}
          onStart={(track) => startRace(track, selectedCar, null, 'freedrive', true)}
          onBack={() => setScreen('menu')}
          onOpenGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'garage' && (
        <GarageScreen
          save={save}
          selectedCar={selectedCar}
          onSelect={(c) => { setSelectedCar(c); audio.playUIClick(); }}
          onUnlock={(c) => {
            if (save.money >= c.price) {
              setSave(prev => ({ ...prev, money: prev.money - c.price, carsUnlocked: [...prev.carsUnlocked, c.id] }));
              audio.playUIClick();
            }
          }}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          sfxOn={sfxOn} musicOn={musicOn} quality={quality}
          onToggleSfx={() => setSfxOn(v => !v)}
          onToggleMusic={() => setMusicOn(v => !v)}
          onQuality={setQuality}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'controls' && <ControlsScreen onBack={() => setScreen('menu')} />}
      {screen === 'credits' && <CreditsScreen onBack={() => setScreen('menu')} />}

      {/* Race HUD */}
      {(screen === 'race' || screen === 'paused' || screen === 'results') && hud && engineRef.current && (
        <RaceHUD
          hud={hud}
          cameraMode={cameraMode}
          onPause={pauseRace}
          trackCurve={engineRef.current.getTrackCurve() as any}
          carPositions={engineRef.current.getCarPositions()}
        />
      )}

      {/* Touch controls on mobile */}
      {screen === 'race' && isMobile && (
        <TouchControls onInput={handleTouchInput} onCamera={handleTouchCamera} onRepair={handleTouchRepair} />
      )}

      {/* Pause menu */}
      {screen === 'paused' && (
        <PauseMenu onResume={resumeRace} onRestart={restartRace} onQuit={quitRace} />
      )}

      {/* Results */}
      {screen === 'results' && result && raceConfig && (
        <ResultsScreen
          result={result}
          reward={reward}
          careerIdx={raceConfig.careerIdx}
          newCar={newCarUnlock || undefined}
          modeLabel={raceConfig.mode === 'career' ? 'CAREER RACE' : raceConfig.mode === 'timetrial' ? 'TIME TRIAL' : raceConfig.mode === 'freedrive' ? 'FREE DRIVE' : 'QUICK RACE'}
          newBest={newBest}
          onNext={() => {
            if (raceConfig.careerIdx !== null && raceConfig.careerIdx + 1 < CAREER.length) {
              const nextIdx = raceConfig.careerIdx + 1;
              const nextRace = CAREER[nextIdx];
              const track = TRACKS.find(t => t.id === nextRace.trackId)!;
              startRace(track, selectedCar, nextIdx, 'career');
            } else {
              setScreen('menu');
            }
          }}
          onReplay={restartRace}
          onGarage={() => { engineRef.current?.cleanup(); engineRef.current = null; setScreen('garage'); }}
          onMenu={quitRace}
        />
      )}
    </div>
  );
}
