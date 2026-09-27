export const INPUT_TYPES = ['text', 'number', 'email', 'file', 'date'] as const;

export type InputType = (typeof INPUT_TYPES)[number];
