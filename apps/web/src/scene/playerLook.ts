import type { AvatarBody } from '@es/shared';

/** Editor labels for the clothes slots of an outfit (null = the outfit has no such part). */
export function slotLabels(body: AvatarBody): { top: string; bottom: string | null; shoes: string | null } {
  switch (body) {
    case 'robot':
      return { top: 'Body', bottom: 'Details', shoes: null };
    case 'suit':
      return { top: 'Suit', bottom: 'Tie', shoes: 'Shoes' };
    case 'dress':
      return { top: 'Dress', bottom: 'Belt', shoes: 'Shoes' };
    case 'girl':
      return { top: 'Shirt', bottom: 'Overalls', shoes: 'Shoes' };
    case 'hoodie':
      return { top: 'Hoodie', bottom: 'Trousers', shoes: 'Shoes' };
    default:
      return { top: 'T-shirt', bottom: 'Shorts', shoes: 'Shoes' };
  }
}
