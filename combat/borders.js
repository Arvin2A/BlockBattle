// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

export const KILLZONE = { left: -400, right: 2400, top: -400, bottom: 1600 };

function stopAtWall(body, axis, shift, side) {
    body.position[axis] += shift;
    body.velocity[axis] = 0;
    body.touching[side] = true;
    body.touching.none = false;
    body.blocked[side] = true;
    body.blocked.none = false;
    if (body.gameObject?.crashTrack) body.gameObject.crashTrack[axis] = 0;
    body.updateCenter();
}

function pushBackInside(body, { horizontalWall, verticalWall }) {
    if (horizontalWall) {
        const centerX = body.position.x + body.halfWidth;
        if (centerX < KILLZONE.left) stopAtWall(body, 'x', KILLZONE.left - centerX, 'left');
        else if (centerX > KILLZONE.right) stopAtWall(body, 'x', KILLZONE.right - centerX, 'right');
    }
    if (verticalWall) {
        const centerY = body.position.y + body.halfHeight;
        if (centerY < KILLZONE.top) stopAtWall(body, 'y', KILLZONE.top - centerY, 'up');
        else if (centerY > KILLZONE.bottom) stopAtWall(body, 'y', KILLZONE.bottom - centerY, 'down');
    }
}

export function attachKillzoneWalls(scene) {
    const zones = scene.killZones;
    if (!zones.horizontalWall && !zones.verticalWall) return;
    const world = scene.physics.world;
    world.on('worldstep', () => {
        world.bodies.forEach(body => {
            if (body.enable && body.moves) pushBackInside(body, zones);
        });
    });
}
