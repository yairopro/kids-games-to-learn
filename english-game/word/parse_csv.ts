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

function findUsMediaUrl(mediaItems: any[]): string | null {
	if (!Array.isArray(mediaItems) || mediaItems.length === 0) return null;

	const audioItems = mediaItems.filter(item => {
		const title = (item.title || '').toLowerCase();
		const type = (item.type || '').toLowerCase();
		return type === 'audio' || title.endsWith('.ogg') || title.endsWith('.oga') || title.endsWith('.mp3');
	});

	if (audioItems.length === 0) return null;

	// Score audio items based on US accent indications
	const scored = audioItems.map(item => {
		const title = (item.title || '').toLowerCase();
		const caption = (item.caption?.text || '').toLowerCase();
		let score = 0;
		if (title.includes('en-us') || title.includes('_us') || title.includes('us-')) score += 10;
		if (caption.includes('us') || caption.includes('american') || caption.includes('u.s.')) score += 5;
		if (title.includes('en-uk') || title.includes('en-gb') || caption.includes('uk') || caption.includes('british')) score -= 5;
		return { item, score };
	});

	scored.sort((a, b) => b.score - a.score);
	const best = scored[0]?.item;
	if (!best) return null;

	// Pick direct mp3 or transcoded mp3
	if (Array.isArray(best.original?.source_urls)) {
		const mp3Source = best.original.source_urls.find((u: string) => u.toLowerCase().endsWith('.mp3'));
		if (mp3Source) return mp3Source;
	}
	if (best.original?.url) {
		const url = best.original.url;
		if (url.toLowerCase().endsWith('.mp3')) return url;
		// Try transcoded mp3 path if ogg/oga
		const transcodeMatch = url.match(/https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(.+)\.(?:ogg|oga)/i);
		if (transcodeMatch) {
			const hashAndFilename = transcodeMatch[1];
			const filename = hashAndFilename.split('/').pop();
			return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${hashAndFilename}.ogg/${filename}.ogg.mp3`;
		}
		return url;
	}

	return null;
}

async function fetchAudioUrlFromWiktionary(word: string): Promise<string | null> {
	const variants = [word, word.toLowerCase()];

	for (const term of variants) {
		// 1. Try Wiktionary REST media-list endpoint
		try {
			const mediaApiUrl = `https://en.wiktionary.org/api/rest_v1/page/media-list/${encodeURIComponent(term)}`;
			const res = await fetch(mediaApiUrl, {
				headers: { 'User-Agent': USER_AGENT }
			});
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.items)) {
					const audioUrl = findUsMediaUrl(data.items);
					if (audioUrl) return audioUrl;
				}
			}
		} catch (e) {
			console.warn(`Wiktionary media-list error for "${term}":`, e);
		}

		// 2. Try parsing Wiktionary HTML page directly
		try {
			const pageUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(term)}`;
			const res = await fetch(pageUrl, {
				headers: { 'User-Agent': USER_AGENT }
			});
			if (res.ok) {
				const html = await res.text();

				// Look for transcoded or direct US mp3 link
				const usMp3Match = html.match(/(?:href|src)=["']((?:https?:)?\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^"']*(?:en-us|_us)[^"']*\.mp3)["']/i);
				if (usMp3Match && usMp3Match[1]) {
					return usMp3Match[1].startsWith('//') ? `https:${usMp3Match[1]}` : usMp3Match[1];
				}

				// Look for any transcoded mp3 link
				const anyMp3Match = html.match(/(?:href|src)=["']((?:https?:)?\/\/upload\.wikimedia\.org\/wikipedia\/commons\/transcoded\/[^"']+\.mp3)["']/i);
				if (anyMp3Match && anyMp3Match[1]) {
					return anyMp3Match[1].startsWith('//') ? `https:${anyMp3Match[1]}` : anyMp3Match[1];
				}

				// Look for Commons audio file upload link
				const audioUploadMatch = html.match(/(?:href|src)=["']((?:https?:)?\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^"']+\.(?:mp3|ogg|oga))["']/i);
				if (audioUploadMatch && audioUploadMatch[1]) {
					let url = audioUploadMatch[1].startsWith('//') ? `https:${audioUploadMatch[1]}` : audioUploadMatch[1];
					if (url.endsWith('.ogg') || url.endsWith('.oga')) {
						const transcodeMatch = url.match(/https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(.+)\.(?:ogg|oga)/i);
						if (transcodeMatch) {
							const hashAndFilename = transcodeMatch[1];
							const filename = hashAndFilename.split('/').pop();
							return `https://upload.wikimedia.org/wikipedia/commons/transcoded/${hashAndFilename}.ogg/${filename}.ogg.mp3`;
						}
					}
					return url;
				}
			}
		} catch (e) {
			console.warn(`Wiktionary HTML fetch error for "${term}":`, e);
		}
	}

	return null;
}

async function downloadFile(url: string, destPath: string, maxRetries = 3): Promise<boolean> {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': USER_AGENT }
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
					console.log(`Fetching US audio for "${word}" from Wiktionary...`);
					const audioUrl = await fetchAudioUrlFromWiktionary(word);

					if (audioUrl) {
						console.log(`Found audio URL for "${word}": ${audioUrl}`);
						const downloaded = await downloadFile(audioUrl, mp3FilePath);
						if (downloaded) {
							console.log(`Saved ${word}.mp3`);
						} else {
							console.warn(`Failed downloading audio file for "${word}". Skipping.`);
						}
					} else {
						console.warn(`No audio URL found on Wiktionary for "${word}". Skipping.`);
					}
				} catch (error) {
					console.warn(`Error processing "${word}":`, error);
				}

				// Delay to stay within Wikimedia rate limits
				await sleep(1200);
			} else {
				console.log(`Audio for "${word}" already exists. Skipping.`);
			}
		}
	}

	fs.writeFileSync(jsonFilePath, JSON.stringify(result, null, 2), 'utf-8');
	console.log(`Successfully converted ${result.length} words to ${jsonFilePath}`);
}

main().catch(console.error);
