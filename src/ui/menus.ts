import type { Modal } from './modal';
import type { UiCtx } from './ctx';
import { openProject } from './menus/project';
import { openHire } from './menus/hire';
import { openTeam } from './menus/team';
import { openShop } from './menus/shop';
import { openTools } from './menus/tools';
import { openRoom } from './menus/room';
import { openPause } from './menus/pause';

/** Router for the menus behind the bottom bar. */
export function openMenu(ctx: UiCtx, id: string, arg: string | undefined, onClose: () => void): Modal | null {
  switch (id) {
    case 'project':
      return openProject(ctx, onClose);
    case 'hire':
      return openHire(ctx, onClose);
    case 'team':
      return openTeam(ctx, arg, onClose);
    case 'shop':
      return openShop(ctx, onClose);
    case 'tools':
      return openTools(ctx, onClose);
    case 'room':
      return openRoom(ctx, onClose);
    case 'apps':
      return openRoom(ctx, onClose, 1);
    case 'launch':
      return null;
    default:
      return openPause(ctx, onClose);
  }
}
