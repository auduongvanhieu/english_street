package online.coffeesos.english_street

import android.net.ConnectivityManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // es/net "radio": estimated bandwidth of the active network for the admin stats. The exact 4G/5G type
        // needs READ_PHONE_STATE, which the app does not ask for.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "es/net").setMethodCallHandler { call, result ->
            if (call.method == "radio") {
                val out = HashMap<String, Any?>()
                try {
                    val cm = getSystemService(ConnectivityManager::class.java)
                    val caps = cm?.getNetworkCapabilities(cm.activeNetwork)
                    out["downlinkKbps"] = caps?.linkDownstreamBandwidthKbps
                } catch (_: Exception) {
                }
                result.success(out)
            } else {
                result.notImplemented()
            }
        }
    }
}
