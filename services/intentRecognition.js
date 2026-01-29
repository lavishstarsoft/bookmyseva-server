const natural = require('natural');
const BotIntent = require('../models/BotIntent');

class IntentRecognitionService {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = natural.PorterStemmer;
        this.intents = [];
        this.loadIntents();
    }

    async loadIntents() {
        try {
            this.intents = await BotIntent.find({ isActive: true }).sort({ priority: -1 });
            console.log(`Loaded ${this.intents.length} active bot intents`);
        } catch (error) {
            console.error('Error loading intents:', error);
        }
    }

    // Tokenize and stem a message
    processMessage(message) {
        const tokens = this.tokenizer.tokenize(message.toLowerCase());
        return tokens.map(token => this.stemmer.stem(token));
    }

    // Calculate similarity between message and intent keywords
    calculateSimilarity(messageTokens, keywords) {
        let matchCount = 0;
        const stemmedKeywords = keywords.map(kw => this.stemmer.stem(kw.toLowerCase()));

        messageTokens.forEach(token => {
            if (stemmedKeywords.includes(token)) {
                matchCount++;
            }
        });

        return matchCount / stemmedKeywords.length;
    }

    // Recognize intent from user message
    async recognizeIntent(message) {
        if (!message || message.trim().length === 0) {
            return null;
        }

        // Reload intents periodically (cached for performance)
        if (this.intents.length === 0) {
            await this.loadIntents();
        }

        const messageTokens = this.processMessage(message);
        let bestMatch = null;
        let highestScore = 0;

        for (const intent of this.intents) {
            const score = this.calculateSimilarity(messageTokens, intent.keywords);

            // Threshold: 0.3 means at least 30% of keywords must match
            if (score > highestScore && score >= 0.3) {
                highestScore = score;
                bestMatch = intent;
            }
        }

        // Update match analytics if found
        if (bestMatch) {
            await BotIntent.findByIdAndUpdate(bestMatch._id, {
                $inc: { matchCount: 1 },
                lastMatched: new Date()
            });
        }

        return bestMatch;
    }

    // Get appropriate response for an intent
    async getResponse(message) {
        const intent = await this.recognizeIntent(message);

        if (intent) {
            return {
                type: 'bot_response',
                message: intent.response,
                quickReplies: intent.quickReplies || [],
                intent: intent.intent
            };
        }

        // No intent matched - trigger WhatsApp escalation
        return {
            type: 'no_match',
            message: "I'm not sure how to help with that. Let me connect you with our team.",
            escalate: true
        };
    }

    // Refresh intents cache (call this when admin updates intents)
    async refresh() {
        await this.loadIntents();
    }
}

module.exports = new IntentRecognitionService();
