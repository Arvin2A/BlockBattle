// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

// mp/mirror.js
// Online matches run the real GameScene on the server (see mp/authority.js).
// MirrorCapture walks that scene every frame and writes down what changed:
// objects, their positions/frames/text/colors, the camera and the sounds played.
// MirrorView rebuilds the same picture on each player's screen from those changes.
// Players never run game logic, they only see the result and send inputs.

const ROOT = 0;

const SUPPORTED_TYPES = new Set([
    'Image', 'Sprite', 'Text', 'Rectangle', 'Arc', 'Ellipse', 'Graphics', 'Container',
    'ParticleEmitter'
]);

const round = (value, places) => {
    const factor = 10 ** places;
    return Math.round((value ?? 0) * factor) / factor;
};

function serializeTextStyle(style) {
    return JSON.stringify({
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
        backgroundColor: style.backgroundColor,
        color: style.color,
        stroke: style.stroke,
        strokeThickness: style.strokeThickness,
        shadow: {
            offsetX: style.shadowOffsetX,
            offsetY: style.shadowOffsetY,
            color: style.shadowColor,
            blur: style.shadowBlur,
            stroke: style.shadowStroke,
            fill: style.shadowFill
        },
        align: style.align,
        maxLines: style.maxLines,
        fixedWidth: style.fixedWidth,
        fixedHeight: style.fixedHeight,
        baselineX: style.baselineX,
        baselineY: style.baselineY,
        wordWrap: {
            width: style.wordWrapWidth,
            useAdvancedWrap: style.wordWrapUseAdvanced
        }
    });
}

function addShapeStyle(state, obj) {
    state.fi = obj.isFilled ? 1 : 0;
    state.fc = obj.fillColor;
    state.fa = round(obj.fillAlpha, 3);
    state.si = obj.isStroked ? 1 : 0;
    state.sc = obj.strokeColor;
    state.sa = round(obj.strokeAlpha, 3);
    state.lw = obj.lineWidth;
}

// Everything the client needs to draw one object, as short keys so frames stay small.
function serialize(obj) {
    const state = {
        ty: obj.type,
        x: round(obj.x, 2),
        y: round(obj.y, 2),
        r: round(obj.rotation, 4),
        sx: round(obj.scaleX, 4),
        sy: round(obj.scaleY, 4),
        a: round(obj.alpha, 3),
        v: obj.visible ? 1 : 0,
        d: obj.depth ?? 0,
        cf: obj.cameraFilter ?? 0,
        sfx: obj.scrollFactorX ?? 1,
        sfy: obj.scrollFactorY ?? 1
    };
    if ('originX' in obj && obj.type !== 'Container') {
        state.ox = round(obj.originX, 4);
        state.oy = round(obj.originY, 4);
    }
    if ('flipX' in obj) {
        state.fx = obj.flipX ? 1 : 0;
        state.fy = obj.flipY ? 1 : 0;
    }
    if ('blendMode' in obj && typeof obj.blendMode === 'number') {
        state.bm = obj.blendMode;
    }
    if ('tintTopLeft' in obj) {
        state.tn = `${obj.tintTopLeft},${obj.tintTopRight},${obj.tintBottomLeft},${obj.tintBottomRight},${obj.tintMode ?? 0}`;
    }

    switch (obj.type) {
        case 'Image':
        case 'Sprite':
            state.k = obj.texture?.key;
            state.f = obj.frame?.name;
            break;
        case 'Text':
            state.tx = obj.text;
            state.st = serializeTextStyle(obj.style);
            state.pd = `${obj.padding.left},${obj.padding.right},${obj.padding.top},${obj.padding.bottom}`;
            state.ls = obj.lineSpacing;
            break;
        case 'Rectangle':
        case 'Ellipse':
            state.w = round(obj.width, 2);
            state.h = round(obj.height, 2);
            addShapeStyle(state, obj);
            break;
        case 'Arc':
            state.rad = round(obj.radius, 2);
            state.as = round(obj.startAngle, 3);
            state.ae = round(obj.endAngle, 3);
            state.ac = obj.anticlockwise ? 1 : 0;
            addShapeStyle(state, obj);
            break;
        case 'Graphics':
            state.cb = JSON.stringify(obj.commandBuffer);
            break;
        // Particles are cosmetic, so players run their own emitter from the
        // same config and only follow its position and on/off/rate.
        case 'ParticleEmitter':
            state.k = obj.texture?.key;
            state.pc = JSON.stringify(obj.config);
            state.em = obj.emitting ? 1 : 0;
            state.fq = obj.frequency;
            state.qt = obj.quantity;
            break;
    }
    return state;
}

