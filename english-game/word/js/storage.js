const STORAGE_KEY = 'kids_word_game_stats_v1';
const SAVES_KEY = 'kids_word_game_saves_v1';
const ACTIVE_SAVE_KEY = 'kids_word_game_active_save_v1';

export class SaveManager {
	constructor() {
		this.activeSaveId = null;
		this.savesMap = {};
	}

	generateSaveId() {
		return 'save_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
	}

	load() {
		try {
			const savedSaves = localStorage.getItem(SAVES_KEY);
			if (savedSaves) {
				this.savesMap = JSON.parse(savedSaves) || {};
			}
		} catch (e) {
			console.warn('Failed to load saves map:', e);
			this.savesMap = {};
		}

		if (Object.keys(this.savesMap).length === 0) {
			let legacyScore = 0;
			let legacyRounds = 0;
			let legacyCredits = 0;
			let legacyStats = {};
			try {
				const legacy = localStorage.getItem(STORAGE_KEY);
				if (legacy) {
					const parsed = JSON.parse(legacy);
					if (typeof parsed.score === 'number') legacyScore = parsed.score;
					if (typeof parsed.roundsCompleted === 'number') legacyRounds = parsed.roundsCompleted;
					if (typeof parsed.creditsSpent === 'number') legacyCredits = parsed.creditsSpent;
					if (parsed.wordStats && typeof parsed.wordStats === 'object') legacyStats = parsed.wordStats;
				}
			} catch (e) {
				console.warn('Failed to parse legacy save:', e);
			}

			const defaultId = this.generateSaveId();
			this.savesMap[defaultId] = {
				id: defaultId,
				name: 'Default',
				score: legacyScore,
				roundsCompleted: legacyRounds,
				creditsSpent: legacyCredits,
				wordStats: legacyStats,
				updatedAt: Date.now()
			};
			this.activeSaveId = defaultId;
			this.persist();
		} else {
			const savedActiveId = localStorage.getItem(ACTIVE_SAVE_KEY);
			if (savedActiveId && this.savesMap[savedActiveId]) {
				this.activeSaveId = savedActiveId;
			} else {
				this.activeSaveId = Object.keys(this.savesMap)[0];
				this.persist();
			}
		}

		return this.getActiveSave();
	}

	persist() {
		try {
			localStorage.setItem(SAVES_KEY, JSON.stringify(this.savesMap));
			if (this.activeSaveId) {
				localStorage.setItem(ACTIVE_SAVE_KEY, this.activeSaveId);
			}
		} catch (e) {
			console.warn('Failed to persist saves map:', e);
		}
	}

	getActiveSave() {
		return this.savesMap[this.activeSaveId] || null;
	}

	saveCurrent(data) {
		if (!this.activeSaveId || !this.savesMap[this.activeSaveId]) return;
		Object.assign(this.savesMap[this.activeSaveId], {
			...data,
			updatedAt: Date.now()
		});
		this.persist();

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				score: data.score,
				roundsCompleted: data.roundsCompleted,
				creditsSpent: data.creditsSpent,
				wordStats: data.wordStats
			}));
		} catch (e) {}
	}

	createSave(name) {
		const cleanName = (name || '').trim();
		if (!cleanName) return null;
		const newId = this.generateSaveId();
		this.savesMap[newId] = {
			id: newId,
			name: cleanName,
			score: 0,
			roundsCompleted: 0,
			creditsSpent: 0,
			wordStats: {},
			updatedAt: Date.now()
		};
		this.activeSaveId = newId;
		this.persist();
		return this.savesMap[newId];
	}

	setActive(id) {
		if (!this.savesMap[id]) return null;
		this.activeSaveId = id;
		this.persist();
		return this.savesMap[id];
	}

	renameSave(id, newName) {
		const cleanName = (newName || '').trim();
		if (!cleanName || !this.savesMap[id]) return false;
		this.savesMap[id].name = cleanName;
		this.savesMap[id].updatedAt = Date.now();
		this.persist();
		return true;
	}

	deleteSave(id) {
		if (id === this.activeSaveId || !this.savesMap[id]) return false;
		delete this.savesMap[id];
		this.persist();
		return true;
	}

	getAllSaves() {
		return Object.values(this.savesMap).sort((a, b) =>
			(a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
		);
	}
}
