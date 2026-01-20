// /types/preferences.ts
export type Gender = "male" | "female" | "non_binary";

export interface UserPreferences {
  gender?: Gender | null;
  kinks?: string[] | null;
}

export interface UpdatePreferencesPayload {
  gender: Gender;
  kinks: string[];
}