// ---------------------------------------------------------------------------
// Server side (authority)
// ---------------------------------------------------------------------------

export class MirrorCapture {
    constructor(scene) {
        this.scene = scene;
        this.ids = new WeakMap();
        this.nextId = 1;
        this.lastStates = new Map();
        this.lastOrders = new Map();
        this.lastCamera = '';
        this.frame = 0;
        this.warnedTypes = new Set();
        this.sounds = new SoundCapture(scene.sound);
    }

    idOf(obj) {
        let id = this.ids.get(obj);
        if (!id) {
            id = this.nextId++;
            this.ids.set(obj, id);
        }
        return id;
    }

    // Returns this frame's changes, or null when nothing changed at all.
    capture() {
        const created = {};
        const updated = {};
        const orders = {};
        const seen = new Set();
        let hasChanges = false;

        const walk = (list, parentId) => {
            const ids = [];
            for (const obj of list) {
                if (!SUPPORTED_TYPES.has(obj.type)) {
                    if (!this.warnedTypes.has(obj.type)) {
                        this.warnedTypes.add(obj.type);
                        console.warn(`[mirror] ${obj.type} objects are not sent to players yet`);
                    }
                    continue;
                }
                const id = this.idOf(obj);
                ids.push(id);
                seen.add(id);

                const state = serialize(obj);
                state.p = parentId;
                const previous = this.lastStates.get(id);
                if (!previous) {
                    created[id] = state;
                    hasChanges = true;
                } else {
                    let changes = null;
                    for (const key in state) {
                        if (state[key] !== previous[key]) {
                            changes ??= {};
                            changes[key] = state[key];
                        }
                    }
                    if (changes) {
                        updated[id] = changes;
                        hasChanges = true;
                    }
                }
                this.lastStates.set(id, state);

                if (obj.type === 'Container') walk(obj.list, id);
            }
            const orderKey = ids.join(',');
            if (this.lastOrders.get(parentId) !== orderKey) {
                this.lastOrders.set(parentId, orderKey);
                orders[parentId] = ids;
                hasChanges = true;
            }
        };
        walk(this.scene.children.list, ROOT);

        const destroyed = [];
        for (const id of this.lastStates.keys()) {
            if (seen.has(id)) continue;
            destroyed.push(id);
            this.lastStates.delete(id);
            this.lastOrders.delete(id);
        }

        const cam = this.scene.cameras.main;
        const camera = [round(cam.scrollX, 2), round(cam.scrollY, 2), round(cam.zoom, 4)];
        const cameraKey = camera.join(',');
        const cameraChanged = cameraKey !== this.lastCamera;
        this.lastCamera = cameraKey;

        const sounds = this.sounds.drain();

        if (!hasChanges && !destroyed.length && !cameraChanged && !sounds.length) {
            return null;
        }

        const message = { t: 'm', f: this.frame++ };
        if (Object.keys(created).length) message.c = created;
        if (Object.keys(updated).length) message.u = updated;
        if (destroyed.length) message.d = destroyed;
        if (Object.keys(orders).length) message.o = orders;
        if (cameraChanged) message.cam = camera;
        if (sounds.length) message.snd = sounds;
        return message;
    }
}

const SOUND_CONFIG_KEYS = ['volume', 'rate', 'detune', 'loop', 'delay', 'seek', 'mute'];

