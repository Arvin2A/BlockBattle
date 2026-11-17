// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { SNOWY_CANNON } from './snowyCannon.js';
import { DESERT_HEAT_RAY } from './heatRay.js';
import { JUNGLE_FLYTRAP } from './jungleFlytrap.js';

const MAP_EVENTS = { SNOWY_CANNON, DESERT_HEAT_RAY, JUNGLE_FLYTRAP };

export function getMapEvent(key) {
    return MAP_EVENTS[key] ?? null;
}
