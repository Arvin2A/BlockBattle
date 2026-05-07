//lets start off ez with a quick and effective refactor: players
export function initiatePlayers(scene) {
    const players = {
        player: null,
        player2: null
    };
    players.player = scene.physics.add.sprite(50, 500, 'axeman');
    players.player2 = scene.physics.add.sprite(800, 420, 'swordman');
    
    for (const key in players) {
        const p = players[key];
        p.canAttack = true;
        p.revokeAggressorStun = null;
        p.revokeVictimStun = null;
        p.hitstun = false;
        p.freeze = false;
        p.willDecelerate = true;
        p.nextAttackTime = 0;
        p.combo = 0;
        p.comboTimer = 0;
        p.winNumber = 0;
        p.outOfBounds = false;
        p.airTime = 0;
        p.KBmultiplier = 1.00;
        p.nextSideSpecialTime = 0;
        p.lastTap = { left: 0, right: 0 };
        p.isUsingSideSpecial = false;
        p.hasHitSideSpecial = false;
        p.hasDoubleJumped = false;
        p.doubleJumpEffect = scene.add.image(
            p.x,
            p.y + 40, 'doublejump');
        p.doubleJumpEffect.setAlpha(0);
    }
    players.player.lastDir = { x: 1, y: 0 };
    players.player2.lastDir = { x: -1, y: 0 };

    players.player.winText = scene.add.text(400, 300, '', {
        fontFamily: 'VCROSD',
        fontSize: '48px',
        fill: '#FFFFFF'
    }).setOrigin(0.5).setStroke('#000000', 4).setVisible(false);

    players.player2.winText = scene.add.text(600, 300, '', {
        fontFamily: 'VCROSD',
        fontSize: '48px',
        fill: '#FFFFFF'
    }).setOrigin(0.5).setStroke('#000000', 4).setVisible(false);


    players.player.atk = scene.add.sprite(
        players.player.x + (players.player.lastDir.x * 50),
        players.player.y + (players.player.lastDir.y * 50),
        'axeatk'
    );

    players.player2.atk = scene.add.sprite(
        players.player2.x + (players.player2.lastDir.x * 50),
        players.player2.y + (players.player2.lastDir.y * 50),
        'swordatk'
    );


    players.player.atk.setVisible(false);
    players.player2.atk.setVisible(false);

    players.player.name = "AXEMAN";
    players.player2.name = "SWORDMAN";
    
    console.log(players.player)
    return players;
}

export function updateCombo(player, dt) {
    if (player.combo > 0) {
        player.comboTimer -= dt;
        if (player.comboTimer <= 0) {
            player.combo = 0;
            player.comboTimer = 0;
        }
    }
}