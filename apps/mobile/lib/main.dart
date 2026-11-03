import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_page.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const EnglishStreetApp());
}

class EnglishStreetApp extends StatelessWidget {
  const EnglishStreetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'English Street',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: const Color(0xFF2563EB), useMaterial3: true),
      darkTheme: ThemeData(colorSchemeSeed: const Color(0xFF2563EB), brightness: Brightness.dark, useMaterial3: true),
      home: const GamePage(),
    );
  }
}
