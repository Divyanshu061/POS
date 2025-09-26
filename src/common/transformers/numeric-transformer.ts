// src/common/transformers/numeric-transformer.ts
import { ValueTransformer } from 'typeorm';

export const numericToNumber: ValueTransformer = {
  to(value: number | null) {
    return value;
  },
  from(value: string | number | null) {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  },
};
