export const INITIAL_WEIGHT = 10;

export function shuffleArray(arr) {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export class GameEngine {
	constructor(wordPairs = []) {
		this.wordPairs = wordPairs;
		this.score = 0;
		this.roundsCompleted = 0;
		this.creditsSpent = 0;
		this.wordStats = {}; // { [english]: { successes: 0, fails: 0 } }
		this.currentWord = null;
	}

	loadState(state) {
		this.score = state.score || 0;
		this.roundsCompleted = state.roundsCompleted || 0;
		this.creditsSpent = state.creditsSpent || 0;
		this.wordStats = state.wordStats ? { ...state.wordStats } : {};
	}

	getState() {
		return {
			score: this.score,
			roundsCompleted: this.roundsCompleted,
			creditsSpent: this.creditsSpent,
			wordStats: this.wordStats
		};
	}

	getCreditsEarned() {
		return Math.floor(this.roundsCompleted / 10);
	}

	getCredits() {
		return Math.max(0, this.getCreditsEarned() - this.creditsSpent);
	}

	getRefillProgress() {
		return (this.roundsCompleted % 10) / 10;
	}

	useCredit() {
		if (this.getCredits() >= 1) {
			this.creditsSpent++;
			return true;
		}
		return false;
	}

	getWordWeight(english) {
		const st = this.wordStats[english];
		if (!st) return INITIAL_WEIGHT;
		const successes = st.successes || 0;
		const fails = st.fails || 0;
		return Math.max(0, INITIAL_WEIGHT + fails - successes);
	}

	getAvailableWords() {
		return this.wordPairs.filter(p => this.getWordWeight(p.english) > 0);
	}

	pickWordByWeight() {
		const available = this.getAvailableWords();
		if (available.length === 0) return null;
		const total = available.reduce((sum, p) => sum + this.getWordWeight(p.english), 0);
		let r = Math.random() * total;
		for (const p of available) {
			r -= this.getWordWeight(p.english);
			if (r <= 0) return p;
		}
		return available[available.length - 1];
	}

	getRandomWrongChoices(count, excludeHebrew) {
		const available = this.wordPairs.filter(p => p.hebrew !== excludeHebrew);
		const shuffled = shuffleArray(available);
		return shuffled.slice(0, count).map(p => p.hebrew);
	}

	startRound() {
		if (this.currentWord !== null) {
			this.roundsCompleted++;
		}
		this.currentWord = this.pickWordByWeight();
		if (!this.currentWord) {
			return null;
		}

		const wrongAnswers = this.getRandomWrongChoices(5, this.currentWord.hebrew);
		const choices = shuffleArray([...wrongAnswers, this.currentWord.hebrew]);

		return {
			word: this.currentWord,
			choices
		};
	}

	recordSuccess(englishWord) {
		this.score += 1;
		if (!this.wordStats[englishWord]) {
			this.wordStats[englishWord] = { successes: 0, fails: 0 };
		}
		this.wordStats[englishWord].successes = (this.wordStats[englishWord].successes || 0) + 1;
	}

	recordFailure(englishWord) {
		const penalty = this.score < 0 ? 1 : Math.max(1, Math.trunc(this.score / 10) + 1);
		this.score -= penalty;
		if (!this.wordStats[englishWord]) {
			this.wordStats[englishWord] = { successes: 0, fails: 0 };
		}
		this.wordStats[englishWord].fails = (this.wordStats[englishWord].fails || 0) + 1;
		return penalty;
	}
}
