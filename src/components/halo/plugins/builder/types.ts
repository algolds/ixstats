/** One place the builder Halo can jump to: a founding step or an editor section. */
export interface BuilderHaloSection {
  id: string;
  label: string;
}

/** What `BuilderHalo` hands its expanded view. */
export interface BuilderHaloContext {
  sections: BuilderHaloSection[];
  currentId: string | null;
  onJump: (id: string) => void;
}
