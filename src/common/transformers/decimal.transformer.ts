// src/common/transformers/decimal.transformer.ts
export const decimalTransformer = {
  to: (value: number): number => value,
  from: (value: string): number => parseFloat(value),
};
