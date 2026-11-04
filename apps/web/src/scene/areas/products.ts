import * as THREE from 'three';
import { Part, box, capsule, cyl, sphere } from '../chibi/buildChibi';

/** Supermarket products by shelf category (ids = supermarket.yaml items). */
export const PRODUCTS_BY_CATEGORY: Record<string, string[]> = {
  'fruit-veg': ['bananas', 'apples', 'grapes', 'lettuce', 'onions', 'oranges', 'tomatoes', 'carrots', 'potatoes'],
  bakery: ['bread', 'croissant', 'cake', 'muffins', 'flour', 'sugar'],
  snacks: ['chips', 'chocolate', 'rice', 'pasta', 'cereal', 'honey', 'cookies'],
  dairy: ['milk', 'cheese', 'eggs', 'yogurt', 'butter'],
  drinks: ['juice', 'water', 'soda', 'coffee', 'tea'],
  household: ['soap', 'toothpaste', 'toilet-paper', 'shampoo', 'tissues'],
  'meat-fish': ['chicken', 'fish', 'sausages', 'beef', 'ham'],
  frozen: ['ice-cream', 'frozen-peas', 'frozen-pizza', 'fish-fingers'],
};

/** One small product built around the origin (bottom at y = 0), roughly 0.15–0.35 m. */
export function productShape(p: Part, id: string) {
  switch (id) {
    case 'bananas':
      for (let i = 0; i < 4; i++) p.add(capsule(0.03, 0.16), '#f6d33c', { p: [i * 0.045 - 0.07, 0.06, 0], r: [0, 0, 0.9 + i * 0.06] });
      break;
    case 'apples':
      for (let i = 0; i < 3; i++) p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#e5533d', { p: [i * 0.11 - 0.11, 0.06, (i % 2) * 0.05] });
      break;
    case 'grapes':
      for (let i = 0; i < 7; i++) p.add(sphere(0.035, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#7b3fa0', { p: [Math.cos(i) * 0.04, 0.04 + (i % 3) * 0.04, Math.sin(i) * 0.04] });
      break;
    case 'lettuce':
      p.add(sphere(0.1, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#8bd16a', { p: [0, 0.09, 0], s: [1, 0.85, 1] });
      break;
    case 'onions':
      for (let i = 0; i < 3; i++) p.add(sphere(0.05, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#d9a35a', { p: [i * 0.1 - 0.1, 0.05, 0], s: [1, 1.15, 1] });
      break;
    case 'bread':
      p.add(capsule(0.07, 0.16), '#d39a52', { p: [0, 0.07, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.9] });
      break;
    case 'croissant':
      p.add(new THREE.TorusGeometry(0.07, 0.035, 6, 10, Math.PI * 1.2), '#e0a656', { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0] });
      break;
    case 'cake':
      p.add(cyl(0.12, 0.12, 0.12, 16), '#6b3b2a', { p: [0, 0.06, 0] });
      p.add(cyl(0.122, 0.122, 0.03, 16), '#ffffff', { p: [0, 0.125, 0] });
      p.add(sphere(0.02), '#e23b4e', { p: [0, 0.15, 0] });
      break;
    case 'chips':
      p.add(box(0.16, 0.22, 0.06), '#f2c94c', { p: [0, 0.11, 0] });
      p.add(box(0.1, 0.06, 0.062), '#e5533d', { p: [0, 0.13, 0] });
      break;
    case 'chocolate':
      p.add(box(0.18, 0.03, 0.08), '#5a2e1e', { p: [0, 0.015, 0] });
      p.add(box(0.1, 0.032, 0.082), '#c0392b', { p: [0.03, 0.016, 0] });
      break;
    case 'rice':
      p.add(box(0.14, 0.2, 0.08), '#f4efe2', { p: [0, 0.1, 0] });
      p.add(box(0.08, 0.06, 0.082), '#2f80ed', { p: [0, 0.12, 0] });
      break;
    case 'milk':
      p.add(box(0.08, 0.18, 0.08), '#ffffff', { p: [0, 0.09, 0] });
      p.add(box(0.06, 0.04, 0.06), '#2f80ed', { p: [0, 0.2, 0], r: [0, Math.PI / 4, 0] });
      p.add(box(0.082, 0.05, 0.082), '#5ab0dc', { p: [0, 0.1, 0] });
      break;
    case 'cheese':
      p.add(cyl(0.09, 0.09, 0.07, 3), '#f4c542', { p: [0, 0.035, 0] });
      break;
    case 'eggs':
      p.add(box(0.2, 0.06, 0.1), '#c9b49a', { p: [0, 0.03, 0] });
      for (let i = 0; i < 4; i++) p.add(sphere(0.022, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#fbf3e4', { p: [i * 0.045 - 0.07, 0.07, 0], s: [1, 1.25, 1] });
      break;
    case 'yogurt':
      p.add(cyl(0.04, 0.035, 0.08, 10), '#ffffff', { p: [0, 0.04, 0] });
      p.add(cyl(0.042, 0.042, 0.01, 10), '#e23b4e', { p: [0, 0.085, 0] });
      break;
    case 'juice':
      p.add(cyl(0.04, 0.045, 0.2, 10), '#f39c12', { p: [0, 0.1, 0] });
      p.add(cyl(0.02, 0.02, 0.04, 8), '#ffffff', { p: [0, 0.22, 0] });
      break;
    case 'water':
      p.add(cyl(0.04, 0.045, 0.24, 10), '#a8dcf2', { p: [0, 0.12, 0] });
      p.add(cyl(0.018, 0.018, 0.04, 8), '#2f80ed', { p: [0, 0.26, 0] });
      break;
    case 'soda':
      p.add(cyl(0.035, 0.035, 0.12, 10), '#e5533d', { p: [0, 0.06, 0] });
      p.add(cyl(0.036, 0.036, 0.02, 10), '#ffffff', { p: [0, 0.07, 0] });
      break;
    case 'soap':
      p.add(box(0.12, 0.05, 0.07), '#f7a8c4', { p: [0, 0.025, 0] });
      break;
    case 'toothpaste':
      p.add(box(0.2, 0.05, 0.05), '#ffffff', { p: [0, 0.025, 0] });
      p.add(box(0.08, 0.052, 0.052), '#2f80ed', { p: [0.04, 0.026, 0] });
      break;
    case 'toilet-paper':
      for (let i = 0; i < 4; i++) p.add(cyl(0.05, 0.05, 0.1, 10), '#fafafa', { p: [(i % 2) * 0.1 - 0.05, 0.05, Math.floor(i / 2) * 0.1 - 0.05] });
      break;
    case 'chicken':
      p.add(box(0.2, 0.05, 0.14), '#ffffff', { p: [0, 0.025, 0] });
      p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f2b6a0', { p: [0, 0.06, 0], s: [1.4, 0.6, 1] });
      break;
    case 'fish':
      p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#a7b8c8', { p: [0, 0.04, 0], s: [2, 0.6, 0.8] });
      p.add(new THREE.ConeGeometry(0.04, 0.06, 4), '#8a9caf', { p: [-0.14, 0.04, 0], r: [0, 0, Math.PI / 2] });
      break;
    case 'sausages':
      p.add(box(0.2, 0.04, 0.12), '#ffffff', { p: [0, 0.02, 0] });
      for (let i = 0; i < 3; i++) p.add(capsule(0.018, 0.14), '#b5552f', { p: [0, 0.055, i * 0.035 - 0.035], r: [0, 0, Math.PI / 2] });
      break;
    case 'ice-cream':
      p.add(cyl(0.07, 0.06, 0.1, 12), '#fdf1e0', { p: [0, 0.05, 0] });
      p.add(cyl(0.072, 0.072, 0.015, 12), '#f7a8c4', { p: [0, 0.105, 0] });
      break;
    case 'frozen-peas':
      p.add(box(0.15, 0.2, 0.05), '#5fae4e', { p: [0, 0.1, 0] });
      p.add(sphere(0.03), '#9be07a', { p: [0, 0.12, 0.03] });
      break;
    case 'oranges':
      for (let i = 0; i < 3; i++) p.add(sphere(0.055, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f39c12', { p: [i * 0.1 - 0.1, 0.055, (i % 2) * 0.04] });
      break;
    case 'tomatoes':
      for (let i = 0; i < 3; i++) {
        p.add(sphere(0.05, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#e23b2e', { p: [i * 0.1 - 0.1, 0.045, 0], s: [1, 0.85, 1] });
        p.add(cyl(0.012, 0.012, 0.02, 5), '#3d8b37', { p: [i * 0.1 - 0.1, 0.095, 0] });
      }
      break;
    case 'carrots':
      for (let i = 0; i < 3; i++) {
        p.add(new THREE.ConeGeometry(0.025, 0.18, 6), '#f08a2c', { p: [0, 0.03, i * 0.05 - 0.05], r: [0, 0, Math.PI / 2] });
        p.add(box(0.04, 0.03, 0.03), '#5fae4e', { p: [0.1, 0.03, i * 0.05 - 0.05] });
      }
      break;
    case 'potatoes':
      for (let i = 0; i < 4; i++) p.add(sphere(0.045, 0, Math.PI, 0, Math.PI * 2, 7, 5), '#b98a55', { p: [(i % 2) * 0.09 - 0.045, 0.04, Math.floor(i / 2) * 0.08 - 0.04], s: [1.3, 0.85, 1] });
      break;
    case 'muffins':
      for (const dx of [-0.06, 0.06]) {
        p.add(cyl(0.045, 0.035, 0.06, 10), '#f2e6d0', { p: [dx, 0.03, 0] });
        p.add(sphere(0.05, 0, Math.PI, 0, Math.PI / 2, 10, 5), '#7a4a2a', { p: [dx, 0.06, 0] });
      }
      break;
    case 'flour':
      p.add(box(0.12, 0.18, 0.07), '#f7f3ea', { p: [0, 0.09, 0] });
      p.add(box(0.08, 0.05, 0.072), '#d39a52', { p: [0, 0.1, 0] });
      break;
    case 'sugar':
      p.add(box(0.12, 0.16, 0.07), '#ffffff', { p: [0, 0.08, 0] });
      p.add(box(0.08, 0.05, 0.072), '#e23b4e', { p: [0, 0.09, 0] });
      break;
    case 'butter':
      p.add(box(0.14, 0.05, 0.07), '#f6e27a', { p: [0, 0.025, 0] });
      p.add(box(0.06, 0.052, 0.072), '#2f80ed', { p: [0, 0.026, 0] });
      break;
    case 'pasta':
      p.add(box(0.1, 0.22, 0.05), '#2f80ed', { p: [0, 0.11, 0] });
      p.add(box(0.06, 0.1, 0.052), '#f2d38a', { p: [0, 0.12, 0] });
      break;
    case 'cereal':
      p.add(box(0.16, 0.24, 0.06), '#f2c94c', { p: [0, 0.12, 0] });
      p.add(sphere(0.04, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#e5533d', { p: [0, 0.14, 0.03], s: [1, 1, 0.3] });
      break;
    case 'honey':
      p.add(cyl(0.045, 0.045, 0.1, 10), '#e0a12e', { p: [0, 0.05, 0] });
      p.add(cyl(0.048, 0.048, 0.025, 10), '#b5552f', { p: [0, 0.112, 0] });
      break;
    case 'cookies':
      p.add(box(0.18, 0.06, 0.08), '#c0392b', { p: [0, 0.03, 0] });
      for (let i = 0; i < 2; i++) p.add(cyl(0.035, 0.035, 0.012, 10), '#c98a52', { p: [i * 0.08 - 0.04, 0.066, 0] });
      break;
    case 'coffee':
      p.add(box(0.1, 0.2, 0.06), '#4a2c1d', { p: [0, 0.1, 0] });
      p.add(box(0.06, 0.05, 0.062), '#f2c94c', { p: [0, 0.12, 0] });
      break;
    case 'tea':
      p.add(box(0.14, 0.09, 0.07), '#3d8b37', { p: [0, 0.045, 0] });
      p.add(box(0.08, 0.04, 0.072), '#ffffff', { p: [0, 0.05, 0] });
      break;
    case 'beef':
      p.add(box(0.2, 0.05, 0.14), '#ffffff', { p: [0, 0.025, 0] });
      p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#a63a2c', { p: [0, 0.06, 0], s: [1.5, 0.5, 1] });
      break;
    case 'ham':
      p.add(box(0.18, 0.04, 0.12), '#ffffff', { p: [0, 0.02, 0] });
      p.add(cyl(0.05, 0.05, 0.02, 12), '#f2a0a6', { p: [0, 0.05, 0] });
      break;
    case 'frozen-pizza':
      p.add(box(0.22, 0.04, 0.22), '#e5533d', { p: [0, 0.02, 0] });
      p.add(cyl(0.08, 0.08, 0.005, 12), '#f2c94c', { p: [0, 0.042, 0] });
      break;
    case 'fish-fingers':
      p.add(box(0.18, 0.05, 0.12), '#2f80ed', { p: [0, 0.025, 0] });
      for (let i = 0; i < 3; i++) p.add(box(0.12, 0.02, 0.025), '#e0a656', { p: [0, 0.06, i * 0.035 - 0.035] });
      break;
    case 'shampoo':
      p.add(cyl(0.04, 0.045, 0.18, 10), '#7b3fa0', { p: [0, 0.09, 0], s: [1, 1, 0.6] });
      p.add(cyl(0.02, 0.02, 0.03, 8), '#ffffff', { p: [0, 0.195, 0] });
      break;
    case 'tissues':
      p.add(box(0.18, 0.08, 0.1), '#8fd3c8', { p: [0, 0.04, 0] });
      p.add(box(0.05, 0.03, 0.04), '#ffffff', { p: [0, 0.09, 0] });
      break;
    default:
      p.add(box(0.12, 0.15, 0.08), '#cccccc', { p: [0, 0.075, 0] });
  }
}
