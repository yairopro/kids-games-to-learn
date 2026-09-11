import * as fs from 'fs';
import * as path from 'path';

const csvFilePath = path.join(__dirname, 'words.csv');
const jsonFilePath = path.join(__dirname, 'words.json');
const mp3DirPath = path.join(__dirname, 'mp3');

if (!fs.existsSync(mp3DirPath)) {
	fs.mkdirSync(mp3DirPath, { recursive: true });
}

const csvData = fs.readFileSync(csvFilePath, 'utf-8');
const lines = csvData.split('\n');

const result = [];

async function main() {
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const parts = trimmedLine.split(',');
		if (parts.length >= 3) {
			const word = parts[0].trim();
			const transliteration = parts[1].trim();
			const translation = parts[2].trim();

			result.push({
				word,
				transliteration,
				translation
			});

			// Fetch mp3
			const mp3FilePath = path.join(mp3DirPath, `${word}.mp3`);
			if (!fs.existsSync(mp3FilePath)) {
				try {
					console.log(`Fetching audio for "${word}"...`);
					const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
					if (res.ok) {
						const data = await res.json();
						let audioUrl = '';

						// Find the first available audio URL
						if (Array.isArray(data)) {
							for (const entry of data) {
								if (entry.phonetics) {
									const phoneticWithAudio = entry.phonetics.find((p: any) => p.audio);
									if (phoneticWithAudio) {
										audioUrl = phoneticWithAudio.audio;
										break;
									}
								}
							}
						}

						if (audioUrl) {
							const audioRes = await fetch(audioUrl);
							if (audioRes.ok) {
								const arrayBuffer = await audioRes.arrayBuffer();
								fs.writeFileSync(mp3FilePath, Buffer.from(arrayBuffer));
								console.log(`Saved ${word}.mp3`);
							} else {
								const audioErrText = await audioRes.text();
								throw new Error(`Failed to download audio file for "${word}". Status: ${audioRes.status} ${audioRes.statusText}. URL: ${audioUrl}. Response: ${audioErrText}`);
							}
						} else {
							throw new Error(`No audio URL found for "${word}". API Response data: ${JSON.stringify(data)}`);
						}
					} else {
						const errText = await res.text();
						throw new Error(`Dictionary API returned ${res.status} ${res.statusText} for "${word}". Response body: ${errText}`);
					}
				} catch (error) {
					console.error(`Error fetching audio for "${word}":`, error);
					process.exit(1);
				}

				// Add a small delay to avoid rate limiting
				await new Promise(resolve => setTimeout(resolve, 300));
			} else {
				console.log(`Audio for "${word}" already exists. Skipping.`);
			}
		}
	}

	fs.writeFileSync(jsonFilePath, JSON.stringify(result, null, 2), 'utf-8');
	console.log(`Successfully converted ${result.length} words to ${jsonFilePath}`);
}

main().catch(console.error);
