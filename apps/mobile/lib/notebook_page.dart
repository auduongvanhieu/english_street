import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Vocabulary notebook that works offline: the last list fetched from /me/vocab is cached on the device.
class NotebookPage extends StatefulWidget {
  const NotebookPage({super.key, required this.session, required this.gameUrl});

  /// {playerId, token, apiUrl, name} from the page, or null when the page has not loaded.
  final Map<String, dynamic>? session;
  final String gameUrl;

  @override
  State<NotebookPage> createState() => _NotebookPageState();
}

class _VocabEntry {
  _VocabEntry({required this.word, required this.meaningVi, required this.example, required this.due});
  final String word;
  final String meaningVi;
  final String example;
  final bool due;

  factory _VocabEntry.fromJson(Map<String, dynamic> j) => _VocabEntry(
        word: j['word']?.toString() ?? '',
        meaningVi: j['meaningVi']?.toString() ?? '',
        example: j['example']?.toString() ?? '',
        due: j['due'] == true,
      );
  Map<String, dynamic> toJson() => {'word': word, 'meaningVi': meaningVi, 'example': example, 'due': due};
}

class _NotebookPageState extends State<NotebookPage> {
  List<_VocabEntry> _items = [];
  bool _fromCache = false;
  bool _busy = true;
  String? _error;
  int _flipped = -1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString('vocab');
    if (cached != null) {
      _items = (jsonDecode(cached) as List).map((e) => _VocabEntry.fromJson(e as Map<String, dynamic>)).toList();
      _fromCache = true;
    }
    if (mounted) setState(() {});
    final s = widget.session;
    if (s == null) {
      setState(() {
        _busy = false;
        _error = _items.isEmpty ? 'Open the game once to sync your notebook.' : null;
      });
      return;
    }
    try {
      final api = (s['apiUrl'] ?? '${widget.gameUrl.replaceAll(RegExp(r'/$'), '')}/api').toString();
      final uri = Uri.parse('$api/me/vocab?playerId=${Uri.encodeComponent(s['playerId'].toString())}');
      final token = s['token']?.toString();
      final res = await http.get(uri, headers: {if (token != null && token.isNotEmpty) 'authorization': 'Bearer $token'}).timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
      final list = (jsonDecode(res.body) as List).map((e) => _VocabEntry.fromJson(e as Map<String, dynamic>)).toList();
      await prefs.setString('vocab', jsonEncode(list.map((e) => e.toJson()).toList()));
      setState(() {
        _items = list;
        _fromCache = false;
        _busy = false;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _busy = false;
        _error = _items.isEmpty ? 'Could not load the notebook ($e).' : null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final due = _items.where((e) => e.due).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('📓 Notebook'),
        actions: [IconButton(onPressed: _busy ? null : _load, icon: const Icon(Icons.refresh), tooltip: 'Sync')],
      ),
      body: _busy && _items.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
              : ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    if (_fromCache)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 8),
                        child: Text('Showing your last synced notebook (offline).', style: TextStyle(color: Colors.grey)),
                      ),
                    Text('${_items.length} words · $due due for review', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 8),
                    for (var i = 0; i < _items.length; i++) _card(i, _items[i]),
                  ],
                ),
    );
  }

  Widget _card(int i, _VocabEntry e) {
    final open = _flipped == i;
    return Card(
      child: InkWell(
        onTap: () => setState(() => _flipped = open ? -1 : i),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(e.word, style: Theme.of(context).textTheme.titleMedium)),
                  if (e.due) const Chip(label: Text('due'), visualDensity: VisualDensity.compact),
                ],
              ),
              if (open) ...[
                const SizedBox(height: 6),
                Text(e.meaningVi, style: const TextStyle(color: Color(0xFF1E3A8A))),
                if (e.example.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(e.example, style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.grey))),
              ] else
                const Padding(padding: EdgeInsets.only(top: 4), child: Text('Tap to see the meaning', style: TextStyle(color: Colors.grey, fontSize: 12))),
            ],
          ),
        ),
      ),
    );
  }
}
