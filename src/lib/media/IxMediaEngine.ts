export type EngineEvent = "statechange" | "timeupdate" | "durationchange" | "ended" | "error";

export class IxMediaEngine {
  private audio: HTMLAudioElement;
  private context: AudioContext | null = null;
  private listeners: Map<EngineEvent, Set<(...args: any[]) => void>> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.setupListeners();
    } else {
      this.audio = {} as HTMLAudioElement;
    }
  }

  public load(url: string, speed = 1.0) {
    if (typeof window === "undefined") return;
    this.audio.src = url;
    this.audio.playbackRate = speed;
    this.audio.load();
  }

  public play(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    this.initializeAudioContext();
    return this.audio.play();
  }

  public pause() {
    if (typeof window === "undefined") return;
    this.audio.pause();
  }

  public seek(seconds: number) {
    if (typeof window === "undefined") return;
    this.audio.currentTime = seconds;
  }

  public setVolume(volume: number) {
    if (typeof window === "undefined") return;
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  public setSpeed(speed: number) {
    if (typeof window === "undefined") return;
    this.audio.playbackRate = speed;
  }

  public get duration(): number {
    return this.audio.duration || 0;
  }
  public get currentTime(): number {
    return this.audio.currentTime || 0;
  }
  public get isPlaying(): boolean {
    return typeof window !== "undefined" && !this.audio.paused;
  }

  public addEventListener(event: EngineEvent, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public removeEventListener(event: EngineEvent, callback: (...args: any[]) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  private initializeAudioContext() {
    if (!this.context && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.context = new AudioCtx();
    }
  }

  private setupListeners() {
    this.audio.addEventListener("timeupdate", () =>
      this.emit("timeupdate", this.audio.currentTime)
    );
    this.audio.addEventListener("durationchange", () =>
      this.emit("durationchange", this.audio.duration)
    );
    this.audio.addEventListener("ended", () => this.emit("ended"));
    this.audio.addEventListener("error", (e) => this.emit("error", e));
    this.audio.addEventListener("play", () => this.emit("statechange", "playing"));
    this.audio.addEventListener("pause", () => this.emit("statechange", "paused"));
  }

  private emit(event: EngineEvent, ...args: any[]) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}
