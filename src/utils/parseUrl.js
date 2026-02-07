// Matches hub.quakeworld.nu URLs and extracts the game ID
// Supports:
//   /game/{id}
//   /qtv/{id}
//   /games/?gameId={id}
//   /games?gameId={id}
const HUB_URL_PATTERN = /hub\.quakeworld\.nu\/(?:(?:game|qtv)\/(\d+)|games\/?\?[^\s]*?gameId=(\d+))/g;

function extractUrls(text) {
  const urls = [];
  let match;
  while ((match = HUB_URL_PATTERN.exec(text)) !== null) {
    const gameId = match[1] || match[2];
    urls.push({ url: match[0], gameId });
  }
  HUB_URL_PATTERN.lastIndex = 0;
  return urls;
}

module.exports = { extractUrls };
