/// Where the game lives. The app is a shell around the web client; everything game-related is served
/// from here (bundle, API under /api, WebSocket under /ws).
class AppConfig {
  static const String defaultGameUrl = String.fromEnvironment('ES_GAME_URL', defaultValue: 'https://englishstreet.coffeesos.online/');
  static const String privacyUrl = 'https://englishstreet.coffeesos.online/privacy.html';
  static const String appVersion = '0.1.0';
}
