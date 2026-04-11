import test from "node:test";
import assert from "node:assert/strict";

import {
  distanceIndexToOption,
  distanceOptionToIndex,
  normalizeDistanceOption,
} from "../distance-options";

test("normalizeDistanceOption maps legacy values to the nearest preset and rounds ties up", () => {
  assert.equal(normalizeDistanceOption(35), 40);
  assert.equal(normalizeDistanceOption(45), 50);
  assert.equal(normalizeDistanceOption(65), 60);
  assert.equal(normalizeDistanceOption(80), 75);
  assert.equal(normalizeDistanceOption(95), 100);
});

test("normalizeDistanceOption returns null for empty or invalid values", () => {
  assert.equal(normalizeDistanceOption(null), null);
  assert.equal(normalizeDistanceOption(undefined), null);
  assert.equal(normalizeDistanceOption(0), null);
  assert.equal(normalizeDistanceOption(-10), null);
});

test("distance option index helpers round-trip shared presets and clamp out-of-range indices", () => {
  assert.equal(distanceIndexToOption(distanceOptionToIndex(5)), 5);
  assert.equal(distanceIndexToOption(distanceOptionToIndex(50)), 50);
  assert.equal(distanceIndexToOption(distanceOptionToIndex(300)), 300);
  assert.equal(distanceIndexToOption(-1), 5);
  assert.equal(distanceIndexToOption(999), 300);
});
