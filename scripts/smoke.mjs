const endpoints = [
  ['api health', 'http://localhost:3001/api/health'],
  ['indexer health', 'http://localhost:3002/health'],
  ['web', 'http://localhost:3000'],
];

for (const [name, url] of endpoints) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`PASS ${name}`);
  } finally {
    clearTimeout(timer);
  }
}
