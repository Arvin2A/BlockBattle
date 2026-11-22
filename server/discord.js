// BlockBattle — Copyright (C) 2026 Arvin Zaman
// Original source: https://github.com/Arvin2A/BlockBattle
// Licensed under the GNU GPL v3 only. See LICENSE.

import { findCharacter } from '../characterRoster.js';

const POST_DELAY_MS = 10000;
const SOURCE_COOLDOWN_MS = 5 * 60 * 1000;
const MATCHED_LINGER_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;
const WEBHOOK_URL = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+\/?(?:\?thread_id=\d+)?$/;
const ROLE_ID = /^\d+$/;

function escapeMarkdown(text) {
    return String(text).replace(/[\\_*~`|>#\-[\]()]/g, '\\$&');
}

function sourceOf(client) {
    return client?.deviceId ?? `connection:${client?.id}`;
}

function fighterName(choice) {
    const character = findCharacter(choice?.character)?.name ?? '';
    return [choice?.variant, character].filter(Boolean).join(' ');
}

function parseWebhook(url) {
    if (!WEBHOOK_URL.test(url ?? '')) return null;
    const parsed = new URL(url);
    return {
        base: `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`,
        threadId: parsed.searchParams.get('thread_id')
    };
}

class WebhookFeed {
    constructor({ label, url, role, link, log }) {
        this.label = label;
        this.webhook = parseWebhook(url);
        this.role = ROLE_ID.test(role ?? '') ? role : null;
        this.link = link;
        this.log = log;
        this.posts = new Map();
        this.lastPostBySource = new Map();
        this.sendingSources = new Set();
        this.lingering = new Set();
        this.inFlight = new Set();
        this.shuttingDown = false;
        if (url && !this.webhook) log(`Discord ${label} webhook ignored: that doesn't look like a Discord webhook URL`);
    }

    get enabled() {
        return Boolean(this.webhook);
    }

    endpoint(path = '', params = {}) {
        const url = new URL(`${this.webhook.base}${path}`);
        if (this.webhook.threadId) url.searchParams.set('thread_id', this.webhook.threadId);
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
        return url;
    }

    messageEndpoint(messageId) {
        return this.endpoint(`/messages/${messageId}`);
    }

    body(text, { ping = true } = {}) {
        const mention = ping && this.role ? `<@&${this.role}> ` : '';
        const link = this.link ? `\n<${this.link}>` : '';
        return {
            content: `${mention}${text}${link}`,
            allowed_mentions: ping && this.role ? { parse: [], roles: [this.role] } : { parse: [] }
        };
    }

    track(promise) {
        this.inFlight.add(promise);
        promise.finally(() => this.inFlight.delete(promise));
        return promise;
    }

    onCooldown(source) {
        if (this.sendingSources.has(source)) return true;
        return Date.now() - (this.lastPostBySource.get(source) ?? -Infinity) < SOURCE_COOLDOWN_MS;
    }

    rememberPost(source) {
        const now = Date.now();
        for (const [oldSource, postedAt] of this.lastPostBySource) {
            if (now - postedAt >= SOURCE_COOLDOWN_MS) this.lastPostBySource.delete(oldSource);
        }
        this.lastPostBySource.set(source, now);
    }

    forget(post) {
        if (this.posts.get(post.key) === post) this.posts.delete(post.key);
    }

    announce(key, source, messages, stillValid) {
        if (!this.enabled || this.shuttingDown || this.posts.has(key) || this.onCooldown(source)) return;
        const post = { key, messages, timer: null, messageId: null, ended: false, outcome: null, stale: false, editing: null };
        this.posts.set(key, post);
        post.timer = setTimeout(() => {
            post.timer = null;
            this.track(this.send(post, source, stillValid));
        }, POST_DELAY_MS);
    }

    async send(post, source, stillValid) {
        if (!stillValid() || this.onCooldown(source)) {
            this.forget(post);
            return;
        }
        this.sendingSources.add(source);
        const message = await this.request('POST', this.endpoint('', { wait: 'true' }), this.body(post.messages.waiting()));
        this.sendingSources.delete(source);
        if (!message?.id) {
            this.forget(post);
            return;
        }
        this.rememberPost(source);
        post.messageId = message.id;
        if (post.ended) await this.finish(post);
        else if (post.stale) await this.edit(post);
    }

    refresh(key) {
        const post = this.posts.get(key);
        if (!post || post.ended || post.timer) return;
        post.stale = true;
        if (post.messageId) this.edit(post);
    }

    edit(post) {
        if (post.editing) return post.editing;
        post.editing = this.track((async () => {
            while (post.stale && !post.ended) {
                post.stale = false;
                await this.request('PATCH', this.messageEndpoint(post.messageId), this.body(post.messages.waiting()));
            }
            post.editing = null;
        })());
        return post.editing;
    }

    withdraw(key, outcome = null) {
        const post = this.posts.get(key);
        if (!post || post.ended) return;
        post.ended = true;
        post.outcome = outcome;
        if (post.timer) {
            clearTimeout(post.timer);
            this.forget(post);
            return;
        }
        if (post.messageId) this.track(this.finish(post));
    }

    async finish(post) {
        this.forget(post);
        await post.editing;
        const endedText = !this.shuttingDown && post.outcome ? post.messages[post.outcome]?.() : null;
        if (!endedText) {
            await this.request('DELETE', this.messageEndpoint(post.messageId));
            return;
        }
        await this.request('PATCH', this.messageEndpoint(post.messageId), this.body(endedText, { ping: false }));
        if (this.shuttingDown) {
            await this.request('DELETE', this.messageEndpoint(post.messageId));
            return;
        }
        const linger = { messageId: post.messageId, timer: null };
        linger.timer = setTimeout(() => {
            this.lingering.delete(linger);
            this.track(this.request('DELETE', this.messageEndpoint(linger.messageId)));
        }, MATCHED_LINGER_MS);
        this.lingering.add(linger);
    }

    async withdrawAll() {
        this.shuttingDown = true;
        for (const post of [...this.posts.values()]) {
            if (post.timer) {
                clearTimeout(post.timer);
                this.forget(post);
                continue;
            }
            post.ended = true;
            post.outcome = null;
            if (post.messageId) this.track(this.finish(post));
        }
        for (const linger of this.lingering) {
            clearTimeout(linger.timer);
            this.track(this.request('DELETE', this.messageEndpoint(linger.messageId)));
        }
        this.lingering.clear();
        while (this.inFlight.size) await Promise.allSettled([...this.inFlight]);
    }

    async request(method, url, body) {
        try {
            const response = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });
            if (!response.ok) {
                this.log(`Discord ${this.label} webhook ${method} failed: HTTP ${response.status}`);
                return null;
            }
            if (response.status === 204) return true;
            return await response.json();
        } catch (error) {
            this.log(`Discord ${this.label} webhook ${method} failed: ${error.message}`);
            return null;
        }
    }
}

