const xOff = 500;
const yOff = 300;
export function initiatePlayers(scene, p1Select = 'axeman', p2Select = 'swordman') {
    const players = {
        player: null,
        player2: null
    };
    players.player = scene.physics.add.sprite(xOff+50, yOff+545, p1Select);
    players.player2 = scene.physics.add.sprite(xOff+800, yOff+440, p2Select);
    
    for (const key in players) {
        const p = players[key];
        p.setDepth(5);
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
        p.lastKBmultiplier = 1.00;
        p.nextSideSpecialTime = 0;
        p.lastTap = { left: 0, right: 0 };
        p.isUsingSideSpecial = false;
        p.hasHitSideSpecial = false;
        p.hasDoubleJumped = false;
        p.doubleJumpEffect = scene.add.image(
            p.x,
            p.y + 40, 'doublejump');
        scene.objs.add(p.doubleJumpEffect);
        p.doubleJumpEffect.setAlpha(0);
        scene.objs.add(p);
        p.setDepth(2);
        p.afterimage = false;
        p.afterimageTimer = 0;
        p.lastInput = {
            left: 0,
            right: 0,
            up: 0,
            down: 0
        };
        p.lastAttackTime = 0
        p.flashObject = scene.add.rectangle(p.x, p.y, 50, 50, 0xffffff);
        p.flashObject.setAlpha(0);
        p.flashObject.setDepth(9999);
        scene.objs.add(p.flashObject);
        p.flash = function() {
            console.log("flash!");
            
            p.flashObject.setAlpha(0.5);
            console.log(p.flashObject);

            scene.tweens.add({
                targets: p.flashObject,
                alpha: 0,
                duration: 200
            });
        }
        p.plunged = false;
        p.lastPlungeTick = 0;

        p.plungeMark;

        p.movementSpeed = 250;
        p.baseDamageScale = 1;

        p.plungeAura = scene.add.image(p.x, p.y, 'plungedAura');
        p.plungeAura.visible = false;
        scene.objs.add(p.plungeAura);
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
    scene.hud.add(players.player.winText);
    scene.hud.add(players.player2.winText);
    players.player.name = p1Select.toUpperCase();
    players.player2.name = p2Select.toUpperCase();

    players.player.icon = p1Select;
    players.player2.icon = p2Select;

    for (const key in players) {
        const p = players[key];
        if (p.name === "SWORDMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'swordatk'
            );
        } else if (p.name === "AXEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'axeatk'
            );
        } else if (p.name === "FISHERMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'rodatk'
            );
        } else if (p.name == "SCYTHEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'scytheatk'
            );
        } else if (p.name == "HAMMERMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'hammeratk'
            );
        } else if (p.name == "SLATEMAN") {
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'slateatk'
            );
            p.KBmultiplier = 0.70;
        } else {
            //fallback to axe sprite
            p.atk = scene.add.sprite(
                p.x + (p.lastDir.x * 50),
                p.y + (p.lastDir.y * 50),
                'axeatk'
            );
        }
        scene.objs.add(p.atk);
    }

    players.player.header = scene.add.text(players.player.x, players.player.y - 50, "P1" ,{ fontFamily: 'GameFont', fontSize: '15px', fill: '#ff4343' });
    players.player2.header = scene.add.text(players.player2.x, players.player2.y - 50, "P2" ,{ fontFamily: 'GameFont', fontSize: '15px', fill: '#0051ff' });
    scene.objs.add(players.player.header);
    scene.objs.add(players.player2.header);

    players.player.atk.setVisible(false);
    players.player2.atk.setVisible(false);

    
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
