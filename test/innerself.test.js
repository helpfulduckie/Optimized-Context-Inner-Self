const { Adventure, buildContext, adventureWithAlice } = require("./aid");

// Constants either side of every threshold Inner Self draws against: 0.2 (refocus), 0.4 and 0.8 (full brain order and labels)
const RANDOMS = [0.1, 0.5, 0.9];

// Context sizes either side of the 20,000-character ASSIGN / CHOICE split, with and without a full brain
const SCENARIOS = {
    "low context": { maxChars: 8000, storyChars: 3000, brain: 0 },
    "high context": { maxChars: 25000, storyChars: 21000, brain: 0 },
    "full brain, low context": { maxChars: 8000, storyChars: 3000, brain: 20 },
    "full brain, high context": { maxChars: 25000, storyChars: 21000, brain: 80 }
};

// Play one measured context turn with Alice triggered
function measuredContext({ maxChars, storyChars, brain }, options = {}) {
    const adventure = adventureWithAlice(options);
    if (brain) {
        adventure.fillBrain("Alice", brain);
    }
    const context = buildContext({ storyChars });
    return { adventure, context, result: adventure.context(context, { maxChars, optimized: options.optimized }) };
}

// Play a task turn, then return the output hook's text and Alice's stored brain
function outputTurn(modelOutput, { brain = 0, ...options } = {}) {
    const adventure = adventureWithAlice(options);
    if (brain) {
        adventure.fillBrain("Alice", brain);
    }
    adventure.context(buildContext());
    const text = adventure.output(modelOutput);
    return { adventure, text, brain: adventure.agentCard("Alice").description };
}

describe("Optimized Context off", () => {
    describe("matches LewdLeah's v1.0.2 byte for byte", () => {
        test.each(Object.keys(SCENARIOS).flatMap(name => RANDOMS.map(random => [name, random])))(
            "context: %s, Math.random = %s",
            (name, random) => {
                const fork = measuredContext(SCENARIOS[name], { random }).result;
                const stock = measuredContext(SCENARIOS[name], { random, stock: true }).result;
                expect(fork).toBe(stock);
            }
        );

        test("a retry turn re-sends the brain without a new task", () => {
            const play = (options) => {
                const adventure = adventureWithAlice(options);
                adventure.context(buildContext());
                adventure.output("(ledger_worry = `I worry the steward has read the ledger.`) The steward bows.");
                return adventure.context(buildContext());
            };
            const fork = play({ random: 0.5 });
            expect(fork).toContain("brain and inner self");
            expect(fork).not.toContain("<|task|>");
            expect(fork).toBe(play({ random: 0.5, stock: true }));
        });

        // Each case also checks the operation took effect, so two builds that both ignored it can't pass
        test.each([
            ["assign", "(ledger_worry = `I worry the steward has read the ledger.`) The steward bows.", 0,
                brain => brain.includes("ledger_worry") && brain.includes("I worry the steward has read the ledger.")],
            ["rename", "(ledger_fear = thought_aa) The steward bows.", 5,
                brain => brain.includes("ledger_fear") && !brain.includes("thought_aa")],
            ["delete", "(delete thought_ba) The steward bows.", 5,
                brain => brain.includes("thought_aa") && !brain.includes("thought_ba")]
        ])("output: a %s operation stores the same brain and returns the same text", (_, modelOutput, brain, applied) => {
            const fork = outputTurn(modelOutput, { random: 0.5, brain });
            const stock = outputTurn(modelOutput, { random: 0.5, brain, stock: true });
            expect(applied(fork.brain)).toBe(true);
            expect(fork.text).toBe(stock.text);
            expect(fork.brain).toBe(stock.brain);
            expect(fork.text).toContain("The steward bows.");
            expect(fork.text).not.toContain("(");
        });
    });

    describe("chooses LewdLeah's prompt for the situation", () => {
        const promptsIn = (name) => {
            const { result } = measuredContext(SCENARIOS[name], { random: 0.5 });
            return {
                directive: result.includes("Alice is both the namesake character in the story"),
                forget: result.includes("Start your output **immediately** with: (delete key_name_to_forget)"),
                assign: result.includes("## SHORT TASK (REQUIRED)") && result.includes("(any_key_name"),
                choice: result.includes("## SUMMARY OF WHAT YOU MUST DO"),
                condensed: result.includes("## SHARED RULES\n")
            };
        };

        test("ASSIGN below 20,000 characters", () => {
            expect(promptsIn("low context")).toEqual({ directive: true, forget: false, assign: true, choice: false, condensed: false });
        });

        test("CHOICE at 20,000 characters and above", () => {
            expect(promptsIn("high context")).toEqual({ directive: true, forget: false, assign: false, choice: true, condensed: false });
        });

        test.each(["full brain, low context", "full brain, high context"])("FORGET for a %s", (name) => {
            expect(promptsIn(name)).toEqual({ directive: true, forget: true, assign: false, choice: false, condensed: false });
        });

        test("no task card is active", () => {
            const { adventure } = measuredContext(SCENARIOS["low context"], { random: 0.5 });
            const card = adventure.taskCard();
            expect(card ? card.keys : "").toBe("");
        });
    });
});

