// Matches hub.quakeworld.nu URLs and extracts the game ID
// Supports: /game/{id}, /qtv/{id}, and bare numeric IDs after the domain
const HUB_URL_PATTERN = /hub\.quakeworld\.nu\/(?:game|qtv)\/(\d+)/g;

function extractGameIds(text) {
  const ids = [];
  let match;
  while ((match = HUB_URL_PATTERN.exec(text)) !== null) {
    ids.push(match[1]);
  }
  // Reset lastIndex since we use the global flag
  HUB_URL_PATTERN.lastIndex = 0;
  return ids;
}

function extractUrls(text) {
  const urls = [];
  let match;
  while ((match = HUB_URL_PATTERN.exec(text)) !== null) {
    urls.push({ url: match[0], gameId: match[1] });
  }
  HUB_URL_PATTERN.lastIndex = 0;
  return urls;
}

module.exports = { extractGameIds, extractUrls };
