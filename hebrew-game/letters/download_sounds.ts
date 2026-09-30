import * as fs from 'fs';
import * as path from 'path';
import { EdgeTTS } from 'node-edge-tts';
import { letters } from './letters.js';

const mp3DirPath = path.join(__dirname, 'mp3');

const VOICE = 'he-IL-AvriNeural';
const LANG = 'he-IL';

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateSound(tts: EdgeTTS, text: string, destPath: string, maxRetries = 3): Promise<boolean> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await tts.ttsPromise(text, destPath);
			if (fs.existsSync(destPath)) {
				return true;
			}
		} catch (e) {
			console.error(`Attempt ${attempt} error generating sound for "${text}":`, e);
			if (attempt < maxRetries) await sleep(attempt * 1000);
		}
	}
	return false;
}

async function main() {
	if (!fs.existsSync(mp3DirPath)) {
		fs.mkdirSync(mp3DirPath, { recursive: true });
	}

	const tts = new EdgeTTS({
		voice: VOICE,
		lang: LANG,
	});

	for (const letter of letters) {
		const destPath = path.join(mp3DirPath, letter.file);
		if (fs.existsSync(destPath)) {
			console.log(`Audio for ${letter.char} already exists. Skipping.`);
			continue;
		}

		console.log(`Generating audio for ${letter.char}...`);
		const ok = await generateSound(tts, letter.spokenName, destPath);
		if (ok) {
			console.log(`Saved ${letter.file}`);
		} else {
			console.error(`Failed ${letter.char}`);
		}
		await sleep(400);
	}

	console.log('Finished downloading sounds.');
}

if (import.meta.main) {
	main();
}
