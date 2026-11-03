import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'config.dart';

/// Native app settings (the in-game ⚙️ sheet handles subtitles, voice and graphics).
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _keepAwake = true;
  String _gameUrl = AppConfig.defaultGameUrl;
  String _version = AppConfig.appVersion;
  final _urlCtl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final info = await PackageInfo.fromPlatform();
    setState(() {
      _keepAwake = prefs.getBool('keepAwake') ?? true;
      _gameUrl = prefs.getString('gameUrl') ?? AppConfig.defaultGameUrl;
      _urlCtl.text = _gameUrl;
      _version = '${info.version}+${info.buildNumber}';
    });
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('keepAwake', _keepAwake);
    final url = _urlCtl.text.trim();
    if (url.startsWith('https://') || url.startsWith('http://')) await prefs.setString('gameUrl', url);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('⚙️ App settings')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Keep the screen awake'),
            subtitle: const Text('While the street is open'),
            value: _keepAwake,
            onChanged: (v) {
              setState(() => _keepAwake = v);
              _save();
            },
          ),
          const Divider(),
          ListTile(
            title: const Text('Game server'),
            subtitle: TextField(
              controller: _urlCtl,
              decoration: const InputDecoration(hintText: AppConfig.defaultGameUrl),
              keyboardType: TextInputType.url,
              onSubmitted: (_) => _save(),
            ),
            trailing: TextButton(
              onPressed: () {
                _urlCtl.text = AppConfig.defaultGameUrl;
                _save();
              },
              child: const Text('Reset'),
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacy policy'),
            onTap: () => launchUrl(Uri.parse(AppConfig.privacyUrl), mode: LaunchMode.externalApplication),
          ),
          ListTile(leading: const Icon(Icons.info_outline), title: const Text('Version'), subtitle: Text(_version)),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Subtitles, IPA, voice and graphics options live inside the game: tap ⚙️ on the street.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        ],
      ),
    );
  }
}
