export const QUICK_CHAT_CATEGORIES = [
    {
        name: 'greeting',
        phrases: ['hello', 'hi', 'hey', 'yo', 'sup', 'gl hf', 'good luck', 'good game', 'gg', 'well played', 'bye']
    },
    {
        name: 'basic',
        phrases: ['yes', 'no', 'ok', 'thanks', 'sorry', 'my bad', 'nice', 'wow', 'lol', 'oops', 'one sec', 'lag']
    },
    {
        name: 'command',
        phrases: ['get ready', 'lets go', 'wait', 'come here', 'fight me', 'stop running', 'go easy', 'rematch', 'run it back']
    },
    {
        name: 'banter',
        phrases: ['ez', 'you suck', 'get better', 'unskilled', 'not fair', 'youre lucky', 'bet', 'too slow', 'is that all', 'try harder', 'nice try', 'cope', 'skill issue']
    }
];

export const QUICK_CHAT_PHRASES = new Set(QUICK_CHAT_CATEGORIES.flatMap(category => category.phrases));

export const QUICK_CHAT_COOLDOWN_MS = 2000;
export const QUICK_CHAT_BURST_LIMIT = 4;
export const QUICK_CHAT_BURST_WINDOW_MS = 15000;

export class QuickChatLimiter {
    constructor(slackMs = 0) {
        this.slackMs = slackMs;
        this.sent = [];
    }

    waitFor(now) {
        const window = QUICK_CHAT_BURST_WINDOW_MS - this.slackMs;
        this.sent = this.sent.filter(time => now - time < window);
        if (!this.sent.length) return 0;
        let wait = this.sent[this.sent.length - 1] + QUICK_CHAT_COOLDOWN_MS - this.slackMs - now;
        if (this.sent.length >= QUICK_CHAT_BURST_LIMIT) {
            wait = Math.max(wait, this.sent[0] + window - now);
        }
        return Math.max(0, wait);
    }

    tryUse(now) {
        if (this.waitFor(now) > 0) return false;
        this.sent.push(now);
        return true;
    }
}
