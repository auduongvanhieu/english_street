import 'dart:collection';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import 'config.dart';
import 'native_bridge.dart';
import 'notebook_page.dart';
import 'settings_page.dart';

/// The game itself: a full-screen WebView of the web client with the native bridge attached,
/// plus a small overflow menu for the native screens (Notebook, Settings).
class GamePage extends StatefulWidget {
  const GamePage({super.key});

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> with WidgetsBindingObserver {
  late final NativeBridge _bridge = NativeBridge(defaultTargetPlatformName);
  InAppWebViewController? _controller;
  String _gameUrl = AppConfig.defaultGameUrl;
  bool _loading = true;
  bool _offline = false;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bridge.init();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('gameUrl');
    final awake = prefs.getBool('keepAwake') ?? true;
    if (awake) WakelockPlus.enable();
    if (url != null && url.isNotEmpty && mounted) setState(() => _gameUrl = url);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _bridge.dispose();
    WakelockPlus.disable();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Pause the game loop when the app is backgrounded (saves battery; the socket reconnects on resume).
    if (state == AppLifecycleState.paused) _controller?.pauseTimers();
    if (state == AppLifecycleState.resumed) _controller?.resumeTimers();
  }

  /// Session of the signed-in / guest player, read from the page (window.__esSession).
  Future<Map<String, dynamic>?> _session() async {
    final raw = await _controller?.evaluateJavascript(source: 'JSON.stringify(window.__esSession ? window.__esSession() : null)');
    if (raw == null || raw == 'null') return null;
    return jsonDecode(raw is String ? raw : raw.toString()) as Map<String, dynamic>;
  }

  Future<void> _openNotebook() async {
    final s = await _session();
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotebookPage(session: s, gameUrl: _gameUrl)));
  }

  Future<void> _openSettings() async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsPage()));
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('gameUrl') ?? AppConfig.defaultGameUrl;
    if (url != _gameUrl && mounted) {
      setState(() => _gameUrl = url);
      _controller?.loadUrl(urlRequest: URLRequest(url: WebUri(url)));
    }
    if (prefs.getBool('keepAwake') ?? true) {
      WakelockPlus.enable();
    } else {
      WakelockPlus.disable();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        // Android back: let the page close its own panels first (Escape), never leave the game by accident.
        await _controller?.evaluateJavascript(source: "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFBAE6FD),
        body: SafeArea(
          top: false,
          bottom: false,
          child: Stack(
            children: [
              InAppWebView(
                initialUrlRequest: URLRequest(url: WebUri(_gameUrl)),
                initialUserScripts: UnmodifiableListView([NativeBridge.bootScript]),
                initialSettings: InAppWebViewSettings(
                  mediaPlaybackRequiresUserGesture: false,
                  allowsInlineMediaPlayback: true,
                  javaScriptEnabled: true,
                  domStorageEnabled: true,
                  transparentBackground: true,
                  supportZoom: false,
                  useHybridComposition: true,
                  allowsBackForwardNavigationGestures: false,
                  iframeAllow: 'microphone; camera',
                  iframeAllowFullscreen: true,
                  userAgent: 'EnglishStreetApp/${AppConfig.appVersion}',
                  applicationNameForUserAgent: 'EnglishStreetApp/${AppConfig.appVersion}',
                ),
                onWebViewCreated: (c) {
                  _controller = c;
                  _bridge.attach(c);
                },
                onLoadStart: (_, _) => setState(() {
                  _loading = true;
                  _offline = false;
                }),
                onLoadStop: (_, _) => setState(() => _loading = false),
                onProgressChanged: (_, p) => setState(() => _progress = p / 100),
                onReceivedError: (_, req, err) {
                  if (req.isForMainFrame ?? true) setState(() => _offline = true);
                },
                // WebRTC voice chat inside the page needs the microphone; grant it once the OS permission exists.
                onPermissionRequest: (_, req) async {
                  final mic = await Permission.microphone.request();
                  return PermissionResponse(resources: req.resources, action: mic.isGranted ? PermissionResponseAction.GRANT : PermissionResponseAction.DENY);
                },
                shouldOverrideUrlLoading: (_, action) async {
                  // Keep the game in the WebView; anything else (privacy policy, links in chat) opens outside.
                  final url = action.request.url;
                  if (url == null) return NavigationActionPolicy.ALLOW;
                  final game = Uri.parse(_gameUrl);
                  if (url.host == game.host) return NavigationActionPolicy.ALLOW;
                  return NavigationActionPolicy.CANCEL;
                },
              ),
              if (_loading && !_offline)
                Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(value: _progress < 1 ? _progress : null, minHeight: 3)),
              if (_offline) _OfflineView(onRetry: () => _controller?.reload(), onNotebook: _openNotebook),
              Positioned(
                top: MediaQuery.of(context).padding.top + 4,
                left: 4,
                child: _MenuButton(onNotebook: _openNotebook, onSettings: _openSettings),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuButton extends StatelessWidget {
  const _MenuButton({required this.onNotebook, required this.onSettings});
  final VoidCallback onNotebook;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'App menu',
      icon: const Icon(Icons.more_vert, color: Colors.white, shadows: [Shadow(blurRadius: 6, color: Colors.black54)]),
      onSelected: (v) {
        if (v == 'notebook') onNotebook();
        if (v == 'settings') onSettings();
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'notebook', child: ListTile(leading: Icon(Icons.menu_book), title: Text('Notebook (offline)'))),
        PopupMenuItem(value: 'settings', child: ListTile(leading: Icon(Icons.settings), title: Text('App settings'))),
      ],
    );
  }
}

class _OfflineView extends StatelessWidget {
  const _OfflineView({required this.onRetry, required this.onNotebook});
  final VoidCallback onRetry;
  final VoidCallback onNotebook;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFBAE6FD),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🏙️', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 12),
          Text('English Street needs an internet connection', style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          const Text('You can still review your notebook while offline.', textAlign: TextAlign.center),
          const SizedBox(height: 20),
          FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: onNotebook, icon: const Icon(Icons.menu_book), label: const Text('Open notebook')),
        ],
      ),
    );
  }
}
