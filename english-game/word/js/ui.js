export class GameUI {
	constructor(callbacks = {}) {
		this.cb = callbacks;

		this.scoreEl = document.querySelector('.score');
		this.activeSaveBadgeEl = document.getElementById('active-save-badge');
		this.creditsCountEl = document.getElementById('credits-count');
		this.creditsProgressEl = document.getElementById('credits-progress');
		this.englishWordEl = document.getElementById('english-word');
		this.transliterationEl = document.getElementById('transliteration');
		this.mainAreaEl = document.querySelector('.main-area');
		this.choiceAreaEl = document.getElementById('choice-area');
		this.gearBtn = document.getElementById('gear-btn');
		this.monitoringModal = document.getElementById('monitoring-modal');
		this.modalCloseBtn = document.getElementById('modal-close-btn');
		this.tabBtnSaves = document.getElementById('tab-btn-saves');
		this.tabBtnStats = document.getElementById('tab-btn-stats');
		this.tabContentSaves = document.getElementById('tab-saves');
		this.tabContentStats = document.getElementById('tab-stats');
		this.savesListEl = document.getElementById('saves-list');
		this.newSaveNameInput = document.getElementById('new-save-name-input');
		this.createSaveBtn = document.getElementById('create-save-btn');
		this.statsTbody = document.getElementById('stats-tbody');
		this.resetScoreBtn = document.getElementById('reset-score-btn');
		this.creditsWrap = document.querySelector('.credits-wrap');

		this.initListeners();
	}

	initListeners() {
		if (this.resetScoreBtn) {
			this.resetScoreBtn.addEventListener('click', () => {
				if (this.cb.onResetScore) this.cb.onResetScore();
			});
		}

		this.mainAreaEl.addEventListener('click', () => {
			if (this.cb.onMainAreaClick) this.cb.onMainAreaClick();
		});

		this.creditsWrap.addEventListener('click', () => {
			if (this.cb.onCreditsClick) this.cb.onCreditsClick();
		});

		this.gearBtn.addEventListener('click', () => this.openModal());
		this.modalCloseBtn.addEventListener('click', () => this.closeModal());

		this.monitoringModal.addEventListener('click', (e) => {
			if (e.target === this.monitoringModal) {
				this.closeModal();
			}
		});

		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.monitoringModal.classList.contains('open')) {
				this.closeModal();
			}
		});

		this.tabBtnSaves.addEventListener('click', () => this.switchModalTab('tab-saves'));
		this.tabBtnStats.addEventListener('click', () => this.switchModalTab('tab-stats'));

		const handleNewSave = () => {
			const name = this.newSaveNameInput.value.trim();
			if (!name) return;
			if (this.cb.onCreateSave) this.cb.onCreateSave(name);
			this.newSaveNameInput.value = '';
		};

		this.createSaveBtn.addEventListener('click', handleNewSave);
		this.newSaveNameInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') handleNewSave();
		});
	}

	setScore(score) {
		this.scoreEl.textContent = score;
	}

	setActiveSaveName(name) {
		if (this.activeSaveBadgeEl) {
			this.activeSaveBadgeEl.textContent = name;
			this.activeSaveBadgeEl.title = 'Active Save: ' + name;
		}
	}

	updateCredits(count, progress) {
		this.creditsCountEl.textContent = count;
		this.creditsProgressEl.style.setProperty('--progress', progress);
	}

	showRound(wordObj, choices, onChoiceSelected) {
		this.mainAreaEl.classList.add('clickable');
		this.englishWordEl.textContent = wordObj.english;
		this.transliterationEl.textContent = '';

		this.choiceAreaEl.innerHTML = '';
		choices.forEach(hebrew => {
			const btn = document.createElement('button');
			btn.className = 'choice-btn';
			btn.textContent = hebrew;
			btn.dataset.hebrew = hebrew;
			btn.addEventListener('click', (e) => onChoiceSelected(e.target, hebrew));
			this.choiceAreaEl.appendChild(btn);
		});
		this.choiceAreaEl.classList.add('hidden');
	}

	revealChoices() {
		this.choiceAreaEl.classList.remove('hidden');
	}

	showTransliteration(text) {
		this.transliterationEl.textContent = text;
	}

	markChoiceCorrect(btn) {
		btn.classList.add('correct', 'correct-show');
	}

	markChoiceIncorrect(btn) {
		btn.classList.add('incorrect');
		btn.disabled = true;
		btn.style.opacity = '0.5';
		btn.style.cursor = 'default';
	}

	showGameOver() {
		this.mainAreaEl.classList.remove('clickable');
		this.englishWordEl.textContent = 'Game Over';
		this.transliterationEl.textContent = 'You mastered all the words!';
		this.choiceAreaEl.classList.add('hidden');
	}

	showError(message) {
		this.englishWordEl.textContent = 'Error';
		this.transliterationEl.textContent = message;
		this.mainAreaEl.classList.remove('clickable');
		this.choiceAreaEl.classList.add('hidden');
	}

	openModal() {
		if (this.cb.onOpenModal) this.cb.onOpenModal();
		this.monitoringModal.classList.add('open');
	}

	closeModal() {
		this.monitoringModal.classList.remove('open');
	}

	switchModalTab(tabName) {
		if (tabName === 'tab-saves') {
			this.tabBtnSaves.classList.add('active');
			this.tabBtnStats.classList.remove('active');
			this.tabContentSaves.classList.add('active');
			this.tabContentStats.classList.remove('active');
		} else {
			this.tabBtnStats.classList.add('active');
			this.tabBtnSaves.classList.remove('active');
			this.tabContentStats.classList.add('active');
			this.tabContentSaves.classList.remove('active');
			if (this.cb.onRefreshStats) this.cb.onRefreshStats();
		}
	}

	renderSaves(savesArr, activeId) {
		if (!this.savesListEl) return;
		this.savesListEl.innerHTML = '';

		savesArr.forEach(save => {
			const isActive = save.id === activeId;
			const item = document.createElement('div');
			item.className = 'save-item' + (isActive ? ' active' : '');

			const info = document.createElement('div');
			info.className = 'save-info';

			const titleRow = document.createElement('div');
			titleRow.className = 'save-title-row';

			const nameSpan = document.createElement('span');
			nameSpan.className = 'save-name';
			nameSpan.textContent = save.name;

			titleRow.appendChild(nameSpan);
			if (isActive) {
				const activeTag = document.createElement('span');
				activeTag.className = 'active-tag';
				activeTag.textContent = 'Active';
				titleRow.appendChild(activeTag);
			}

			const metaSpan = document.createElement('span');
			metaSpan.className = 'save-meta';
			const wordsLearned = Object.values(save.wordStats || {}).filter(st => (st.successes || 0) > 0).length;
			metaSpan.textContent = `Score: ${save.score || 0} • Rounds: ${save.roundsCompleted || 0} • Words practiced: ${wordsLearned}`;

			info.appendChild(titleRow);
			info.appendChild(metaSpan);

			const actions = document.createElement('div');
			actions.className = 'save-actions';

			if (!isActive) {
				const loadBtn = document.createElement('button');
				loadBtn.className = 'btn-save-action btn-load';
				loadBtn.textContent = 'Load';
				loadBtn.addEventListener('click', () => {
					if (this.cb.onLoadSave) this.cb.onLoadSave(save.id);
				});
				actions.appendChild(loadBtn);
			}

			const renameBtn = document.createElement('button');
			renameBtn.className = 'btn-save-action btn-rename';
			renameBtn.textContent = 'Rename';
			renameBtn.addEventListener('click', () => {
				const newName = prompt('Enter new name for save:', save.name);
				if (newName && newName.trim() && this.cb.onRenameSave) {
					this.cb.onRenameSave(save.id, newName.trim());
				}
			});
			actions.appendChild(renameBtn);

			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn-save-action btn-delete';
			deleteBtn.textContent = 'Delete';
			deleteBtn.disabled = isActive;
			if (!isActive) {
				deleteBtn.addEventListener('click', () => {
					if (confirm(`Are you sure you want to delete save "${save.name}"?`)) {
						if (this.cb.onDeleteSave) this.cb.onDeleteSave(save.id);
					}
				});
			}
			actions.appendChild(deleteBtn);

			item.appendChild(info);
			item.appendChild(actions);
			this.savesListEl.appendChild(item);
		});
	}

	renderStats(statsData) {
		this.statsTbody.innerHTML = '';
		statsData.forEach(item => {
			const tr = document.createElement('tr');

			const tdWord = document.createElement('td');
			tdWord.textContent = item.english;

			const tdWeight = document.createElement('td');
			tdWeight.className = 'num';
			tdWeight.textContent = item.weight;

			const tdSuccess = document.createElement('td');
			tdSuccess.className = 'num num-success';
			tdSuccess.textContent = item.successes;

			const tdFail = document.createElement('td');
			tdFail.className = 'num num-fail';
			tdFail.textContent = item.fails;

			tr.appendChild(tdWord);
			tr.appendChild(tdWeight);
			tr.appendChild(tdSuccess);
			tr.appendChild(tdFail);
			this.statsTbody.appendChild(tr);
		});
	}
}
