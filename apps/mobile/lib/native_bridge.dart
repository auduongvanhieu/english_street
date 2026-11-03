import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Native capabilities exposed to the web game (see apps/web/src/native/bridge.ts).
///
/// Web → native: `window.flutter_inappwebview.callHandler('stt.start', {lang})` etc.
/// Native → web: `window.__esNativeEvent('{"type":"stt.final","text":"..."}')`.
class NativeBridge {
  NativeBridge(this.platform);

  final String platform;
  InAppWebViewController? _controller;
  final stt.SpeechToText _speech = stt.SpeechToText();
  final FlutterTts _tts = FlutterTts();
  bool _speechReady = false;
  bool _listening = false;
  int _ttsId = 0;

  /// JavaScript run before any page script: tells the web client it is inside the app.
  static final UserScript bootScript = UserScript(
    source: "window.esNative = { platform: '${_platformName()}', version: '0.1.0', stt: true, tts: true };",
    injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
  );

  static String _platformName() => defaultTargetPlatformName;

  Future<void> init() async {
    await _tts.awaitSpeakCompletion(true);
    _tts.setStartHandler(() => emit({'type': 'tts.start', 'id': _ttsId}));
    _tts.setCompletionHandler(() => emit({'type': 'tts.end', 'id': _ttsId}));
    _tts.setCancelHandler(() => emit({'type': 'tts.end', 'id': _ttsId}));
    _tts.setErrorHandler((_) => emit({'type': 'tts.end', 'id': _ttsId}));
  }

  void attach(InAppWebViewController controller) {
    _controller = controller;
    controller.addJavaScriptHandler(handlerName: 'stt.start', callback: (args) => _sttStart(_arg(args, 'lang') ?? 'en-US'));
    controller.addJavaScriptHandler(handlerName: 'stt.stop', callback: (_) => _sttStop());
    controller.addJavaScriptHandler(handlerName: 'stt.abort', callback: (_) => _sttAbort());
    controller.addJavaScriptHandler(
      handlerName: 'tts.speak',
      callback: (args) => _ttsSpeak(
        id: (_num(args, 'id') ?? 0).toInt(),
        text: _arg(args, 'text') ?? '',
        lang: _arg(args, 'lang') ?? 'en-US',
        rate: (_num(args, 'rate') ?? 0.95).toDouble(),
      ),
    );
    controller.addJavaScriptHandler(handlerName: 'tts.stop', callback: (_) => _tts.stop());
    controller.addJavaScriptHandler(handlerName: 'haptic', callback: (args) {
      final kind = _arg(args, 'kind');
      return kind == 'medium' ? HapticFeedback.mediumImpact() : HapticFeedback.lightImpact();
    });
  }

  /// Push a JSON event into the page.
  void emit(Map<String, Object?> event) {
    final json = jsonEncode(jsonEncode(event)); // double-encode: a JS string literal containing JSON
    _controller?.evaluateJavascript(source: 'window.__esNativeEvent && window.__esNativeEvent($json);');
  }

  // ---------------------------------------------------------------- speech to text
  Future<bool> _sttStart(String lang) async {
    if (_listening) return true;
    if (!await Permission.microphone.request().isGranted) return false;
    if (!_speechReady) {
      _speechReady = await _speech.initialize(
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            if (_listening) {
              _listening = false;
              emit({'type': 'stt.end'});
            }
          }
        },
        onError: (e) {
          emit({'type': 'stt.error', 'code': e.errorMsg});
        },
      );
    }
    if (!_speechReady) return false;
    _listening = true;
    await _speech.listen(
      listenOptions: stt.SpeechListenOptions(localeId: lang.replaceAll('-', '_'), partialResults: true, listenMode: stt.ListenMode.dictation, cancelOnError: true),
      onResult: (r) => emit({'type': r.finalResult ? 'stt.final' : 'stt.interim', 'text': r.recognizedWords}),
    );
    return true;
  }

  Future<void> _sttStop() async {
    await _speech.stop();
  }

  Future<void> _sttAbort() async {
    _listening = false;
    await _speech.cancel();
  }

  // ---------------------------------------------------------------- text to speech
  Future<void> _ttsSpeak({required int id, required String text, required String lang, required double rate}) async {
    _ttsId = id;
    await _tts.stop();
    await _tts.setLanguage(lang);
    // flutter_tts rates are platform-scaled; 0.5 ≈ normal on both platforms.
    await _tts.setSpeechRate((rate * 0.5).clamp(0.2, 1.0));
    await _tts.setPitch(1.0);
    await _tts.speak(text);
  }

  Future<void> dispose() async {
    await _speech.cancel();
    await _tts.stop();
  }

  static String? _arg(List<dynamic> args, String key) {
    if (args.isEmpty || args.first is! Map) return null;
    final v = (args.first as Map)[key];
    return v?.toString();
  }

  static num? _num(List<dynamic> args, String key) {
    if (args.isEmpty || args.first is! Map) return null;
    final v = (args.first as Map)[key];
    return v is num ? v : num.tryParse(v?.toString() ?? '');
  }
}

String get defaultTargetPlatformName {
  switch (defaultTargetPlatform) {
    case TargetPlatform.iOS:
      return 'ios';
    case TargetPlatform.android:
      return 'android';
    default:
      return 'other';
  }
}
