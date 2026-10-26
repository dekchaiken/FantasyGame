// Unit tests for collision and pathfinding. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNav, findPath, isFree, blocked } from '../public/js/nav.js';

const box = (x, z, w, d) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
const RADIUS = 0.35;

// every waypoint and every segment between waypoints must be walkable
function assertWalkable(nav, from, path) {
  let cx = from.x;
  let cz = from.z;
  for (const p of path) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = cx + (p.x - cx) * t;
      const z = cz + (p.z - cz) * t;
      assert.ok(isFree(nav, x, z), `point (${x.toFixed(2)}, ${z.toFixed(2)}) is blocked`);
    }
    cx = p.x;
    cz = p.z;
  }
}

test('a straight walk with no obstacles is a single waypoint', () => {
  const nav = buildNav([], 10, RADIUS);
  const path = findPath(nav, -5, 0, 5, 0);
  assert.equal(path.length, 1);
  assert.deepEqual(path[0], { x: 5, z: 0 });
});

test('the route goes around a tree instead of through it', () => {
  // a wall of trees between the hero and the goal, with a gap at the north end
  const solids = [box(0, -1.5, 1.2, 1.2), box(0, 0.5, 1.2, 1.2), box(0, 2.5, 1.2, 1.2), box(0, 4.5, 1.2, 1.2)];
  const nav = buildNav(solids, 10, RADIUS);
  const path = findPath(nav, -3, 0, 3, 0);
  assert.ok(path, 'a path should exist');
  assertWalkable(nav, { x: -3, z: 0 }, path);
  assert.ok(path.length > 1, 'the path must bend around the obstacle');
});

test('a goal inside a sealed area has no path', () => {
  const wall = [];
  for (let x = -3; x <= 3; x += 0.6) {
    wall.push(box(x, -2, 0.7, 0.7), box(x, 2, 0.7, 0.7));
  }
  for (let z = -2; z <= 2; z += 0.6) {
    wall.push(box(-3, z, 0.7, 0.7), box(3, z, 0.7, 0.7));
  }
  const nav = buildNav(wall, 10, RADIUS);
  assert.equal(findPath(nav, -6, 6, 0, 0), null);
});

test('circular islands clip the edge', () => {
  const nav = buildNav([], 5, RADIUS, true);
  assert.equal(isFree(nav, 4.9, 4.9), false);
  assert.equal(isFree(nav, 3, 3), true);
});

test('blocked() respects the hero radius', () => {
  const solids = [box(0, 0, 1, 1)];
  assert.equal(blocked(solids, 0.8, 0, RADIUS), true);
  assert.equal(blocked(solids, 1.0, 0, RADIUS), false);
});
