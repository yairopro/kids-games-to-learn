import * as fs from 'fs';
import * as path from 'path';

const csvFilePath = path.join(__dirname, 'words.csv');
const jsonFilePath = path.join(__dirname, 'words.json');
const mp3DirPath = path.join(__dirname, 'mp3');

type Entry = {
	word: string,
	transliteration: string,
	translation: string,
}

const USER_AGENT = 'kids-english-learning-game/1.0 (https://github.com/yairopro/kids-games-to-learn)';

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function getGoogleTtsUrl(word: string, tl = 'en'): string {
	return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=${tl}&client=tw-ob`;
}

async function downloadFile(url: string, destPath: string, maxRetries = 3): Promise<boolean> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const res = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Referer': 'https://translate.google.com/'
				}
			});
			if (res.ok) {
				const arrayBuffer = await res.arrayBuffer();
				fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
				return true;
			} else if (res.status === 429) {
				const retryAfterHeader = res.headers.get('Retry-After');
				const backoffMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : attempt * 2000;
				console.warn(`HTTP 429 on ${url}. Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
				await sleep(backoffMs);
			} else {
				console.error(`Failed to download audio from ${url}: HTTP ${res.status} ${res.statusText}`);
				return false;
			}
		} catch (e) {
			console.error(`Attempt ${attempt} error downloading ${url}:`, e);
			if (attempt < maxRetries) await sleep(attempt * 1000);
		}
	}
	return false;
}

async function main() {
	if (!fs.existsSync(mp3DirPath))
		fs.mkdirSync(mp3DirPath, { recursive: true });

	const csvData: string = fs.readFileSync(csvFilePath, 'utf-8');
	const lines = csvData.split('\n');

	const result: Entry[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const parts = trimmedLine.split(',');
		if (parts.length >= 3) {
			const word = parts[0].trim();
			const translation = parts[1].trim();
			const transliteration = parts[2].trim();

			result.push({ word, transliteration, translation });

			// Fetch mp3
			const mp3FilePath = path.join(mp3DirPath, `${word}.mp3`);
			if (!fs.existsSync(mp3FilePath)) {
				try {
					console.log(`Fetching US audio for "${word}" from Google Translate TTS...`);
					const audioUrl = getGoogleTtsUrl(word, 'en');
					const downloaded = await downloadFile(audioUrl, mp3FilePath);
					if (downloaded) {
						console.log(`Saved ${word}.mp3`);
					} else {
						console.warn(`Failed downloading audio file for "${word}". Skipping.`);
					}
				} catch (error) {
					console.warn(`Error processing "${word}":`, error);
				}

				// Small delay between downloads
				await sleep(500);
			} else {
				console.log(`Audio for "${word}" already exists. Skipping.`);
			}
		}
	}

	fs.writeFileSync(jsonFilePath, JSON.stringify(result, null, 2), 'utf-8');
	console.log(`Successfully converted ${result.length} words to ${jsonFilePath}`);
}

main().catch(console.error);
