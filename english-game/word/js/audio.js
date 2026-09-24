export class SoundPlayer {
	constructor() {
		this.currentAudio = null;
		this.audioSequenceTimer = null;
	}

	stop() {
		if (this.audioSequenceTimer) {
			clearTimeout(this.audioSequenceTimer);
			this.audioSequenceTimer = null;
		}
		if (this.currentAudio) {
			this.currentAudio.pause();
			this.currentAudio.currentTime = 0;
			this.currentAudio = null;
		}
		if ('speechSynthesis' in window) {
			window.speechSynthesis.cancel();
		}
	}

	speak(text, lang = 'en-US', onEnded = null) {
		if ('speechSynthesis' in window) {
			window.speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = lang;
			if (onEnded) {
				utterance.onend = () => onEnded();
				utterance.onerror = () => onEnded();
			}
			window.speechSynthesis.speak(utterance);
		} else if (onEnded) {
			onEnded();
		}
	}

	playAudioClip(url, fallbackText, fallbackLang = 'en-US', onEnded = null) {
		this.stop();

		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			if (onEnded) onEnded();
		};

		const audio = new Audio(url);
		this.currentAudio = audio;

		const triggerFallback = () => {
			if (this.currentAudio === audio) {
				this.currentAudio = null;
			}
			this.speak(fallbackText, fallbackLang, finish);
		};

		audio.addEventListener('ended', () => {
			if (this.currentAudio === audio) {
				this.currentAudio = null;
			}
			finish();
		});
		audio.addEventListener('error', triggerFallback);
		audio.play().catch(triggerFallback);
	}

	playWord(text) {
		this.playAudioClip(`mp3/en/${encodeURIComponent(text)}.en.mp3`, text, 'en-US');
	}

	playSuccessSequence(wordObj, onComplete) {
		const hebrewUrl = `mp3/he/${encodeURIComponent(wordObj.english)}.he.mp3`;
		const englishUrl = `mp3/en/${encodeURIComponent(wordObj.english)}.en.mp3`;

		this.playAudioClip('mp3/right.effect.mp3', '', 'en-US', () => {
			this.audioSequenceTimer = setTimeout(() => {
				this.playAudioClip(hebrewUrl, wordObj.hebrew, 'he-IL', () => {
					this.audioSequenceTimer = setTimeout(() => {
						this.playAudioClip(englishUrl, wordObj.english, 'en-US', () => {
							this.audioSequenceTimer = setTimeout(() => {
								if (onComplete) onComplete();
							}, 300);
						});
					}, 200);
				});
			}, 150);
		});
	}

	playWrongSequence(englishWord) {
		this.playAudioClip('mp3/wrong.effect.mp3', '', 'en-US', () => {
			this.audioSequenceTimer = setTimeout(() => this.playWord(englishWord));
		});
	}
}