function pickSoundConfig(config) {
    if (!config || typeof config !== 'object') return undefined;
    const picked = {};
    for (const key of SOUND_CONFIG_KEYS) {
        if (key in config) picked[key] = config[key];
    }
    return Object.keys(picked).length ? picked : undefined;
}

// Records every sound call the game makes so players hear them too.
class SoundCapture {
    constructor(manager) {
        this.ops = [];
        this.nextId = 1;
        let insideOneShot = 0;

        const originalPlay = manager.play.bind(manager);
        const originalAdd = manager.add.bind(manager);

        // sound.play(key) is a fire-and-forget one-shot.
        manager.play = (key, extra) => {
            this.ops.push({ o: 'play1', k: key, c: pickSoundConfig(extra) });
            insideOneShot++;
            try {
                return originalPlay(key, extra);
            } finally {
                insideOneShot--;
            }
        };

        // sound.add(key) returns a sound the game controls (loops, chainsaw...).
        manager.add = (key, config) => {
            const sound = originalAdd(key, config);
            if (insideOneShot) return sound;
            const id = this.nextId++;
            this.ops.push({ o: 'add', id, k: key, c: pickSoundConfig(config) });
            this.wrapSound(sound, id);
            return sound;
        };

        for (const method of ['stopAll', 'pauseAll', 'resumeAll']) {
            const original = manager[method].bind(manager);
            manager[method] = (...args) => {
                this.ops.push({ o: method });
                return original(...args);
            };
        }
        const originalStopByKey = manager.stopByKey.bind(manager);
        manager.stopByKey = key => {
            this.ops.push({ o: 'stopKey', k: key });
            return originalStopByKey(key);
        };
    }

    wrapSound(sound, id) {
        for (const method of ['play', 'stop', 'pause', 'resume']) {
            const original = sound[method].bind(sound);
            sound[method] = (...args) => {
                const config = method === 'play'
                    ? pickSoundConfig(typeof args[0] === 'object' ? args[0] : args[1])
                    : undefined;
                this.ops.push({ o: method, id, c: config });
                return original(...args);
            };
        }
        const setters = { setRate: 'rate', setVolume: 'volume', setDetune: 'detune', setLoop: 'loop' };
        for (const [method, op] of Object.entries(setters)) {
            if (typeof sound[method] !== 'function') continue;
            const original = sound[method].bind(sound);
            sound[method] = value => {
                this.ops.push({ o: op, id, v: value });
                return original(value);
            };
        }
        const originalDestroy = sound.destroy.bind(sound);
        sound.destroy = () => {
            this.ops.push({ o: 'destroy', id });
            return originalDestroy();
        };
    }

    drain() {
        const ops = this.ops;
        this.ops = [];
        return ops;
    }
}

// ---------------------------------------------------------------------------
// Player side
// ---------------------------------------------------------------------------

export class MirrorView {
    // The scene needs the same camera setup as GameScene: main camera first,
    // then a second "hudCam", so the camera ignore filters line up.
    constructor(scene) {
        this.scene = scene;
        this.objects = new Map();
        this.sounds = new Map();
        this.lastFrame = -1;
    }

    get(id) {
        return this.objects.get(id) ?? null;
    }

    apply(message) {
        this.lastFrame = message.f;

        if (message.d) {
            for (const id of message.d) this.destroy(id);
        }

        const parents = [];
        if (message.c) {
            for (const [id, state] of Object.entries(message.c)) {
                const obj = this.create(state);
                if (!obj) continue;
                this.objects.set(Number(id), obj);
                this.applyState(obj, state);
                parents.push([obj, state.p]);
            }
        }
        if (message.u) {
            for (const [id, changes] of Object.entries(message.u)) {
                const obj = this.objects.get(Number(id));
                if (!obj) continue;
                this.applyState(obj, changes);
                if ('p' in changes) parents.push([obj, changes.p]);
            }
        }
        for (const [obj, parentId] of parents) this.setParent(obj, parentId);

        if (message.o) {
            for (const [parentId, ids] of Object.entries(message.o)) {
                this.reorder(Number(parentId), ids);
            }
        }

        if (message.cam) {
            const cam = this.scene.cameras.main;
            cam.scrollX = message.cam[0];
            cam.scrollY = message.cam[1];
            cam.setZoom(message.cam[2]);
        }

        if (message.snd) {
            for (const op of message.snd) this.playSound(op);
        }
    }

