export function preload() {
    // =====================================================
    // MENU
    // =====================================================

    this.load.image('menuBackground', 'assets/Homescreen.png');
    this.load.image('uifade', 'assets/uifade.png');
    
    this.load.audio('hover', 'audio/hover.wav');
    this.load.image('arenapreview', 'assets/arenapreview.png');
    // =====================================================
    // MAP / STAGE
    // =====================================================

    this.load.image('background', 'assets/background_one.png');

    this.load.image('ground', 'assets/ground.png');
    this.load.image('betterground', 'assets/betterground.png');

    this.load.image('platform', 'assets/platform.png');
    this.load.image('platform1', 'assets/platform1.png');

    this.load.image('groundhitbox', 'assets/groundhitbox.png');
    this.load.image('thickgroundhitbox', 'assets/groundhitbox2.png');

    // =====================================================
    // UI
    // =====================================================

    this.load.image('redstat', 'assets/KBstatBG1.png');
    this.load.image('bluestat', 'assets/KBstatBG2.png');

    this.load.image('p1guide', 'assets/p1guide.png');
    this.load.image('p2guide', 'assets/p2guide.png');

    this.load.image('winbar', 'assets/WINbar.png');

    this.load.image('restartBtn', 'assets/restartBtn.png');
    this.load.image('restartBtnPressed', 'assets/pressedRestart.png');

    for (let i = 1; i < 5; i++) {
        this.load.image('countdown' + i, 'assets/countdown' + i + '.png');
    }

    // =====================================================
    // EFFECTS
    // =====================================================

    this.load.image('doublejump', 'assets/DoubleJump.png');
    this.load.image('plungedAura', 'assets/plungedAura.png');

    // =====================================================
    // AXEMAN
    // =====================================================

    this.load.image(
        'axeman',
        'assets/sprites/axeman/axeman-default.png'
    );

    this.load.spritesheet(
        'axeatk',
        'assets/sprites/axeman/axeatk1.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'axeatkthird',
        'assets/sprites/axeman/axeatk2.png',
        {
            frameWidth: 75,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'axeatktilt',
        'assets/sprites/axeman/axetilt.png',
        {
            frameWidth: 75,
            frameHeight: 75
        }
    );

    // =====================================================
    // SWORDMAN
    // =====================================================

    this.load.image(
        'swordman',
        'assets/sprites/swordman/swordman-default.png'
    );

    this.load.spritesheet(
        'swordatk',
        'assets/sprites/swordman/swordatk1.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'swordatkthird',
        'assets/sprites/swordman/swordatk2.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'swordatktilt',
        'assets/sprites/swordman/swordatk3.png',
        {
            frameWidth: 100,
            frameHeight: 50
        }
    );

    // =====================================================
    // FISHERMAN
    // =====================================================

    this.load.image(
        'fisherman',
        'assets/sprites/fisherman/fisherman-default.png'
    );

    this.load.image(
        'hook',
        'assets/sprites/fisherman/hook.png'
    );

    this.load.spritesheet(
        'rodatk',
        'assets/sprites/fisherman/rodatk1.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    // =====================================================
    // SCYTHEMAN
    // =====================================================

    this.load.image(
        'scytheman',
        'assets/sprites/scytheman/scytheman-default.png'
    );

    this.load.image(
        'whitescythe',
        'assets/sprites/scytheman/whitescythe.png'
    );

    this.load.image(
        'slasheffect',
        'assets/sprites/scytheman/slasheffect.png'
    );

    this.load.spritesheet(
        'scytheatk',
        'assets/sprites/scytheman/scytheatk1.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'scytheatktilt',
        'assets/sprites/scytheman/scythelightatk.png',
        {
            frameWidth: 75,
            frameHeight: 75
        }
    );

    // =====================================================
    // HAMMERMAN
    // =====================================================

    this.load.image(
        'hammerman',
        'assets/sprites/hammerman/hammerman-default.png'
    );

    this.load.spritesheet(
        'hammeratk',
        'assets/sprites/hammerman/malletswing.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    // =====================================================
    // SLATEMAN
    // =====================================================

    this.load.image(
        'slateman',
        'assets/sprites/slateman/slateman-default-1.png'
    );

    this.load.image(
        'slatemanphase1',
        'assets/sprites/slateman/slateman-default-2.png'
    );

    this.load.image(
        'slatemanphase2',
        'assets/sprites/slateman/slateman-default-3.png'
    );

    this.load.image(
        'slatemanphase3',
        'assets/sprites/slateman/slateman-default-4.png'
    );

    this.load.spritesheet(
        'slateatk',
        'assets/sprites/slateman/slateatk.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'slateatkthird',
        'assets/sprites/slateman/slateatkthird.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'slateatktilt',
        'assets/sprites/slateman/slateatktilt.png',
        {
            frameWidth: 75,
            frameHeight: 75
        }
    );

    this.load.spritesheet(
        'slateplunge',
        'assets/sprites/slateman/slateplunge.png',
        {
            frameWidth: 100,
            frameHeight: 50
        }
    );

    // =====================================================
    // MISC SPRITESHEETS
    // =====================================================

    this.load.spritesheet(
        'upbambooGrow',
        'assets/upBamboo.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    // =====================================================
    // AUDIO - GLOBAL
    // =====================================================

    this.load.audio('anyhit', 'audio/hit1.ogg');
    this.load.audio('miss', 'audio/swordslash.wav');

    this.load.audio('countdown', 'audio/countdown.wav');

    this.load.audio('swosh', 'audio/swosh.wav');

    this.load.audio('finisher', 'audio/finisher.wav');

    // =====================================================
    // AUDIO - SWORDMAN
    // =====================================================

    this.load.audio('swordthirdhitsfx', 'audio/swordlunge.wav');
    this.load.audio('lunge', 'audio/Dodge3.wav');

    // =====================================================
    // AUDIO - AXEMAN
    // =====================================================

    this.load.audio('axethirdhitsfx', 'audio/snd_damage_c.wav');

    // =====================================================
    // AUDIO - FISHERMAN
    // =====================================================

    this.load.audio('rodthirdhitsfx', 'audio/whipcrack.wav');
    this.load.audio('whoosh', 'audio/hookwhoosh.wav');

    // =====================================================
    // AUDIO - SCYTHEMAN
    // =====================================================

    this.load.audio('scythethirdhitsfx', 'audio/scythethird.wav');
    this.load.audio('slash', 'audio/slash.ogg');
    this.load.audio('twirl', 'audio/Twirling.ogg');

    // =====================================================
    // AUDIO - HAMMERMAN
    // =====================================================

    this.load.audio('hammerhit', 'audio/punch.wav');
    this.load.audio('repair', 'audio/Hitwrench.ogg');

    // =====================================================
    // AUDIO - SLATEMAN
    // =====================================================

    this.load.audio('slatepunch', 'audio/slatepunch.wav');
    this.load.audio('plunge', 'audio/plunge.ogg');

    // =====================================================
    // AUDIO - MISC
    // =====================================================

    this.load.audio('bamboo', 'audio/snd_spearrise.wav');
}