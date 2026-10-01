// Band comparisons on probabilities that carry two decimals: 1 - 0.9 and 0.5 - 0.4 are off by a float step, so a value exactly on a band must still count.

const EPSILON = 1e-9;

export const atLeast = (value: number, bound: number): boolean => value - bound >= -EPSILON;
export const atMost = (value: number, bound: number): boolean => bound - value >= -EPSILON;
