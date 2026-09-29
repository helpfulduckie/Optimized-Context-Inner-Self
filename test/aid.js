// Minimal AI Dungeon sandbox for running Inner Self's real library and hook tabs under Jest.
// Each hook call gets a fresh VM context, like AI Dungeon, which reruns the Library tab before every hook.
// state, storyCards and history persist across calls on the same Adventure.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// LewdLeah/Inner-Self src/library.js at ddae96d (v1.0.2), the stock behavior the fork is compared against.
// Vendored because this repo shares no history with LewdLeah's, so a fresh clone can't `git show` it.
const STOCK_LIBRARY = path.join(__dirname, "baseline", "library.js");

const scripts = new Map();

function getScript(file) {
    if (!scripts.has(file)) {
        // The working tree may be checked out with CRLF; AI Dungeon receives pasted LF text
        const source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
        scripts.set(file, new vm.Script(source, { filename: path.relative(ROOT, file) }));
    }
    return scripts.get(file);
}

class Adventure {
    // random fixes Math.random inside the sandbox, so the fork and stock builds draw the same values.
    // A constant rather than a seeded sequence: the fork draws a different number of values per turn.
    constructor({ stock = false, random = null, player = "Player" } = {}) {
        this.library = stock ? STOCK_LIBRARY : path.join(ROOT, "files", "library.js");
        this.random = random;
        this.player = player;
        this.state = {};
        this.storyCards = [];
        this.history = [];
        this.actionCount = 0;
    }

    addStoryCard(keys = "", entry = "", type = "", title = keys, description = "", { returnCard = false } = {}) {
        this.storyCards.push({ keys, entry, type, title, description });
        return returnCard ? this.storyCards[this.storyCards.length - 1] : this.storyCards.length - 1;
    }

    // Run one hook tab. The tabs are the fork's own, which match LewdLeah's apart from comments.
    run(hook, text, { info = {} } = {}) {
        const context = vm.createContext({
            state: this.state,
            storyCards: this.storyCards,
            history: this.history,
            info: Object.assign({ actionCount: this.actionCount, characters: [{ name: this.player }] }, info),
            text,
            addStoryCard: (...args) => this.addStoryCard(...args),
            removeStoryCard: (index) => {
                if ((0 <= index) && (index < this.storyCards.length)) {
                    this.storyCards.splice(index, 1);
                }
            },
            log: () => {},
            console
        });
        if (this.random !== null) {
            vm.runInContext(`Math.random = () => ${this.random};`, context);
        }
        getScript(this.library).runInContext(context);
        const result = getScript(path.join(ROOT, "files", `${hook}.js`)).runInContext(context);
        // history may have been reassigned by the library's own validation
        this.history = context.history;
        return result;
    }

    input(text) {
        return this.run("input", text).text;
    }

    // Returns the context text the model would receive. Inner Self treats any call with
    // info.maxChars as a context call, so only this hook sets it, as in AI Dungeon.
    context(text, { optimized = false, maxChars = 8000 } = {}) {
        const info = { maxChars };
        if (optimized) {
            info.useCacheEfficient = true;
        }
        return this.run("context", text, { info }).text;
    }

    output(text) {
        return this.run("output", text).text;
    }

    configCard() {
        return this.storyCards.find(card => /^Configure\s+Inner Self$/.test(card.title || ""));
    }

    agentCard(name) {
        return this.storyCards.find(card => (
            (card !== this.configCard()) && (card !== this.taskCard())
            && new RegExp(`(?:^|[^a-z])${name}(?:$|[^a-z])`, "i").test(card.title || "")
        ));
    }

    taskCard() {
        return this.storyCards.find(card => /Inner Self Task/.test(card.title || ""));
    }

    // Edit the config card the way a player would: thoughts on every turn, and these agents listed
    configure(agents) {
        this.context("Recent Story:\n");
        const card = this.configCard();
        card.entry = card.entry
            .replace(/Thought formation chance per turn:\s*\d+%/, "Thought formation chance per turn: 100%")
            .replace(/Half thought chance for Do\/Say\/Story:\s*true/, "Half thought chance for Do/Say/Story: false");
        card.description = card.description.replace(
            "listed from highest to lowest trigger priority:",
            `listed from highest to lowest trigger priority:\n${agents.join("\n")}`
        );
        return this;
    }

    // Record an action in history, the way AI Dungeon does before the next context hook
    act(text, type = "story") {
        this.history.push({ text, type });
        this.actionCount++;
        return this;
    }

    // Replace an agent's brain with n distinct thoughts, in the simple format Inner Self reads from Notes
    fillBrain(name, n) {
        this.agentCard(name).description = Array.from({ length: n }, (_, i) => (
            `thought_${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}: `
            + `I keep turning over the matter of ledger ${i} and what it means for my plans now.`
        )).join("\n");
        return this;
    }
}

// A context as AI Dungeon assembles it, padded so the recent story is about storyChars long
function buildContext({ storyChars = 3000, lastAction = "Alice looked around." } = {}) {
    const filler = "The room was quiet and still. ".repeat(Math.ceil(storyChars / 30));
    return `World Lore:\nThe manor stands above the valley.\n\nRecent Story:\n${filler}${lastAction}\n`;
}

// An adventure at the point Alice has been mentioned, ready for the measured context turn
function adventureWithAlice(options = {}) {
    const adventure = new Adventure(options).configure(["Alice"]);
    adventure.act("Alice walked into the room.");
    adventure.context(buildContext({ lastAction: "Alice walked into the room." }));
    adventure.act("Alice looked around.");
    return adventure;
}

module.exports = { Adventure, buildContext, adventureWithAlice, STOCK_LIBRARY };
