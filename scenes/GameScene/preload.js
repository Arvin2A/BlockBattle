export function preload() {

    //dont be fooled i didn't ai this, i did use it to reorganize my preload

    // =====================================================
    // PLUGINS
    // =====================================================

    /*this.load.scenePlugin(
        'rexUI', 
        'https://githubusercontent.com', 
        'rexUI', 
        'rexUI'
    );*/

    //this.load.scenePlugin('rexuiplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexuiplugin.min.js', 'rexUI', 'rexUI');

   
    // =====================================================
    // MENU
    // =====================================================

    this.load.image('menuBackground', 'assets/Homescreen.png');
    this.load.image('uifade', 'assets/uifade.png');
    
    this.load.audio('hover', 'audio/hover.wav');
    this.load.audio('deny', 'audio/deny.wav');

    //map preview images
    this.load.image('desertpreview', 'assets/arenapreview.png');
    this.load.image('snowypreview', 'assets/snowy_preview.png');
    this.load.image('randompreview', 'assets/random_preview.png');

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

    this.load.image('snowy_background', 'assets/snowy_background.png');
    this.load.image('snowy_betterground', 'assets/snowy_betterground.png');
    
    this.load.image('snowplatform1', 'assets/snowplatform1.png');
    this.load.image('snowplatform2', 'assets/snowplatform2.png');


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

    this.load.image('gohomeBtn', 'assets/goHomeBtn.png');
    this.load.image('gohomeBtnPressed', 'assets/pressedgoHome.png');

    for (let i = 1; i < 5; i++) {
        this.load.image('countdown' + i, 'assets/countdown' + i + '.png');
    }

    this.load.image('ready', 'assets/READY.png');
    this.load.image('selectedoverlay', 'assets/selectedOverlay.png');


    // =====================================================
    // HAZARDS
    // =====================================================

    this.load.spritesheet('sandstorm', 'assets/sandstorm.png', {frameWidth: 1000, frameHeight: 600});    
    this.load.spritesheet('blizzard', 'assets/blizzard.png', {frameWidth: 1000, frameHeight: 600});

    this.load.audio('storm', 'audio/sandstorm.mp3');

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
    this.load.image('chopped', 'assets/woodcrack.png');

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
    // AXEMAN - CHAINSAW
    // =====================================================

    this.load.image(
        'chainsawman',
        'assets/sprites/axeman/axeman-chainsaw.png'
    );
    
    this.load.spritesheet(
        'activechainsaw',
        'assets/sprites/axeman/activechainsaw.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );
    this.load.spritesheet(
        'inactivechainsaw',
        'assets/sprites/axeman/inactivechainsaw.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    )


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

    //HAMMERMAN // SLEDGEHAMMER

    this.load.image(
        'sledgehammerman',
        'assets/sprites/hammerman/hammerman-sledgehammer.png'
    );
    this.load.spritesheet(
        'sledgehammeratk',
        'assets/sprites/hammerman/sledgehammerswing.png',
        {
            frameWidth: 150,
            frameHeight: 150
        }
    );
    this.load.image(
        'sledge_idle',
        'assets/sprites/hammerman/sledge_idle.png'
    );
    this.load.spritesheet(
        'sledge_walk',
        'assets/sprites/hammerman/sledge_walk.png',
        {
            frameWidth: 150,
            frameHeight: 150
        }
    );
    this.load.spritesheet(
        'sledgehammerquickslam1',
        'assets/sprites/hammerman/quickslam.png',
        {
            frameWidth: 175,
            frameHeight: 175
        }
    );
    this.load.spritesheet(
        'sledgehammerquickslam2',
        'assets/sprites/hammerman/quickslam2.png',
        {
            frameWidth: 175,
            frameHeight: 175
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
    // CROWBARMAN
    // =====================================================

    this.load.image(
        'crowbarman',
        'assets/sprites/crowbarman/crowbarman-default.png'
    );

    this.load.spritesheet(
        'crowbaratk',
        'assets/sprites/crowbarman/crowbaratk.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );

    this.load.spritesheet(
        'crowbargrab',
        'assets/sprites/crowbarman/crowbargrab.png',
        {
            frameWidth: 200,
            frameHeight: 200
        }
    );

    // =====================================================
    // GUNMAN
    // =====================================================

    this.load.image(
        'gunman',
        'assets/sprites/gunman/gunman-default.png'
    );

    this.load.spritesheet(
        'gunmanatk',
        'assets/sprites/gunman/gunmanatk.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );
    this.load.spritesheet(
        'explosion',
        'assets/explosion.png',
        {
            frameWidth: 120,
            frameHeight: 200
        }

    )

    // =====================================================
    // MISC SPRITESHEETS/ASSETS
    // =====================================================

    this.load.spritesheet(
        'upbambooGrow',
        'assets/upBamboo.png',
        {
            frameWidth: 50,
            frameHeight: 50
        }
    );
    this.load.spritesheet(
        'upgrassGrow',
        'assets/upGrass.png',
        {
            frameWidth: 75,
            frameHeight: 75
        }
    );
    this.load.image('impactcrater', 'assets/impactcrater.png');


    // =====================================================
    // AUDIO - GLOBAL
    // =====================================================

    this.load.audio('anyhit', 'audio/hit1.ogg');
    this.load.audio('miss', 'audio/swordslash.wav');

    this.load.audio('countdown', 'audio/countdown.wav');

    this.load.audio('swosh', 'audio/swosh.wav');

    this.load.audio('finisher', 'audio/finisher.wav');

    this.load.audio('slamimpact', 'audio/slamimpact.wav');

    // =====================================================
    // AUDIO - SWORDMAN
    // =====================================================

    this.load.audio('swordthirdhitsfx', 'audio/swordlunge.wav');
    this.load.audio('lunge', 'audio/Dodge3.wav');
    this.load.audio('swordslash1', 'audio/swordslash1.wav');
    this.load.audio('swordslash2', 'audio/swordslash2.wav');



    // =====================================================
    // AUDIO - AXEMAN
    // =====================================================

    this.load.audio('axethirdhitsfx', 'audio/snd_damage_c.wav');
    this.load.audio('axecleavesfx', 'audio/axechop.wav');
    this.load.audio('axeslash1', 'audio/axeslash1.wav');
    this.load.audio('axeslash2', 'audio/axeslash2.wav');

    this.load.audio('chainsaw', 'audio/chainsaw.wav');
    this.load.audio('deactivatechainsaw', 'audio/deactivatechainsaw.wav');

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
    this.load.audio('slice', 'audio/preslice.wav');

    // =====================================================
    // AUDIO - HAMMERMAN
    // =====================================================

    this.load.audio('hammerhit', 'audio/punch.wav');
    this.load.audio('repair', 'audio/Hitwrench.ogg');

    this.load.audio('rocksliding', 'audio/rocksliding.wav');
    this.load.audio('sledgehammerhit', 'audio/sledgehammerhit.wav');
    this.load.audio('sledgewhoosh', 'audio/sledgewhoosh.wav');
    this.load.audio('sledgehammerquickslam', 'audio/quickslamgrounded.wav');

    // =====================================================
    // AUDIO - SLATEMAN
    // =====================================================

    this.load.audio('slatepunch', 'audio/slatepunch.wav');
    this.load.audio('plunge', 'audio/plunge.ogg');
    this.load.audio('slatelight1', 'audio/slatelight1.wav');
    this.load.audio('slatelight2', 'audio/slatelight2.wav');

    // =====================================================
    // AUDIO - CROWBARMAN
    // =====================================================

    this.load.audio('grab', 'audio/snd_grab.wav');
    this.load.audio('crowbarhit', 'audio/hl_crowbar.mp3');
    this.load.audio('crowbarclang1', 'audio/crowbarclang1.wav');
    this.load.audio('crowbarclang2', 'audio/crowbarclang2.wav');

    // =====================================================
    // AUDIO - GUNMAN
    // =====================================================

    this.load.audio('gunshot', 'audio/fire.wav');
    this.load.audio('reload', 'audio/reload.ogg');
    this.load.audio('explosion', 'audio/explosion.wav');


    // =====================================================
    // AUDIO - MISC
    // =====================================================

    this.load.audio('bamboo', 'audio/snd_spearrise.wav');
    this.load.audio('harvest', 'audio/harvest.wav');
    this.load.audio('damn', 'audio/daaaaaamn.wav');

}