export function createDiscordNotifier(env, log) {
    const link = env.BB_DISCORD_GAME_LINK?.trim() || null;
    const queue = new WebhookFeed({
        label: 'quick 1v1',
        url: env.BB_DISCORD_QUEUE_WEBHOOK?.trim(),
        role: env.BB_DISCORD_QUEUE_ROLE?.trim(),
        link,
        log
    });
    const lobbies = new WebhookFeed({
        label: 'lobby',
        url: env.BB_DISCORD_LOBBY_WEBHOOK?.trim(),
        role: env.BB_DISCORD_LOBBY_ROLE?.trim(),
        link,
        log
    });

    return {
        queueWaiting(client, stillWaiting) {
            const name = () => escapeMarkdown(client.name);
            queue.announce(client, sourceOf(client), {
                waiting: () => `**${name()}** is waiting for a **QUICK 1V1** as ${escapeMarkdown(fighterName(client.choice))}!`,
                matched: () => `**${name()}** found a **QUICK 1V1** match!`
            }, stillWaiting);
        },
        queueEnded(client, outcome = null) {
            queue.withdraw(client, outcome);
        },
        lobbyOpened(lobby, stillOpen, describe) {
            const title = () => `"${escapeMarkdown(lobby.name)}"`;
            lobbies.announce(lobby, sourceOf(lobby.members[0]), {
                waiting: () => {
                    const { host, players, max } = describe();
                    return `**${escapeMarkdown(host)}** has a public **${lobby.mode}** lobby open: ` +
                        `${title()} on ${escapeMarkdown(lobby.map)} (${players}/${max} players)`;
                },
                matched: () => `The **${lobby.mode}** lobby ${title()} filled up and started!`
            }, stillOpen);
        },
        lobbyUpdated(lobby) {
            lobbies.refresh(lobby);
        },
        lobbyEnded(lobby, outcome = null) {
            lobbies.withdraw(lobby, outcome);
        },
        withdrawAll() {
            return Promise.allSettled([queue.withdrawAll(), lobbies.withdrawAll()]);
        },
        describe() {
            const on = [queue.enabled && 'quick 1v1', lobbies.enabled && 'public lobbies'].filter(Boolean);
            return on.length ? on.join(' + ') : 'off';
        }
    };
}
