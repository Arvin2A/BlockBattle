export function fadeOutTo(scene, transition, duration = 200) {
    if (scene._fadeTransitionPending) return;

    scene._fadeTransitionPending = true;
    const camera = scene.cameras.main;
    camera.once('camerafadeoutcomplete', () => {
        scene._fadeTransitionPending = false;
        transition();
    });
    camera.fadeOut(duration, 0, 0, 0);
}