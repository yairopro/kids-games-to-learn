import { SaveManager } from './storage.js';
import { SoundPlayer } from './audio.js';
import { GameEngine } from './engine.js';
import { GameUI } from './ui.js';

class WordGameApp {
	constructor() {
		this.storage = new SaveManager();
		this.audio = new SoundPlayer();
		this.engine = null;
		this.ui = null;

		this.awaitingNextRound = false;
		this.awaitingAfterCorrect = false;
		this.suggestionsRevealed = false;
		this.transliterationRevealed = false;
	}

	async init() {
		try {
			const response = await fetch('words.json');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.json();
			const wordPairs = data.map(item => ({
				english: item.word,
				transliteration: item.transliteration,
				hebrew: item.translation
			}));

			this.engine = new GameEngine(wordPairs);

			this.ui = new GameUI({
				onMainAreaClick: () => this.handleMainAreaClick(),
				onCreditsClick: () => this.handleCreditsClick(),
				onCreateSave: (name) => this.handleCreateSave(name),
				onLoadSave: (id) => this.handleLoadSave(id),
				onRenameSave: (id, name) => this.handleRenameSave(id, name),
				onDeleteSave: (id) => this.handleDeleteSave(id),
				onResetScore: () => this.handleResetScore(),
				onOpenModal: () => this.refreshModalContent(),
				onRefreshStats: () => this.renderStatsTable()
			});

			const activeProfile = this.storage.load();
			if (activeProfile) {
				this.engine.loadState(activeProfile);
				this.ui.setActiveSaveName(activeProfile.name);
			}

			this.syncUI();
			this.loadRound();
		} catch (err) {
			console.error('Failed to initialize word game:', err);
			if (this.ui) {
				this.ui.showError('Failed to load words.json. Please run via a local web server.');
			}
		}
	}

	syncUI() {
		this.ui.setScore(this.engine.score);
		this.ui.updateCredits(this.engine.getCredits(), this.engine.getRefillProgress());
	}

	persistState() {
		this.storage.saveCurrent(this.engine.getState());
	}

	loadRound() {
		this.audio.stop();

		const round = this.engine.startRound();
		if (!round) {
			this.ui.showGameOver();
			return;
		}

		this.syncUI();
		this.persistState();

		this.awaitingNextRound = false;
		this.awaitingAfterCorrect = false;
		this.suggestionsRevealed = false;
		this.transliterationRevealed = false;

		this.ui.showRound(round.word, round.choices, (btn, chosen) => {
			this.handleChoice(btn, chosen);
		});
	}

	handleChoice(btn, chosenHebrew) {
		if (this.awaitingNextRound) return;

		const current = this.engine.currentWord;
		if (chosenHebrew === current.hebrew) {
			this.engine.recordSuccess(current.english);
			this.persistState();
			this.ui.setScore(this.engine.score);
			this.ui.markChoiceCorrect(btn);

			this.awaitingNextRound = true;
			this.awaitingAfterCorrect = true;

			this.audio.playSuccessSequence(current, () => {
				this.loadRound();
			});
		} else {
			this.engine.recordFailure(current.english);
			this.persistState();
			this.ui.setScore(this.engine.score);
			this.ui.markChoiceIncorrect(btn);

			if (navigator.vibrate) {
				navigator.vibrate(200);
			}
			this.audio.playWrongSequence(current.english);
		}
	}

	handleMainAreaClick() {
		if (this.awaitingNextRound) {
			if (this.awaitingAfterCorrect) return;
			this.loadRound();
			return;
		}

		if (this.engine.currentWord) {
			this.audio.playWord(this.engine.currentWord.english);
		}

		if (!this.suggestionsRevealed) {
			this.suggestionsRevealed = true;
			this.ui.revealChoices();
		}
	}

	handleCreditsClick() {
		if (this.awaitingNextRound) return;

		if (!this.transliterationRevealed && this.engine.useCredit()) {
			this.transliterationRevealed = true;
			this.ui.showTransliteration(this.engine.currentWord.transliteration);
			this.syncUI();
			this.persistState();
		}
	}

	handleCreateSave(name) {
		const newSave = this.storage.createSave(name);
		if (newSave) {
			this.handleLoadSave(newSave.id);
		}
	}

	handleLoadSave(id) {
		const profile = this.storage.setActive(id);
		if (!profile) return;

		this.engine.loadState(profile);
		this.ui.setActiveSaveName(profile.name);
		this.syncUI();
		this.refreshModalContent();
		this.loadRound();
	}

	handleRenameSave(id, name) {
		this.storage.renameSave(id, name);
		const active = this.storage.getActiveSave();
		if (active && active.id === id) {
			this.ui.setActiveSaveName(active.name);
		}
		this.refreshModalContent();
	}

	handleDeleteSave(id) {
		this.storage.deleteSave(id);
		this.refreshModalContent();
	}

	handleResetScore() {
		this.engine.score = 0;
		this.persistState();
		this.syncUI();
		this.refreshModalContent();
	}

	refreshModalContent() {
		this.ui.renderSaves(this.storage.getAllSaves(), this.storage.activeSaveId);
		this.renderStatsTable();
	}

	renderStatsTable() {
		const wordPairs = this.engine.wordPairs;
		const sorted = [...wordPairs].sort((a, b) => {
			const stA = this.engine.wordStats[a.english] || { successes: 0, fails: 0 };
			const stB = this.engine.wordStats[b.english] || { successes: 0, fails: 0 };
			const triesA = (stA.successes || 0) + (stA.fails || 0);
			const triesB = (stB.successes || 0) + (stB.fails || 0);
			return triesB - triesA;
		});

		const statsData = sorted.map(p => {
			const st = this.engine.wordStats[p.english] || { successes: 0, fails: 0 };
			return {
				english: p.english,
				weight: this.engine.getWordWeight(p.english),
				successes: st.successes || 0,
				fails: st.fails || 0
			};
		});

		this.ui.renderStats(statsData);
	}
}

const app = new WordGameApp();
app.init();
