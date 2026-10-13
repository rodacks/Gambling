import { parseSave, Save } from "./engine";
export const STORAGE_KEY = "gambling:v1";
export interface SaveRepository {
  load(): Save | null;
  save(state: Save): void;
  clear(): void;
}
export const localRepository: SaveRepository = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseSave(raw) : null;
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
