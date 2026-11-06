/**
 * Restaurant kitchen (behind the bar, world coordinates): the cooking stations (LPM kitchen_kit) and the recipes
 * of the cooking game. Each step is an English instruction; the cook walks to the right station and picks the
 * right verb. Dishes are restaurant menu items (scene/areas/Dish.tsx draws them).
 */
export type Station = 'fridge' | 'sink' | 'stove' | 'prep' | 'spices' | 'pass';
export const STATIONS: Record<Station, { x: number; kit: string; w: number; label: string }> = {
  fridge: { x: -149.4, kit: 'SM_KT_Fridge', w: 0.8, label: 'Fridge' },
  sink: { x: -147.8, kit: 'SM_KT_Sink', w: 1.2, label: 'Sink' },
  stove: { x: -145.8, kit: 'SM_KT_Stove', w: 1.6, label: 'Cooker' },
  prep: { x: -143.6, kit: 'SM_KT_Prep', w: 1.6, label: 'Chopping board' },
  spices: { x: -141.4, kit: 'SM_KT_Spices', w: 1.2, label: 'Spice rack' },
  pass: { x: -136, kit: 'SM_KT_Pass', w: 1.0, label: 'Serving hatch' },
};
/** Station pieces stand against the back wall (z -28.5); the cook stands at COOK_Z. */
export const STATION_Z = -28.08;
export const COOK_Z = -27.15;
/** The pass sits on the bar top. */
export const PASS = { x: -136, y: 1.1, z: -25.9 };
export const BAR_TOP_Y = 1.1;

export interface RecipeStep {
  text: string;
  station: Station;
  /** three verb choices; the first is right (shuffled in the UI) */
  verbs: [string, string, string];
}
export interface Recipe {
  id: string;
  dish: string;
  name: string;
  steps: RecipeStep[];
}
export const RECIPES: Recipe[] = [
  {
    id: 'tomato-soup',
    dish: 'tomato-soup',
    name: 'Tomato soup',
    steps: [
      { text: 'Take the tomatoes and an onion out of the fridge.', station: 'fridge', verbs: ['take out', 'put in', 'close'] },
      { text: 'Wash the tomatoes.', station: 'sink', verbs: ['wash', 'dry', 'fill'] },
      { text: 'Chop the tomatoes and the onion.', station: 'prep', verbs: ['chop', 'peel', 'grate'] },
      { text: 'Boil them in water for ten minutes.', station: 'stove', verbs: ['boil', 'fry', 'bake'] },
      { text: 'Add a little salt.', station: 'spices', verbs: ['add salt', 'add sugar', 'add pepper'] },
      { text: 'Serve the soup in a bowl.', station: 'pass', verbs: ['serve', 'drop', 'freeze'] },
    ],
  },
  {
    id: 'fried-rice',
    dish: 'fried-rice',
    name: 'Fried rice',
    steps: [
      { text: 'Take the eggs and the vegetables out of the fridge.', station: 'fridge', verbs: ['take out', 'put in', 'open'] },
      { text: 'Chop the vegetables into small pieces.', station: 'prep', verbs: ['chop', 'mix', 'slice'] },
      { text: 'Fry the eggs in a hot pan.', station: 'stove', verbs: ['fry', 'boil', 'wash'] },
      { text: 'Add the rice and the vegetables, and stir.', station: 'stove', verbs: ['stir', 'bake', 'pour'] },
      { text: 'Add some pepper.', station: 'spices', verbs: ['add pepper', 'add sugar', 'add salt'] },
      { text: 'Put the rice on a plate and serve it.', station: 'pass', verbs: ['serve', 'drop', 'hide'] },
    ],
  },
  {
    id: 'pancakes',
    dish: 'pancakes',
    name: 'Pancakes',
    steps: [
      { text: 'Take the milk and the eggs out of the fridge.', station: 'fridge', verbs: ['take out', 'put in', 'close'] },
      { text: 'Mix the flour, the milk and the eggs in a bowl.', station: 'prep', verbs: ['mix', 'chop', 'peel'] },
      { text: 'Fry the pancakes in a hot pan, one by one.', station: 'stove', verbs: ['fry', 'boil', 'grill'] },
      { text: 'Add some sugar on top.', station: 'spices', verbs: ['add sugar', 'add salt', 'add pepper'] },
      { text: 'Serve the pancakes while they are hot.', station: 'pass', verbs: ['serve', 'freeze', 'drop'] },
    ],
  },
  {
    id: 'garden-salad',
    dish: 'garden-salad',
    name: 'Garden salad',
    steps: [
      { text: 'Take the lettuce, the tomatoes and a cucumber out of the fridge.', station: 'fridge', verbs: ['take out', 'put in', 'open'] },
      { text: 'Wash the vegetables in cold water.', station: 'sink', verbs: ['wash', 'boil', 'dry'] },
      { text: 'Slice the cucumber and the tomatoes.', station: 'prep', verbs: ['slice', 'mix', 'grate'] },
      { text: 'Add salt and a little pepper.', station: 'spices', verbs: ['add salt', 'add sugar', 'add flour'] },
      { text: 'Serve the salad on a plate.', station: 'pass', verbs: ['serve', 'bake', 'drop'] },
    ],
  },
  {
    id: 'spaghetti',
    dish: 'spaghetti',
    name: 'Spaghetti',
    steps: [
      { text: 'Fill a big pot with water.', station: 'sink', verbs: ['fill', 'wash', 'empty'] },
      { text: 'Boil the water and cook the spaghetti for eight minutes.', station: 'stove', verbs: ['boil', 'fry', 'bake'] },
      { text: 'Take the cheese out of the fridge.', station: 'fridge', verbs: ['take out', 'put in', 'close'] },
      { text: 'Grate the cheese.', station: 'prep', verbs: ['grate', 'chop', 'mix'] },
      { text: 'Stir the tomato sauce.', station: 'stove', verbs: ['stir', 'boil', 'fry'] },
      { text: 'Serve the spaghetti with the sauce and the cheese.', station: 'pass', verbs: ['serve', 'drop', 'freeze'] },
    ],
  },
];

// the station cabinets are solid (the cook stands in front of them); the wall shelf and the pass are not
import { registerBlockers } from './layout';
registerBlockers(
  (Object.keys(STATIONS) as Station[])
    .filter((k) => k !== 'spices' && k !== 'pass')
    .map((k) => ({ minX: STATIONS[k].x - STATIONS[k].w / 2, maxX: STATIONS[k].x + STATIONS[k].w / 2, minZ: STATION_Z - 0.36, maxZ: STATION_Z + 0.36 })),
);