describe("Optimized Context on", () => {
    test.each(Object.keys(SCENARIOS).flatMap(name => RANDOMS.map(random => [name, random])))(
        "returns the original context unchanged: %s, Math.random = %s",
        (name, random) => {
            const { context, result } = measuredContext(SCENARIOS[name], { random, optimized: true });
            expect(result).toBe(context);
        }
    );

    test("a retry turn returns the original context unchanged", () => {
        const adventure = adventureWithAlice({ random: 0.5 });
        adventure.context(buildContext(), { optimized: true });
        adventure.output("(ledger_worry = `I worry the steward has read the ledger.`) The steward bows.");
        const context = buildContext();
        expect(adventure.context(context, { optimized: true })).toBe(context);
    });

    test("the task card carries the condensed instructions and some of the brain, within 2,000 characters", () => {
        const { adventure } = measuredContext({ maxChars: 8000, storyChars: 3000, brain: 5 }, { random: 0.5, optimized: true });
        const card = adventure.taskCard();
        expect(card.keys).not.toBe("");
        expect(card.entry).toContain("## 1) THOUGHT-WRITING FORMAT");
        expect(card.entry).toContain("## SHARED RULES");
        expect(card.entry).toContain("brain and inner self");
        expect(card.entry.length).toBeLessThanOrEqual(2000);
    });

    test("the task card's Entry carries no build stamp; the Notes do", () => {
        const { adventure } = measuredContext({ maxChars: 8000, storyChars: 3000, brain: 5 }, { random: 0.5, optimized: true });
        const card = adventure.taskCard();
        expect(card.entry).not.toContain("Inner Self Ver");
        expect(card.entry.startsWith("<|task|><SYSTEM>")).toBe(true);
        expect(card.description).toMatch(/^\[build Ver\.[^\]]+\] /);
    });

    test("the task card cleanup leaves this build's card alone on the hooks that follow", () => {
        const { adventure } = measuredContext({ maxChars: 8000, storyChars: 3000, brain: 5 }, { random: 0.5, optimized: true });
        const written = adventure.taskCard().entry;
        adventure.output("The steward bows.");
        adventure.input("You wait.");
        expect(adventure.taskCard().entry).toBe(written);
        expect(adventure.taskCard().keys).not.toBe("");
    });

    test("turning the setting off deactivates the task card", () => {
        const adventure = adventureWithAlice({ random: 0.5 });
        adventure.context(buildContext(), { optimized: true });
        expect(adventure.taskCard().keys).not.toBe("");
        adventure.act("Alice sat down.");
        adventure.context(buildContext({ lastAction: "Alice sat down." }));
        expect(adventure.taskCard().keys).toBe("");
        expect(adventure.taskCard().entry).toBe("");
    });
});

// XloSky's changes that apply on both routes. They differ from LewdLeah's on purpose.
describe("XloSky's changes kept on both routes", () => {
    // Bea is listed first, so LewdLeah's priority tie-break favors her.
    // The chosen agent is read from state rather than the prompt, so the check holds for either prompt set.
    const whoThinks = (options) => {
        const adventure = new Adventure(options).configure(["Bea", "Alice"]);
        const action = "Alice set down her cup. \"Bea is probably in the classroom already,\" she said.";
        adventure.act(action);
        adventure.context(buildContext({ lastAction: action }));
        return adventure.state.InnerSelf.agent;
    };

    test("a name in narration outweighs a name inside dialogue", () => {
        expect(whoThinks({ random: 0.1 })).toBe("Alice");
        expect(whoThinks({ random: 0.9 })).toBe("Alice");
    });

    test("LewdLeah's build can pick the character who is only spoken about", () => {
        expect(whoThinks({ random: 0.1, stock: true })).toBe("Bea");
    });

    test("a thought that names its own agent is discarded", () => {
        const modelOutput = "(tonight_plan = `Alice will find the ledger tonight.`) The steward bows.";
        expect(outputTurn(modelOutput, { random: 0.5 }).brain).not.toContain("tonight_plan");
        expect(outputTurn(modelOutput, { random: 0.5, stock: true }).brain).toContain("tonight_plan");
    });
});
