export async function fetchJson(url: string, init?: RequestInit): Promise<any> {
	const response = await fetch(url, init);
	return readJsonOrThrow(response);
}

export async function readJsonOrThrow(response: Response): Promise<any> {
	const contentType = response.headers.get('content-type') || '';
	const text = await response.text();

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
	}

	if (!contentType.includes('application/json')) {
		throw new Error(`Non-JSON response: ${contentType} -> ${text.slice(0, 200)}`);
	}

	try {
		return JSON.parse(text);
	} catch (e) {
		// Surface the bad payload to aid debugging
		console.error('Bad JSON payload:', text);
		throw e;
	}
}