    create(state) {
        const add = this.scene.add;
        switch (state.ty) {
            case 'Image':
            case 'Sprite':
                return add.image(0, 0, this.textureKey(state.k), state.f);
            case 'Text':
                return add.text(0, 0, '');
            case 'Rectangle':
                return add.rectangle(0, 0, state.w, state.h);
            case 'Ellipse':
                return add.ellipse(0, 0, state.w, state.h);
            case 'Arc':
                return add.arc(0, 0, state.rad, state.as, state.ae, Boolean(state.ac));
            case 'Graphics':
                return add.graphics();
            case 'Container':
                return add.container(0, 0);
            case 'ParticleEmitter':
                return add.particles(0, 0, this.textureKey(state.k), JSON.parse(state.pc));
            default:
                return null;
        }
    }

    textureKey(key) {
        return this.scene.textures.exists(key) ? key : '__MISSING';
    }

    applyState(obj, s) {
        if ('x' in s) obj.x = s.x;
        if ('y' in s) obj.y = s.y;
        if ('r' in s) obj.rotation = s.r;
        if ('sx' in s) obj.scaleX = s.sx;
        if ('sy' in s) obj.scaleY = s.sy;
        if ('a' in s) obj.alpha = s.a;
        if ('v' in s) obj.visible = Boolean(s.v);
        if ('d' in s) obj.setDepth(s.d);
        if ('cf' in s) obj.cameraFilter = s.cf;
        if ('sfx' in s) obj.scrollFactorX = s.sfx;
        if ('sfy' in s) obj.scrollFactorY = s.sfy;
        if ('fx' in s) obj.flipX = Boolean(s.fx);
        if ('fy' in s) obj.flipY = Boolean(s.fy);
        if ('bm' in s) obj.setBlendMode(s.bm);

        if ('k' in s || 'f' in s) {
            const key = 'k' in s ? this.textureKey(s.k) : obj.texture.key;
            const frame = 'f' in s ? s.f : obj.frame.name;
            if (key !== obj.texture.key) {
                obj.setTexture(key, frame);
            } else if (frame !== obj.frame.name && obj.texture.has(frame)) {
                obj.setFrame(frame);
            }
        }
        if ('tn' in s) {
            const [tl, tr, bl, br, mode] = s.tn.split(',').map(Number);
            obj.setTint(tl, tr, bl, br);
            if (typeof obj.setTintMode === 'function') obj.setTintMode(mode);
        }

        if ('st' in s) obj.setStyle(JSON.parse(s.st));
        if ('pd' in s) {
            const [left, right, top, bottom] = s.pd.split(',').map(Number);
            obj.setPadding({ left, right, top, bottom });
        }
        if ('ls' in s) obj.setLineSpacing(s.ls);
        if ('tx' in s) obj.setText(s.tx);

        if ('w' in s || 'h' in s) {
            obj.setSize(s.w ?? obj.width, s.h ?? obj.height);
        }
        if ('rad' in s) obj.setRadius(s.rad);
        if ('as' in s) obj.setStartAngle(s.as);
        if ('ae' in s) obj.setEndAngle(s.ae);
        if ('ac' in s) obj.anticlockwise = Boolean(s.ac);
        if ('fi' in s || 'fc' in s || 'fa' in s) {
            const filled = 'fi' in s ? s.fi : obj.isFilled;
            if (filled) {
                obj.setFillStyle(s.fc ?? obj.fillColor, s.fa ?? obj.fillAlpha);
            } else {
                obj.isFilled = false;
                if ('fc' in s) obj.fillColor = s.fc;
                if ('fa' in s) obj.fillAlpha = s.fa;
            }
        }
        if ('si' in s || 'sc' in s || 'sa' in s || 'lw' in s) {
            const stroked = 'si' in s ? s.si : obj.isStroked;
            if (stroked) {
                obj.setStrokeStyle(s.lw ?? obj.lineWidth, s.sc ?? obj.strokeColor, s.sa ?? obj.strokeAlpha);
            } else {
                obj.isStroked = false;
            }
        }

        if ('cb' in s) obj.commandBuffer = JSON.parse(s.cb);

        if ('fq' in s || 'qt' in s) obj.setFrequency(s.fq ?? obj.frequency, s.qt ?? obj.quantity);
        if ('em' in s) {
            if (s.em) obj.start();
            else obj.stop();
        }

        // Setting the origin last keeps text/frame size changes from shifting it.
        if ('ox' in s || 'oy' in s) {
            obj.setOrigin(s.ox ?? obj.originX, s.oy ?? obj.originY);
        }
    }

