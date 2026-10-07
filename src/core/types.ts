export type SpecialKind = 'spin-again' | 'message';
export type SpecialVisibility = 'always' | 'free-only';

export interface Student {
  id: string;
  graderId: string | null;
  firstName: string;
  lastName: string;
  color: string | null;
  pickCount: number;
  weight: number;
  active: boolean;
}

export interface Special {
  id: string;
  label: string;
  color: string;
  kind: SpecialKind;
  message?: string;
  /** Percent of every spin, 0–100 (exclusive of 100 in total). */
  probability: number;
  showIn: SpecialVisibility;
}
