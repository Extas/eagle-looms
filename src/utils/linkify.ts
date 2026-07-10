export function linkify(text: string): string {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  let ret = "";
  let lastIndex = 0;

  for (const match of text.matchAll(urlRegex)) {
    const url = match[0];
    const index = match.index ?? 0;
    const escapedUrl = escapeHtml(url);
    ret += escapeHtml(text.slice(lastIndex, index));
    ret += `<a target="_blank" href="${escapedUrl}">${escapedUrl}</a>`;
    lastIndex = index + url.length;
  }

  return ret + escapeHtml(text.slice(lastIndex));
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}
