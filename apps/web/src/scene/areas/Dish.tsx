import { useMemo } from 'react';
import { Part, box, capsule, cyl, sphere } from '../chibi/buildChibi';
import { chibiMaterial } from '../chibi/buildChibi';

/** Restaurant menu items as little plates/glasses (ids = restaurant.yaml items). */
function build(p: Part, id: string) {
  const plate = () => p.add(cyl(0.17, 0.13, 0.03, 18), '#ffffff', { p: [0, 0.015, 0] });
  const bowl = (c: string) => {
    p.add(cyl(0.13, 0.08, 0.08, 16), '#ffffff', { p: [0, 0.04, 0] });
    p.add(cyl(0.115, 0.115, 0.01, 16), c, { p: [0, 0.075, 0] });
  };
  const glass = (c: string, h = 0.16) => {
    p.add(cyl(0.045, 0.04, h, 12), '#e6f4fb', { p: [0, h / 2, 0] });
    p.add(cyl(0.04, 0.036, h * 0.75, 12), c, { p: [0, h * 0.38, 0] });
  };
  switch (id) {
    case 'tomato-soup': bowl('#d9452f'); break;
    case 'garden-salad': plate(); for (let i = 0; i < 6; i++) p.add(sphere(0.04, 0, Math.PI, 0, Math.PI * 2, 6, 4), i % 3 ? '#7cc45a' : '#e5533d', { p: [Math.cos(i) * 0.07, 0.05, Math.sin(i) * 0.07] }); break;
    case 'garlic-bread': plate(); for (const dx of [-0.05, 0.05]) p.add(box(0.07, 0.03, 0.14), '#e0b060', { p: [dx, 0.045, 0], r: [0, 0.3, 0] }); break;
    case 'steak': plate(); p.add(sphere(0.08, 0, Math.PI, 0, Math.PI * 2, 10, 6), '#7a3b26', { p: [-0.03, 0.04, 0], s: [1.3, 0.35, 1] }); for (let i = 0; i < 5; i++) p.add(box(0.015, 0.015, 0.08), '#f2c94c', { p: [0.08 + (i % 2) * 0.02, 0.045, i * 0.02 - 0.04] }); break;
    case 'grilled-fish': plate(); p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 10, 6), '#d9b89a', { p: [0, 0.045, 0], s: [2, 0.5, 0.8] }); p.add(sphere(0.03), '#f6e04a', { p: [0.1, 0.05, 0.06] }); break;
    case 'roast-chicken': plate(); p.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 10, 6), '#c9803a', { p: [0, 0.06, 0], s: [1.2, 0.8, 1] }); break;
    case 'spaghetti': plate(); p.add(sphere(0.09, 0, Math.PI / 2, 0, Math.PI * 2, 12, 6), '#f2d38a', { p: [0, 0.02, 0], s: [1, 0.5, 1] }); p.add(sphere(0.05, 0, Math.PI / 2, 0, Math.PI * 2, 10, 5), '#d9452f', { p: [0, 0.05, 0], s: [1, 0.5, 1] }); break;
    case 'burger': plate(); p.add(sphere(0.07, 0, Math.PI / 2, 0, Math.PI * 2, 12, 6), '#d39a52', { p: [0, 0.08, 0] }); p.add(cyl(0.07, 0.07, 0.025, 12), '#6b3b2a', { p: [0, 0.06, 0] }); p.add(cyl(0.072, 0.072, 0.012, 12), '#f2c94c', { p: [0, 0.075, 0] }); p.add(cyl(0.07, 0.07, 0.025, 12), '#d39a52', { p: [0, 0.035, 0] }); break;
    case 'pizza': p.add(cyl(0.16, 0.16, 0.02, 20), '#e8b860', { p: [0, 0.01, 0] }); p.add(cyl(0.14, 0.14, 0.01, 20), '#d9452f', { p: [0, 0.025, 0] }); for (let i = 0; i < 5; i++) p.add(cyl(0.02, 0.02, 0.008, 8), '#fff3c4', { p: [Math.cos(i * 1.3) * 0.08, 0.032, Math.sin(i * 1.3) * 0.08] }); break;
    case 'curry': bowl('#e0a12e'); p.add(sphere(0.05, 0, Math.PI / 2, 0, Math.PI * 2, 8, 4), '#ffffff', { p: [0.04, 0.08, 0], s: [1, 0.5, 1] }); break;
    case 'chocolate-cake': plate(); p.add(cyl(0.07, 0.07, 0.07, 3), '#5a2e1e', { p: [0, 0.05, 0] }); p.add(sphere(0.02), '#ffffff', { p: [0, 0.1, 0] }); break;
    case 'ice-cream': p.add(cyl(0.06, 0.03, 0.06, 12), '#e6f4fb', { p: [0, 0.03, 0] }); for (const [c, y] of [['#fdf1e0', 0.08], ['#f7a8c4', 0.12]] as const) p.add(sphere(0.045, 0, Math.PI, 0, Math.PI * 2, 8, 6), c, { p: [0, y, 0] }); break;
    case 'fruit-salad': bowl('#f7d9a8'); for (let i = 0; i < 5; i++) p.add(sphere(0.025, 0, Math.PI, 0, Math.PI * 2, 6, 4), ['#e5533d', '#7b3fa0', '#f2c94c', '#7cc45a', '#f08a2c'][i]!, { p: [Math.cos(i * 1.2) * 0.05, 0.085, Math.sin(i * 1.2) * 0.05] }); break;
    case 'water': glass('#cfeaf7', 0.15); break;
    case 'orange-juice': glass('#f39c12'); break;
    case 'coffee': p.add(cyl(0.08, 0.08, 0.01, 14), '#ffffff', { p: [0, 0.005, 0] }); p.add(cyl(0.045, 0.04, 0.07, 12), '#ffffff', { p: [0, 0.045, 0] }); p.add(cyl(0.04, 0.04, 0.005, 12), '#6b3b2a', { p: [0, 0.08, 0] }); break;
    case 'tea': p.add(cyl(0.08, 0.08, 0.01, 14), '#ffffff', { p: [0, 0.005, 0] }); p.add(cyl(0.045, 0.04, 0.07, 12), '#ffffff', { p: [0, 0.045, 0] }); p.add(cyl(0.04, 0.04, 0.005, 12), '#b8762a', { p: [0, 0.08, 0] }); break;
    case 'soup-of-the-day': bowl('#c9a05a'); p.add(sphere(0.02), '#5fae4e', { p: [0.03, 0.08, 0.02], s: [1, 0.4, 1] }); break;
    case 'spring-rolls': plate(); for (const dz of [-0.05, 0, 0.05]) p.add(capsule(0.022, 0.1), '#e0a656', { p: [0, 0.04, dz], r: [0, 0, Math.PI / 2] }); p.add(cyl(0.03, 0.025, 0.025, 10), '#d9452f', { p: [0.1, 0.04, 0.08] }); break;
    case 'chicken-wings': plate(); for (let i = 0; i < 4; i++) p.add(capsule(0.025, 0.06), '#b8552a', { p: [Math.cos(i * 1.6) * 0.06, 0.045, Math.sin(i * 1.6) * 0.06], r: [0, i, Math.PI / 2] }); break;
    case 'fried-rice': plate(); p.add(sphere(0.09, 0, Math.PI, 0, Math.PI / 2, 12, 6), '#e8c46a', { p: [0, 0.02, 0], s: [1, 0.5, 1] }); for (let i = 0; i < 5; i++) p.add(sphere(0.012), i % 2 ? '#7cc45a' : '#f08a2c', { p: [Math.cos(i * 1.3) * 0.05, 0.06, Math.sin(i * 1.3) * 0.05] }); break;
    case 'sushi': p.add(box(0.3, 0.02, 0.12), '#2b2b2b', { p: [0, 0.01, 0] }); for (let i = 0; i < 4; i++) { p.add(cyl(0.025, 0.025, 0.04, 10), '#ffffff', { p: [i * 0.065 - 0.1, 0.04, 0] }); p.add(cyl(0.015, 0.015, 0.041, 8), i % 2 ? '#f08a6c' : '#e23b4e', { p: [i * 0.065 - 0.1, 0.041, 0] }); } break;
    case 'fish-and-chips': plate(); p.add(capsule(0.035, 0.12), '#d99a3a', { p: [-0.04, 0.045, 0], r: [0, 0.3, Math.PI / 2] }); for (let i = 0; i < 5; i++) p.add(box(0.015, 0.015, 0.08), '#f2c94c', { p: [0.08 + (i % 2) * 0.02, 0.045, i * 0.02 - 0.04] }); p.add(sphere(0.025), '#7cc45a', { p: [0.02, 0.04, 0.09], s: [1, 0.5, 1] }); break;
    case 'lasagne': plate(); p.add(box(0.13, 0.06, 0.1), '#e0a656', { p: [0, 0.06, 0] }); p.add(box(0.132, 0.012, 0.102), '#d9452f', { p: [0, 0.055, 0] }); p.add(box(0.132, 0.012, 0.102), '#fff3c4', { p: [0, 0.09, 0] }); break;
    case 'pancakes': plate(); for (let i = 0; i < 3; i++) p.add(cyl(0.08, 0.08, 0.02, 14), '#e0b060', { p: [0, 0.04 + i * 0.022, 0] }); p.add(cyl(0.05, 0.05, 0.006, 12), '#a8541f', { p: [0, 0.1, 0] }); p.add(sphere(0.015), '#7b3fa0', { p: [0.02, 0.11, 0.01] }); break;
    case 'cheesecake': plate(); p.add(cyl(0.07, 0.07, 0.06, 3), '#fbeac0', { p: [0, 0.05, 0] }); p.add(cyl(0.071, 0.071, 0.012, 3), '#d9452f', { p: [0, 0.085, 0] }); break;
    case 'apple-pie': plate(); p.add(cyl(0.07, 0.07, 0.05, 3), '#d39a52', { p: [0, 0.045, 0] }); p.add(sphere(0.03), '#fdf1e0', { p: [0.08, 0.05, 0.03] }); break;
    case 'lemonade': glass('#f6e88a'); p.add(cyl(0.025, 0.025, 0.006, 10), '#f6d33c', { p: [0.04, 0.15, 0], r: [0, 0, Math.PI / 2] }); break;
    case 'hot-chocolate': p.add(cyl(0.08, 0.08, 0.01, 14), '#ffffff', { p: [0, 0.005, 0] }); p.add(cyl(0.045, 0.04, 0.07, 12), '#ffffff', { p: [0, 0.045, 0] }); p.add(cyl(0.04, 0.04, 0.005, 12), '#5a2e1e', { p: [0, 0.08, 0] }); p.add(sphere(0.03, 0, Math.PI, 0, Math.PI / 2, 8, 4), '#fdf6ec', { p: [0, 0.08, 0] }); break;
    case 'milkshake': glass('#f7a8c4', 0.2); p.add(sphere(0.04, 0, Math.PI, 0, Math.PI / 2, 8, 4), '#fdf6ec', { p: [0, 0.2, 0] }); p.add(cyl(0.006, 0.006, 0.12, 6), '#e23b4e', { p: [0.015, 0.24, 0], r: [0, 0, 0.2] }); break;
    default: plate(); p.add(capsule(0.04, 0.05), '#c98a52', { p: [0, 0.05, 0], r: [0, 0, Math.PI / 2] });
  }
}

/** The dish on the table in front of a seated player (table top ≈ 0.78 m, 0.62 m ahead). */
export function Dish({ item }: { item: string }) {
  const geo = useMemo(() => {
    const p = new Part();
    build(p, item);
    return p.build();
  }, [item]);
  return <mesh geometry={geo} material={chibiMaterial()} position={[0, 0.79, 0.62]} scale={1.6} />;
}
