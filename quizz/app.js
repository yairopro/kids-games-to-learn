const STORAGE_KEY = 'joshua_quiz_state_v1';
export const INITIAL_WEIGHT = 10;

function shuffleArray(arr) {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

class SoundEffects {
	constructor() {
		this.rightAudio = new Audio('/assets/audio/right.effect.mp3');
		this.wrongAudio = new Audio('/assets/audio/wrong.effect.mp3');
	}

	playRight() {
		try {
			this.rightAudio.currentTime = 0;
			this.rightAudio.play().catch(() => {});
		} catch (e) {}
	}

	playWrong() {
		try {
			this.wrongAudio.currentTime = 0;
			this.wrongAudio.play().catch(() => {});
		} catch (e) {}
	}
}

class QuizApp {
	constructor() {
		this.items = [];
		this.score = 0;
		this.stats = {}; // { [id]: { successes: 0, fails: 0 } }
		this.currentItem = null;
		this.remainingChoices = [];
		this.audio = new SoundEffects();

		this.dom = {
			scoreDisplay: document.getElementById('score-display'),
			quizCard: document.getElementById('quiz-card'),
			victoryCard: document.getElementById('victory-card'),
			typePill: document.getElementById('item-type-pill'),
			promptText: document.getElementById('prompt-text'),
			choicesList: document.getElementById('choices-list'),
			nextBtn: document.getElementById('next-btn'),
			gearBtn: document.getElementById('gear-btn'),
			modal: document.getElementById('monitoring-modal'),
			modalCloseBtn: document.getElementById('modal-close-btn'),
			statsTbody: document.getElementById('stats-tbody'),
			resetAllBtn: document.getElementById('reset-all-btn'),
			restartGameBtn: document.getElementById('restart-game-btn')
		};

		this.bindEvents();
	}

	async init() {
		try {
			const res = await fetch('data.json');
			this.items = await res.json();
			this.loadStorage();
			this.updateScoreDisplay();
			this.nextRound();
		} catch (e) {
			console.error('Error loading quiz data:', e);
			this.dom.promptText.textContent = 'שגיאה בטעינת הנתונים';
		}
	}

	loadStorage() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved);
				this.score = typeof parsed.score === 'number' ? parsed.score : 0;
				this.stats = parsed.stats || {};
			}
		} catch (e) {
			console.warn('Failed to parse localStorage:', e);
			this.stats = {};
		}
	}

	saveStorage() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				score: this.score,
				stats: this.stats
			}));
		} catch (e) {
			console.warn('Failed to save to localStorage:', e);
		}
	}

	getItemWeight(id) {
		const st = this.stats[id];
		if (!st) return INITIAL_WEIGHT;
		const successes = st.successes || 0;
		const fails = st.fails || 0;
		return Math.max(0, INITIAL_WEIGHT + fails - successes);
	}

	getAvailableItems() {
		return this.items.filter(item => this.getItemWeight(item.id) > 0);
	}

	pickItemByWeight() {
		const available = this.getAvailableItems();
		if (available.length === 0) return null;

		const totalWeight = available.reduce((acc, item) => acc + this.getItemWeight(item.id), 0);
		let r = Math.random() * totalWeight;

		for (const item of available) {
			r -= this.getItemWeight(item.id);
			if (r <= 0) return item;
		}
		return available[available.length - 1];
	}

	getDistractors(item, count = 2) {
		const sameTypePool = this.items.filter(other => other.type === item.type && other.id !== item.id);
		const shuffled = shuffleArray(sameTypePool);
		return shuffled.slice(0, count).map(other => other.answer);
	}

	nextRound() {
		this.dom.nextBtn.classList.remove('visible');
		this.dom.choicesList.innerHTML = '';

		const chosen = this.pickItemByWeight();
		if (!chosen) {
			// All items reached weight 0 -> Victory!
			this.dom.quizCard.style.display = 'none';
			this.dom.victoryCard.classList.add('visible');
			return;
		}

		this.currentItem = chosen;
		this.dom.quizCard.style.display = 'flex';
		this.dom.victoryCard.classList.remove('visible');

		// UI Type Pill
		if (chosen.type === 'question') {
			this.dom.typePill.textContent = 'שאלה על הפרק';
			this.dom.typePill.className = 'type-pill question';
		} else {
			this.dom.typePill.textContent = 'פירוש מילים';
			this.dom.typePill.className = 'type-pill vocab';
		}

		this.dom.promptText.textContent = chosen.prompt;

		// 3 Choices: 1 correct + 2 distractors from same section
		const distractors = this.getDistractors(chosen, 2);
		const choices = shuffleArray([chosen.answer, ...distractors]);
		this.remainingChoices = [...choices];

		choices.forEach(choiceText => {
			const btn = document.createElement('button');
			btn.className = 'choice-btn';
			btn.textContent = choiceText;
			btn.addEventListener('click', () => this.handleChoiceClick(btn, choiceText));
			this.dom.choicesList.appendChild(btn);
		});
	}

	handleChoiceClick(btn, choiceText) {
		if (btn.disabled || !this.currentItem) return;

		const isCorrect = choiceText === this.currentItem.answer;
		const id = this.currentItem.id;
		if (!this.stats[id]) {
			this.stats[id] = { successes: 0, fails: 0 };
		}

		if (isCorrect) {
			this.audio.playRight();
			this.score += 1;
			this.stats[id].successes += 1;
			this.updateScoreDisplay();
			this.saveStorage();

			btn.classList.add('correct');
			// Disable all buttons now that correct answer found
			const allBtns = this.dom.choicesList.querySelectorAll('.choice-btn');
			allBtns.forEach(b => b.disabled = true);

			// Show Next button
			this.dom.nextBtn.classList.add('visible');
		} else {
			this.audio.playWrong();
			const penalty = this.score < 0 ? 1 : Math.max(1, Math.trunc(this.score / 10) + 1);
			this.score -= penalty;
			this.stats[id].fails += 1;
			this.updateScoreDisplay();
			this.saveStorage();

			// Mark button as wrong and disable it
			btn.classList.add('wrong');
			btn.disabled = true;

			// Check if only 1 enabled button is left (which must be the correct one)
			const remainingBtns = Array.from(this.dom.choicesList.querySelectorAll('.choice-btn')).filter(b => !b.disabled);
			if (remainingBtns.length === 1) {
				// Only right answer left -> auto-win round
				const lastBtn = remainingBtns[0];
				lastBtn.classList.add('correct');
				lastBtn.disabled = true;
				this.dom.nextBtn.classList.add('visible');
			}
		}
	}

	updateScoreDisplay() {
		this.dom.scoreDisplay.textContent = this.score;
	}

	renderStatsModal() {
		this.dom.statsTbody.innerHTML = '';
		this.items.forEach(item => {
			const weight = this.getItemWeight(item.id);
			const st = this.stats[item.id] || { successes: 0, fails: 0 };
			const tr = document.createElement('tr');

			const tdName = document.createElement('td');
			tdName.textContent = item.prompt;

			const tdWeight = document.createElement('td');
			tdWeight.style.textAlign = 'center';
			tdWeight.textContent = weight;
			if (weight === 0) {
				tdWeight.style.color = '#10b981';
				tdWeight.style.fontWeight = 'bold';
			}

			const tdSuccess = document.createElement('td');
			tdSuccess.style.textAlign = 'center';
			tdSuccess.textContent = st.successes || 0;

			const tdFails = document.createElement('td');
			tdFails.style.textAlign = 'center';
			tdFails.textContent = st.fails || 0;

			tr.appendChild(tdName);
			tr.appendChild(tdWeight);
			tr.appendChild(tdSuccess);
			tr.appendChild(tdFails);
			this.dom.statsTbody.appendChild(tr);
		});
	}

	resetAll() {
		if (confirm('האם אתה בטוח שברצונך לאפס את הניקוד ואת כל נתוני ההצלחות והטעויות?')) {
			this.score = 0;
			this.stats = {};
			this.saveStorage();
			this.updateScoreDisplay();
			this.renderStatsModal();
			this.dom.modal.classList.remove('open');
			this.nextRound();
		}
	}

	bindEvents() {
		this.dom.nextBtn.addEventListener('click', () => this.nextRound());

		this.dom.gearBtn.addEventListener('click', () => {
			this.renderStatsModal();
			this.dom.modal.classList.add('open');
		});

		this.dom.modalCloseBtn.addEventListener('click', () => {
			this.dom.modal.classList.remove('open');
		});

		this.dom.modal.addEventListener('click', (e) => {
			if (e.target === this.dom.modal) {
				this.dom.modal.classList.remove('open');
			}
		});

		this.dom.resetAllBtn.addEventListener('click', () => this.resetAll());

		this.dom.restartGameBtn.addEventListener('click', () => {
			this.stats = {};
			this.saveStorage();
			this.nextRound();
		});
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const app = new QuizApp();
	app.init();
});
