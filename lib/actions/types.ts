export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export const IDLE: ActionState = { ok: false };

export function fail(error: string): ActionState {
  return { ok: false, error };
}

export function done(message?: string): ActionState {
  return { ok: true, message };
}

export type QuantityResult = {
  ok: boolean;
  error?: string;
  quantity?: number;
};
