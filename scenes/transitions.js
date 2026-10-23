export function fadeOutTo(scene, transition, duration = 200) {
    if (scene._fadeTransitionPending) return;

    scene._fadeTransitionPending = true;
    const camera = scene.cameras.main;
    camera.once('camerafadeoutcomplete', () => {
        scene._fadeTransitionPending = false;
        transition();
    });
    camera.fadeOut(duration, 0, 0, 0);
    scene.sound.play('hover2');

}

// Slides each group of objects in from whichever side of the screen it sits on.
// A group (like a button's box and label) moves as one piece, and groups
// arrive one after another. Returns how long the whole thing takes, in ms.
export function slideInFromSides(scene, groups, duration = 550, stagger = 90) {
    const width = scene.scale.width;
    groups.forEach((group, index) => {
        const fromLeft = group[0].getBounds().centerX < width / 2;
        for (const obj of group) {
            const targetX = obj.x;
            obj.x = targetX + (fromLeft ? -width : width);
            scene.tweens.add({ targets: obj, x: targetX, delay: index * stagger, duration, ease: 'Back.easeOut' });
        }
    });
    return (groups.length - 1) * stagger + duration;
}
