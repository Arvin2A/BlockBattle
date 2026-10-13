//navigation.js
//mainly for controller players


export function wrapIndex(index, length) {
    return (index + length) % length;
}

export function moveSelection(currentIndex, direction, length) {
    if (length <= 0) return 0;

    return wrapIndex(currentIndex + direction, length);
}

export function getConnectedControllers(scene) {
    return Array.from(navigator.getGamepads?.() ?? [])
        .filter(gamepad => gamepad && gamepad.connected);
}


export function getMenuGamepadInput(pad) {
    if (!pad) {
        return {
            left: false,
            right: false,
            up: false,
            down: false,
            a: false
        };
    }

    const pressed = index => {
        const button = pad.buttons[index];
        return Boolean(button && (button.pressed || button.value > 0.5));
    };

    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;

    return {
        left: pressed(14) || Math.round(x) < 0,
        right: pressed(15) || Math.round(x) > 0,
        up: pressed(12) || pressed(3),
        down: pressed(13) || Math.round(y) > 0,
        a: pressed(0)
    };
}

export function createNavigationBox(scene, options = {}) {
    const {
        x = 0,
        y = 0,
        width = 100,
        height = 50,
        color = 0xffffff,
        alpha = 1,
        lineWidth = 3,
        padding = 6,
        duration = 150,
        ease = "Sine.easeOut"
    } = options;

    const box = scene.add.rectangle(
        x,
        y,
        width,
        height
    );

    box.setFillStyle(0x000000, 0); 
    box.setStrokeStyle(lineWidth, color, alpha);
    box.setDepth(options.depth ?? 1000);

    box.navigationOptions = {
        padding,
        duration,
        ease
    };

    return box;
}



export function getNavigationBounds(target, padding = 0) {
    const bounds = target.getBounds();

    return {
        x: bounds.centerX,
        y: bounds.centerY,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2
    };
}




export function moveNavigationBox(scene, box, target, options = {}) {
    if (!box || !target) return;

    const settings = {
        ...box.navigationOptions,
        ...options
    };

    const padding = settings.padding ?? 6;

    const bounds = typeof target.getBounds === "function"
        ? getNavigationBounds(target, padding)
        : {
            x: target.x,
            y: target.y,
            width: target.width + padding * 2,
            height: target.height + padding * 2
        };

    scene.tweens.killTweensOf(box);

    box.setSize(bounds.width, bounds.height);

    scene.tweens.add({
        targets: box,
        x: bounds.x,
        y: bounds.y,
        duration: settings.duration ?? 150,
        ease: settings.ease ?? "Sine.easeOut"
    });
}