    setParent(obj, parentId) {
        const current = obj.parentContainer ?? null;
        if (parentId === ROOT) {
            if (current) current.remove(obj);
            if (!obj.displayList) obj.addToDisplayList();
            return;
        }
        const parent = this.objects.get(parentId);
        if (parent && parent !== current) parent.add(obj);
    }

    // Matches the authority's child order. Root objects are then depth-sorted by
    // Phaser exactly like on the authority, since that sort is stable.
    reorder(parentId, ids) {
        const index = new Map();
        ids.forEach((id, position) => {
            const obj = this.objects.get(id);
            if (obj) index.set(obj, position);
        });
        const order = obj => index.get(obj) ?? Number.MAX_SAFE_INTEGER;
        if (parentId === ROOT) {
            this.scene.children.list.sort((a, b) => order(a) - order(b));
            this.scene.children.queueDepthSort();
            return;
        }
        const container = this.objects.get(parentId);
        container?.list.sort((a, b) => order(a) - order(b));
    }

    destroy(id) {
        const obj = this.objects.get(id);
        if (!obj) return;
        this.objects.delete(id);
        // Children get their own destroy/move entries, so don't take them down too.
        if (obj.type === 'Container') obj.removeAll(false);
        obj.destroy();
    }

    playSound(op) {
        const manager = this.scene.sound;
        try {
            switch (op.o) {
                case 'play1':
                    if (this.scene.cache.audio.exists(op.k)) manager.play(op.k, op.c);
                    break;
                case 'add':
                    if (this.scene.cache.audio.exists(op.k)) this.sounds.set(op.id, manager.add(op.k, op.c));
                    break;
                case 'play':
                    this.sounds.get(op.id)?.play(op.c);
                    break;
                case 'stop':
                case 'pause':
                case 'resume':
                    this.sounds.get(op.id)?.[op.o]();
                    break;
                case 'rate':
                    this.sounds.get(op.id)?.setRate(op.v);
                    break;
                case 'volume':
                    this.sounds.get(op.id)?.setVolume(op.v);
                    break;
                case 'detune':
                    this.sounds.get(op.id)?.setDetune(op.v);
                    break;
                case 'loop':
                    this.sounds.get(op.id)?.setLoop(op.v);
                    break;
                case 'destroy':
                    this.sounds.get(op.id)?.destroy();
                    this.sounds.delete(op.id);
                    break;
                case 'stopAll':
                case 'pauseAll':
                case 'resumeAll':
                    manager[op.o]();
                    break;
                case 'stopKey':
                    manager.stopByKey(op.k);
                    break;
            }
        } catch (error) {
            console.warn('[mirror] sound failed', op, error);
        }
    }

    shutdown() {
        for (const sound of this.sounds.values()) sound.destroy();
        this.sounds.clear();
        this.objects.clear();
    }
}
