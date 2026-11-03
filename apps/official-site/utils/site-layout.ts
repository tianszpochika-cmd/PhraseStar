const informationPaths = new Set([
  "/help", "/about", "/announcements", "/status",
  "/privacy", "/terms", "/minors", "/compliance",
]);

export function isInformationPage(path: string): boolean {
  return informationPaths.has(path);
}
